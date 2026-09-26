import { Link } from 'react-router-dom'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { addDays, formatMoney, todayIn, zonedToIso } from '../../lib/format.js'
import { EmptyState, ErrorBox, Loading } from '../../components/ui.jsx'
import { AdminTitle, BookingCard } from './adminUi.jsx'

function Stat({ label, value, sub, testId }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4" data-testid={testId}>
      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const { business } = useBusiness()
  const tz = business.timezone
  const today = todayIn(tz)

  const stats = useAsync(() => api.adminStats(business.id), [business.id])
  // Pending bookings from the past week onward (includes stale ones not yet expired).
  const pending = useAsync(
    () =>
      api.adminListBookings({
        businessId: business.id,
        from: zonedToIso(addDays(today, -7), '00:00', tz),
        to: zonedToIso(addDays(today, 366), '00:00', tz),
        status: 'pending',
      }),
    [business.id, today],
  )
  const todays = useAsync(
    () =>
      api.adminListBookings({
        businessId: business.id,
        from: zonedToIso(today, '00:00', tz),
        to: zonedToIso(addDays(today, 1), '00:00', tz),
      }),
    [business.id, today],
  )

  const refresh = async () => {
    await Promise.all([stats.reload(), pending.reload(), todays.reload()])
  }
  const s = stats.data
  const todayActive = (todays.data || []).filter((b) => b.status !== 'cancelled')

  return (
    <div>
      <AdminTitle title="Dashboard">
        <Link to="/admin/bookings" className="btn-secondary btn-sm">
          All bookings
        </Link>
      </AdminTitle>

      <ErrorBox error={stats.error} onRetry={stats.reload} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings this week" value={s ? s.bookings_this_week : '—'} sub="Mon–Sun, excl. cancelled" testId="stat-week" />
        <Stat
          label="Revenue this month"
          value={s ? formatMoney(s.revenue_this_month, s.currency) : '—'}
          sub="Confirmed + completed"
          testId="stat-revenue"
        />
        <Stat label="Awaiting payment" value={s ? s.pending_count : '—'} sub="Pending bookings" testId="stat-pending" />
        <Stat label="Today" value={s ? s.today_count : '—'} sub={s ? `${formatMoney(s.deposits_received_this_month, s.currency)} deposits this month` : ''} testId="stat-today" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-sans text-base font-semibold">Awaiting payment{pending.data ? ` (${pending.data.length})` : ''}</h2>
          <p className="mb-3 text-sm text-stone-600">
            Check Messenger / {business.payment_method_label || 'your payment app'} for the deposit, then confirm.
          </p>
          {pending.loading && !pending.data ? (
            <Loading />
          ) : (
            <div className="space-y-3">
              <ErrorBox error={pending.error} onRetry={pending.reload} />
              {pending.data?.length === 0 && <EmptyState>No bookings waiting for payment. 🎉</EmptyState>}
              {(pending.data || []).map((b) => (
                <BookingCard key={b.id} booking={b} business={business} onChanged={refresh} />
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-sans text-base font-semibold">Today&apos;s appointments{todays.data ? ` (${todayActive.length})` : ''}</h2>
          {todays.loading && !todays.data ? (
            <Loading />
          ) : (
            <div className="space-y-3">
              <ErrorBox error={todays.error} onRetry={todays.reload} />
              {todayActive.length === 0 && <EmptyState>Nothing booked today.</EmptyState>}
              {todayActive.map((b) => (
                <BookingCard key={b.id} booking={b} business={business} onChanged={refresh} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
