import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, List, CalendarDays, RefreshCw } from 'lucide-react'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { addDays, dateLabel, formatTime, STATUS_LABELS, todayIn, zonedToIso } from '../../lib/format.js'
import { EmptyState, ErrorBox, Loading } from '../../components/ui.jsx'
import { AdminTitle, BookingCard, Modal } from './adminUi.jsx'

const STATUS_BLOCK = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  completed: 'border-sky-300 bg-sky-50 text-sky-900',
  no_show: 'border-red-300 bg-red-50 text-red-900',
  cancelled: 'border-stone-200 bg-stone-50 text-stone-400 line-through',
}

function localMinutes(iso, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0)
  return get('hour') * 60 + get('minute')
}

// Day view: one column per staff member, 30-minute rows.
function DayCalendar({ bookings, staff, schedules, date, business, onSelect }) {
  const tz = business.timezone
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const daySchedules = schedules.filter((s) => s.day_of_week === dow)
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

  const visible = bookings.filter((b) => b.status !== 'cancelled')
  const starts = [...daySchedules.map((s) => toMin(s.start_time)), ...visible.map((b) => localMinutes(b.start_time, tz))]
  const ends = [...daySchedules.map((s) => toMin(s.end_time)), ...visible.map((b) => localMinutes(b.end_time, tz) || 1440)]
  const dayStart = Math.floor(Math.min(9 * 60, ...starts) / 60) * 60
  const dayEnd = Math.ceil(Math.max(18 * 60, ...ends) / 60) * 60
  const PX_PER_MIN = 1.2
  const height = (dayEnd - dayStart) * PX_PER_MIN

  const columns = staff.length ? staff : [{ id: null, name: 'Bookings' }]
  const hours = []
  for (let m = dayStart; m < dayEnd; m += 60) hours.push(m)

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <div className="flex min-w-max">
        <div className="w-[4.5rem] shrink-0 border-r border-stone-100 pt-10">
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-2 text-[11px] whitespace-nowrap text-stone-400" style={{ top: (m - dayStart) * PX_PER_MIN }}>
                {formatTime(zonedToIso(date, `${String(m / 60).padStart(2, '0')}:00`, tz), tz)}
              </div>
            ))}
          </div>
        </div>
        {columns.map((col) => {
          const colSchedules = daySchedules.filter((s) => s.staff_id === col.id)
          const colBookings = visible.filter((b) => (col.id ? b.staff?.id === col.id : true))
          return (
            <div key={col.id || 'all'} className="w-48 shrink-0 border-r border-stone-100 last:border-r-0 sm:w-56">
              <div className="flex h-10 items-center justify-center border-b border-stone-100 text-sm font-semibold" data-testid="calendar-column">
                {col.name}
              </div>
              <div className="relative bg-stone-50" style={{ height }}>
                {colSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="absolute inset-x-0 bg-white"
                    style={{ top: (toMin(s.start_time) - dayStart) * PX_PER_MIN, height: (toMin(s.end_time) - toMin(s.start_time)) * PX_PER_MIN }}
                  />
                ))}
                {hours.map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-stone-100" style={{ top: (m - dayStart) * PX_PER_MIN }} />
                ))}
                {colBookings.map((b) => {
                  const top = (localMinutes(b.start_time, tz) - dayStart) * PX_PER_MIN
                  const h = Math.max(24, (new Date(b.end_time) - new Date(b.start_time)) / 60000) * PX_PER_MIN
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelect(b)}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm hover:brightness-95 ${STATUS_BLOCK[b.status]}`}
                      style={{ top, height: h - 2 }}
                    >
                      <span className="block font-semibold">
                        {formatTime(b.start_time, tz)} {b.customer.name}
                      </span>
                      <span className="block truncate">{b.services.map((s) => s.name).join(' + ')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {daySchedules.length === 0 && <p className="p-3 text-center text-xs text-stone-500">No one is scheduled to work on this day.</p>}
    </div>
  )
}

export default function AdminBookings() {
  const { business } = useBusiness()
  const tz = business.timezone
  const today = todayIn(tz)
  const [view, setView] = useState('list')
  const [date, setDate] = useState(today)
  const [rangeDays, setRangeDays] = useState(14)
  const [staffId, setStaffId] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)

  const staff = useAsync(() => api.listStaff(business.id, { includeInactive: true }), [business.id])
  const schedules = useAsync(() => api.listSchedules(business.id), [business.id])

  const fromDate = date
  const toDate = view === 'day' ? addDays(date, 1) : addDays(date, rangeDays)
  const bookings = useAsync(
    () =>
      api.adminListBookings({
        businessId: business.id,
        from: zonedToIso(fromDate, '00:00', tz),
        to: zonedToIso(toDate, '00:00', tz),
        staffId: staffId || null,
        status: view === 'list' ? status || null : null,
      }),
    [business.id, fromDate, toDate, staffId, status, view, tz],
  )

  const grouped = useMemo(() => {
    const g = new Map()
    for (const b of bookings.data || []) {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(b.start_time))
      if (!g.has(d)) g.set(d, [])
      g.get(d).push(b)
    }
    return [...g.entries()]
  }, [bookings.data, tz])

  const calendarStaff = (staff.data || []).filter((s) => (staffId ? s.id === staffId : s.is_active || (bookings.data || []).some((b) => b.staff?.id === s.id)))
  const step = view === 'day' ? 1 : 7
  const selectedFresh = selected && (bookings.data || []).find((b) => b.id === selected.id)

  return (
    <div>
      <AdminTitle title="Bookings">
        <div className="inline-flex rounded-full border border-stone-200 bg-white p-0.5">
          <button
            type="button"
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${view === 'list' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${view === 'day' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
            onClick={() => setView('day')}
            aria-pressed={view === 'day'}
          >
            <CalendarDays className="h-4 w-4" /> Day
          </button>
        </div>
      </AdminTitle>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-3">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, -step))} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="sr-only" htmlFor="bk-date">
            {view === 'day' ? 'Date' : 'From date'}
          </label>
          <input id="bk-date" type="date" className="input w-auto py-1.5" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, step))} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(today)}>
            Today
          </button>
        </div>
        {view === 'list' && (
          <select className="input w-auto py-1.5" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))} aria-label="Range">
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={31}>31 days</option>
            <option value={90}>90 days</option>
          </select>
        )}
        <select className="input w-auto py-1.5" value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Filter by staff">
          <option value="">All staff</option>
          {(staff.data || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {view === 'list' && (
          <select className="input w-auto py-1.5" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-ghost btn-sm ml-auto" onClick={bookings.reload} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${bookings.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <ErrorBox error={bookings.error || staff.error || schedules.error} onRetry={bookings.reload} />
      {bookings.loading && !bookings.data ? (
        <Loading />
      ) : view === 'day' ? (
        <>
          <p className="mb-3 text-sm font-semibold">{dateLabel(date).long}</p>
          <DayCalendar
            bookings={bookings.data || []}
            staff={calendarStaff}
            schedules={schedules.data || []}
            date={date}
            business={business}
            onSelect={setSelected}
          />
          {(bookings.data || []).some((b) => b.status === 'cancelled') && (
            <p className="mt-2 text-xs text-stone-500">Cancelled bookings are hidden in the day view — use the list view to see them.</p>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {grouped.length === 0 && <EmptyState>No bookings in this range.</EmptyState>}
          {grouped.map(([d, items]) => (
            <section key={d}>
              <h2 className="mb-2 text-sm font-semibold text-stone-700">
                {dateLabel(d).long} <span className="font-normal text-stone-500">({items.length})</span>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((b) => (
                  <BookingCard key={b.id} booking={b} business={business} onChanged={bookings.reload} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedFresh && (
        <Modal title="Booking" onClose={() => setSelected(null)}>
          <BookingCard booking={selectedFresh} business={business} onChanged={bookings.reload} />
        </Modal>
      )}
    </div>
  )
}
