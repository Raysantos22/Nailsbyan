import { AlertCircle, Loader2 } from 'lucide-react'
import { STATUS_LABELS, STATUS_STYLES } from '../lib/format.js'

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-stone-500" role="status">
      <Spinner />
      {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message || 'Something went wrong.'
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ children, tone = 'info', className = '' }) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return <div className={`rounded-xl border p-4 text-sm ${tones[tone]} ${className}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="dot-texture bg-mist py-10 sm:py-14">
      <div className="container-page text-center">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.2em] text-brand-600 uppercase">{eyebrow}</p>}
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-[0.08em] text-ink uppercase sm:text-4xl">{title}</h1>
        {children && <div className="mx-auto mt-3 max-w-2xl text-stone-600">{children}</div>}
      </div>
    </header>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLES[status] || 'bg-stone-100 text-stone-700'}`}>{STATUS_LABELS[status] || status}</span>
}

export function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-brand-200 p-8 text-center text-sm text-stone-500">{children}</div>
}

export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
