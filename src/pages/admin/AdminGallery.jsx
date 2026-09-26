import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useBusiness } from '../../lib/BusinessContext.jsx'
import { api } from '../../lib/api/index.js'
import { useAsync } from '../../lib/useAsync.js'
import { EmptyState, ErrorBox, Loading } from '../../components/ui.jsx'
import { AdminTitle, ImageUpload } from './adminUi.jsx'

export default function AdminGallery() {
  const { business } = useBusiness()
  const gallery = useAsync(() => api.listGallery(business.id), [business.id])
  const [error, setError] = useState(null)
  const photos = gallery.data || []

  const onUploaded = async ({ url, path }) => {
    const minOrder = photos.length ? Math.min(...photos.map((p) => p.sort_order)) : 0
    await api.addGalleryPhoto({ business_id: business.id, image_url: url, storage_path: path, caption: null, sort_order: minOrder - 1 })
    await gallery.reload()
  }

  const run = async (fn) => {
    setError(null)
    try {
      await fn()
      await gallery.reload()
    } catch (e) {
      setError(e)
    }
  }

  // Swap positions by re-numbering the whole list (robust to equal sort_orders).
  const move = (index, delta) =>
    run(async () => {
      const order = [...photos]
      const [p] = order.splice(index, 1)
      order.splice(index + delta, 0, p)
      await Promise.all(order.map((ph, i) => (ph.sort_order !== i ? api.updateGalleryPhoto(ph.id, { sort_order: i }) : null)))
    })

  const saveCaption = (photo, caption) => {
    if ((photo.caption || '') === caption) return
    run(() => api.updateGalleryPhoto(photo.id, { caption: caption || null }))
  }

  const remove = (photo) => {
    if (!window.confirm('Delete this photo?')) return
    run(() => api.deleteGalleryPhoto(photo))
  }

  return (
    <div>
      <AdminTitle title="Gallery">
        <ImageUpload businessId={business.id} folder="gallery" label="Upload photos" multiple onUploaded={onUploaded} />
      </AdminTitle>
      <p className="mb-4 text-sm text-stone-600">New uploads appear first. Square or portrait photos look best. Use the arrows to reorder.</p>
      <ErrorBox error={gallery.error || error} onRetry={gallery.error ? gallery.reload : undefined} />
      {gallery.loading && !gallery.data && <Loading />}
      {gallery.data && photos.length === 0 && <EmptyState>No photos yet — upload your best work!</EmptyState>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <img src={p.image_url} alt={p.caption || ''} className="aspect-square w-full object-cover" loading="lazy" />
            <div className="space-y-2 p-2">
              <input
                className="input py-1.5 text-xs"
                defaultValue={p.caption || ''}
                placeholder="Caption (optional)"
                aria-label="Caption"
                onBlur={(e) => saveCaption(p, e.target.value.trim())}
              />
              <div className="flex justify-between">
                <div className="flex">
                  <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost btn-sm" disabled={i === photos.length - 1} onClick={() => move(i, 1)} aria-label="Move later">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(p)} aria-label="Delete photo">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
