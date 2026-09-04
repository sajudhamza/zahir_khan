import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pages, site } from '../data'
import Seo, { breadcrumbJsonLd } from '../components/Seo'
import {
  adminLogin,
  adminLogout,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  fetchRecipes,
  getAdminToken,
  isLoggedIn,
} from '../lib/recipesApi'

const EMPTY_FORM = { name: '', ingredients: '', steps: '', files: [] }

export default function Recipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSlug, setEditingSlug] = useState('')
  const [removeMedia, setRemoveMedia] = useState([])
  const [editingMedia, setEditingMedia] = useState({ images: [], videos: [] })
  const [form, setForm] = useState(EMPTY_FORM)

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRecipes()
      setRecipes(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoggedIn(isLoggedIn())
    loadRecipes()
  }, [loadRecipes])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      await adminLogin(password)
      setLoggedIn(true)
      setShowLogin(false)
      setPassword('')
    } catch (err) {
      setLoginError(err.message || 'Incorrect password')
    }
  }

  async function handleLogout() {
    await adminLogout()
    setLoggedIn(false)
    setFormSuccess('')
    closeForm()
  }

  function openCreate() {
    setEditingSlug('')
    setForm(EMPTY_FORM)
    setRemoveMedia([])
    setEditingMedia({ images: [], videos: [] })
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }

  function openEdit(recipe) {
    setEditingSlug(recipe.slug)
    setForm({
      name: recipe.name || '',
      ingredients: (recipe.ingredients || []).join('\n'),
      steps: (recipe.steps || []).join('\n'),
      files: [],
    })
    setRemoveMedia([])
    setEditingMedia({ images: recipe.images || [], videos: recipe.videos || [] })
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingSlug('')
    setForm(EMPTY_FORM)
    setRemoveMedia([])
    setEditingMedia({ images: [], videos: [] })
    setProgress('')
  }

  function toggleRemove(src) {
    setRemoveMedia((list) =>
      list.includes(src) ? list.filter((s) => s !== src) : [...list, src],
    )
  }

  const onProgress = (index, total, frac, filename) =>
    setProgress(`Uploading ${index + 1}/${total} (${Math.round(frac * 100)}%) — ${filename}`)

  async function handleSave(e) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setSaving(true)
    setProgress('')
    try {
      if (!getAdminToken()) {
        setLoggedIn(false)
        throw new Error('Please log in first')
      }
      const payload = {
        name: form.name.trim(),
        ingredients: form.ingredients,
        steps: form.steps,
      }
      if (editingSlug) {
        await updateRecipe({
          slug: editingSlug,
          fields: payload,
          files: form.files,
          removeImages: removeMedia.filter((src) => editingMedia.images.includes(src)),
          removeVideos: removeMedia.filter((src) => editingMedia.videos.includes(src)),
          onProgress,
        })
        setFormSuccess('Recipe updated.')
      } else {
        await createRecipe({ ...payload, files: form.files, onProgress })
        setFormSuccess('Recipe published.')
      }
      closeForm()
      await loadRecipes()
    } catch (err) {
      setFormError(err.message || 'Could not save recipe')
    } finally {
      setSaving(false)
      setProgress('')
    }
  }

  async function handleDelete(recipe) {
    if (!window.confirm(`Delete "${recipe.name}" and all of its photos/videos?`)) return
    setFormError('')
    try {
      await deleteRecipe(recipe.slug)
      setFormSuccess(`Deleted ${recipe.name}.`)
      await loadRecipes()
    } catch (err) {
      setFormError(err.message || 'Could not delete recipe')
    }
  }

  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto min-h-[60vh]">
      <Seo
        title={pages.recipes.title}
        description={pages.recipes.description}
        path={pages.recipes.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Recipes', path: '/recipes' },
          ]),
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-sans font-semibold text-2xl sm:text-3xl tracking-section uppercase mb-4">
            Indian Recipes by Chef Zahir Khan
          </h1>
          <p className="font-sans font-light text-base leading-relaxed max-w-2xl text-black/80">
            Restaurant-quality Indian recipes from {site.fullName}, Head Chef at {site.restaurant}{' '}
            in Manhattan. Traditional spices, modern twists, and authentic flavors.
          </p>
        </div>

        <div className="shrink-0 flex gap-3">
          {loggedIn ? (
            <>
              <button
                type="button"
                onClick={openCreate}
                className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-5 py-2.5 bg-black text-sage hover:bg-transparent hover:text-black transition-colors"
              >
                Add recipe
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-5 py-2.5 hover:bg-black hover:text-sage transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-5 py-2.5 hover:bg-black hover:text-sage transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>

      {showLogin && !loggedIn && (
        <div className="mb-10 border border-black/15 bg-white/40 p-6 max-w-md">
          <h2 className="font-sans font-semibold text-sm tracking-[0.2em] uppercase mb-4">
            Admin login
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="sr-only">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full bg-transparent border-0 border-b border-black/40 py-3 px-0 font-sans font-light text-sm focus:outline-none focus:border-black"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-700">{loginError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-6 py-2.5 hover:bg-black hover:text-sage transition-colors"
              >
                Enter
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogin(false)
                  setLoginError('')
                  setPassword('')
                }}
                className="font-sans font-light text-xs tracking-[0.2em] uppercase px-4 py-2.5 hover:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loggedIn && showForm && (
        <section className="mb-14 border border-black/15 bg-white/40 p-6 sm:p-8">
          <h2 className="font-sans font-semibold text-sm tracking-[0.2em] uppercase mb-6">
            {editingSlug ? `Edit ${form.name || 'recipe'}` : 'Add a recipe'}
          </h2>
          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            <div>
              <label htmlFor="dish-name" className="block font-sans text-xs tracking-[0.15em] uppercase mb-2">
                Dish name
              </label>
              <input
                id="dish-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Butter Chicken"
                className="w-full bg-transparent border-0 border-b border-black/40 py-3 px-0 font-sans font-light text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label htmlFor="dish-ingredients" className="block font-sans text-xs tracking-[0.15em] uppercase mb-2">
                Ingredients
              </label>
              <textarea
                id="dish-ingredients"
                rows={6}
                value={form.ingredients}
                onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))}
                required
                placeholder={'One ingredient per line\n500g chicken thighs\n2 tbsp garam masala...'}
                className="w-full bg-transparent border border-black/20 p-3 font-sans font-light text-sm focus:outline-none focus:border-black resize-y"
              />
            </div>

            <div>
              <label htmlFor="dish-steps" className="block font-sans text-xs tracking-[0.15em] uppercase mb-2">
                Directions to cook
              </label>
              <textarea
                id="dish-steps"
                rows={8}
                value={form.steps}
                onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))}
                required
                placeholder={'One step per line\nMarinate the chicken...\nSimmer the sauce...'}
                className="w-full bg-transparent border border-black/20 p-3 font-sans font-light text-sm focus:outline-none focus:border-black resize-y"
              />
            </div>

            {editingSlug &&
              (editingMedia.images.length > 0 || editingMedia.videos.length > 0) && (
                <div>
                  <p className="block font-sans text-xs tracking-[0.15em] uppercase mb-2">
                    Current photos & videos
                    <span className="normal-case tracking-normal text-black/50"> — click to remove</span>
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {editingMedia.images.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleRemove(src)}
                        className={`relative aspect-square overflow-hidden border ${
                          removeMedia.includes(src) ? 'border-red-600 opacity-40' : 'border-black/15'
                        }`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {removeMedia.includes(src) && (
                          <span className="absolute inset-0 flex items-center justify-center font-sans text-[10px] uppercase tracking-[0.2em] text-red-700 bg-white/60">
                            Remove
                          </span>
                        )}
                      </button>
                    ))}
                    {editingMedia.videos.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleRemove(src)}
                        className={`relative aspect-square overflow-hidden border ${
                          removeMedia.includes(src) ? 'border-red-600 opacity-40' : 'border-black/15'
                        }`}
                      >
                        <video src={src} muted className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 font-sans text-[9px] uppercase tracking-[0.15em] bg-black/70 text-white px-1.5 py-0.5">
                          Video
                        </span>
                        {removeMedia.includes(src) && (
                          <span className="absolute inset-0 flex items-center justify-center font-sans text-[10px] uppercase tracking-[0.2em] text-red-700 bg-white/60">
                            Remove
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div>
              <label htmlFor="dish-media" className="block font-sans text-xs tracking-[0.15em] uppercase mb-2">
                Photos & videos
              </label>
              <input
                id="dish-media"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) =>
                  setForm((f) => ({ ...f, files: Array.from(e.target.files || []) }))
                }
                className="block w-full font-sans font-light text-sm file:mr-4 file:border file:border-black file:bg-transparent file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em]"
              />
              {form.files.length > 0 && (
                <p className="mt-2 font-sans font-light text-xs text-black/60">
                  {form.files.length} file{form.files.length === 1 ? '' : 's'} selected
                </p>
              )}
            </div>

            {progress && <p className="text-sm text-black/70">{progress}</p>}
            {formError && <p className="text-sm text-red-700">{formError}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="font-sans font-semibold text-xs tracking-[0.3em] uppercase border border-black px-10 py-3 hover:bg-black hover:text-sage transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingSlug ? 'Save changes' : 'Publish recipe'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="font-sans font-light text-xs tracking-[0.2em] uppercase px-4 py-3 hover:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {formSuccess && !showForm && <p className="mb-6 text-sm text-emerald-800">{formSuccess}</p>}
      {formError && !showForm && <p className="mb-6 text-sm text-red-700">{formError}</p>}

      <div className="mb-8">
        <button
          type="button"
          className="font-sans font-light text-sm border border-black/30 px-4 py-2 hover:border-black transition-colors"
          aria-current="page"
        >
          All Posts
        </button>
      </div>

      {loading ? (
        <p className="font-sans font-light text-sm text-black/60">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <div className="border border-black/10 py-20 px-6 text-center">
          <p className="font-sans font-medium text-lg mb-3">No recipes yet</p>
          <p className="font-sans font-light text-sm text-black/70 mb-6">
            Log in with the admin password to add the first dish.
          </p>
          <a
            href={site.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-sans font-semibold text-xs tracking-[0.3em] uppercase border border-black px-8 py-3 hover:bg-black hover:text-sage transition-colors duration-300"
          >
            Follow on Instagram
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {recipes.map((recipe) => (
            <div
              key={recipe.id || recipe.slug}
              className="group relative block overflow-hidden border border-black/10 bg-white/30 hover:border-black/30 transition-colors"
            >
              <Link to={`/recipes/${recipe.slug}`} className="block">
                <div className="aspect-[4/3] overflow-hidden bg-black/5">
                  {recipe.images?.[0] ? (
                    <img
                      src={recipe.images[0]}
                      alt={recipe.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : recipe.videos?.[0] ? (
                    <video
                      src={recipe.videos[0]}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-sans text-xs tracking-[0.2em] uppercase text-black/40">
                      No photo
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-sans font-medium text-lg mb-1 group-hover:opacity-70 transition-opacity">
                    {recipe.name}
                  </h2>
                  <p className="font-sans font-light text-xs text-black/60">
                    {recipe.ingredients?.length
                      ? `${recipe.ingredients.length} ingredients · `
                      : ''}
                    {recipe.steps?.length || 0} steps
                    {recipe.videos?.length
                      ? ` · ${recipe.videos.length} video${recipe.videos.length === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
              </Link>
              {loggedIn && (
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => openEdit(recipe)}
                    className="font-sans font-semibold text-[10px] tracking-[0.2em] uppercase border border-black px-3 py-1.5 hover:bg-black hover:text-sage transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(recipe)}
                    className="font-sans font-semibold text-[10px] tracking-[0.2em] uppercase border border-red-700 text-red-700 px-3 py-1.5 hover:bg-red-700 hover:text-white transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 font-sans font-light text-sm text-black/60">
        Looking for collaborations or private events?{' '}
        <Link to="/contact" className="underline underline-offset-2 hover:opacity-70">
          Contact Chef Zahir Khan
        </Link>
        .
      </p>
    </article>
  )
}
