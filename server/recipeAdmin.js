import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * Dev twin of infra/lambda/index.mjs — same routes, same JSON shapes, but
 * everything lands in public/ instead of S3. The admin UI reserves a slug,
 * PUTs each photo/video to the URL it's handed, then saves the metadata; in
 * production those URLs are presigned S3, here they hit /api/admin/upload-blob.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RECIPES_DIR = path.join(ROOT, 'public', 'recipes')
const RECIPES_MEDIA_DIR = path.join(RECIPES_DIR, 'media')
const RECIPES_FILE = path.join(RECIPES_DIR, 'recipes.json')
const PROJECTS_DIR = path.join(ROOT, 'public', 'projects')
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const tokens = new Map()

function getAdminPassword() {
  return process.env.ZAHIR_ADMIN_PASSWORD || 'ChefZahir2026!'
}

/* ---------------------------------------------------------------- helpers */

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function isAuthed(req, body = {}) {
  const header = req.headers.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const token = bearer || body.token || ''
  if (!token) return false
  const meta = tokens.get(token)
  if (!meta) return false
  if (Date.now() > meta.expiresAt) {
    tokens.delete(token)
    return false
  }
  return true
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
  while (items.some((r) => r.slug === slug)) {
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

function safeName(filename, contentType) {
  const base = String(filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const fallback = String(contentType || '').startsWith('video/') ? '.mp4' : '.jpg'
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

function normalizeUrls(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => (typeof item === 'string' ? item : item?.url || item?.image || ''))
    .map(String)
    .filter((url) => /^https?:\/\//.test(url) || url.startsWith('/'))
}

function safeUnlinkUnder(dir, filename) {
  const base = path.basename(String(filename || ''))
  if (!base || base === '.' || base === '..') return false
  const full = path.join(dir, base)
  if (!full.startsWith(dir)) return false
  if (!fs.existsSync(full)) return false
  fs.unlinkSync(full)
  return true
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return
  fs.rmSync(dir, { recursive: true, force: true })
}

/* -------------------------------------------------------------- storage */

function ensureRecipeDirs() {
  fs.mkdirSync(RECIPES_MEDIA_DIR, { recursive: true })
  if (!fs.existsSync(RECIPES_FILE)) fs.writeFileSync(RECIPES_FILE, '[]\n', 'utf8')
}

function readRecipes() {
  ensureRecipeDirs()
  try {
    const parsed = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecipes(recipes) {
  ensureRecipeDirs()
  fs.writeFileSync(RECIPES_FILE, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8')
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

function ensureProjectDirs() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  if (!fs.existsSync(PROJECTS_FILE)) fs.writeFileSync(PROJECTS_FILE, '[]\n', 'utf8')
}

function listFolderImages(folderName) {
  const dir = path.join(PROJECTS_DIR, folderName)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    return []
  }
  return fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `/projects/${folderName}/${name}`)
}

function readProjectsRaw() {
  ensureProjectDirs()
  try {
    const parsed = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeProjects(projects) {
  ensureProjectDirs()
  fs.writeFileSync(PROJECTS_FILE, `${JSON.stringify(projects, null, 2)}\n`, 'utf8')
}

/** Merge JSON metadata with images currently sitting in each project folder. */
export function syncProjectsFromDisk() {
  const projects = readProjectsRaw().map((project) => {
    const folder = project.folder || project.slug || project.id
    // Folder scan first (drop-photos workflow), then any remote URLs kept in JSON.
    const local = listFolderImages(folder)
    const remote = (Array.isArray(project.images) ? project.images : []).filter((src) =>
      /^https?:\/\//.test(String(src)),
    )
    return { ...project, folder, images: local.concat(remote) }
  })
  writeProjects(projects)
  return projects
}

/* ------------------------------------------------------------------ auth */

async function handleLogin(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!body.password || body.password !== getAdminPassword()) {
      return sendJson(res, 401, { error: 'Incorrect password' })
    }
    const token = crypto.randomBytes(24).toString('hex')
    tokens.set(token, { expiresAt: Date.now() + 1000 * 60 * 60 * 12 })
    return sendJson(res, 200, { ok: true, token })
  } catch {
    return sendJson(res, 400, { error: 'Invalid request' })
  }
}

async function handleLogout(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
    const token = bearer || body.token || ''
    if (token) tokens.delete(token)
    return sendJson(res, 200, { ok: true })
  } catch {
    return sendJson(res, 200, { ok: true })
  }
}

/* --------------------------------------------------------------- uploads */

async function handleSlug(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })
    const name = String(body.name || '').trim()
    if (!name) return sendJson(res, 400, { error: 'Name is required' })
    const items = body.scope === 'recipes' ? readRecipes() : readProjectsRaw()
    return sendJson(res, 200, { slug: uniqueSlug(slugify(name), items) })
  } catch {
    return sendJson(res, 400, { error: 'Invalid request' })
  }
}

async function handleUploadUrl(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const scope = body.scope === 'recipes' ? 'recipes' : 'projects'
    const slug = slugify(body.slug || '')
    const contentType = String(body.contentType || 'image/jpeg')
    const isImage = contentType.startsWith('image/')
    const isVideo = contentType.startsWith('video/')

    if (!slug) return sendJson(res, 400, { error: 'Missing slug' })
    if (!isImage && !isVideo) {
      return sendJson(res, 400, { error: 'Only image or video uploads are allowed' })
    }
    if (isVideo && scope !== 'recipes') {
      return sendJson(res, 400, { error: 'Videos are only supported on recipes' })
    }

    const name = safeName(body.filename, contentType)
    const file = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${name}`
    const publicUrl =
      scope === 'recipes' ? `/recipes/media/${slug}/${file}` : `/projects/${slug}/${file}`

    return sendJson(res, 200, {
      uploadUrl: `/api/admin/upload-blob?scope=${scope}&slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(file)}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      publicUrl,
    })
  } catch {
    return sendJson(res, 400, { error: 'Invalid request' })
  }
}

