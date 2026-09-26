import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, Clock, User, Users } from 'lucide-react'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { addDays, dateLabel, formatDateTime, formatDuration, formatMoney, formatTime, todayIn } from '../lib/format.js'
import { groupByCategory, isAddonAvailable, summarize, toggleService } from '../lib/services.js'
import { ErrorBox, Field, Loading, Notice, PageHeader, Spinner } from '../components/ui.jsx'
import PaymentInstructions from '../components/booking/PaymentInstructions.jsx'

const STEPS = ['Services', 'Staff', 'Date & time', 'Your details', 'Confirm']

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1 text-xs sm:gap-2 sm:text-sm" aria-label="Booking steps">
      {STEPS.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={label} className="flex shrink-0 items-center gap-1 sm:gap-2" aria-current={current ? 'step' : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                done ? 'bg-brand-600 text-white' : current ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`${current ? 'font-semibold text-ink' : 'text-stone-500'} ${current ? '' : 'hidden sm:inline'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-stone-300 sm:w-8" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

// Sticky summary bar with running total and the Continue button.
function SummaryBar({ summary, currency, onNext, nextLabel = 'Continue', disabled, busy }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-brand-100 bg-cream/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm">
          {summary.items.length ? (
            <>
              <p className="truncate font-semibold text-ink">
                {formatMoney(summary.total, currency)} · {formatDuration(summary.duration)}
              </p>
              <p className="truncate text-xs text-stone-500">{summary.items.map((s) => s.name).join(' + ')}</p>
            </>
          ) : (
            <p className="text-stone-500">Choose a service to start</p>
          )}
        </div>
        {/* mr leaves room for the floating Messenger button on small screens */}
        <button type="button" className="btn-primary mr-14 shrink-0 sm:mr-0" onClick={onNext} disabled={disabled || busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />}
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

function StepServices({ services, selected, setSelected, currency }) {
  const main = services.filter((s) => !s.is_addon)
  const addons = services.filter((s) => s.is_addon)
  const mainSelected = selected.filter((id) => main.some((s) => s.id === id))
  const byId = Object.fromEntries(services.map((s) => [s.id, s]))

  const renderOption = (s, disabled = false) => {
    const checked = selected.includes(s.id)
    return (
      <label
        key={s.id}
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
          checked ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-brand-100 bg-white hover:border-brand-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-brand-600"
          checked={checked}
          disabled={disabled}
          onChange={() => setSelected(toggleService(selected, s, services))}
        />
        <span className="flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="font-semibold">{s.name}</span>
            <span className="font-semibold whitespace-nowrap">
              {s.is_addon && '+'}
              {formatMoney(s.price, currency)}
            </span>
          </span>
          {s.description && <span className="mt-0.5 block text-sm text-stone-600">{s.description}</span>}
          <span className="mt-1 flex items-center gap-1 text-xs text-stone-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {s.is_addon && '+'}
            {formatDuration(s.duration_minutes)}
            {s.parent_service_id && byId[s.parent_service_id] && ` · only with ${byId[s.parent_service_id].name}`}
          </span>
        </span>
      </label>
    )
  }

  return (
    <div className="space-y-8">
      {groupByCategory(main).map(([category, items]) => (
        <fieldset key={category}>
          <legend className="mb-3 font-display text-xl font-semibold">{category}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((s) => renderOption(s))}
          </div>
        </fieldset>
      ))}
      {addons.length > 0 && (
        <fieldset>
          <legend className="mb-1 font-display text-xl font-semibold">Add-ons</legend>
          <p className="mb-3 text-sm text-stone-600">
            {mainSelected.length ? 'Optional extras for your appointment.' : 'Choose a main service first to add extras.'}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {addons.map((s) => renderOption(s, !isAddonAvailable(s, mainSelected)))}
          </div>
        </fieldset>
      )}
    </div>
  )
}

function StepStaff({ staff, staffId, setStaffId }) {
  const options = [{ id: '', name: 'Any available', bio: 'First available nail tech — the most time options.' }, ...staff]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Choose staff">
      {options.map((s) => {
        const checked = staffId === s.id
        return (
          <label
            key={s.id || 'any'}
            className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
              checked ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-brand-100 bg-white hover:border-brand-300'
            }`}
          >
            <input type="radio" name="staff" className="sr-only" checked={checked} onChange={() => setStaffId(s.id)} />
            {s.photo_url ? (
              <img src={s.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                {s.id ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              </span>
            )}
            <span>
              <span className="block font-semibold">{s.name}</span>
              {s.bio && <span className="block text-sm text-stone-600">{s.bio}</span>}
            </span>
            {checked && <Check className="ml-auto h-5 w-5 text-brand-600" aria-hidden="true" />}
          </label>
        )
      })}
    </div>
  )
}

