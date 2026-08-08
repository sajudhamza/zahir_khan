import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { site } from '../data'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Recipes', to: '/recipes' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/#contact' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-40 bg-sage border-b border-black/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="group">
            <span className="block font-sans font-bold text-sm sm:text-base tracking-[0.2em] uppercase">
              {site.name}
            </span>
            <span className="block font-sans font-light text-[10px] sm:text-xs tracking-[0.15em] mt-0.5 text-black/80">
              {site.tagline}
            </span>
          </Link>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative w-10 h-10 flex flex-col items-center justify-center gap-1.5"
          >
            <span
              className={`block w-6 h-[1.5px] bg-black transition-transform duration-300 ${
                open ? 'translate-y-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`block w-6 h-[1.5px] bg-black transition-opacity duration-300 ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-6 h-[1.5px] bg-black transition-transform duration-300 ${
                open ? '-translate-y-[7px] -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 bg-sage transition-opacity duration-300 ${
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none invisible'
        }`}
        aria-hidden={!open}
        hidden={!open}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="group" onClick={() => setOpen(false)}>
            <span className="block font-sans font-bold text-sm sm:text-base tracking-[0.2em] uppercase">
              {site.name}
            </span>
            <span className="block font-sans font-light text-[10px] sm:text-xs tracking-[0.15em] mt-0.5 text-black/80">
              {site.tagline}
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="relative w-10 h-10 flex flex-col items-center justify-center gap-1.5"
          >
            <span className="block w-6 h-[1.5px] bg-black translate-y-[7px] rotate-45" />
            <span className="block w-6 h-[1.5px] bg-black opacity-0" />
            <span className="block w-6 h-[1.5px] bg-black -translate-y-[7px] -rotate-45" />
          </button>
        </div>

        <nav className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
          {navLinks.map((link) =>
            link.to.includes('#') ? (
              <a
                key={link.label}
                href={link.to}
                onClick={() => setOpen(false)}
                className="font-sans font-semibold text-2xl sm:text-3xl tracking-[0.25em] uppercase hover:opacity-60 transition-opacity"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="font-sans font-semibold text-2xl sm:text-3xl tracking-[0.25em] uppercase hover:opacity-60 transition-opacity"
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            to="/recipes"
            onClick={() => setOpen(false)}
            className="font-sans font-light text-sm tracking-[0.3em] uppercase opacity-50 hover:opacity-100 transition-opacity mt-4"
          >
            Login
          </Link>
        </nav>
      </div>
    </>
  )
}
