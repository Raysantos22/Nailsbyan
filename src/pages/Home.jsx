import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import FacebookPagePlugin from '../components/FacebookPagePlugin.jsx'

// Loose brush stroke used as a decorative accent.
function BrushStroke({ className = '' }) {
  return (
    <svg viewBox="0 0 400 90" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path
        fill="currentColor"
        d="M8 52c30-22 80-30 130-32 60-3 118-12 176-10 30 1 62 6 78 20 6 6 2 14-8 16-40 8-88 2-130 6-56 6-110 20-166 22-26 1-60 0-76-8-8-4-10-10-4-14z"
      />
      <path fill="currentColor" opacity="0.6" d="M40 70c50-6 110-8 170-12 40-2 90-4 130 2-40 10-96 12-148 16-52 4-104 6-152-6z" />
    </svg>
  )
}

function SectionLabel({ children, className = '' }) {
  return <p className={`tracked-caps text-[0.7rem] text-brand-600 ${className}`}>{children}</p>
}

export default function Home() {
  const { business } = useBusiness()
  const services = useAsync(() => api.listServices(business.id), [business.id])
  const gallery = useAsync(() => api.listGallery(business.id), [business.id])
  const testimonials = useAsync(() => api.listTestimonials(business.id), [business.id])

  const featured = (services.data || []).filter((s) => !s.is_addon).slice(0, 5)
  const photos = gallery.data || []
  const second = photos[0]
  const strip = photos.slice(1, 5).length === 4 ? photos.slice(1, 5) : photos.slice(0, 4)
  const quotes = (testimonials.data || []).slice(0, 3)
  const reviewsUrl = business.facebook_page_url
    ? `${business.facebook_page_url}${business.facebook_page_url.includes('?') ? '&' : '?'}sk=reviews`
    : null

  return (
    <div className="-mb-16 bg-mist">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        {/* decorative blocks along the bottom edge, as in the design */}
        <div className="halftone absolute bottom-6 left-[50%] hidden h-12 w-24 opacity-25 md:block" aria-hidden="true" />
        <div className="absolute right-[6%] bottom-0 hidden h-24 w-48 bg-blush md:block" aria-hidden="true" />
        <div className="absolute right-[6%] bottom-24 hidden h-10 w-28 bg-blush/70 md:block" aria-hidden="true" />

        <div className="container-page relative grid items-center md:min-h-[600px] md:grid-cols-[1fr_1.2fr]">
          <div className="relative z-10 pt-10 pb-6 text-center md:py-24">
            <h1 className="font-heading text-[2.1rem] leading-[1.15] font-semibold tracking-[0.1em] whitespace-nowrap text-ink uppercase sm:text-5xl lg:text-[3.3rem] xl:text-[3.7rem]">
              Pretty nails
              <br />
              happier you
            </h1>
            <p className="mx-auto mt-6 max-w-xs font-heading text-lg leading-snug font-light text-ink/85 sm:text-xl">
              Fresh sets. Clean vibes.
              <br />
              Gel, extensions &amp; nail art
              <br />
              by {business.name}.
            </p>
            <Link to="/book" className="btn-outline mt-8 px-10">
              Book an appointment
            </Link>
          </div>

          <div className="relative z-10 -mx-4 self-end md:mx-0 md:-mr-16 lg:-mr-28">
            <picture>
              <source media="(max-width: 767px)" srcSet="/images/hero-hands-760.webp" />
              <img
                src="/images/hero-hands.webp"
                alt="Hands with a glossy white manicure and gold rings"
                width="1400"
                height="1046"
                className="block h-auto w-full"
                fetchPriority="high"
              />
            </picture>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Collage */}
      <section className="grid md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden bg-blush sm:min-h-[440px]">
          <BrushStroke className="absolute top-10 -right-10 h-16 w-72 rotate-[-8deg] text-white/60" />
          <BrushStroke className="absolute bottom-16 -left-12 h-12 w-60 rotate-[6deg] text-white/40" />
          {second && (
            <img
              src={second.image_url}
              alt={second.caption || 'Nail design'}
              className="absolute bottom-0 left-1/2 aspect-square w-[62%] -translate-x-1/2 object-cover shadow-xl"
              loading="lazy"
            />
          )}
          <Link
            to="/gallery"
            className="absolute top-8 left-8 bg-white px-5 py-3 font-heading text-xs font-semibold tracking-[0.2em] text-ink uppercase shadow-sm transition hover:bg-ink hover:text-white"
          >
            View lookbook →
          </Link>
        </div>

        <div className="dot-texture relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
          <div className="absolute top-10 right-0 h-44 w-40 bg-blush sm:w-56" aria-hidden="true" />
          <div className="halftone absolute top-6 left-6 h-20 w-28 opacity-40" aria-hidden="true" />
          <div className="relative max-w-md">
            <SectionLabel>The menu</SectionLabel>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-[0.06em] text-ink uppercase sm:text-4xl">Popular services</h2>
            <ul className="mt-8 space-y-5">
              {featured.map((s) => (
                <li key={s.id}>
                  <Link to={`/book?service=${s.id}`} className="group block">
                    <div className="flex items-baseline gap-3">
                      <span className="font-heading text-sm font-semibold tracking-[0.12em] text-ink uppercase group-hover:text-brand-600">
                        {s.name}
                      </span>
                      <span className="flex-1 border-b border-dotted border-ink/30" aria-hidden="true" />
                      <span className="font-heading text-sm font-semibold text-ink">{formatMoney(s.price, business.currency)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">{formatDuration(s.duration_minutes)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/services" className="btn-outline mt-10 bg-white/70">
              Full menu
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Values */}
      <section className="container-page grid gap-10 py-16 sm:grid-cols-3 sm:py-20">
        {[
          ['01', 'Detail first', 'Careful prep and quality products, so your set looks fresh for weeks.'],
          ['02', 'Clean & calm', 'Sanitised tools, fresh files and a relaxed space for every client.'],
          ['03', 'Easy booking', 'Pick a service and a free time online. Your slot is held while you pay the deposit.'],
        ].map(([n, title, body]) => (
          <div key={n} className="border-t-2 border-ink pt-5">
            <p className="font-heading text-sm font-semibold text-brand-600">{n}</p>
            <h3 className="mt-2 font-heading text-lg font-bold tracking-[0.12em] text-ink uppercase">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{body}</p>
          </div>
        ))}
      </section>

      {/* ----------------------------------------------------------- Lookbook */}
      {strip.length > 0 && (
        <section className="container-page pb-16 sm:pb-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <SectionLabel>Lookbook</SectionLabel>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-[0.06em] text-ink uppercase">Recent sets</h2>
            </div>
            <Link to="/gallery" className="font-heading text-xs font-semibold tracking-[0.2em] text-ink uppercase hover:text-brand-600">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
            {strip.map((p, i) => (
              <Link key={p.id} to="/gallery" className={`group block overflow-hidden bg-blush ${i % 2 ? 'sm:mt-8' : ''}`}>
                <img
                  src={p.image_url}
                  alt={p.caption || 'Nail design'}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------------- Testimonials + Facebook */}
      <section className="relative overflow-hidden bg-blush/60 py-16 sm:py-20">
        <BrushStroke className="absolute -top-2 left-1/3 h-14 w-80 text-white/50" />
        <div className="container-page relative grid gap-12 lg:grid-cols-[1fr_auto]">
          <div>
            <SectionLabel>Kind words</SectionLabel>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-[0.06em] text-ink uppercase">What clients say</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {quotes.map((t) => (
                <figure key={t.id} className="bg-white/80 p-6">
                  <div className="flex gap-0.5 text-ink" aria-label={`${t.rating || 5} out of 5 stars`}>
                    {Array.from({ length: t.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mt-4 leading-relaxed text-stone-700">“{t.body}”</blockquote>
                  <figcaption className="mt-4 font-heading text-xs font-semibold tracking-[0.18em] text-ink uppercase">
                    {t.author_name}
                    {t.source && <span className="font-normal tracking-normal text-stone-500 normal-case"> · via {t.source}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            {reviewsUrl && (
              <a href={reviewsUrl} target="_blank" rel="noreferrer" className="btn-outline mt-8 bg-white/70">
                <Facebook className="mr-2 h-4 w-4" /> More reviews on Facebook
              </a>
            )}
          </div>
          {business.facebook_page_url && (
            <div className="mx-auto w-full max-w-[500px] lg:w-[360px]">
              <SectionLabel className="mb-4">Follow along</SectionLabel>
              <FacebookPagePlugin pageUrl={business.facebook_page_url} height={540} />
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="dot-texture">
        <div className="container-page flex flex-col items-center py-16 text-center sm:py-24">
          <p className="font-script text-4xl text-brand-600 sm:text-5xl">see you soon</p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-[0.1em] text-ink uppercase sm:text-5xl">Ready when you are</h2>
          <p className="mt-4 max-w-md text-stone-600">
            Choose your service and a time that suits you. We hold your slot while you send the deposit.
          </p>
          <Link to="/book" className="btn-outline mt-8">
            Book now
          </Link>
        </div>
      </section>
    </div>
  )
}
