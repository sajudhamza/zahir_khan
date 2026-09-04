/**
 * Chef Zahir Khan CMS API — single Lambda behind a Function URL.
 *
 * Same architecture as the Shaila Rizvi studio CMS: the browser asks for a
 * presigned URL, PUTs the file straight to S3 (so Lambda's 6 MB request limit
 * never applies), then saves the metadata here. Two collections live in the
 * bucket:
 *
 *   data/projects.json  — restaurants/kitchens (name, description, photos)
 *   data/recipes.json   — dishes (name, ingredients, directions, photos+videos)
 *   media/projects/{slug}/…  and  media/recipes/{slug}/…
 *
 * The Vite plugin in server/recipeAdmin.js implements the same routes for
 * local dev, so the admin UI has exactly one code path.
 *
 * Env: BUCKET, PUBLIC_MEDIA_BASE, ZAHIR_ADMIN_PASSWORD, ADMIN_TOKEN_SECRET
 */
import crypto from 'node:crypto'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.BUCKET
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 300 * 1024 * 1024

const SCOPES = {
  projects: { dataKey: 'data/projects.json', label: 'Project' },
  recipes: { dataKey: 'data/recipes.json', label: 'Recipe' },
}

const s3 = new S3Client({})

/** Public https:// prefix the site uses to load media, no trailing slash. */
function mediaBase() {
  const base = process.env.PUBLIC_MEDIA_BASE || `https://${BUCKET}.s3.amazonaws.com`
  return base.replace(/\/+$/, '')
}

function adminPassword() {
  return process.env.ZAHIR_ADMIN_PASSWORD || ''
}

function tokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || adminPassword() || 'zahir-dev-secret'
}

/* ---------------------------------------------------------------- helpers */

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

function scopeFrom(value) {
  return value === 'recipes' ? 'recipes' : 'projects'
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || `item-${Date.now()}`
  )
}

function uniqueSlug(base, items) {
  let slug = base
  let n = 2
  while (items.some((p) => p.slug === slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

function extensionFromMime(mime = '', fallback = '.jpg') {
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('quicktime')) return '.mov'
  if (mime.includes('webm')) return '.webm'
  if (mime.includes('x-m4v')) return '.m4v'
  if (mime.includes('mp4')) return '.mp4'
  return fallback
}

/** Strip anything path-ish from a client-supplied filename. */
function safeName(filename, contentType) {
  const base = String(filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const fallback = contentType.startsWith('video/') ? '.mp4' : '.jpg'
  return `${base || 'file'}${extensionFromMime(contentType, fallback)}`
}

function lines(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean)
  }
  return String(input || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Accepts ['https://…'] or [{ url }] and keeps only real media URLs. */
function normalizeUrls(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => (typeof item === 'string' ? item : item?.url || item?.image || ''))
    .map(String)
    .filter((url) => /^https?:\/\//.test(url) || url.startsWith('/'))
}

/* ------------------------------------------------------------------ auth */

/** Stateless HMAC token — Lambda instances don't share an in-memory Map. */
function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url')
  const sig = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.')
  if (!payload || !sig) return false
  const expected = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

function isAuthed(event, body = {}) {
  const headers = event.headers || {}
  const raw = headers.authorization || headers.Authorization || ''
  const bearer = raw.startsWith('Bearer ') ? raw.slice(7) : ''
  return verifyToken(bearer || body.token || '')
}

/* -------------------------------------------------------------- s3 store */

async function readItems(scope) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: SCOPES[scope].dataKey }))
    const parsed = JSON.parse(await res.Body.transformToString())
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return []
    throw err
  }
}

async function writeItems(scope, items) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: SCOPES[scope].dataKey,
      Body: `${JSON.stringify(items, null, 2)}\n`,
      ContentType: 'application/json',
      CacheControl: 'no-cache, max-age=0, must-revalidate',
    }),
  )
}

/** Map a public media URL back to its S3 key, or null if it isn't ours. */
function keyForUrl(url) {
  const str = String(url || '')
  const prefix = `${mediaBase()}/`
  if (!str.startsWith(prefix)) return null
  const key = decodeURIComponent(str.slice(prefix.length).split('?')[0])
  return key.startsWith('media/') ? key : null
}

async function deleteUrls(urls) {
  const keys = urls.map(keyForUrl).filter(Boolean).map((Key) => ({ Key }))
  if (!keys.length) return
  await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }))
}

async function deleteItemMedia(scope, slug) {
  let token
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `media/${scope}/${slug}/`,
        ContinuationToken: token,
      }),
    )
    const objects = (listed.Contents || []).map((o) => ({ Key: o.Key }))
    if (objects.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } }))
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (token)
}

/* ------------------------------------------------------------- decorate */

function decorateProject(project) {
  const slug = project.slug || project.id
  return {
    ...project,
    slug,
    images: Array.isArray(project.images) ? project.images : [],
  }
}

