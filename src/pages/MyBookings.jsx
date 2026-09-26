import { useState } from 'react'
import { LogOut, Mail, Search } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { DEMO_MODE } from '../lib/config.js'
import { formatDateTime } from '../lib/format.js'
import { EmptyState, ErrorBox, Field, Loading, Notice, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx'
import PaymentInstructions from '../components/booking/PaymentInstructions.jsx'

function LookupForm({ business }) {
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const b = await api.lookupBooking(reference.trim(), phone.trim())
      if (!b) setError('We couldn’t find a booking with that reference and mobile number.')
      else setResult(b)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
        <Field label="Booking reference" htmlFor="ref">
          <input id="ref" className="input font-mono uppercase" value={reference} onChange={(e) => setReference(e.target.value)} required maxLength={12} placeholder="e.g. 3F9A1C2B" />
        </Field>
        <Field label="Mobile number used" htmlFor="lookup-phone">
          <input id="lookup-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4 text-white" /> : <Search className="h-4 w-4" />} Find booking
        </button>
      </form>
      <ErrorBox error={error} />
      {result && <PaymentInstructions booking={result} business={business} />}
    </div>
  )
}

function LoginOptions() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ busy: false, error: null, sent: false })

  const facebook = async () => {
    setState({ busy: true, error: null, sent: false })
    try {
      await api.signInWithFacebook('/my-bookings')
    } catch (e) {
      setState({ busy: false, error: e, sent: false })
    }
  }
  const emailLink = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: null, sent: false })
    try {
      await api.signInWithEmailLink(email.trim(), '/my-bookings')
      setState({ busy: false, error: null, sent: true })
    } catch (err) {
      setState({ busy: false, error: err, sent: false })
    }
  }

  return (
    <div className="card space-y-4 p-5 sm:p-6">
      <h2 className="font-sans text-lg font-semibold">See all your bookings</h2>
      <p className="text-sm text-stone-600">Log in to see every booking you make with the same Facebook account or email.</p>
      {DEMO_MODE && <Notice tone="warn">Customer login works once the site is connected to Supabase.</Notice>}
      <button type="button" onClick={facebook} className="btn w-full bg-[#0866FF] text-white hover:bg-[#0756d6]" disabled={state.busy}>
        <Facebook className="h-4 w-4" /> Continue with Facebook
      </button>
      <form onSubmit={emailLink} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="login-email" className="sr-only">
          Email
        </label>
        <input id="login-email" type="email" required className="input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn-secondary shrink-0" disabled={state.busy}>
          <Mail className="h-4 w-4" /> Email me a link
        </button>
      </form>
      {state.sent && <Notice tone="success">Check your inbox for a login link.</Notice>}
      <ErrorBox error={state.error} />
    </div>
  )
}

function MyBookingsList({ business }) {
  const { data, error, loading, reload } = useAsync(() => api.getMyBookings(), [])
  const [open, setOpen] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return
    setBusyId(id)
    setActionError(null)
    try {
      await api.cancelMyBooking(id)
      await reload()
    } catch (e) {
      setActionError(e)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading />
  return (
    <div className="space-y-4">
      <ErrorBox error={error || actionError} onRetry={error ? reload : undefined} />
      {data?.length === 0 && (
        <EmptyState>
          No bookings linked to this login yet. Bookings made while logged in will appear here — or look one up with its reference below.
        </EmptyState>
      )}
      {(data || []).map((b) => (
        <div key={b.booking_id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{b.services.map((s) => s.name).join(' + ')}</p>
              <p className="text-sm text-stone-600">
                {formatDateTime(b.start_time, business.timezone)} · {b.staff_name} · Ref <span className="font-mono">{b.reference}</span>
              </p>
            </div>
            <StatusBadge status={b.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(open === b.booking_id ? null : b.booking_id)}>
              {open === b.booking_id ? 'Hide details' : b.status === 'pending' ? 'Payment details' : 'Details'}
            </button>
            {b.status === 'pending' && (
              <button type="button" className="btn-danger btn-sm" onClick={() => cancel(b.booking_id)} disabled={busyId === b.booking_id}>
                Cancel booking
              </button>
            )}
          </div>
          {open === b.booking_id && (
            <div className="mt-4">
              <PaymentInstructions booking={b} business={business} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function MyBookings() {
  const { business } = useBusiness()
  const { user, ready } = useAuth()

  return (
    <>
      <PageHeader eyebrow="Your appointments" title="My booking">
        Look up a booking with your reference and mobile number, or log in to see them all.
      </PageHeader>
      <div className="container-page max-w-3xl space-y-10 py-10">
        {ready && user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Hi{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}!</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={() => api.signOut()}>
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
            <MyBookingsList business={business} />
          </section>
        )}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Find a booking</h2>
          <LookupForm business={business} />
        </section>
        {ready && !user && <LoginOptions />}
      </div>
    </>
  )
}
