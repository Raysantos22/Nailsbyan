import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, Ban, UserX, BadgeCheck, Send, Phone, Mail, MessageCircle, StickyNote } from 'lucide-react'
import { api } from '../../lib/api/index.js'
import { formatDate, formatDuration, formatMoney, formatTime } from '../../lib/format.js'
import { ErrorBox, Spinner, StatusBadge } from '../../components/ui.jsx'

export function AdminTitle({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, textarea, select, button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-sans text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const MAX_UPLOAD_MB = 10
export function ImageUpload({ businessId, folder, label = 'Upload image', onUploaded, multiple = false, className = '' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const input = useRef(null)

  const onChange = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`${file.name} is larger than ${MAX_UPLOAD_MB} MB.`)
        const result = await api.uploadImage(businessId, folder, file)
        await onUploaded(result, file)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <input ref={input} type="file" accept="image/*" multiple={multiple} className="sr-only" onChange={onChange} aria-label={label} />
      <button type="button" className="btn-secondary" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} {busy ? 'Uploading…' : label}
      </button>
      {error && (
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      )}
    </div>
  )
}

// One booking with every admin action. `onChanged` is called after any action.
export function BookingCard({ booking: b, business, onChanged, compact = false }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [info, setInfo] = useState(null)
  const tz = business.timezone
  const currency = business.currency

  const act = async (name, fn) => {
    setBusy(name)
    setError(null)
    setInfo(null)
    try {
      await fn()
      await onChanged?.()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  const confirmPayment = () =>
    act('confirm', async () => {
      await api.confirmPayment(b.id, note.trim() || null)
      setConfirming(false)
      setNote('')
    })
  const cancel = () => {
    const reason = window.prompt('Cancel this booking? Optional reason (shown to staff only):', '')
    if (reason === null) return
    act('cancel', () => api.setBookingStatus(b.id, 'cancelled', reason || null))
  }
  const mark = (status) => act(status, () => api.setBookingStatus(b.id, status))
  const resend = () =>
    act('resend', async () => {
      await api.resendConfirmation(b.id)
      setInfo('Confirmation sent (see notification log).')
    })

  const phoneHref = b.customer.phone ? `tel:${b.customer.phone.replace(/\s/g, '')}` : null
  const expiresSoon = b.status === 'pending' && b.expires_at

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4" data-testid="admin-booking" data-reference={b.reference}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {formatDate(b.start_time, tz)} · {formatTime(b.start_time, tz)}–{formatTime(b.end_time, tz)}
            <span className="font-normal text-stone-500"> · {b.staff?.name || 'Unassigned'}</span>
          </p>
          <p className="mt-0.5 font-semibold">{b.customer.name}</p>
          <p className="text-sm text-stone-600">{b.services.map((s) => s.name).join(' + ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={b.status} />
          <span className="font-mono text-xs text-stone-500">{b.reference}</span>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 grid gap-1 text-sm text-stone-600 sm:grid-cols-2">
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {phoneHref ? (
              <a href={phoneHref} className="hover:underline">
                {b.customer.phone}
              </a>
            ) : (
              '—'
            )}
          </p>
          {b.customer.email && (
            <p className="flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <a href={`mailto:${b.customer.email}`} className="truncate hover:underline">
                {b.customer.email}
              </a>
            </p>
          )}
          <p>
            {formatMoney(b.total_price, currency)} · {formatDuration(b.total_duration)}
          </p>
          {b.payment && (
            <p>
              Deposit {formatMoney(b.payment.amount_expected, currency)}:{' '}
              <span className={b.payment.status === 'received' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                {b.payment.status === 'received' ? 'received' : 'awaiting proof'}
              </span>
              {b.payment.reference_note && <span className="text-stone-500"> · {b.payment.reference_note}</span>}
            </p>
          )}
          {b.notes && (
            <p className="flex items-start gap-1.5 sm:col-span-2">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span className="whitespace-pre-line">{b.notes}</span>
            </p>
          )}
          {expiresSoon && (
            <p className="text-xs text-amber-700 sm:col-span-2">Auto-cancels {formatDate(b.expires_at, tz)} {formatTime(b.expires_at, tz)} if unpaid.</p>
          )}
          {b.cancelled_reason && b.status === 'cancelled' && <p className="text-xs text-stone-500 sm:col-span-2">{b.cancelled_reason}</p>}
          {b.notifications?.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-stone-500 sm:col-span-2">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {b.notifications
                .slice(0, 3)
                .map((n) => `${n.channel}: ${n.status}`)
                .join(' · ')}
            </p>
          )}
        </div>
      )}

      {confirming && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3">
          <label htmlFor={`note-${b.id}`} className="text-sm font-medium text-emerald-900">
            Payment reference / note (optional)
          </label>
          <input
            id={`note-${b.id}`}
            className="input mt-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. GCash ref 1234 5678"
            onKeyDown={(e) => e.key === 'Enter' && confirmPayment()}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmPayment} disabled={!!busy}>
              {busy === 'confirm' ? <Spinner className="h-4 w-4 text-white" /> : <CheckCircle2 className="h-4 w-4" />} Payment received — confirm
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(b.status === 'pending' || (b.status === 'cancelled' && b.cancelled_reason?.startsWith('Auto-cancelled'))) && (
            <button
              type="button"
              className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setConfirming(true)}
              disabled={!!busy}
            >
              <CheckCircle2 className="h-4 w-4" /> {b.status === 'cancelled' ? 'Reinstate & confirm payment' : 'Confirm payment'}
            </button>
          )}
          {b.status === 'confirmed' && (
            <>
              <button type="button" className="btn-secondary btn-sm" onClick={() => mark('completed')} disabled={!!busy}>
                {busy === 'completed' ? <Spinner className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />} Completed
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => mark('no_show')} disabled={!!busy}>
                {busy === 'no_show' ? <Spinner className="h-4 w-4" /> : <UserX className="h-4 w-4" />} No-show
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={resend} disabled={!!busy}>
                {busy === 'resend' ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Resend confirmation
              </button>
            </>
          )}
          {(b.status === 'completed' || b.status === 'no_show') && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => mark(b.status === 'completed' ? 'no_show' : 'completed')} disabled={!!busy}>
              Mark {b.status === 'completed' ? 'no-show' : 'completed'} instead
            </button>
          )}
          {(b.status === 'pending' || b.status === 'confirmed') && (
            <button type="button" className="btn-danger btn-sm" onClick={cancel} disabled={!!busy}>
              {busy === 'cancel' ? <Spinner className="h-4 w-4" /> : <Ban className="h-4 w-4" />} Cancel
            </button>
          )}
        </div>
      )}
      {info && <p className="mt-2 text-xs text-emerald-700">{info}</p>}
      {error && (
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      )}
    </article>
  )
}
