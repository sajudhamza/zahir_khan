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

export async function fetchRecipes() {
  return fetchCollection('recipes', '/recipes/recipes.json')
}

export async function fetchRecipeBySlug(slug) {
  const recipes = await fetchRecipes()
  return recipes.find((r) => r.slug === slug) || null
}

/**
 * Publish a dish: reserve a slug, upload each photo/video straight to the
 * media store, then save the metadata (name, ingredients, directions, URLs).
 */
export async function createRecipe({ name, ingredients, steps, files, onProgress }) {
  const slug = await reserveSlug('recipes', name)
  const { images, videos } = await uploadFiles({ scope: 'recipes', slug, files, onProgress })
  const data = await adminMutate('/api/admin/recipes', {
    body: { slug, name, ingredients, steps, images, videos },
  })
  return data.recipe
}

export async function updateRecipe({ slug, fields, files, removeImages, removeVideos, onProgress }) {
  const { images, videos } = await uploadFiles({ scope: 'recipes', slug, files, onProgress })
  const data = await adminMutate(`/api/admin/recipes/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: { ...fields, images, videos, removeImages, removeVideos },
  })
  return data.recipe
}

export async function deleteRecipe(slug) {
  return adminMutate(`/api/admin/recipes/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}
