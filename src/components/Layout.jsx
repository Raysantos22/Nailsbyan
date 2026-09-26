import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, MessageCircle, X, MapPin, Phone, Mail } from 'lucide-react'
import { Facebook } from './icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { DEMO_MODE } from '../lib/config.js'
import { DAY_KEYS, DAY_NAMES, formatClock, messengerLink } from '../lib/format.js'
import { ErrorBox, Loading } from './ui.jsx'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
  { to: '/my-bookings', label: 'My Booking' },
]

export function DemoBanner() {
  if (!DEMO_MODE) return null
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-xs text-white/90">
      Demo mode — bookings are stored only in this browser. Connect Supabase to go live.
    </div>
  )
}

function Logo({ business }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={`${business?.name || 'Home'} — home`}>
      {business?.logo_url ? (
        <img src={business.logo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-brand-100" />
      ) : null}
      <span className="font-display text-xl font-semibold text-ink">{business?.name || 'Nails'}</span>
    </Link>
  )
}

function Header({ business }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const linkClass = ({ isActive }) =>
    `rounded-full px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-700 hover:text-brand-700'}`

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo business={business} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
          <Link to="/book" className="btn-primary ml-2">
            Book Now
          </Link>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <Link to="/book" className="btn-primary btn-sm">
            Book Now
          </Link>
          <button
            type="button"
            className="rounded-full p-2 text-stone-700 hover:bg-brand-50"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-brand-100 bg-cream md:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col py-2">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

export function OpeningHours({ hours, compact = false }) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-6 ${compact ? 'gap-y-1 text-sm' : 'gap-y-2'}`}>
      {order.map((d) => {
        const h = hours?.[DAY_KEYS[d]]
        return (
          <div key={d} className="contents">
            <dt className="font-medium">{DAY_NAMES[d]}</dt>
            <dd className="text-right text-stone-600">
              {h?.open ? `${formatClock(h.open)} – ${formatClock(h.close)}` : 'Closed'}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function Footer({ business }) {
  return (
    <footer className="mt-20 border-t border-brand-100 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-3">
        <div>
          <Logo business={business} />
          <p className="mt-3 text-sm text-stone-600">{business?.tagline}</p>
          {business?.facebook_page_url && (
            <a
              href={business.facebook_page_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
            >
              <Facebook className="h-4 w-4" /> Follow us on Facebook
            </a>
          )}
        </div>
        <div className="text-sm">
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-wide text-ink uppercase">Visit us</h2>
          <ul className="space-y-2 text-stone-600">
            {business?.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {business.address}
              </li>
            )}
            {business?.phone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="hover:underline">
                  {business.phone}
                </a>
              </li>
            )}
            {business?.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <a href={`mailto:${business.email}`} className="hover:underline">
                  {business.email}
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-wide text-ink uppercase">Opening hours</h2>
          <OpeningHours hours={business?.hours_json} compact />
        </div>
      </div>
      <div className="border-t border-brand-100 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {business?.name}.{' '}
        <Link to="/admin" className="hover:underline">
          Staff login
        </Link>
      </div>
    </footer>
  )
}

// Meta retired the embedded Messenger Chat Plugin in 2024, so the widget is
// a floating button that opens the Page's conversation via m.me.
export function MessengerButton({ business }) {
  const href = messengerLink(business)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#0866FF] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:bg-[#0756d6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
      aria-label="Message us on Facebook Messenger"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Message us</span>
    </a>
  )
}

export default function Layout() {
  const { business, error, loading, reload } = useBusiness()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <Header business={business} />
      <main className="flex-1">
        {loading ? (
          <Loading label="Loading salon…" />
        ) : error ? (
          <div className="container-page py-16">
            <ErrorBox error={error} onRetry={reload} />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer business={business} />
      <MessengerButton business={business} />
    </div>
  )
}
