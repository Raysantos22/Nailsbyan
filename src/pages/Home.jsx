import { Link } from 'react-router-dom'
import { MapPin, MessageCircle, Star } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { formatDuration, formatMoney, messengerLink } from '../lib/format.js'
import { useParallax } from '../lib/useParallax.js'
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
  const handsRef = useParallax(0.35)
  const services = useAsync(() => api.listServices(business.id), [business.id])
  const gallery = useAsync(() => api.listGallery(business.id), [business.id])
  const testimonials = useAsync(() => api.listTestimonials(business.id), [business.id])

  const featured = (services.data || []).filter((s) => !s.is_addon).slice(0, 5)
  const photos = gallery.data || []
  const strip = photos.slice(1, 5).length === 4 ? photos.slice(1, 5) : photos.slice(0, 4)
  const quotes = (testimonials.data || []).slice(0, 3)
  const reviewsUrl = business.facebook_page_url
    ? `${business.facebook_page_url}${business.facebook_page_url.includes('?') ? '&' : '?'}sk=reviews`
    : null

  return (
    <div className="-mb-16 bg-mist">
      {/* ---------------------------------------------------------------- Hero */}
      {/* Fills the screen below the header; the hands drift down on scroll. */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden md:block md:min-h-[calc(100svh-6rem)]">
        {/* decorative blocks along the bottom edge, as in the design */}
        <div className="halftone absolute bottom-8 left-[40%] hidden h-12 w-24 opacity-25 md:block" aria-hidden="true" />
        <div className="absolute right-[5%] bottom-0 hidden h-28 w-56 bg-blush md:block" aria-hidden="true" />
        <div className="absolute right-[5%] bottom-28 hidden h-12 w-32 bg-blush/70 md:block" aria-hidden="true" />

        <div className="container-page relative z-20 flex items-center md:absolute md:inset-0 md:mx-auto">
          <div className="w-full pt-10 pb-4 text-center md:w-[44%] md:py-0">
            <h1 className="font-heading text-[2.1rem] leading-[1.15] font-semibold tracking-[0.1em] whitespace-nowrap text-ink uppercase sm:text-5xl lg:text-[3.4rem] xl:text-[4rem]">
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
            <Link to="/book" className="btn-outline mt-8 bg-mist/80 px-10">
              Book an appointment
            </Link>
          </div>
        </div>

        {/* Hands: big, anchored bottom-right, parallax on scroll */}
        <div className="relative z-10 mt-auto -mx-[22%] md:absolute md:right-[-3vw] md:bottom-0 md:mx-0 md:w-[min(64vw,calc((100svh-6rem)*1.22))] md:max-w-[1180px]">
          <div ref={handsRef} className="will-change-transform">
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

      {/* ------------------------------------- Welcome (big split panels) */}
      <section className="grid md:grid-cols-2">
        {/* Left: full-height photo with social rail */}
        <div className="relative min-h-[70svh] overflow-hidden bg-blush md:min-h-[100svh]">
          {photos[0] && (
            <img
              src={photos[0].image_url}
              alt={photos[0].caption || 'Nail design'}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="absolute top-1/2 left-4 flex -translate-y-1/2 flex-col gap-5 sm:left-6">
            {business.facebook_page_url && (
              <a href={business.facebook_page_url} target="_blank" rel="noreferrer" aria-label="Facebook" className="text-ink transition hover:text-brand-600">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {messengerLink(business) && (
              <a href={messengerLink(business)} target="_blank" rel="noreferrer" aria-label="Messenger" className="text-ink transition hover:text-brand-600">
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
            <Link to="/contact" aria-label="Location and hours" className="text-ink transition hover:text-brand-600">
              <MapPin className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Right: welcome text + menu, then a second big photo */}
        <div className="flex flex-col">
          <div className="bg-white px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
            <p className="font-heading text-lg tracking-[0.08em] text-ink/80 uppercase">Welcome to</p>
            <h2 className="mt-2 font-display text-5xl leading-tight text-ink italic sm:text-6xl lg:text-7xl">{business.name}</h2>
            {business.description && <p className="mt-6 max-w-md leading-relaxed text-stone-600">{business.description}</p>}

            <h3 className="mt-10 font-heading text-sm font-semibold tracking-[0.2em] text-brand-600 uppercase">Popular services</h3>
            <ul className="mt-5 max-w-md space-y-4">
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
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/services" className="btn-outline">
                Full menu
              </Link>
              <Link to="/book" className="btn-outline border-ink bg-ink text-white hover:bg-transparent hover:text-ink">
                Book now
              </Link>
            </div>
          </div>
          <div className="relative min-h-[60svh] flex-1 overflow-hidden bg-[#a9cde6]">
            <picture>
              <source media="(max-width: 767px)" srcSet="/images/welcome-nails-800.webp" />
              <img
                src="/images/welcome-nails.webp"
                alt="Almond nails in nude and pearl white with 3D flowers and gold bow nail art"
                width="1313"
                height="1198"
                className="absolute inset-0 h-full w-full object-cover object-[50%_55%]"
                loading="lazy"
              />
            </picture>
            <Link
              to="/gallery"
              className="absolute bottom-8 left-8 bg-white px-5 py-3 font-heading text-xs font-semibold tracking-[0.2em] text-ink uppercase shadow-sm transition hover:bg-ink hover:text-white"
            >
              View lookbook →
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