async function handleUploadBlob(req, res, query) {
  if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const scope = query.get('scope') === 'recipes' ? 'recipes' : 'projects'
    const slug = slugify(query.get('slug') || '')
    const file = path.basename(String(query.get('file') || ''))
    if (!slug || !file) return sendJson(res, 400, { error: 'Missing upload target' })

    const ext = path.extname(file).toLowerCase()
    if (!IMAGE_EXT.has(ext) && !(scope === 'recipes' && VIDEO_EXT.has(ext))) {
      return sendJson(res, 400, { error: 'Unsupported file type' })
    }

    const dir =
      scope === 'recipes' ? path.join(RECIPES_MEDIA_DIR, slug) : path.join(PROJECTS_DIR, slug)
    fs.mkdirSync(dir, { recursive: true })

    const buffer = await readRawBody(req)
    if (!buffer.length) return sendJson(res, 400, { error: 'Empty upload' })
    fs.writeFileSync(path.join(dir, file), buffer)
    return sendJson(res, 200, { ok: true })
  } catch (err) {
    console.error('[admin] upload', err)
    return sendJson(res, 500, { error: 'Could not save file' })
  }
}

/* -------------------------------------------------------------- projects */

async function handleGetProjects(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    return sendJson(res, 200, { projects: syncProjectsFromDisk() })
  } catch (err) {
    console.error('[admin] projects get', err)
    return sendJson(res, 500, { error: 'Could not load projects' })
  }
}

async function handleCreateProject(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const name = String(body.name || '').trim()
    const description = String(body.description || '').trim()
    if (!name) return sendJson(res, 400, { error: 'Project name is required' })
    if (!description) return sendJson(res, 400, { error: 'Description is required' })

    const projects = readProjectsRaw()
    // The client reserved this slug before uploading, so honour it when free.
    const requested = slugify(body.slug || name)
    const slug = projects.some((p) => p.slug === requested)
      ? uniqueSlug(slugify(name), projects)
      : requested

    const project = {
      id: crypto.randomBytes(8).toString('hex'),
      slug,
      name,
      role: String(body.role || '').trim(),
      location: String(body.location || '').trim(),
      website: String(body.website || '').trim(),
      folder: slug,
      summary:
        String(body.summary || '').trim() ||
        description.split(/(?<=\.)\s+/)[0] ||
        description.slice(0, 140),
      description,
      images: [],
      createdAt: new Date().toISOString(),
    }

    projects.unshift(project)
    writeProjects(projects)
    const synced = syncProjectsFromDisk()
    return sendJson(res, 201, { ok: true, project: synced.find((p) => p.slug === slug) })
  } catch (err) {
    console.error('[admin] project create', err)
    return sendJson(res, 500, { error: 'Could not save project' })
  }
}

