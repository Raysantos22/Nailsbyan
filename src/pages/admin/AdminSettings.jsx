import { useState } from 'react'
import { Plus, Trash2, Save, QrCode } from 'lucide-react'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { DEMO_MODE } from '../../lib/config.js'
import { DAY_KEYS, DAY_NAMES } from '../../lib/format.js'
import { ErrorBox, Field, Notice, Spinner } from '../../components/ui.jsx'
import { AdminTitle, ImageUpload } from './adminUi.jsx'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-stone-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PaymentQr({ business, onSaved }) {
  const [error, setError] = useState(null)
  const save = async (fields) => {
    setError(null)
    try {
      await onSaved(fields)
    } catch (e) {
      setError(e)
    }
  }
  return (
    <Section title="Payment QR code" description="Shown to customers right after they book, with instructions to send proof on Messenger.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-44 shrink-0">
          {business.payment_qr_url ? (
            <img src={business.payment_qr_url} alt="Current payment QR code" className="w-full rounded-xl border border-stone-200 p-2" data-testid="admin-qr" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-stone-300 text-stone-400">
              <QrCode className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="space-y-3">
          <ImageUpload businessId={business.id} folder="payment" label="Upload new QR code" onUploaded={({ url }) => save({ payment_qr_url: url })} />
          {business.payment_qr_url && (
            <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => window.confirm('Remove the QR code?') && save({ payment_qr_url: null })}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
          <p className="text-xs text-stone-500">Tip: screenshot the QR from your GCash / bank app and crop it. PNG or JPG, under 10 MB.</p>
          <ErrorBox error={error} />
        </div>
      </div>
    </Section>
  )
}

function Testimonials({ business }) {
  const list = useAsync(() => api.listTestimonials(business.id, { includeUnpublished: true }), [business.id])
  const [draft, setDraft] = useState({ author_name: '', body: '', rating: 5 })
  const [error, setError] = useState(null)

  const run = async (fn) => {
    setError(null)
    try {
      await fn()
      await list.reload()
    } catch (e) {
      setError(e)
    }
  }
  const add = (e) => {
    e.preventDefault()
    if (!draft.author_name.trim() || !draft.body.trim()) return
    run(async () => {
      await api.saveTestimonial({
        business_id: business.id,
        author_name: draft.author_name.trim(),
        body: draft.body.trim(),
        rating: Number(draft.rating),
        source: 'Facebook',
        sort_order: (list.data || []).length + 1,
      })
      setDraft({ author_name: '', body: '', rating: 5 })
    })
  }

  return (
    <Section title="Testimonials" description="Shown on the home page. Copy your favourite Facebook reviews here.">
      <ul className="space-y-2">
        {(list.data || []).map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 p-3 text-sm">
            <div className={t.is_published ? '' : 'opacity-50'}>
              <p className="font-semibold">
                {t.author_name} · {'★'.repeat(t.rating || 5)}
              </p>
              <p className="text-stone-600">{t.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn-ghost btn-sm" onClick={() => run(() => api.saveTestimonial({ id: t.id, is_published: !t.is_published }))}>
                {t.is_published ? 'Hide' : 'Show'}
              </button>
              <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => window.confirm('Delete?') && run(() => api.deleteTestimonial(t.id))} aria-label="Delete testimonial">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder="Customer name" value={draft.author_name} onChange={(e) => setDraft((d) => ({ ...d, author_name: e.target.value }))} aria-label="Customer name" />
        <select className="input w-auto" value={draft.rating} onChange={(e) => setDraft((d) => ({ ...d, rating: e.target.value }))} aria-label="Rating">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
        <textarea className="input min-h-16 sm:col-span-2" placeholder="What they said" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} aria-label="Review text" />
        <div className="sm:col-span-2">
          <button type="submit" className="btn-secondary btn-sm">
            <Plus className="h-4 w-4" /> Add testimonial
          </button>
        </div>
      </form>
      <div className="mt-2">
        <ErrorBox error={error || list.error} />
      </div>
    </Section>
  )
}

export default function AdminSettings() {
  const { business, setBusiness } = useBusiness()
  const [form, setForm] = useState(() => ({
    ...business,
    hours_json: WEEK_ORDER.reduce((acc, d) => ({ ...acc, [DAY_KEYS[d]]: business.hours_json?.[DAY_KEYS[d]] ?? null }), {}),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const set = (k) => (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }
  const setHours = (key, value) => {
    setSaved(false)
    setForm((f) => ({ ...f, hours_json: { ...f.hours_json, [key]: value } }))
  }

  const updateBusiness = async (fields) => {
    const updated = await api.updateBusiness(business.id, fields)
    setBusiness(updated)
    setForm((f) => ({ ...f, ...fields }))
    return updated
  }

  const save = async (e) => {
    e.preventDefault()
    for (const [k, h] of Object.entries(form.hours_json)) {
      if (h && (!h.open || !h.close || h.close <= h.open)) {
        setError(`Opening hours for ${DAY_NAMES[DAY_KEYS.indexOf(k)]}: closing time must be after opening time.`)
        return
      }
    }
    const ints = { booking_window_days: [1, 365], min_notice_hours: [0, 336], slot_interval_minutes: [5, 240], pending_expiry_hours: [1, 168] }
    for (const [k, [min, max]] of Object.entries(ints)) {
      const v = Number(form[k])
      if (!Number.isInteger(v) || v < min || v > max) {
        setError(`${k.replace(/_/g, ' ')} must be a whole number between ${min} and ${max}.`)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      await updateBusiness({
        name: form.name.trim(),
        tagline: form.tagline?.trim() || null,
        description: form.description?.trim() || null,
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        facebook_page_url: form.facebook_page_url?.trim() || null,
        messenger_id: form.messenger_id?.trim() || null,
        instagram_handle: form.instagram_handle?.trim() || null,
        hours_json: form.hours_json,
        payment_method_label: form.payment_method_label?.trim() || null,
        payment_instructions: form.payment_instructions?.trim() || null,
        deposit_amount: Number(form.deposit_amount) || 0,
        booking_window_days: Number(form.booking_window_days),
        min_notice_hours: Number(form.min_notice_hours),
        slot_interval_minutes: Number(form.slot_interval_minutes),
        pending_expiry_hours: Number(form.pending_expiry_hours),
        cancellation_policy: form.cancellation_policy?.trim() || null,
        no_show_policy: form.no_show_policy?.trim() || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const resetDemo = async () => {
    if (!window.confirm('Reset all demo data (bookings, edits, uploads) back to the original seed?')) return
    await api.resetDemoData()
    window.location.reload()
  }

  const SaveBar = (
    <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-3 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:rounded-2xl sm:border">
      {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save settings
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <AdminTitle title="Settings" />
      <PaymentQr business={business} onSaved={updateBusiness} />

      <form onSubmit={save} className="space-y-6">
        <Section title="Salon details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="s-name">
              <input id="s-name" className="input" value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Tagline" htmlFor="s-tagline">
              <input id="s-tagline" className="input" value={form.tagline || ''} onChange={set('tagline')} />
            </Field>
            <Field label="Description" htmlFor="s-desc" className="sm:col-span-2">
              <textarea id="s-desc" className="input min-h-20" value={form.description || ''} onChange={set('description')} />
            </Field>
            <Field label="Address" htmlFor="s-address" hint="Shown on the Contact page with a map." className="sm:col-span-2">
              <input id="s-address" className="input" value={form.address || ''} onChange={set('address')} />
            </Field>
            <Field label="Phone" htmlFor="s-phone">
              <input id="s-phone" className="input" value={form.phone || ''} onChange={set('phone')} />
            </Field>
            <Field label="Email" htmlFor="s-email">
              <input id="s-email" type="email" className="input" value={form.email || ''} onChange={set('email')} />
            </Field>
            <Field label="Facebook Page URL" htmlFor="s-fb">
              <input id="s-fb" className="input" value={form.facebook_page_url || ''} onChange={set('facebook_page_url')} />
            </Field>
            <Field label="Messenger ID (page ID or username)" htmlFor="s-msg" hint="Used for m.me links, e.g. 61556891524730">
              <input id="s-msg" className="input" value={form.messenger_id || ''} onChange={set('messenger_id')} />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {business.logo_url && <img src={business.logo_url} alt="Logo" className="h-14 w-14 rounded-full object-cover ring-1 ring-stone-200" />}
            <ImageUpload businessId={business.id} folder="branding" label="Upload logo" onUploaded={({ url }) => updateBusiness({ logo_url: url })} />
          </div>
        </Section>

        <Section title="Opening hours" description="Shown on the website. Bookable times come from each staff member’s working hours (Staff page).">
          <div className="space-y-2">
            {WEEK_ORDER.map((d) => {
              const key = DAY_KEYS[d]
              const h = form.hours_json[key]
              return (
                <div key={key} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-sm font-medium">{DAY_NAMES[d]}</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={!!h}
                      onChange={(e) => setHours(key, e.target.checked ? { open: '09:00', close: '18:00' } : null)}
                    />
                    Open
                  </label>
                  {h && (
                    <>
                      <input type="time" className="input w-auto py-1.5" value={h.open} onChange={(e) => setHours(key, { ...h, open: e.target.value })} aria-label={`${DAY_NAMES[d]} opens`} />
                      <span>–</span>
                      <input type="time" className="input w-auto py-1.5" value={h.close} onChange={(e) => setHours(key, { ...h, close: e.target.value })} aria-label={`${DAY_NAMES[d]} closes`} />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Booking rules & payments">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={`Deposit amount (${business.currency})`} htmlFor="s-deposit" hint="0 = no deposit shown">
              <input id="s-deposit" type="number" min="0" step="1" className="input" value={form.deposit_amount} onChange={set('deposit_amount')} />
            </Field>
            <Field label="Payment method label" htmlFor="s-method" hint="e.g. GCash, BPI, Maya">
              <input id="s-method" className="input" value={form.payment_method_label || ''} onChange={set('payment_method_label')} />
            </Field>
            <Field label="Hold unpaid bookings for (hours)" htmlFor="s-expiry">
              <input id="s-expiry" type="number" min="1" max="168" className="input" value={form.pending_expiry_hours} onChange={set('pending_expiry_hours')} />
            </Field>
            <Field label="Book up to (days ahead)" htmlFor="s-window">
              <input id="s-window" type="number" min="1" max="365" className="input" value={form.booking_window_days} onChange={set('booking_window_days')} />
            </Field>
            <Field label="Minimum notice (hours)" htmlFor="s-notice">
              <input id="s-notice" type="number" min="0" max="336" className="input" value={form.min_notice_hours} onChange={set('min_notice_hours')} />
            </Field>
            <Field label="Time slot every (minutes)" htmlFor="s-interval">
              <select id="s-interval" className="input" value={form.slot_interval_minutes} onChange={set('slot_interval_minutes')}>
                {[15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment instructions" htmlFor="s-instr" className="sm:col-span-2 lg:col-span-3">
              <textarea id="s-instr" className="input min-h-20" value={form.payment_instructions || ''} onChange={set('payment_instructions')} />
            </Field>
            <Field label="Cancellation / rescheduling policy" htmlFor="s-cancel" className="sm:col-span-2 lg:col-span-3">
              <textarea id="s-cancel" className="input min-h-16" value={form.cancellation_policy || ''} onChange={set('cancellation_policy')} />
            </Field>
            <Field label="No-show policy" htmlFor="s-noshow" className="sm:col-span-2 lg:col-span-3">
              <textarea id="s-noshow" className="input min-h-16" value={form.no_show_policy || ''} onChange={set('no_show_policy')} />
            </Field>
          </div>
        </Section>

        <ErrorBox error={error} />
        {SaveBar}
      </form>

      <Testimonials business={business} />

      {DEMO_MODE && (
        <Section title="Demo data">
          <Notice tone="warn">Everything in demo mode is stored in this browser only.</Notice>
          <button type="button" className="btn-danger mt-3" onClick={resetDemo}>
            Reset demo data
          </button>
        </Section>
      )}
    </div>
  )
}
