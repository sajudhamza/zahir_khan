import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pages } from '../data'
import Seo, { breadcrumbJsonLd } from '../components/Seo'
import {
  adminLogin,
  adminLogout,
  fetchProjects,
  isLoggedIn,
  updateProject,
} from '../lib/projectsApi'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [editingSlug, setEditingSlug] = useState('')
  const [form, setForm] = useState(null)
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await fetchProjects())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoggedIn(isLoggedIn())
    load()
  }, [load])

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
    setEditingSlug('')
    setForm(null)
  }

  function startEdit(project) {
    setEditingSlug(project.slug)
    setForm({
      name: project.name || '',
      role: project.role || '',
      location: project.location || '',
      website: project.website || '',
      summary: project.summary || '',
      description: project.description || '',
    })
    setFiles([])
    setMessage('')
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!editingSlug || !form) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateProject({ slug: editingSlug, fields: form, files })
      setMessage('Project saved. New photos are in the project folder.')
      setFiles([])
      setEditingSlug('')
      setForm(null)
      await load()
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto min-h-[60vh]">
      <Seo
        title={pages.projects.title}
        description={pages.projects.description}
        path={pages.projects.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Projects', path: '/projects' },
          ]),
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-sans font-semibold text-2xl sm:text-3xl tracking-section uppercase mb-4">
            Kitchens I Have Worked
          </h1>
          <p className="font-sans font-light text-base leading-relaxed max-w-2xl text-black/80">
            GupShup, Chote Miya, Ammi, and Punjab Meet House. Drop photos into each project folder
            and they will show here.
          </p>
        </div>
        <div className="shrink-0">
          {loggedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-5 py-2.5 hover:bg-black hover:text-sage transition-colors"
            >
              Log out
            </button>
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-transparent border-0 border-b border-black/40 py-3 font-sans font-light text-sm focus:outline-none focus:border-black"
            />
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
                onClick={() => setShowLogin(false)}
                className="font-sans font-light text-xs tracking-[0.2em] uppercase px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {message && <p className="mb-6 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mb-6 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="font-sans font-light text-sm text-black/60">Loading projects…</p>
      ) : (
        <div className="space-y-16">
          {projects.map((project) => (
            <section key={project.id} className="border-b border-black/10 pb-16 last:border-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                <div>
                  <p className="font-sans font-light text-xs tracking-[0.2em] uppercase text-black/60 mb-2">
                    {project.role}
                    {project.location ? ` · ${project.location}` : ''}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl uppercase mb-4">
                    <Link to={`/projects/${project.slug}`} className="hover:opacity-70">
                      {project.name}
                    </Link>
                  </h2>
                  <p className="font-sans font-light text-base leading-relaxed whitespace-pre-line mb-6">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-4 items-center">
                    <Link
                      to={`/projects/${project.slug}`}
                      className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border-b border-black pb-1 hover:opacity-60"
                    >
                      View gallery
                    </Link>
                    {project.website && (
                      <a
                        href={project.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans font-light text-xs tracking-[0.2em] uppercase hover:opacity-60"
                      >
                        Website
                      </a>
                    )}
                    {loggedIn && (
                      <button
                        type="button"
                        onClick={() => startEdit(project)}
                        className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-4 py-2 hover:bg-black hover:text-sage transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="mt-4 font-sans font-light text-[11px] text-black/45">
                    Folder: <code>public/projects/{project.folder}/</code>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(project.images || []).slice(0, 4).map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt={`${project.name} — work by Chef Zahir Khan`}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  ))}
                  {!(project.images || []).length && (
                    <div className="col-span-2 border border-dashed border-black/20 p-10 text-center font-sans font-light text-sm text-black/50">
                      No photos yet. Add images to{' '}
                      <code className="text-xs">public/projects/{project.folder}/</code>
                    </div>
                  )}
                </div>
              </div>

              {loggedIn && editingSlug === project.slug && form && (
                <form
                  onSubmit={handleSave}
                  className="mt-8 border border-black/15 bg-white/40 p-6 space-y-4 max-w-2xl"
                >
                  <h3 className="font-sans font-semibold text-sm tracking-[0.2em] uppercase">
                    Edit {project.name}
                  </h3>
                  {['name', 'role', 'location', 'website', 'summary'].map((field) => (
                    <div key={field}>
                      <label className="block font-sans text-xs tracking-[0.15em] uppercase mb-1">
                        {field}
                      </label>
                      <input
                        type="text"
                        value={form[field]}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                        className="w-full bg-transparent border-0 border-b border-black/40 py-2 font-sans font-light text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block font-sans text-xs tracking-[0.15em] uppercase mb-1">
                      Description
                    </label>
                    <textarea
                      rows={8}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full border border-black/20 p-3 font-sans font-light text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-xs tracking-[0.15em] uppercase mb-1">
                      Add pictures
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      className="block w-full font-sans font-light text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-6 py-2.5 hover:bg-black hover:text-sage transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save project'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlug('')
                        setForm(null)
                      }}
                      className="font-sans font-light text-xs tracking-[0.2em] uppercase px-4 py-2.5"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          ))}
        </div>
      )}
    </article>
  )
}
