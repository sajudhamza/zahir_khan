/**
 * One client for both backends. window.ZK_CONFIG (public/config.js) decides
 * where requests go: blank values mean the Vite dev plugin, filled-in values
 * mean the deployed Lambda + S3 (see infra/). Both implement the same
 * contract, so everything below is a single code path.
 */

const TOKEN_KEY = 'zahir_admin_token'

function config() {
  const cfg = (typeof window !== 'undefined' && window.ZK_CONFIG) || {}
  return {
    apiBase: String(cfg.apiBase || '').replace(/\/+$/, ''),
    mediaBase: String(cfg.mediaBase || '').replace(/\/+$/, ''),
  }
}

export function apiUrl(path) {
  return `${config().apiBase}${path}`
}

export function hasRemoteBackend() {
  return Boolean(config().apiBase)
}

export function mediaBase() {
  return config().mediaBase
}

/* ------------------------------------------------------------------ auth */

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function isLoggedIn() {
  return Boolean(getAdminToken())
}

async function postJson(path, body, { auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getAdminToken()
  if (auth) {
    if (!token) throw new Error('Please log in first')
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(auth ? { token, ...body } : body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function adminLogin(password) {
  const data = await postJson('/api/admin/login', { password })
  setAdminToken(data.token)
  return data
}

export async function adminLogout() {
  const token = getAdminToken()
  try {
    await fetch(apiUrl('/api/admin/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token }),
    })
  } catch {
    /* ignore */
  }
  setAdminToken('')
}

/* --------------------------------------------------------------- uploads */

/** Reserve a slug for a new item so its uploads are filed under it. */
export async function reserveSlug(scope, name) {
  const data = await postJson('/api/admin/slug', { scope, name }, { auth: true })
  return data.slug
}

/**
 * Upload one file: ask the backend for an upload URL, PUT the bytes to it
 * (presigned S3 in production, the dev plugin locally), return the public URL.
 */
export async function uploadFile({ scope, slug, file, onProgress }) {
  const target = await postJson(
    '/api/admin/upload-url',
    {
      scope,
      slug,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    },
    { auth: true },
  )

  await new Promise((resolve, reject) => {
    // XHR instead of fetch for upload progress on large videos.
    const xhr = new XMLHttpRequest()
    xhr.open(target.method || 'PUT', target.uploadUrl)
    Object.entries(target.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'))
    xhr.send(file)
  })

  return target.publicUrl
}

/** Upload many files, splitting the result into images and videos. */
export async function uploadFiles({ scope, slug, files, onProgress }) {
  const images = []
  const videos = []
  const list = Array.from(files || [])
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i]
    const url = await uploadFile({
      scope,
      slug,
      file,
      onProgress: (frac) => onProgress?.(i, list.length, frac, file.name),
    })
    if ((file.type || '').startsWith('video/')) videos.push(url)
    else images.push(url)
  }
  return { images, videos }
}

/* --------------------------------------------------------------- fetches */

/**
 * Read a collection. With a deployed backend, visitors read the static JSON
 * straight from S3 (no Lambda cold start); locally the dev plugin answers;
 * the JSON files baked into the build are the last resort.
 */
export async function fetchCollection(scope, staticPath) {
  const { apiBase, mediaBase: media } = config()

  if (media) {
    try {
      const res = await fetch(`${media}/data/${scope}.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) return data
      }
    } catch {
      /* fall through */
    }
  }

  if (apiBase || !media) {
    try {
      const res = await fetch(apiUrl(`/api/${scope}?t=${Date.now()}`), { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data[scope])) return data[scope]
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const res = await fetch(`${staticPath}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function adminMutate(path, { method = 'POST', body = {} } = {}) {
  const token = getAdminToken()
  if (!token) throw new Error('Please log in first')
  const res = await fetch(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
