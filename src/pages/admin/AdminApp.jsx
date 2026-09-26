import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarDays, Image, LayoutDashboard, LogOut, Scissors, Settings, Users, ExternalLink } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext.jsx'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { DEMO_ADMIN, DEMO_MODE } from '../../lib/config.js'
import { ErrorBox, Field, Loading, Notice, Spinner } from '../../components/ui.jsx'
import { DemoBanner } from '../../components/Layout.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminBookings from './AdminBookings.jsx'
import AdminServices from './AdminServices.jsx'
import AdminStaff from './AdminStaff.jsx'
import AdminGallery from './AdminGallery.jsx'
import AdminSettings from './AdminSettings.jsx'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/services', label: 'Services', icon: Scissors },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/gallery', label: 'Gallery', icon: Image },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function AdminLogin() {
  const [email, setEmail] = useState(DEMO_MODE ? DEMO_ADMIN.email : '')
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_ADMIN.password : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.signInWithPassword(email.trim(), password)
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 to-cream p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Staff login</h1>
          <p className="text-sm text-stone-600">Manage bookings, services and payments.</p>
        </div>
        {DEMO_MODE && (
          <Notice>
            Demo mode — use <strong>{DEMO_ADMIN.email}</strong> / <strong>{DEMO_ADMIN.password}</strong>
          </Notice>
        )}
        <Field label="Email" htmlFor="admin-email">
          <input id="admin-email" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="admin-password">
          <input
            id="admin-password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorBox error={error} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Log in
        </button>
        <Link to="/" className="block text-center text-sm text-stone-500 hover:underline">
          ← Back to website
        </Link>
      </form>
    </div>
  )
}

function useAdminCheck(user, businessId) {
  const [state, setState] = useState({ checking: true, isAdmin: false, error: null })
  useEffect(() => {
    let active = true
    if (!user || !businessId) {
      setState({ checking: false, isAdmin: false, error: null })
      return
    }
    setState({ checking: true, isAdmin: false, error: null })
    api
      .isAdmin(businessId)
      .then((ok) => active && setState({ checking: false, isAdmin: ok, error: null }))
      .catch((error) => active && setState({ checking: false, isAdmin: false, error }))
    return () => {
      active = false
    }
  }, [user, businessId])
  return state
}

export default function AdminApp() {
  const { user, ready } = useAuth()
  const { business, loading: bizLoading, error: bizError, reload } = useBusiness()
  const { checking, isAdmin, error } = useAdminCheck(user, business?.id)

  if (!ready || bizLoading) return <Loading label="Loading…" />
  if (bizError)
    return (
      <div className="container-page py-16">
        <ErrorBox error={bizError} onRetry={reload} />
      </div>
    )
  if (!user) return <AdminLogin />
  if (checking) return <Loading label="Checking access…" />
  if (!isAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md space-y-4 p-6 text-center">
          <h1 className="text-xl font-semibold">No admin access</h1>
          <p className="text-sm text-stone-600">
            {user.email} is not an admin for {business.name}. Ask the owner to add you (see README → “Create an admin user”).
          </p>
          <ErrorBox error={error} />
          <button type="button" className="btn-secondary" onClick={() => api.signOut()}>
            Log out
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-stone-50">
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/admin" className="font-display text-lg font-semibold">
            {business.name} <span className="font-sans text-xs font-medium text-stone-500">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/" target="_blank" className="btn-ghost btn-sm hidden sm:inline-flex">
              <ExternalLink className="h-4 w-4" /> View site
            </Link>
            <button type="button" className="btn-ghost btn-sm" onClick={() => api.signOut()} aria-label="Log out">
              <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="gallery" element={<AdminGallery />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<p className="text-stone-600">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  )
}
