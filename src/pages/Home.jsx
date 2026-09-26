import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import FacebookPagePlugin from '../components/FacebookPagePlugin.jsx'

// Watercolour-style blob behind the hero photo.
function BrushBlob({ className = '' }) {
  return (
    <svg viewBox="0 0 600 640" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path
        fill="currentColor"
        opacity="0.7"
        d="M92 58c58-22 121-8 183-18 71-12 132-44 201-22 47 15 64 63 71 108 9 56-12 108-4 164 8 58 49 110 35 168-13 56-66 96-122 110-62 16-126-6-190 2-60 8-121 44-176 20C39 566 18 510 12 455 5 395 38 340 36 280 34 222 2 166 18 112c9-30 45-43 74-54z"
      />
      <path
        fill="currentColor"
        opacity="1"
        d="M130 96c50-16 104-2 157-12 66-12 118-40 176-14 38 17 50 60 52 99 3 50-18 96-10 146 8 52 42 98 26 148-15 46-62 74-110 84-56 12-112-10-168-4-54 6-108 34-154 8-38-21-50-68-52-112-2-50 26-96 26-146 0-46-24-92-10-136 10-32 38-52 67-61z"
      />
      <path fill="currentColor" opacity="0.35" d="M470 30c30 4 60 18 72 44s-4 52-26 60-50-6-62-30 -14-78 16-74z" />
      <path fill="currentColor" opacity="0.3" d="M40 540c20-8 48-2 58 16s-2 42-24 46-48-8-52-28 0-28 18-34z" />
    </svg>
  )
}

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
  const hero = photos[0]
  const second = photos[1] || photos[0]
  const strip = photos.slice(2, 6).length === 4 ? photos.slice(2, 6) : photos.slice(0, 4)
  const quotes = (testimonials.data || []).slice(0, 3)
  const reviewsUrl = business.facebook_page_url
    ? `${business.facebook_page_url}${business.facebook_page_url.includes('?') ? '&' : '?'}sk=reviews`
    : null

  return (
    <div className="-mb-16 bg-mist">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="dot-texture overflow-hidden">
        <div className="container-page grid items-center gap-10 py-12 md:grid-cols-2 md:gap-6 md:py-20">
          <div className="md:text-right">
            <h1 className="font-heading text-[2.5rem] leading-[1.05] font-bold tracking-[0.08em] text-ink uppercase sm:text-6xl lg:text-[4.25rem]">
              Small art
              <br />
              for your
              <br />
              fingertips
            </h1>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-stone-600 md:ml-auto">
              {business.tagline || 'Manicures, pedicures, gel and nail art — book your slot online in a minute.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 md:justify-end">
              <Link to="/book" className="btn-outline">
                Book an appointment
              </Link>
            </div>
            {business.facebook_page_url && (
              <a
                href={business.facebook_page_url}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-ink"
              >
                <Facebook className="h-4 w-4 text-[#0866FF]" /> Latest work & reviews on Facebook
              </a>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <BrushBlob className="absolute -inset-x-6 -inset-y-8 h-[calc(100%+4rem)] w-[calc(100%+3rem)] text-[#f4c9bf]" />
            <div className="relative mx-auto aspect-[4/5] w-[68%] rotate-2 sm:w-[78%] overflow-hidden bg-blush shadow-[0_30px_60px_-25px_rgba(45,28,34,0.35)]">
              {hero && (
                <img src={hero.image_url} alt={hero.caption || 'Nail design'} className="h-full w-full object-cover" fetchPriority="high" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Collage */}
      <section className="grid md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden bg-powder sm:min-h-[440px]">
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
