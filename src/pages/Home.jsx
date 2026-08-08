import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { copy, images, pages, site } from '../data'
import Seo, {
  breadcrumbJsonLd,
  faqJsonLd,
  personJsonLd,
  websiteJsonLd,
} from '../components/Seo'
import { fetchProjects } from '../lib/projectsApi'

function ContactForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '+1',
    message: '',
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    console.log('Contact form submitted:', form)
    alert('Thank you! Your message has been received.')
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '+1',
      message: '',
    })
  }

  const fieldClass =
    'w-full bg-transparent border-0 border-b border-black/40 py-3 px-0 font-sans font-light text-sm focus:outline-none focus:border-black placeholder:text-black/40'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl" name="contact" method="post">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="firstName" className="sr-only">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder="First name *"
            value={form.firstName}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="sr-only">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            placeholder="Last name *"
            value={form.lastName}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email *"
          value={form.email}
          onChange={handleChange}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="phone" className="sr-only">
          Phone
        </label>
        <div className="flex gap-3 items-end">
          <select
            name="country"
            value={form.country}
            onChange={handleChange}
            aria-label="Country code"
            className="bg-transparent border-0 border-b border-black/40 py-3 font-sans font-light text-sm focus:outline-none focus:border-black"
          >
            <option value="+1">+1</option>
            <option value="+44">+44</option>
            <option value="+91">+91</option>
            <option value="+971">+971</option>
          </select>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel-national"
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
            className={`${fieldClass} flex-1`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Type your message here..."
          value={form.message}
          onChange={handleChange}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <button
        type="submit"
        className="mt-4 inline-block font-sans font-semibold text-xs tracking-[0.3em] uppercase border border-black px-10 py-3 hover:bg-black hover:text-sage transition-colors duration-300"
      >
        Submit
      </button>
    </form>
  )
}

const dishAlts = [
  'Authentic Indian dish plated by Chef Zahir Khan in Manhattan',
  'Modern Indian cuisine by Chef Zahir Khan at Gupshup NYC',
  'Indian street-food inspired plate by Chef Zahir Khan',
  'Refined Indian tasting dish from Chef Zahir Khan',
  'Bold Indian flavors crafted by Chef Zahir Khan',
  'Restaurant-quality Indian cuisine in New York City',
  'Signature Indian culinary presentation by Zahir Khan',
  'Traditional spices with modern plating by Chef Zahir Khan',
  'Indian culinary artistry from Manhattan chef Zahir Khan',
]

