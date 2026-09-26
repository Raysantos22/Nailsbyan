import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { api } from '../lib/api/index.js'
import { useAsync } from '../lib/useAsync.js'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/ui.jsx'

function Lightbox({ photos, index, onClose, onMove }) {
  const photo = photos[index]
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onMove(1)
      if (e.key === 'ArrowLeft') onMove(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, onMove])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || 'Photo'}
      onClick={onClose}
    >
      <button type="button" className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-6 w-6" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6"
            onClick={(e) => {
              e.stopPropagation()
              onMove(-1)
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6"
            onClick={(e) => {
              e.stopPropagation()
              onMove(1)
            }}
            aria-label="Next photo"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}
      <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <img src={photo.image_url} alt={photo.caption || 'Nail design'} className="max-h-[80vh] rounded-xl object-contain" />
        {photo.caption && <figcaption className="mt-3 text-center text-sm text-white/80">{photo.caption}</figcaption>}
      </figure>
    </div>
  )
}

export default function Gallery() {
  const { business } = useBusiness()
  const { data, error, loading, reload } = useAsync(() => api.listGallery(business.id), [business.id])
  const [open, setOpen] = useState(null)
  const photos = data || []
  const close = useCallback(() => setOpen(null), [])
  const move = useCallback((d) => setOpen((i) => (i + d + photos.length) % photos.length), [photos.length])

  return (
    <>
      <PageHeader eyebrow="Our work" title="Gallery">
        A peek at recent sets. Tap a photo to see it larger.
      </PageHeader>
      <div className="container-page py-10">
        {loading && <Loading />}
        <ErrorBox error={error} onRetry={reload} />
        {data && photos.length === 0 && <EmptyState>Photos coming soon.</EmptyState>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group block aspect-square w-full overflow-hidden rounded-2xl bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                aria-label={`Open photo${p.caption ? `: ${p.caption}` : ''}`}
              >
                <img
                  src={p.image_url}
                  alt={p.caption || 'Nail design'}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
        {business.facebook_page_url && (
          <div className="mt-10 text-center">
            <a href={business.facebook_page_url} target="_blank" rel="noreferrer" className="btn-secondary">
              <Facebook className="h-4 w-4" /> More photos on our Facebook Page
            </a>
          </div>
        )}
      </div>
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onClose={close} onMove={move} />}
    </>
  )
}
