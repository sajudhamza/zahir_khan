import {
  adminLogin,
  adminLogout,
  adminMutate,
  fetchCollection,
  getAdminToken,
  isLoggedIn,
  reserveSlug,
  setAdminToken,
  uploadFiles,
} from './apiClient'

export { adminLogin, adminLogout, getAdminToken, setAdminToken, isLoggedIn }

export async function fetchProjects() {
  return fetchCollection('projects', '/projects/projects.json')
}

export async function fetchProjectBySlug(slug) {
  const projects = await fetchProjects()
  return projects.find((p) => p.slug === slug || p.id === slug) || null
}

/**
 * Add a restaurant/kitchen: reserve a slug, upload the photos, save the
 * metadata (name, description, photo URLs).
 */
export async function createProject({ name, description, fields = {}, files, onProgress }) {
  const slug = await reserveSlug('projects', name)
  const { images } = await uploadFiles({ scope: 'projects', slug, files, onProgress })
  const data = await adminMutate('/api/admin/projects', {
    body: { slug, name, description, ...fields, images },
  })
  return data.project
}

export async function updateProject({ slug, fields, files, removeImages, onProgress }) {
  const { images } = await uploadFiles({ scope: 'projects', slug, files, onProgress })
  const data = await adminMutate(`/api/admin/projects/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: { ...fields, images, removeImages },
  })
  return data.project
}

export async function deleteProject(slug) {
  return adminMutate(`/api/admin/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}
