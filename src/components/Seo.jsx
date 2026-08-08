import { useEffect } from 'react'
import { site } from '../data'

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Per-route SEO: title, description, canonical, Open Graph, Twitter, JSON-LD.
 */
export default function Seo({
  title,
  description,
  path = '/',
  image = imagesFallback(),
  type = 'website',
  jsonLd,
}) {
  const canonical = `${site.url}${path === '/' ? '' : path}`
  const absoluteImage = image.startsWith('http') ? image : `${site.url}${image}`

  useEffect(() => {
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'keywords', site.keywords.join(', '))
    upsertMeta('name', 'author', site.fullName)
    upsertMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    upsertMeta('name', 'googlebot', 'index, follow')
    upsertMeta('name', 'theme-color', '#C4E7C9')

    upsertLink('canonical', canonical)

    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:site_name', site.fullName)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:image', absoluteImage)
    upsertMeta('property', 'og:image:alt', `${site.fullName}, Indian chef in Manhattan`)
    upsertMeta('property', 'og:locale', 'en_US')

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', absoluteImage)

    if (jsonLd) {
      const payload = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
      payload.forEach((item, i) => upsertJsonLd(`zahir-jsonld-${i}`, item))
    }
  }, [title, description, path, absoluteImage, type, canonical, JSON.stringify(jsonLd)])

  return null
}

function imagesFallback() {
  return '/images/hero-orig.jpeg'
}

export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${site.url}/#person`,
    name: 'Zahir Khan',
    honorificPrefix: 'Chef',
    jobTitle: 'Head Chef',
    description: site.descriptionDefault,
    url: site.url,
    image: `${site.url}/images/hero-orig.jpeg`,
    email: site.email,
    telephone: site.phoneE164,
    sameAs: [site.instagram],
    worksFor: {
      '@type': 'Restaurant',
      name: site.restaurant,
      address: {
        '@type': 'PostalAddress',
        addressLocality: site.location.city,
        addressRegion: site.location.region,
        addressCountry: site.location.country,
      },
    },
    knowsAbout: [
      'Indian cuisine',
      'Authentic Indian cooking',
      'Modern Indian gastronomy',
      'James Beard Foundation dining',
      'Manhattan restaurants',
    ],
    nationality: {
      '@type': 'Country',
      name: 'India',
    },
    homeLocation: {
      '@type': 'Place',
      name: 'Manhattan, New York',
    },
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: site.fullName,
    url: site.url,
    description: site.descriptionDefault,
    publisher: { '@id': `${site.url}/#person` },
    inLanguage: 'en-US',
  }
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${site.url}${item.path === '/' ? '' : item.path}`,
    })),
  }
}

export function faqJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
