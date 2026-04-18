import { useEffect, useState } from 'react'

/**
 * Best-effort `prefers-reduced-motion` (e.g. H5). WeChat webview may expose
 * `matchMedia`; when unavailable, returns false.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const matcher = (
      globalThis as {
        matchMedia?: (query: string) => MediaQueryList
      }
    ).matchMedia?.('(prefers-reduced-motion: reduce)')

    if (!matcher) {
      return undefined
    }

    const update = () => setReduced(matcher.matches)
    update()

    if (typeof matcher.addEventListener === 'function') {
      matcher.addEventListener('change', update)
      return () => matcher.removeEventListener('change', update)
    }

    matcher.addListener?.(update)
    return () => matcher.removeListener?.(update)
  }, [])

  return reduced
}