function StepDateTime({ business, serviceIds, staffId, date, setDate, slot, setSlot, refreshKey }) {
  const tz = business.timezone
  const today = todayIn(tz)
  const last = addDays(today, business.booking_window_days)

  const dates = useAsync(
    () => api.getAvailableDates({ businessId: business.id, serviceIds, from: today, to: last, staffId: staffId || null }),
    [business.id, serviceIds.join(','), staffId, today, last, refreshKey],
  )
  const counts = useMemo(() => Object.fromEntries((dates.data || []).map((d) => [d.day, d.slot_count])), [dates.data])

  // Pick the first date with availability if none (or an unavailable one) is chosen.
  useEffect(() => {
    if (!dates.data) return
    if (!date || !counts[date]) {
      const first = dates.data.find((d) => d.slot_count > 0)
      setDate(first ? first.day : null)
    }
  }, [dates.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useAsync(
    () => api.getAvailableSlots({ businessId: business.id, serviceIds, date, staffId: staffId || null }),
    [business.id, serviceIds.join(','), staffId, date, refreshKey],
    { enabled: !!date },
  )

  const groups = useMemo(() => {
    const g = { Morning: [], Afternoon: [], Evening: [] }
    for (const s of slots.data || []) {
      const hour = Number(new Date(s.slot_start).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }))
      g[hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'].push(s)
    }
    return Object.entries(g).filter(([, v]) => v.length)
  }, [slots.data, tz])

  const dayList = []
  for (let d = today; d <= last; d = addDays(d, 1)) dayList.push(d)
  const anyAvailable = (dates.data || []).some((d) => d.slot_count > 0)

  return (
    <div className="space-y-6">
      <ErrorBox error={dates.error} onRetry={dates.reload} />
      <div>
        <h2 className="mb-3 font-sans text-sm font-semibold text-stone-700">Choose a date</h2>
        {dates.loading && !dates.data ? (
          <Loading label="Checking availability…" />
        ) : (
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2" role="listbox" aria-label="Dates">
            {dayList.map((d) => {
              const lbl = dateLabel(d)
              const n = counts[d] || 0
              const selected = d === date
              return (
                <button
                  key={d}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!n}
                  onClick={() => {
                    setDate(d)
                    setSlot(null)
                  }}
                  data-date={d}
                  className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border px-2 py-2.5 text-center transition ${
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : n
                        ? 'border-brand-100 bg-white hover:border-brand-400'
                        : 'cursor-not-allowed border-stone-100 bg-stone-50 text-stone-400'
                  }`}
                  aria-label={`${lbl.long}${n ? `, ${n} times available` : ', unavailable'}`}
                >
                  <span className="text-[11px] font-medium uppercase">{lbl.weekday}</span>
                  <span className="text-lg leading-tight font-semibold">{lbl.day}</span>
                  <span className="text-[11px]">{lbl.month}</span>
                </button>
              )
            })}
          </div>
        )}
        {dates.data && !anyAvailable && (
          <Notice tone="warn" className="mt-3">
            No times are available in the next {business.booking_window_days} days for this selection. Try another staff member or
            message us on Messenger.
          </Notice>
        )}
      </div>

      {date && (
        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold text-stone-700">
            Available times on {dateLabel(date).long}
          </h2>
          <ErrorBox error={slots.error} onRetry={slots.reload} />
          {slots.loading ? (
            <Loading label="Loading times…" />
          ) : (slots.data || []).length === 0 ? (
            <Notice tone="warn">No times left on this day — please pick another date.</Notice>
          ) : (
            <div className="space-y-4">
              {groups.map(([label, items]) => (
                <div key={label}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {items.map((s) => {
                      const selected = slot?.slot_start === s.slot_start
                      return (
                        <button
                          key={s.slot_start}
                          type="button"
                          onClick={() => setSlot(s)}
                          aria-pressed={selected}
                          className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                            selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-100 bg-white hover:border-brand-400'
                          }`}
                        >
                          {formatTime(s.slot_start, tz)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function validateDetails(d) {
  const errors = {}
  if (d.name.trim().length < 2) errors.name = 'Please enter your name.'
  const digits = d.phone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) errors.phone = 'Please enter a valid mobile number.'
  if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) errors.email = 'Please enter a valid email address.'
  if (d.notes.length > 1000) errors.notes = 'Please keep notes under 1000 characters.'
  if (!d.agree) errors.agree = 'Please accept the booking policy to continue.'
  return errors
}

function StepDetails({ business, details, setDetails, errors }) {
  const { user } = useAuth()
  const set = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {!user && (
        <Notice className="md:col-span-2">
          No account needed — just your name and mobile number.{' '}
          <Link to="/my-bookings" className="font-semibold underline">
            Log in with Facebook
          </Link>{' '}
          if you&apos;d like to see all your bookings in one place.
        </Notice>
      )}
      <Field label="Full name *" htmlFor="name" error={errors.name}>
        <input id="name" className="input" autoComplete="name" value={details.name} onChange={set('name')} />
      </Field>
      <Field label="Mobile number *" htmlFor="phone" error={errors.phone} hint="We'll use this to contact you about your booking.">
        <input id="phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={details.phone} onChange={set('phone')} />
      </Field>
      <Field label="Email (optional)" htmlFor="email" error={errors.email} hint="For your confirmation email.">
        <input id="email" className="input" type="email" autoComplete="email" value={details.email} onChange={set('email')} />
      </Field>
      <Field label="Notes (optional)" htmlFor="notes" error={errors.notes} className="md:col-span-2" hint="Design ideas, nail length, allergies…">
        <textarea id="notes" className="input min-h-24" value={details.notes} onChange={set('notes')} maxLength={1000} />
      </Field>
      <div className="md:col-span-2">
        <div className="rounded-xl bg-white p-4 text-sm text-stone-600 ring-1 ring-brand-100">
          <p className="font-semibold text-ink">Booking policy</p>
          {Number(business.deposit_amount) > 0 && (
            <p className="mt-1">
              A {formatMoney(business.deposit_amount, business.currency)} deposit via {business.payment_method_label || 'QR payment'} is needed to
              confirm your slot. Unpaid bookings are released after {business.pending_expiry_hours} hours.
            </p>
          )}
          {business.cancellation_policy && <p className="mt-1">{business.cancellation_policy}</p>}
          {business.no_show_policy && <p className="mt-1">{business.no_show_policy}</p>}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={details.agree} onChange={set('agree')} />
          <span>I understand and accept the booking policy.</span>
        </label>
        {errors.agree && <p className="mt-1 text-xs text-red-600">{errors.agree}</p>}
      </div>
    </div>
  )
}

function StepReview({ business, summary, staffName, slot, details }) {
  const tz = business.timezone
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-sans text-lg font-semibold">Check your booking</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="text-stone-500">When</dt>
        <dd className="font-medium">
          {formatDateTime(slot.slot_start, tz)} – {formatTime(slot.slot_end, tz)}
        </dd>
        <dt className="text-stone-500">With</dt>
        <dd>{staffName}</dd>
        <dt className="text-stone-500">Services</dt>
        <dd>
          <ul>
            {summary.items.map((s) => (
              <li key={s.id}>
                {s.name} <span className="text-stone-500">· {formatMoney(s.price, business.currency)}</span>
              </li>
            ))}
          </ul>
        </dd>
        <dt className="text-stone-500">Total</dt>
        <dd className="font-semibold">
          {formatMoney(summary.total, business.currency)} <span className="font-normal text-stone-500">· {formatDuration(summary.duration)}</span>
        </dd>
        {Number(business.deposit_amount) > 0 && (
          <>
            <dt className="text-stone-500">Deposit</dt>
            <dd>
              {formatMoney(Math.min(Number(business.deposit_amount), summary.total), business.currency)} now via QR · rest on the day
            </dd>
          </>
        )}
        <dt className="text-stone-500">Name</dt>
        <dd>{details.name}</dd>
        <dt className="text-stone-500">Mobile</dt>
        <dd>{details.phone}</dd>
        {details.email && (
          <>
            <dt className="text-stone-500">Email</dt>
            <dd>{details.email}</dd>
          </>
        )}
        {details.notes && (
          <>
            <dt className="text-stone-500">Notes</dt>
            <dd className="whitespace-pre-line">{details.notes}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

export default function Book() {
  const { business } = useBusiness()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const services = useAsync(() => api.listServices(business.id), [business.id])
  const staff = useAsync(() => api.listStaff(business.id), [business.id])

  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState([])
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(null)
  const [slot, setSlot] = useState(null)
  const [details, setDetails] = useState({ name: '', phone: '', email: '', notes: '', agree: false })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [booking, setBooking] = useState(null)

  // Pre-select a service from /book?service=<id>
  useEffect(() => {
    const id = params.get('service')
    if (id && services.data?.some((s) => s.id === id && !s.is_addon)) setSelected([id])
  }, [services.data, params])

  // Pre-fill from a logged-in (e.g. Facebook) customer.
  useEffect(() => {
    if (!user) return
    const meta = user.user_metadata || {}
    setDetails((d) => ({
      ...d,
      name: d.name || meta.full_name || meta.name || '',
      email: d.email || user.email || '',
    }))
  }, [user])

  // Changing services or staff invalidates the chosen time.
  useEffect(() => {
    setSlot(null)
  }, [selected, staffId])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step, booking])

  const summary = useMemo(() => summarize(selected, services.data || []), [selected, services.data])
  const staffName = staffId ? staff.data?.find((s) => s.id === staffId)?.name : 'Any available'
  const hasMain = summary.items.some((s) => !s.is_addon)

  const next = () => {
    if (step === 3) {
      const errs = validateDetails(details)
      setErrors(errs)
      if (Object.keys(errs).length) return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await api.createBooking({
        business_id: business.id,
        service_ids: selected,
        staff_id: staffId || null,
        start_time: slot.slot_start,
        customer: { name: details.name.trim(), phone: details.phone.trim(), email: details.email.trim() || null },
        notes: details.notes.trim() || null,
      })
      setBooking(result)
    } catch (e) {
      setSubmitError(e)
      if (e.hint === 'slot_unavailable') {
        setSlot(null)
        setRefreshKey((k) => k + 1)
        setStep(2)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (booking) {
    return (
      <>
        <PageHeader eyebrow="Almost done" title="Your slot is reserved!">
          Your booking is <strong>pending</strong> until we receive your deposit. Follow the steps below.
        </PageHeader>
        <div className="container-page max-w-3xl py-10">
          <PaymentInstructions booking={booking} business={business} />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" className="btn-secondary">
              Back to home
            </Link>
            <Link to="/my-bookings" className="btn-ghost">
              Find my booking later
            </Link>
          </div>
        </div>
      </>
    )
  }

  const loading = services.loading || staff.loading
  const loadError = services.error || staff.error

  return (
    <>
      <PageHeader eyebrow="Book now" title="Book your appointment" />
      <div className="container-page max-w-4xl pt-6 pb-10">
        <Stepper step={step} />
        <div className="mt-6">
          {step > 0 && (
            <button type="button" onClick={back} className="btn-ghost mb-4 -ml-3">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          {loadError && (
            <ErrorBox
              error={loadError}
              onRetry={() => {
                services.reload()
                staff.reload()
              }}
            />
          )}
          {loading ? (
            <Loading />
          ) : (
            !loadError && (
              <>
                {step === 0 && (
                  <StepServices services={services.data} selected={selected} setSelected={setSelected} currency={business.currency} />
                )}
                {step === 1 && <StepStaff staff={staff.data} staffId={staffId} setStaffId={setStaffId} />}
                {step === 2 && (
                  <>
                    {submitError?.hint === 'slot_unavailable' && (
                      <div className="mb-4">
                        <ErrorBox error={submitError} />
                      </div>
                    )}
                    <StepDateTime
                      business={business}
                      serviceIds={selected}
                      staffId={staffId}
                      date={date}
                      setDate={setDate}
                      slot={slot}
                      setSlot={setSlot}
                      refreshKey={refreshKey}
                    />
                  </>
                )}
                {step === 3 && <StepDetails business={business} details={details} setDetails={setDetails} errors={errors} />}
                {step === 4 && slot && (
                  <>
                    <StepReview business={business} summary={summary} staffName={staffName} slot={slot} details={details} />
                    {submitError && submitError.hint !== 'slot_unavailable' && (
                      <div className="mt-4">
                        <ErrorBox error={submitError} />
                      </div>
                    )}
                  </>
                )}

                <SummaryBar
                  summary={summary}
                  currency={business.currency}
                  onNext={step === 4 ? submit : next}
                  nextLabel={step === 4 ? 'Confirm booking' : 'Continue'}
                  busy={submitting}
                  disabled={(step === 0 && !hasMain) || (step === 2 && !slot) || (step === 4 && !slot)}
                />
              </>
            )
          )}
        </div>
      </div>
    </>
  )
}
