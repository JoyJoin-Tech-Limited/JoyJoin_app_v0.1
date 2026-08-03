import { useEffect, useState } from 'react'

export const SYNC_DEADLINE_DEFAULT_MS = 8000

/**
 * Hard UI deadline for queries behind a "syncing" placeholder.
 *
 * The network layer already has its own timeout (5s dev / 15s prod) plus one
 * retry, so a hung-but-reachable server can keep a query pending for 30s+.
 * When a query stays stalled (no cached data, no error) beyond `ms`, this
 * hook reports the deadline as expired so the UI can fall back to its error
 * state with a retry CTA instead of spinning indefinitely.
 *
 * Change `resetKey` (e.g. increment a nonce on manual retry) to start a
 * fresh deadline window.
 */
export function useSyncDeadline(
  stalled: boolean,
  resetKey: unknown = 0,
  ms: number = SYNC_DEADLINE_DEFAULT_MS,
): boolean {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    setExpired(false)
    if (!stalled) return
    const timer = setTimeout(() => setExpired(true), ms)
    return () => clearTimeout(timer)
  }, [stalled, resetKey, ms])

  return expired
}