async function handleUpdateProject(req, res, slug) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const projects = syncProjectsFromDisk()
    const index = projects.findIndex((p) => p.slug === slug || p.id === slug)
    if (index === -1) return sendJson(res, 404, { error: 'Project not found' })

    const current = projects[index]
    const folder = current.folder || current.slug
    const name = String(body.name ?? current.name ?? '').trim()
    const description = String(body.description ?? current.description ?? '').trim()
    if (!name) return sendJson(res, 400, { error: 'Project name is required' })
    if (!description) return sendJson(res, 400, { error: 'Description is required' })

    // New photos already landed via /api/admin/upload-blob; only removals left.
    const folderPath = path.join(PROJECTS_DIR, folder)
    normalizeUrls(body.removeImages).forEach((src) => {
      safeUnlinkUnder(folderPath, path.basename(String(src)))
    })

    projects[index] = {
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
      updatedAt: new Date().toISOString(),
    }
    writeProjects(projects)
    const synced = syncProjectsFromDisk()
    return sendJson(res, 200, { ok: true, project: synced.find((p) => p.slug === slug || p.id === slug) })
  } catch (err) {
    console.error('[admin] project update', err)
    return sendJson(res, 500, { error: 'Could not update project' })
  }
}

async function handleDeleteProject(req, res, slug) {
  if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req).catch(() => ({}))
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const projects = readProjectsRaw()
    const target = projects.find((p) => p.slug === slug || p.id === slug)
    if (!target) return sendJson(res, 404, { error: 'Project not found' })

    writeProjects(projects.filter((p) => p !== target))
    removeDirRecursive(path.join(PROJECTS_DIR, target.folder || target.slug || slug))
    return sendJson(res, 200, { ok: true, slug })
  } catch (err) {
    console.error('[admin] project delete', err)
    return sendJson(res, 500, { error: 'Could not delete project' })
  }
}

/* --------------------------------------------------------------- recipes */

async function handleGetRecipes(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    return sendJson(res, 200, { recipes: readRecipes().map(decorateRecipe) })
  } catch (err) {
    console.error('[admin] recipes get', err)
    return sendJson(res, 500, { error: 'Could not load recipes' })
  }
}

async function handleCreateRecipe(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const name = String(body.name || '').trim()
    const ingredients = lines(body.ingredients)
    const steps = lines(body.steps ?? body.directions)
    if (!name) return sendJson(res, 400, { error: 'Dish name is required' })
    if (!ingredients.length) return sendJson(res, 400, { error: 'At least one ingredient is required' })
    if (!steps.length) return sendJson(res, 400, { error: 'At least one direction is required' })

    const recipes = readRecipes()
    const requested = slugify(body.slug || name)
    const slug = recipes.some((r) => r.slug === requested)
      ? uniqueSlug(slugify(name), recipes)
      : requested

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
    writeRecipes(recipes)
    return sendJson(res, 201, { ok: true, recipe })
  } catch (err) {
    console.error('[admin] recipe create', err)
    return sendJson(res, 500, { error: 'Could not save recipe' })
  }
}

