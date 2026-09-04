import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { site } from '../data'
import Seo, { breadcrumbJsonLd } from '../components/Seo'
import { fetchProjectBySlug } from '../lib/projectsApi'

export default function ProjectDetail() {
  const { slug } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const data = await fetchProjectBySlug(slug)
      if (active) {
        setProject(data)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <div className="px-5 sm:px-10 lg:px-16 py-24 max-w-4xl mx-auto">
        <p className="font-sans font-light text-sm text-black/60">Loading…</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="px-5 sm:px-10 lg:px-16 py-24 max-w-4xl mx-auto text-center">
        <h1 className="font-display text-3xl uppercase mb-4">Project not found</h1>
        <Link to="/projects" className="font-sans text-xs tracking-[0.25em] uppercase border-b border-black pb-1">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-5xl mx-auto min-h-[60vh]">
      <Seo
        title={`${project.name} | Chef Zahir Khan`}
        description={(project.summary || project.description || '').slice(0, 160)}
        path={`/projects/${project.slug}`}
        image={project.images?.[0] || '/images/hero-orig.jpeg'}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' }, { name: 'Projects', path: '/projects' }, { name: project.name, path: `/projects/${project.slug}` }, ]), ]}
      />

      <Link
        to="/projects"
        className="inline-block font-sans font-light text-xs tracking-[0.2em] uppercase mb-8 hover:opacity-60"
      >
        ← All projects
      </Link>

      <p className="font-sans font-light text-xs tracking-[0.2em] uppercase text-black/60 mb-2">
        {project.role}
        {project.location ? ` · ${project.location}` : ''}
      </p>
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide uppercase mb-6">{project.name}</h1>
      <p className="font-sans font-light text-base sm:text-lg leading-relaxed whitespace-pre-line max-w-3xl mb-10">
        {project.description}
      </p>

      {project.website && (
        <a
          href={project.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mb-12 font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-6 py-2.5 hover:bg-black hover:text-sage transition-colors"
        >
          Visit {project.name}
        </a>
      )}

      {(project.images || []).length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {project.images.map((src) => (
            <img
              key={src}
              src={src}
              alt={`${project.name}, ${site.fullName}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-black/20 p-12 text-center font-sans font-light text-sm text-black/50">
          No photos yet. Log in on the projects page and edit {project.name} to upload some.
        </div>
      )}
    </article>
  )
}
