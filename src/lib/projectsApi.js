import {
  getAdminToken,
  setAdminToken,
  isLoggedIn,
  adminLogin,
  adminLogout,
} from './recipesApi'

export { getAdminToken, setAdminToken, isLoggedIn, adminLogin, adminLogout }

export async function fetchProjects() {
  try {
    const res = await fetch(`/api/projects?t=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.projects)) return data.projects
    }
  } catch {
    /* fall through to static json */
  }

  const res = await fetch(`/projects/projects.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchProjectBySlug(slug) {
  const projects = await fetchProjects()
  return projects.find((p) => p.slug === slug || p.id === slug) || null
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function updateProject({ slug, fields, files }) {
  const token = getAdminToken()
  if (!token) throw new Error('Please log in first')

  const images = []
  for (const file of files || []) {
    const data = await fileToBase64(file)
    images.push({ data, type: file.type, name: file.name })
  }

  const res = await fetch('/api/admin/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token, slug, ...fields, images }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not update project')
  return data.project
}