async function handleUpdateRecipe(req, res, slug) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const recipes = readRecipes()
    const index = recipes.findIndex((r) => r.slug === slug)
    if (index === -1) return sendJson(res, 404, { error: 'Recipe not found' })

    const current = decorateRecipe(recipes[index])
    const name = String(body.name ?? current.name ?? '').trim()
    const ingredients = body.ingredients != null ? lines(body.ingredients) : current.ingredients
    const steps =
      body.steps != null || body.directions != null
        ? lines(body.steps ?? body.directions)
        : current.steps
    if (!name) return sendJson(res, 400, { error: 'Dish name is required' })
    if (!ingredients.length) return sendJson(res, 400, { error: 'At least one ingredient is required' })
    if (!steps.length) return sendJson(res, 400, { error: 'At least one direction is required' })

    const removeImages = new Set(normalizeUrls(body.removeImages).map(String))
    const removeVideos = new Set(normalizeUrls(body.removeVideos).map(String))
    const mediaDir = path.join(RECIPES_MEDIA_DIR, slug)
    ;[...removeImages, ...removeVideos].forEach((src) => {
      safeUnlinkUnder(mediaDir, path.basename(String(src)))
    })

    recipes[index] = decorateRecipe({
      ...current,
      name,
      ingredients,
      steps,
      images: current.images
        .filter((src) => !removeImages.has(String(src)))
        .concat(normalizeUrls(body.images)),
      videos: current.videos
        .filter((src) => !removeVideos.has(String(src)))
        .concat(normalizeUrls(body.videos)),
      updatedAt: new Date().toISOString(),
    })

    writeRecipes(recipes)
    return sendJson(res, 200, { ok: true, recipe: recipes[index] })
  } catch (err) {
    console.error('[admin] recipe update', err)
    return sendJson(res, 500, { error: 'Could not update recipe' })
  }
}

async function handleDeleteRecipe(req, res, slug) {
  if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req).catch(() => ({}))
    if (!isAuthed(req, body)) return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })

    const recipes = readRecipes()
    const next = recipes.filter((r) => r.slug !== slug)
    if (next.length === recipes.length) return sendJson(res, 404, { error: 'Recipe not found' })

    writeRecipes(next)
    removeDirRecursive(path.join(RECIPES_MEDIA_DIR, slug))
    return sendJson(res, 200, { ok: true, slug })
  } catch (err) {
    console.error('[admin] recipe delete', err)
    return sendJson(res, 500, { error: 'Could not delete recipe' })
  }
}

/**
 * Vite plugin: admin login + projects + recipes (writes into public/)
 */
export function recipeAdminPlugin() {
  const mount = (middlewares) => {
    middlewares.use(async (req, res, next) => {
      const rawUrl = req.url || '/'
      const url = rawUrl.split('?')[0]

      if (url === '/api/admin/upload-blob') {
        return handleUploadBlob(req, res, new URLSearchParams(rawUrl.split('?')[1] || ''))
      }
      if (url === '/api/admin/login') return handleLogin(req, res)
      if (url === '/api/admin/logout') return handleLogout(req, res)
      if (url === '/api/admin/slug') return handleSlug(req, res)
      if (url === '/api/admin/upload-url') return handleUploadUrl(req, res)
      if (url === '/api/projects' && req.method === 'GET') return handleGetProjects(req, res)
      if (url === '/api/recipes' && req.method === 'GET') return handleGetRecipes(req, res)
      if (url === '/api/admin/projects' && req.method === 'POST') return handleCreateProject(req, res)
      if (url === '/api/admin/recipes' && req.method === 'POST') return handleCreateRecipe(req, res)

      const projectMatch = url.match(/^\/api\/admin\/projects\/([^/]+)$/)
      if (projectMatch) {
        const slug = decodeURIComponent(projectMatch[1])
        if (req.method === 'PUT' || req.method === 'PATCH') return handleUpdateProject(req, res, slug)
        if (req.method === 'DELETE') return handleDeleteProject(req, res, slug)
      }

      const recipeMatch = url.match(/^\/api\/admin\/recipes\/([^/]+)$/)
      if (recipeMatch) {
        const slug = decodeURIComponent(recipeMatch[1])
        if (req.method === 'PUT' || req.method === 'PATCH') return handleUpdateRecipe(req, res, slug)
        if (req.method === 'DELETE') return handleDeleteRecipe(req, res, slug)
      }

      return next()
    })
  }

  return {
    name: 'zahir-recipe-admin',
    buildStart() {
      try {
        syncProjectsFromDisk()
      } catch (err) {
        console.warn('[admin] project sync skipped', err)
      }
    },
    configureServer(server) {
      mount(server.middlewares)
    },
    configurePreviewServer(server) {
      mount(server.middlewares)
    },
  }
}
