import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import { groupByCategory } from '../lib/services.js'
import { ErrorBox, Loading, PageHeader, EmptyState } from '../components/ui.jsx'

export default function Services() {
  const { business } = useBusiness()
  const { data, error, loading, reload } = useAsync(() => api.listServices(business.id), [business.id])

  const main = (data || []).filter((s) => !s.is_addon)
  const addons = (data || []).filter((s) => s.is_addon)
  const byId = Object.fromEntries((data || []).map((s) => [s.id, s]))

  return (
    <>
      <PageHeader eyebrow="Menu" title="Services & prices">
        Price may vary depending on your nail inspo / design — please send your nail inspo on Messenger. Removal can be added when you book (+₱50 if your current set was done by another salon).
      </PageHeader>
      <div className="container-page py-10">
        {loading && <Loading />}
        <ErrorBox error={error} onRetry={reload} />
        {data && data.length === 0 && <EmptyState>The menu is being updated — check back soon.</EmptyState>}

        <div className="space-y-12">
          {groupByCategory(main).map(([category, items]) => (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="border-b border-brand-100 pb-2 text-2xl font-semibold">
                {category}
              </h2>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {items.map((s) => (
                  <li key={s.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <h3 className="font-sans text-base font-semibold">{s.name}</h3>
                      {s.description && <p className="mt-1 text-sm text-stone-600">{s.description}</p>}
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {formatDuration(s.duration_minutes)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <span className="text-lg font-semibold text-ink">{formatMoney(s.price, business.currency)}</span>
                      <Link to={`/book?service=${s.id}`} className="btn-primary btn-sm" aria-label={`Book ${s.name}`}>
                        Book
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {addons.length > 0 && (
            <section aria-labelledby="cat-addons">
              <h2 id="cat-addons" className="border-b border-brand-100 pb-2 text-2xl font-semibold">
                Add-ons
              </h2>
              <p className="mt-2 text-sm text-stone-600">Add these to any main service when booking.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {addons.map((s) => (
                  <li key={s.id} className="card flex items-start justify-between gap-4 p-4">
                    <div>
                      <h3 className="font-sans text-sm font-semibold">{s.name}</h3>
                      {s.description && <p className="mt-0.5 text-xs text-stone-600">{s.description}</p>}
                      <p className="mt-1 text-xs text-stone-500">
                        +{formatDuration(s.duration_minutes)}
                        {s.parent_service_id && byId[s.parent_service_id] && ` · with ${byId[s.parent_service_id].name}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">+{formatMoney(s.price, business.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {business.deposit_amount > 0 && (
          <p className="mt-10 text-center text-sm text-stone-600">
            A {formatMoney(business.deposit_amount, business.currency)} deposit secures your booking.{' '}
            <Link to="/book" className="font-semibold text-brand-700 hover:underline">
              Book now →
            </Link>
          </p>
        )}
      </div>
    </>
  )
}