export default function Home({ scrollToContact = false }) {
  const location = useLocation()
  const seo = scrollToContact || location.pathname === '/contact' ? pages.contact : pages.home
  const [projects, setProjects] = useState([])

  useEffect(() => {
    if (scrollToContact || location.hash === '#contact' || location.pathname === '/contact') {
      const el = document.getElementById('contact')
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    }
  }, [scrollToContact, location.hash, location.pathname])

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  const collageImages = [
    images.dishes[0],
    images.dishes[1],
    images.dishes[6],
    images.dishes[2],
  ]

  const instagramGrid = images.dishes.slice(0, 6)

  return (
    <div>
      <Seo
        title={seo.title}
        description={seo.description}
        path={seo.path}
        image={images.heroOrig}
        jsonLd={[
          personJsonLd(),
          websiteJsonLd(),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
          faqJsonLd(copy.faq),
        ]}
      />

      {/* Hero */}
      <section
        className="relative w-full min-h-[85vh] sm:min-h-[92vh] overflow-hidden bg-sage"
        aria-label="Chef Zahir Khan hero"
      >
        <img
          src={images.heroOrig}
          alt="Chef Zahir Khan, Indian chef and Head Chef at Gupshup in Manhattan, New York"
          className="absolute inset-0 w-full h-full object-cover object-[52%_38%]"
          width={1066}
          height={1600}
          fetchPriority="high"
        />

        <div className="relative z-10 flex flex-col justify-between min-h-[85vh] sm:min-h-[92vh] px-5 sm:px-10 lg:px-16 py-10 sm:py-14">
          <h1 className="opacity-0-start animate-fade-up font-sans font-medium text-[10px] sm:text-xs tracking-hero text-black uppercase text-center">
            Indian Culinary Expert · Manhattan
          </h1>

          <div className="flex-1 flex flex-col justify-center items-center">
            <p
              className="opacity-0-start animate-fade-up-delay font-display text-black text-[clamp(3rem,11vw,5rem)] leading-[0.92] tracking-wide uppercase text-center"
              aria-hidden="true"
            >
              <span className="block">Tastes</span>
              <span className="block">&amp; Flavors</span>
            </p>
            <p className="sr-only">
              Chef Zahir Khan — tastes and flavors of authentic Indian cuisine in New York City
            </p>
          </div>

          <div className="opacity-0-start animate-fade-up-delay-2 self-start">
            <img
              src={images.signature}
              alt="Handwritten signature of Chef Zahir Khan"
              className="w-28 sm:w-40 brightness-0 opacity-90"
              width={254}
              height={180}
            />
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto">
        <h2 className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-6">
          In the kitchen
        </h2>
        <p className="font-sans font-light text-base sm:text-lg leading-relaxed max-w-2xl mb-12">
          {copy.homeIntro}
        </p>
        <img
          src={images.foodMain}
          alt="Indian dish cooked by Chef Zahir Khan"
          className="w-full max-h-[70vh] object-cover transition-transform duration-700 hover:scale-[1.01]"
          width={2000}
          height={2000}
          loading="lazy"
        />
      </section>

      {/* Bio split */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto" aria-labelledby="bio-heading">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <h2
              id="bio-heading"
              className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-4"
            >
              Chef Zahir Khan
            </h2>
            <p className="font-sans font-medium text-lg sm:text-xl mb-5">{copy.bioHeadline}</p>
            <p className="font-sans font-light text-base leading-relaxed mb-8">{copy.bio}</p>
            <Link
              to="/about"
              className="inline-block font-sans font-semibold text-xs tracking-[0.25em] uppercase border-b border-black pb-1 hover:opacity-60 transition-opacity"
            >
              Read All
            </Link>
          </div>
          <div className="overflow-hidden">
            <img
              src={images.portraitSide}
              alt="Portrait of Chef Zahir Khan"
              className="w-full h-auto object-cover transition-transform duration-700 hover:scale-[1.02]"
              width={720}
              height={1489}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto" aria-labelledby="projects-heading">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2
              id="projects-heading"
              className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-3"
            >
              Projects
            </h2>
            <p className="font-sans font-light text-base text-black/80 max-w-xl">
              GupShup, Chote Miya, Ammi, and Punjab Meet House — the kitchens I work with.
            </p>
          </div>
          <Link
            to="/projects"
            className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border border-black px-6 py-2.5 hover:bg-black hover:text-sage transition-colors shrink-0"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.slug}`}
              className="group border border-black/10 bg-white/30 p-5 hover:border-black/30 transition-colors"
            >
              <p className="font-sans font-light text-[11px] tracking-[0.18em] uppercase text-black/55 mb-2">
                {project.role}
              </p>
              <h3 className="font-display text-2xl uppercase mb-2 group-hover:opacity-70">{project.name}</h3>
              <p className="font-sans font-light text-sm leading-relaxed text-black/75">
                {project.summary}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recipes CTA */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto">
        <h2 className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-6">
          Recipes
        </h2>
        <p className="font-sans font-light text-base sm:text-lg leading-relaxed max-w-2xl mb-10">
          {copy.flavours}
        </p>
        <Link
          to="/recipes"
          className="inline-block font-sans font-semibold text-xs tracking-[0.3em] uppercase border border-black px-10 py-3 mb-14 hover:bg-black hover:text-sage transition-colors duration-300"
        >
          My Recipes
        </Link>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {collageImages.map((src, i) => (
            <div key={src} className={`overflow-hidden ${i === 1 || i === 2 ? 'md:mt-8' : ''}`}>
              <img
                src={src}
                alt={dishAlts[i]}
                className="w-full h-48 sm:h-64 object-cover transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Press */}
      <section className="px-5 sm:px-10 lg:px-16 py-12 max-w-6xl mx-auto">
        <h2 className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-4">
          Notes from the work
        </h2>
        <p className="font-sans font-light text-sm sm:text-base leading-relaxed max-w-3xl text-black/75">
          {copy.press}
        </p>
      </section>

      {/* Instagram */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto">
        <h2 className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-3 text-center">
          Follow Zahir on Instagram
        </h2>
        <p className="font-sans font-light text-sm text-center text-black/70 mb-10">
          Recipes, kitchen videos, and what I am cooking now
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
          {instagramGrid.map((src, i) => (
            <a
              key={src}
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden block"
            >
              <img
                src={src}
                alt={dishAlts[i + 3] || dishAlts[i]}
                className="w-full aspect-square object-cover transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
            </a>
          ))}
        </div>

        <div className="text-center">
          <a
            href={site.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-sans font-semibold text-xs tracking-[0.3em] uppercase border border-black px-10 py-3 hover:bg-black hover:text-sage transition-colors duration-300"
          >
            Follow
          </a>
        </div>
      </section>

      {/* FAQ — supports rich results for Indian chef searches */}
      <section
        className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-3xl mx-auto"
        aria-labelledby="faq-heading"
      >
        <h2
          id="faq-heading"
          className="font-sans font-semibold text-sm sm:text-base tracking-section uppercase mb-10 text-center"
        >
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {copy.faq.map((item) => (
            <details
              key={item.question}
              className="border-b border-black/15 pb-5 group open:pb-6"
            >
              <summary className="font-sans font-medium text-base sm:text-lg cursor-pointer list-none flex justify-between gap-4 items-start">
                <span>{item.question}</span>
                <span className="text-black/40 group-open:rotate-45 transition-transform text-xl leading-none">
                  +
                </span>
              </summary>
              <p className="font-sans font-light text-sm sm:text-base leading-relaxed text-black/80 mt-3 pr-8">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto scroll-mt-20"
        aria-labelledby="contact-heading"
      >
        <h2
          id="contact-heading"
          className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-wide uppercase mb-10"
        >
          Let&apos;s Work Together
        </h2>
        <p className="font-sans font-light text-base leading-relaxed max-w-xl mb-8 text-black/80">
          For kitchen work, events, press, or collaborations — write below or email me directly.
        </p>
        <ContactForm />
      </section>
    </div>
  )
}
