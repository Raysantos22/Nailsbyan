import { useEffect, useRef } from 'react'

// Moves an element down as the page scrolls (speed 0.4 = 40% of scroll
// distance), creating a parallax effect. Uses transforms + rAF only, and
// does nothing for visitors who prefer reduced motion.
export function useParallax(speed = 0.4, { maxScroll = 1400 } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      const y = Math.min(window.scrollY, maxScroll)
      el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [speed, maxScroll])

  return ref
}
