import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RECIPES_DIR = path.join(ROOT, 'public', 'recipes')
const RECIPE_IMAGES_DIR = path.join(RECIPES_DIR, 'images')
const RECIPES_FILE = path.join(RECIPES_DIR, 'recipes.json')
const PROJECTS_DIR = path.join(ROOT, 'public', 'projects')
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const tokens = new Map()

function getAdminPassword() {
  return process.env.ZAHIR_ADMIN_PASSWORD || 'ChefZahir2026!'
}

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

function extensionFromMime(mime = '') {
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  return '.jpg'
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

function ensureRecipeDirs() {
  fs.mkdirSync(RECIPE_IMAGES_DIR, { recursive: true })
  if (!fs.existsSync(RECIPES_FILE)) fs.writeFileSync(RECIPES_FILE, '[]\n', 'utf8')
}

function readRecipes() {
  ensureRecipeDirs()
  try {
    return JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'))
  } catch {
    return []
  }
}

function writeRecipes(recipes) {
  ensureRecipeDirs()
  fs.writeFileSync(RECIPES_FILE, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8')
}

function ensureProjectDirs() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, '[]\n', 'utf8')
  }
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
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'))
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
    const images = listFolderImages(folder)
    return { ...project, folder, images }
  })
  writeProjects(projects)
  return projects
}

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

async function handleCreateRecipe(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) {
      return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })
    }

    const name = String(body.name || '').trim()
    const steps = Array.isArray(body.steps)
      ? body.steps.map((s) => String(s).trim()).filter(Boolean)
      : String(body.steps || '')
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean)

    if (!name) return sendJson(res, 400, { error: 'Dish name is required' })
    if (!steps.length) return sendJson(res, 400, { error: 'At least one step is required' })

    const recipes = readRecipes()
    const slug = uniqueSlug(slugify(name), recipes)
    const id = crypto.randomBytes(8).toString('hex')
    const imageInputs = Array.isArray(body.images) ? body.images : []
    const savedImages = []

    ensureRecipeDirs()
    imageInputs.forEach((img, index) => {
      if (!img || !img.data) return
      const raw = String(img.data).replace(/^data:[^;]+;base64,/, '')
      const buffer = Buffer.from(raw, 'base64')
      if (!buffer.length) return
      const ext = extensionFromMime(img.type || img.mime || '')
      const filename = `${slug}-${index + 1}${ext}`
      fs.writeFileSync(path.join(RECIPE_IMAGES_DIR, filename), buffer)
      savedImages.push(`/recipes/images/${filename}`)
    })

    const recipe = {
      id,
      slug,
      name,
      steps,
      images: savedImages,
      createdAt: new Date().toISOString(),
    }

    recipes.unshift(recipe)
    writeRecipes(recipes)
    return sendJson(res, 201, { ok: true, recipe })
  } catch (err) {
    console.error('[admin] recipe', err)
    return sendJson(res, 500, { error: 'Could not save recipe' })
  }
}

async function handleGetProjects(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  try {
    const projects = syncProjectsFromDisk()
    return sendJson(res, 200, { projects })
  } catch (err) {
    console.error('[admin] projects get', err)
    return sendJson(res, 500, { error: 'Could not load projects' })
  }
}

async function handleUpdateProject(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  try {
    const body = await readBody(req)
    if (!isAuthed(req, body)) {
      return sendJson(res, 401, { error: 'Unauthorized. Please log in again.' })
    }

    const slug = String(body.slug || body.id || '').trim()
    if (!slug) return sendJson(res, 400, { error: 'Project slug is required' })

    const projects = syncProjectsFromDisk()
    const index = projects.findIndex((p) => p.slug === slug || p.id === slug)
    if (index < 0) return sendJson(res, 404, { error: 'Project not found' })

    const current = projects[index]
    const folder = current.folder || current.slug
    const folderPath = path.join(PROJECTS_DIR, folder)
    fs.mkdirSync(folderPath, { recursive: true })

    const next = {
      ...current,
      name: body.name != null ? String(body.name).trim() : current.name,
      role: body.role != null ? String(body.role).trim() : current.role,
      location: body.location != null ? String(body.location).trim() : current.location,
      website: body.website != null ? String(body.website).trim() : current.website,
      summary: body.summary != null ? String(body.summary).trim() : current.summary,
      description:
        body.description != null ? String(body.description).trim() : current.description,
    }

    const imageInputs = Array.isArray(body.images) ? body.images : []
    const existing = listFolderImages(folder)
    imageInputs.forEach((img, i) => {
      if (!img || !img.data) return
      const raw = String(img.data).replace(/^data:[^;]+;base64,/, '')
      const buffer = Buffer.from(raw, 'base64')
      if (!buffer.length) return
      const ext = extensionFromMime(img.type || img.mime || '')
      const base = slugify(img.name || `photo-${Date.now()}-${i}`).replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
      let filename = `${base}${ext}`
      let n = 2
      while (fs.existsSync(path.join(folderPath, filename))) {
        filename = `${base}-${n}${ext}`
        n += 1
      }
      fs.writeFileSync(path.join(folderPath, filename), buffer)
    })

    next.images = listFolderImages(folder)
    // if no new uploads, keep scanned list (includes existing)
    if (!imageInputs.length) next.images = existing.length ? existing : next.images

    projects[index] = next
    writeProjects(projects)
    return sendJson(res, 200, { ok: true, project: next })
  } catch (err) {
    console.error('[admin] project update', err)
    return sendJson(res, 500, { error: 'Could not update project' })
  }
}

/**
 * Vite plugin: admin login + recipes + projects (writes into public/)
 */
export function recipeAdminPlugin() {
  const mount = (middlewares) => {
    middlewares.use(async (req, res, next) => {
      const url = req.url?.split('?')[0]
      if (url === '/api/admin/login') return handleLogin(req, res)
      if (url === '/api/admin/logout') return handleLogout(req, res)
      if (url === '/api/admin/recipes') return handleCreateRecipe(req, res)
      if (url === '/api/projects') return handleGetProjects(req, res)
      if (url === '/api/admin/projects') return handleUpdateProject(req, res)
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