function decorateRecipe(recipe) {
  const slug = recipe.slug || recipe.id
  return {
    ...recipe,
    slug,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    images: Array.isArray(recipe.images) ? recipe.images : [],
    videos: Array.isArray(recipe.videos) ? recipe.videos : [],
  }
}

/* ---------------------------------------------------------------- routes */

async function handleLogin(body) {
  const password = adminPassword()
  if (!password) return json(500, { error: 'Admin password is not configured' })
  const given = String(body.password || '')
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(password).digest()
  if (!crypto.timingSafeEqual(a, b)) return json(401, { error: 'Incorrect password' })
  return json(200, { ok: true, token: issueToken() })
}

async function handleGetProjects() {
  const projects = (await readItems('projects')).map(decorateProject)
  return json(200, { projects })
}

async function handleGetRecipes() {
  const recipes = (await readItems('recipes')).map(decorateRecipe)
  return json(200, { recipes })
}

/** Reserve the slug up front so uploads can be filed under it. */
async function handleSlug(event, body) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })
  const scope = scopeFrom(body.scope)
  const name = String(body.name || '').trim()
  if (!name) return json(400, { error: `${SCOPES[scope].label} name is required` })
  const items = await readItems(scope)
  return json(200, { slug: uniqueSlug(slugify(name), items) })
}

async function handleUploadUrl(event, body) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const scope = scopeFrom(body.scope)
  const slug = slugify(body.slug || '')
  const contentType = String(body.contentType || 'image/jpeg')
  const size = Number(body.size || 0)
  const isImage = contentType.startsWith('image/')
  const isVideo = contentType.startsWith('video/')

  if (!slug) return json(400, { error: 'Missing slug' })
  if (!isImage && !isVideo) return json(400, { error: 'Only image or video uploads are allowed' })
  if (isVideo && scope !== 'recipes') {
    return json(400, { error: 'Videos are only supported on recipes' })
  }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (size > max) {
    return json(413, { error: `File is larger than ${Math.round(max / 1024 / 1024)} MB` })
  }

  const name = safeName(body.filename, contentType)
  const ext = name.slice(name.lastIndexOf('.'))
  if (isImage && !IMAGE_EXT.has(ext)) return json(400, { error: 'Unsupported image type' })
  if (isVideo && !VIDEO_EXT.has(ext)) return json(400, { error: 'Unsupported video type' })

  const key = `media/${scope}/${slug}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${name}`
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    { expiresIn: 3600 },
  )

  return json(200, {
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    publicUrl: `${mediaBase()}/${key}`,
  })
}

/* ------------------------------------------------------------- projects */

async function handleCreateProject(event, body) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  if (!name) return json(400, { error: 'Project name is required' })
  if (!description) return json(400, { error: 'Description is required' })

  const projects = await readItems('projects')
  const requested = slugify(body.slug || name)
  const slug = projects.some((p) => p.slug === requested) ? uniqueSlug(requested, projects) : requested

  const project = decorateProject({
    id: crypto.randomBytes(8).toString('hex'),
    slug,
    name,
    role: String(body.role || '').trim(),
    location: String(body.location || '').trim(),
    website: String(body.website || '').trim(),
    summary:
      String(body.summary || '').trim() ||
      description.split(/(?<=\.)\s+/)[0] ||
      description.slice(0, 140),
    description,
    images: normalizeUrls(body.images),
    createdAt: new Date().toISOString(),
  })

  projects.unshift(project)
  await writeItems('projects', projects)
  return json(201, { ok: true, project })
}

async function handleUpdateProject(event, body, slug) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const projects = await readItems('projects')
  const index = projects.findIndex((p) => p.slug === slug)
  if (index === -1) return json(404, { error: 'Project not found' })

  const current = decorateProject(projects[index])
  const name = String(body.name ?? current.name ?? '').trim()
  const description = String(body.description ?? current.description ?? '').trim()
  if (!name) return json(400, { error: 'Project name is required' })
  if (!description) return json(400, { error: 'Description is required' })

  const removeImages = new Set(normalizeUrls(body.removeImages).map(String))
  const keptImages = current.images.filter((src) => !removeImages.has(String(src)))

  projects[index] = decorateProject({
    ...current,
    name,
    role: String(body.role ?? current.role ?? '').trim(),
    location: String(body.location ?? current.location ?? '').trim(),
    website: String(body.website ?? current.website ?? '').trim(),
    summary:
      String(body.summary ?? current.summary ?? '').trim() ||
      description.split(/(?<=\.)\s+/)[0] ||
      description.slice(0, 140),
    description,
    images: keptImages.concat(normalizeUrls(body.images)),
    updatedAt: new Date().toISOString(),
  })

  await writeItems('projects', projects)
  await deleteUrls([...removeImages])
  return json(200, { ok: true, project: projects[index] })
}

async function handleDeleteProject(event, body, slug) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const projects = await readItems('projects')
  const next = projects.filter((p) => p.slug !== slug)
  if (next.length === projects.length) return json(404, { error: 'Project not found' })

  await writeItems('projects', next)
  await deleteItemMedia('projects', slug)
  return json(200, { ok: true, slug })
}

