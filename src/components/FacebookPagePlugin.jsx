import { useEffect, useRef, useState } from 'react'

// Facebook Page Plugin (timeline + reviews come from the Page itself).
// Uses the iframe version so no Facebook SDK/app id is needed. The plugin
// supports widths 180–500px, so we measure the container and re-render.
export default function FacebookPagePlugin({ pageUrl, height = 560, tabs = 'timeline' }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(340)

  useEffect(() => {
    if (!ref.current) return
    const update = () => {
      const w = Math.floor(ref.current?.getBoundingClientRect().width || 340)
      setWidth(Math.max(180, Math.min(500, w)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  if (!pageUrl) return null
  const src =
    'https://www.facebook.com/plugins/page.php?' +
    new URLSearchParams({
      href: pageUrl,
      tabs,
      width: String(width),
      height: String(height),
      small_header: 'false',
      adapt_container_width: 'true',
      hide_cover: 'false',
      show_facepile: 'true',
    })

  return (
    <div ref={ref} className="w-full max-w-[500px]">
      <iframe
        key={width}
        title="Facebook Page"
        src={src}
        width={width}
        height={height}
        style={{ border: 'none', overflow: 'hidden' }}
        scrolling="no"
        frameBorder="0"
        allow="encrypted-media"
        loading="lazy"
        className="rounded-2xl bg-white shadow-sm"
      />
    </div>
  )
}
