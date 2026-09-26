import { Link } from 'react-router-dom'
import { CalendarCheck, Sparkles, ShieldCheck, Star } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import FacebookPagePlugin from '../components/FacebookPagePlugin.jsx'

const HIGHLIGHTS = [
  { icon: Sparkles, title: 'Detailed, long-lasting work', body: 'Careful prep and quality products for nails that stay pretty for weeks.' },
  { icon: ShieldCheck, title: 'Clean & hygienic', body: 'Sanitised tools and fresh files for every client.' },
  { icon: CalendarCheck, title: 'Book in a minute', body: 'Pick your service and time online — no back-and-forth messages.' },
]

export default function Home() {
  const { business } = useBusiness()
  const services = useAsync(() => api.listServices(business.id), [business.id])
  const gallery = useAsync(() => api.listGallery(business.id), [business.id])
  const testimonials = useAsync(() => api.listTestimonials(business.id), [business.id])

  const featured = (services.data || []).filter((s) => !s.is_addon).slice(0, 4)
  const photos = (gallery.data || []).slice(0, 4)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-100 via-brand-50 to-cream">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-brand-600 uppercase">Nail & beauty studio</p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold text-ink sm:text-5xl">{business.name}</h1>
            <p className="mt-4 max-w-md text-lg text-stone-600">{business.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book" className="btn-primary px-7 py-3 text-base">
                Book an appointment
              </Link>
              <Link to="/services" className="btn-secondary px-7 py-3 text-base">
                View services & prices
              </Link>
            </div>
            {business.facebook_page_url && (
              <a
                href={business.facebook_page_url}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-brand-700"
              >
                <Facebook className="h-4 w-4 text-[#0866FF]" /> See our latest work & reviews on Facebook
              </a>
            )}
          </div>
          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3">
            {(photos.length ? photos : [null, null, null, null]).map((p, i) => (
              <div
                key={p?.id || i}
                className={`aspect-[4/5] overflow-hidden rounded-3xl bg-brand-100 shadow-md ${i % 2 ? 'translate-y-6' : ''}`}
              >
                {p && <img src={p.image_url} alt={p.caption || 'Nail design'} className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="container-page grid gap-4 py-14 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-6">
            <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
            <h2 className="mt-3 font-sans text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{body}</p>
          </div>
        ))}
      </section>

      {/* Services preview */}
      <section className="container-page py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold">Popular services</h2>
            <p className="mt-1 text-stone-600">A few favourites — see the full menu for everything we offer.</p>
          </div>
          <Link to="/services" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">
            Full menu →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((s) => (
            <Link key={s.id} to={`/book?service=${s.id}`} className="card group flex flex-col p-5 transition hover:border-brand-300 hover:shadow-md">
              <span className="text-xs font-semibold tracking-wide text-brand-600 uppercase">{s.category}</span>
              <h3 className="mt-1 font-sans text-base font-semibold">{s.name}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-stone-600">{s.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">{formatMoney(s.price, business.currency)}</span>
                <span className="text-stone-500">{formatDuration(s.duration_minutes)}</span>
              </div>
              <span className="mt-3 text-sm font-semibold text-brand-700 group-hover:underline">Book this →</span>
            </Link>
          ))}
        </div>
        <Link to="/services" className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:underline sm:hidden">
          See the full menu →
        </Link>
      </section>

      {/* Testimonials + Facebook */}
      <section className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-3xl font-semibold">What clients say</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(testimonials.data || []).map((t) => (
              <figure key={t.id} className="card p-6">
                <div className="flex gap-0.5 text-brand-500" aria-label={`${t.rating || 5} out of 5 stars`}>
                  {Array.from({ length: t.rating || 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-3 text-stone-700">“{t.body}”</blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-ink">
                  {t.author_name}
                  {t.source && <span className="font-normal text-stone-500"> · via {t.source}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          {business.facebook_page_url && (
            <a
              href={`${business.facebook_page_url}${business.facebook_page_url.includes('?') ? '&' : '?'}sk=reviews`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary mt-6"
            >
              <Facebook className="h-4 w-4" /> Read more reviews on Facebook
            </a>
          )}
        </div>
        {business.facebook_page_url && (
          <div className="mx-auto w-full max-w-[500px] lg:w-[380px]">
            <h2 className="mb-4 text-xl font-semibold">Latest from our Facebook</h2>
            <FacebookPagePlugin pageUrl={business.facebook_page_url} height={560} />
          </div>
        )}
      </section>

      {/* CTA band */}
      <section className="container-page">
        <div className="rounded-3xl bg-brand-600 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-semibold">Ready for pretty nails?</h2>
          <p className="mx-auto mt-2 max-w-lg text-brand-50">
            Choose your service and a time that suits you. Your slot is held while you send your deposit.
          </p>
          <Link to="/book" className="btn mt-6 bg-white px-7 py-3 text-base text-brand-700 hover:bg-brand-50">
            Book now
          </Link>
        </div>
      </section>
    </>
  )
}
