import { useState, useEffect } from 'react'

/**
 * useStaggerMount — single-boolean mount trigger for CSS-staggered entrances.
 *
 * Flips to `true` on the next animation frame after mount.
 * Pair with `.stagger-in-hidden` / `.stagger-in--N` SCSS utilities.
 *
 * Why not per-index timers? CSS animation-delay staggers for free with
 * zero JS overhead. One state flip vs. N setTimeout calls.
 */
export function useStaggerMount() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return mounted
}
