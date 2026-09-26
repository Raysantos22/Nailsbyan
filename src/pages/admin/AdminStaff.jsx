import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, User, X } from 'lucide-react'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { addDays, DAY_NAMES, formatClock, formatDateTime, todayIn, zonedToIso } from '../../lib/format.js'
import { EmptyState, ErrorBox, Field, Loading, Spinner } from '../../components/ui.jsx'
import { AdminTitle, ImageUpload, Modal } from './adminUi.jsx'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const hhmm = (t) => (t || '').slice(0, 5)

function StaffForm({ initial, businessId, onSaved, onClose }) {
  const [form, setForm] = useState({ name: '', bio: '', photo_url: '', is_active: true, sort_order: 0, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setBusy(true)
    setError(null)
    try {
      await api.saveStaff({
        id: form.id,
        business_id: businessId,
        name: form.name.trim(),
        bio: form.bio?.trim() || null,
        photo_url: form.photo_url || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        {form.photo_url ? (
          <img src={form.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <User className="h-7 w-7" />
          </span>
        )}
        <ImageUpload businessId={businessId} folder="staff" label="Upload photo" onUploaded={({ url }) => setForm((f) => ({ ...f, photo_url: url }))} />
      </div>
      <Field label="Name *" htmlFor="staff-name">
        <input id="staff-name" className="input" value={form.name} onChange={set('name')} required />
      </Field>
      <Field label="Short bio" htmlFor="staff-bio">
        <input id="staff-bio" className="input" value={form.bio || ''} onChange={set('bio')} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sort order" htmlFor="staff-sort">
          <input id="staff-sort" type="number" className="input" value={form.sort_order} onChange={set('sort_order')} />
        </Field>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.is_active} onChange={set('is_active')} /> Takes bookings
        </label>
      </div>
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Save
        </button>
      </div>
    </form>
  )
}

function ScheduleEditor({ staff, schedules, onSaved, onClose }) {
  const [rows, setRows] = useState(() =>
    schedules
      .filter((s) => s.staff_id === staff.id)
      .map((s) => ({ day_of_week: s.day_of_week, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const add = (day) => setRows((r) => [...r, { day_of_week: day, start_time: '09:00', end_time: '18:00' }])
  const del = (i) => setRows((r) => r.filter((_, j) => j !== i))

  const save = async () => {
    for (const r of rows) {
      if (!r.start_time || !r.end_time || r.end_time <= r.start_time) {
        setError(`${DAY_NAMES[r.day_of_week]}: end time must be after start time.`)
        return
      }
    }
    for (const d of WEEK_ORDER) {
      const day = rows.filter((r) => r.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time))
      for (let i = 1; i < day.length; i++) {
        if (day[i].start_time < day[i - 1].end_time) {
          setError(`${DAY_NAMES[d]}: working periods overlap.`)
          return
        }
      }
    }
    setBusy(true)
    setError(null)
    try {
      await api.saveSchedules(staff.id, rows)
      await onSaved()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">Customers can only book times inside these hours. Add a second period for split shifts.</p>
      {WEEK_ORDER.map((d) => {
        const dayRows = rows.map((r, i) => ({ ...r, i })).filter((r) => r.day_of_week === d)
        return (
          <div key={d} className="flex flex-wrap items-start gap-3 border-b border-stone-100 pb-3">
            <span className="w-24 pt-2 text-sm font-medium">{DAY_NAMES[d]}</span>
            <div className="flex flex-1 flex-col gap-2">
              {dayRows.length === 0 && <span className="pt-2 text-sm text-stone-400">Day off</span>}
              {dayRows.map((r) => (
                <div key={r.i} className="flex items-center gap-2">
                  <input
                    type="time"
                    className="input w-auto py-1.5"
                    value={r.start_time}
                    onChange={(e) => update(r.i, 'start_time', e.target.value)}
                    aria-label={`${DAY_NAMES[d]} start`}
                  />
                  <span className="text-stone-400">–</span>
                  <input
                    type="time"
                    className="input w-auto py-1.5"
                    value={r.end_time}
                    onChange={(e) => update(r.i, 'end_time', e.target.value)}
                    aria-label={`${DAY_NAMES[d]} end`}
                  />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => del(r.i)} aria-label={`Remove ${DAY_NAMES[d]} period`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => add(d)}>
              <Plus className="h-4 w-4" /> {dayRows.length ? 'Split' : 'Add hours'}
            </button>
          </div>
        )
      })}
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Save schedule
        </button>
      </div>
    </div>
  )
}

function TimeOff({ business, staff }) {
  const tz = business.timezone
  const timeOff = useAsync(() => api.listTimeOff(business.id), [business.id])
  const today = todayIn(tz)
  const [form, setForm] = useState({ staff_id: '', date: today, endDate: today, allDay: true, start: '12:00', end: '13:00', reason: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const staffName = (id) => staff.find((s) => s.id === id)?.name || '—'

  const add = async (e) => {
    e.preventDefault()
    const targets = form.staff_id ? [form.staff_id] : staff.filter((s) => s.is_active).map((s) => s.id)
    const endDate = form.endDate < form.date ? form.date : form.endDate
    const starts_at = zonedToIso(form.date, form.allDay ? '00:00' : form.start, tz)
    const ends_at = form.allDay
      ? zonedToIso(addDays(endDate, 1), '00:00', tz)
      : zonedToIso(endDate, form.end, tz)
    if (new Date(ends_at) <= new Date(starts_at)) return setError('End must be after start.')
    setBusy(true)
    setError(null)
    try {
      for (const staff_id of targets) await api.addTimeOff({ staff_id, starts_at, ends_at, reason: form.reason.trim() || null })
      setForm((f) => ({ ...f, reason: '' }))
      await timeOff.reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id) => {
    try {
      await api.deleteTimeOff(id)
      await timeOff.reload()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-sans text-base font-semibold">Time off & closures</h2>
      <p className="mb-3 text-sm text-stone-600">Block holidays, leave or breaks. Existing bookings are not affected — cancel them separately if needed.</p>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Who" htmlFor="to-staff">
          <select id="to-staff" className="input" value={form.staff_id} onChange={set('staff_id')}>
            <option value="">Everyone (salon closed)</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From" htmlFor="to-date">
          <input id="to-date" type="date" className="input" value={form.date} onChange={set('date')} required />
        </Field>
        <Field label="To" htmlFor="to-end-date">
          <input id="to-end-date" type="date" className="input" value={form.endDate} min={form.date} onChange={set('endDate')} required />
        </Field>
        <Field label="Reason (private)" htmlFor="to-reason">
          <input id="to-reason" className="input" value={form.reason} onChange={set('reason')} placeholder="e.g. Holiday" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.allDay} onChange={set('allDay')} /> All day
        </label>
        {!form.allDay && (
          <div className="flex items-center gap-2 lg:col-span-2">
            <input type="time" className="input w-auto" value={form.start} onChange={set('start')} aria-label="Start time" />
            <span>–</span>
            <input type="time" className="input w-auto" value={form.end} onChange={set('end')} aria-label="End time" />
          </div>
        )}
        <div className="flex items-end justify-end lg:col-start-4">
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4" />} Block time
          </button>
        </div>
      </form>
      <div className="mt-2">
        <ErrorBox error={error || timeOff.error} />
      </div>
      <ul className="mt-3 space-y-2">
        {(timeOff.data || []).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
            <span>
              <strong>{staffName(t.staff_id)}</strong> · {formatDateTime(t.starts_at, tz)} → {formatDateTime(t.ends_at, tz)}
              {t.reason && <span className="text-stone-500"> · {t.reason}</span>}
            </span>
            <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(t.id)} aria-label="Remove time off">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {timeOff.data?.length === 0 && <li className="text-sm text-stone-500">No upcoming time off.</li>}
      </ul>
    </section>
  )
}

export default function AdminStaff() {
  const { business } = useBusiness()
  const staff = useAsync(() => api.listStaff(business.id, { includeInactive: true }), [business.id])
  const schedules = useAsync(() => api.listSchedules(business.id), [business.id])
  const [editing, setEditing] = useState(null)
  const [scheduling, setScheduling] = useState(null)
  const [error, setError] = useState(null)

  const remove = async (s) => {
    if (!window.confirm(`Remove ${s.name}? Their past bookings stay (unassigned). Tip: untick “Takes bookings” instead to keep history.`)) return
    try {
      await api.deleteStaff(s.id)
      await staff.reload()
    } catch (e) {
      setError(e)
    }
  }

  const summary = (id) => {
    const rows = (schedules.data || []).filter((s) => s.staff_id === id)
    if (!rows.length) return 'No working hours set — can’t be booked'
    return WEEK_ORDER.filter((d) => rows.some((r) => r.day_of_week === d))
      .map((d) => {
        const r = rows.filter((x) => x.day_of_week === d)
        return `${DAY_NAMES[d].slice(0, 3)} ${r.map((x) => `${formatClock(hhmm(x.start_time))}–${formatClock(hhmm(x.end_time))}`).join(', ')}`
      })
      .join(' · ')
  }

  return (
    <div>
      <AdminTitle title="Staff & schedules">
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" /> Add staff
        </button>
      </AdminTitle>
      <ErrorBox error={staff.error || schedules.error || error} onRetry={staff.error ? staff.reload : undefined} />
      {staff.loading && !staff.data && <Loading />}
      {staff.data?.length === 0 && <EmptyState>No staff yet.</EmptyState>}
      <ul className="grid gap-3 md:grid-cols-2">
        {(staff.data || []).map((s) => (
          <li key={s.id} className={`rounded-2xl border border-stone-200 bg-white p-4 ${s.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <User className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.name} {!s.is_active && <span className="badge ml-1 bg-stone-200 text-stone-600">Not bookable</span>}
                </p>
                <p className="text-sm text-stone-500">{s.bio}</p>
                <p className="mt-2 text-xs text-stone-600">{summary(s.id)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setScheduling(s)}>
                <CalendarClock className="h-4 w-4" /> Working hours
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(s)}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(s)}>
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {staff.data && <TimeOff business={business} staff={staff.data} />}

      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'Add staff'} onClose={() => setEditing(null)}>
          <StaffForm initial={editing} businessId={business.id} onSaved={staff.reload} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {scheduling && (
        <Modal title={`${scheduling.name} — working hours`} onClose={() => setScheduling(null)} wide>
          <ScheduleEditor staff={scheduling} schedules={schedules.data || []} onSaved={schedules.reload} onClose={() => setScheduling(null)} />
        </Modal>
      )}
    </div>
  )
}
