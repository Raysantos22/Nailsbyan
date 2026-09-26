import { useState } from 'react'
import { Plus, Pencil, Trash2, EyeOff, Eye } from 'lucide-react'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { formatDuration, formatMoney } from '../../lib/format.js'
import { groupByCategory } from '../../lib/services.js'
import { EmptyState, ErrorBox, Field, Loading, Spinner } from '../../components/ui.jsx'
import { AdminTitle, Modal } from './adminUi.jsx'

const EMPTY = {
  category: '',
  name: '',
  description: '',
  price: '',
  duration_minutes: 60,
  is_addon: false,
  parent_service_id: '',
  is_active: true,
  sort_order: 0,
}

function ServiceForm({ initial, services, businessId, onSaved, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, parent_service_id: initial.parent_service_id || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const categories = [...new Set(services.map((s) => s.category))]
  const mains = services.filter((s) => !s.is_addon && s.id !== form.id)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const price = Number(form.price)
    const duration = Number(form.duration_minutes)
    if (!form.name.trim()) return setError('Name is required.')
    if (!(price >= 0)) return setError('Price must be 0 or more.')
    if (!(duration > 0 && duration <= 600)) return setError('Duration must be between 1 and 600 minutes.')
    setBusy(true)
    setError(null)
    try {
      await api.saveService({
        id: form.id,
        business_id: businessId,
        category: form.category.trim() || (form.is_addon ? 'Add-ons' : 'Services'),
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        duration_minutes: duration,
        is_addon: form.is_addon,
        parent_service_id: form.is_addon && form.parent_service_id ? form.parent_service_id : null,
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
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name *" htmlFor="svc-name" className="sm:col-span-2">
        <input id="svc-name" className="input" value={form.name} onChange={set('name')} required />
      </Field>
      <Field label="Category" htmlFor="svc-cat" hint="Services are grouped by category on the menu.">
        <input id="svc-cat" className="input" list="svc-categories" value={form.category} onChange={set('category')} />
        <datalist id="svc-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Sort order" htmlFor="svc-sort" hint="Lower numbers show first.">
        <input id="svc-sort" type="number" className="input" value={form.sort_order} onChange={set('sort_order')} />
      </Field>
      <Field label="Price *" htmlFor="svc-price">
        <input id="svc-price" type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} required />
      </Field>
      <Field label="Duration (minutes) *" htmlFor="svc-dur">
        <input id="svc-dur" type="number" min="5" max="600" step="5" className="input" value={form.duration_minutes} onChange={set('duration_minutes')} required />
      </Field>
      <Field label="Description" htmlFor="svc-desc" className="sm:col-span-2">
        <textarea id="svc-desc" className="input min-h-20" value={form.description || ''} onChange={set('description')} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.is_addon} onChange={set('is_addon')} /> This is an add-on
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.is_active} onChange={set('is_active')} /> Visible & bookable
      </label>
      {form.is_addon && (
        <Field label="Only available with" htmlFor="svc-parent" className="sm:col-span-2" hint="Leave as “Any main service” for add-ons that go with everything.">
          <select id="svc-parent" className="input" value={form.parent_service_id} onChange={set('parent_service_id')}>
            <option value="">Any main service</option>
            {mains.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <ErrorBox error={error} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Save service
        </button>
      </div>
    </form>
  )
}

export default function AdminServices() {
  const { business } = useBusiness()
  const services = useAsync(() => api.listServices(business.id, { includeInactive: true }), [business.id])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  const toggleActive = async (s) => {
    setError(null)
    try {
      await api.saveService({ id: s.id, is_active: !s.is_active })
      await services.reload()
    } catch (e) {
      setError(e)
    }
  }
  const remove = async (s) => {
    if (!window.confirm(`Delete “${s.name}”? Past bookings keep their details. Tip: hiding keeps it for later.`)) return
    setError(null)
    try {
      await api.deleteService(s.id)
      await services.reload()
    } catch (e) {
      setError(e)
    }
  }

  const all = services.data || []
  const main = all.filter((s) => !s.is_addon)
  const addons = all.filter((s) => s.is_addon)
  const sections = [...groupByCategory(main), ...(addons.length ? [['Add-ons', addons]] : [])]

  return (
    <div>
      <AdminTitle title="Services & prices">
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4" /> Add service
        </button>
      </AdminTitle>
      <ErrorBox error={services.error || error} onRetry={services.error ? services.reload : undefined} />
      {services.loading && !services.data && <Loading />}
      {services.data && all.length === 0 && <EmptyState>No services yet — add your first one.</EmptyState>}
      <div className="space-y-6">
        {sections.map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">{category}</h2>
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {items.map((s) => (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${s.is_active ? '' : 'bg-stone-50 text-stone-400'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {s.name} {!s.is_active && <span className="badge ml-1 bg-stone-200 text-stone-600">Hidden</span>}
                    </p>
                    <p className="truncate text-sm text-stone-500">{s.description}</p>
                  </div>
                  <div className="text-sm whitespace-nowrap">
                    <span className="font-semibold">{formatMoney(s.price, business.currency)}</span> · {formatDuration(s.duration_minutes)}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => toggleActive(s)}
                      aria-label={s.is_active ? `Hide ${s.name}` : `Show ${s.name}`}
                      title={s.is_active ? 'Hide from menu' : 'Show on menu'}
                    >
                      {s.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit service' : 'Add service'} onClose={() => setEditing(null)} wide>
          <ServiceForm initial={editing} services={all} businessId={business.id} onSaved={services.reload} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}