/* -------------------------------------------------------------- recipes */

async function handleCreateRecipe(event, body) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const name = String(body.name || '').trim()
  const ingredients = lines(body.ingredients)
  const steps = lines(body.steps ?? body.directions)
  if (!name) return json(400, { error: 'Dish name is required' })
  if (!ingredients.length) return json(400, { error: 'At least one ingredient is required' })
  if (!steps.length) return json(400, { error: 'At least one direction is required' })

  const recipes = await readItems('recipes')
  const requested = slugify(body.slug || name)
  const slug = recipes.some((r) => r.slug === requested) ? uniqueSlug(requested, recipes) : requested

  const recipe = decorateRecipe({
    id: crypto.randomBytes(8).toString('hex'),
    slug,
    name,
    ingredients,
    steps,
    images: normalizeUrls(body.images),
    videos: normalizeUrls(body.videos),
    createdAt: new Date().toISOString(),
  })

  recipes.unshift(recipe)
  await writeItems('recipes', recipes)
  return json(201, { ok: true, recipe })
}

async function handleUpdateRecipe(event, body, slug) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const recipes = await readItems('recipes')
  const index = recipes.findIndex((r) => r.slug === slug)
  if (index === -1) return json(404, { error: 'Recipe not found' })

  const current = decorateRecipe(recipes[index])
  const name = String(body.name ?? current.name ?? '').trim()
  const ingredients = body.ingredients != null ? lines(body.ingredients) : current.ingredients
  const steps =
    body.steps != null || body.directions != null ? lines(body.steps ?? body.directions) : current.steps
  if (!name) return json(400, { error: 'Dish name is required' })
  if (!ingredients.length) return json(400, { error: 'At least one ingredient is required' })
  if (!steps.length) return json(400, { error: 'At least one direction is required' })

  const removeImages = new Set(normalizeUrls(body.removeImages).map(String))
  const removeVideos = new Set(normalizeUrls(body.removeVideos).map(String))

  recipes[index] = decorateRecipe({
    ...current,
    name,
    ingredients,
    steps,
    images: current.images.filter((src) => !removeImages.has(String(src))).concat(normalizeUrls(body.images)),
    videos: current.videos.filter((src) => !removeVideos.has(String(src))).concat(normalizeUrls(body.videos)),
    updatedAt: new Date().toISOString(),
  })

  await writeItems('recipes', recipes)
  await deleteUrls([...removeImages, ...removeVideos])
  return json(200, { ok: true, recipe: recipes[index] })
}

async function handleDeleteRecipe(event, body, slug) {
  if (!isAuthed(event, body)) return json(401, { error: 'Unauthorized. Please log in again.' })

  const recipes = await readItems('recipes')
  const next = recipes.filter((r) => r.slug !== slug)
  if (next.length === recipes.length) return json(404, { error: 'Recipe not found' })

  await writeItems('recipes', next)
  await deleteItemMedia('recipes', slug)
  return json(200, { ok: true, slug })
}

/* --------------------------------------------------------------- handler */

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || 'GET'
  // Works whether the Function URL is called directly or proxied under /api.
  const path = (event?.rawPath || '/').replace(/\/+$/, '') || '/'

  if (method === 'OPTIONS') return { statusCode: 204, body: '' }

  let body = {}
  if (event.body) {
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return json(400, { error: 'Invalid request body' })
    }
  }

  try {
    if (path === '/api/projects' && method === 'GET') return await handleGetProjects()
    if (path === '/api/recipes' && method === 'GET') return await handleGetRecipes()
    if (path === '/api/admin/login' && method === 'POST') return await handleLogin(body)
    if (path === '/api/admin/logout' && method === 'POST') return json(200, { ok: true })
    if (path === '/api/admin/slug' && method === 'POST') return await handleSlug(event, body)
    if (path === '/api/admin/upload-url' && method === 'POST') return await handleUploadUrl(event, body)
    if (path === '/api/admin/projects' && method === 'POST') return await handleCreateProject(event, body)
    if (path === '/api/admin/recipes' && method === 'POST') return await handleCreateRecipe(event, body)

    const projectMatch = path.match(/^\/api\/admin\/projects\/([^/]+)$/)
    if (projectMatch) {
      const slug = decodeURIComponent(projectMatch[1])
      if (method === 'PUT' || method === 'PATCH') return await handleUpdateProject(event, body, slug)
      if (method === 'DELETE') return await handleDeleteProject(event, body, slug)
    }

    const recipeMatch = path.match(/^\/api\/admin\/recipes\/([^/]+)$/)
    if (recipeMatch) {
      const slug = decodeURIComponent(recipeMatch[1])
      if (method === 'PUT' || method === 'PATCH') return await handleUpdateRecipe(event, body, slug)
      if (method === 'DELETE') return await handleDeleteRecipe(event, body, slug)
    }

    return json(404, { error: 'Not found' })
  } catch (err) {
    console.error('[zahir-cms]', err)
    return json(500, { error: 'Server error' })
  }
}
