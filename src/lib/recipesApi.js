const TOKEN_KEY = 'zahir_admin_token'

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

export async function adminLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Login failed')
  setAdminToken(data.token)
  return data
}

export async function adminLogout() {
  const token = getAdminToken()
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    })
  } catch {
    /* ignore */
  }
  setAdminToken('')
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function createRecipe({ name, steps, files }) {
  const token = getAdminToken()
  if (!token) throw new Error('Please log in first')

  const images = []
  for (const file of files || []) {
    const data = await fileToBase64(file)
    images.push({ data, type: file.type, name: file.name })
  }

  const res = await fetch('/api/admin/recipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token, name, steps, images }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not save recipe')
  return data.recipe
}

export async function fetchRecipes() {
  const res = await fetch(`/recipes/recipes.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchRecipeBySlug(slug) {
  const recipes = await fetchRecipes()
  return recipes.find((r) => r.slug === slug) || null
}
