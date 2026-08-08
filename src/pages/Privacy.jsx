import { Link } from 'react-router-dom'
import { pages, site } from '../data'
import Seo, { breadcrumbJsonLd } from '../components/Seo'

export default function Privacy() {
  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-3xl mx-auto min-h-[60vh]">
      <Seo
        title={pages.privacy.title}
        description={pages.privacy.description}
        path={pages.privacy.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Privacy Policy', path: '/privacy-policy' },
          ]),
        ]}
      />

      <h1 className="font-display text-3xl sm:text-4xl tracking-wide uppercase mb-8">
        Privacy Policy
      </h1>

      <div className="space-y-5 font-sans font-light text-base leading-relaxed text-black/80">
        <p>
          This website is operated by {site.fullName}. We respect your privacy and are committed to
          protecting any personal information you choose to share with us.
        </p>
        <p>
          When you submit the contact form, we may collect your name, email address, phone number,
          and message content solely to respond to your inquiry. We do not sell or share your
          personal information with third parties for marketing purposes.
        </p>
        <p>
          This site may link to external platforms such as Instagram. Those services have their own
          privacy policies, which we encourage you to review.
        </p>
        <p>
          For privacy-related questions, please contact us at{' '}
          <a href={`mailto:${site.email}`} className="underline underline-offset-2 hover:opacity-60">
            {site.email}
          </a>
          .
        </p>
        <p className="pt-4">
          <Link
            to="/"
            className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border-b border-black pb-1 hover:opacity-60 transition-opacity"
          >
            Back to Home
          </Link>
        </p>
      </div>
    </article>
  )
}
