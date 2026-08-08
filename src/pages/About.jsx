import { copy, images, pages } from '../data'
import Seo, { breadcrumbJsonLd, personJsonLd } from '../components/Seo'

export default function About() {
  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-6xl mx-auto">
      <Seo
        title={pages.about.title}
        description={pages.about.description}
        path={pages.about.path}
        image={images.heroOrig}
        type="profile"
        jsonLd={[
          personJsonLd(),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about' },
          ]),
        ]}
      />

      <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl tracking-wide uppercase mb-4">
        More About Chef Zahir
      </h1>
      <p className="font-sans font-light text-sm sm:text-base tracking-[0.2em] uppercase text-black/70 mb-12 sm:mb-16">
        Head Chef, GupShup · Executive Chef, Punjab Meet House
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start mb-16">
        <div className="overflow-hidden">
          <img
            src={images.heroOrig}
            alt="Chef Zahir Khan, Indian culinary expert and Head Chef at Gupshup in Manhattan"
            className="w-full h-auto object-cover transition-transform duration-700 hover:scale-[1.02]"
            width={1066}
            height={1600}
          />
        </div>
        <div className="space-y-6">
          {copy.about.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="font-sans font-light text-base sm:text-lg leading-relaxed"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="overflow-hidden">
          <img
            src={images.about2}
            alt="Chef Zahir Khan preparing authentic Indian cuisine in New York"
            className="w-full h-72 sm:h-96 object-cover transition-transform duration-700 hover:scale-[1.02]"
            width={1600}
            height={1600}
            loading="lazy"
          />
        </div>
        <div className="overflow-hidden">
          <img
            src={images.about3}
            alt="Chef Zahir Khan presenting refined Indian dishes in Manhattan"
            className="w-full h-72 sm:h-96 object-cover transition-transform duration-700 hover:scale-[1.02]"
            width={1600}
            height={1600}
            loading="lazy"
          />
        </div>
      </div>
    </article>
  )
}
