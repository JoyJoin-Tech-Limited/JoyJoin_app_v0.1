/**
 * Source-lock: hooks must never live below the early returns on this page.
 *
 * Origin (2026-10-21): `ticketFooter` was a useMemo placed AFTER five
 * conditional early returns (loading / pageError / success / verifying /
 * terminal). A cold render (no warm query cache) renders the loading path
 * with M hooks, then the main render calls hook M+1 → React #310
 * "Rendered more hooks than during the previous render" → whole root
 * unmounts → white screen. Latent since 2026-08-17 (订座 ceremony),
 * masked in production by warm-cache navigation; exposed by the
 * screenshot pipeline's cold render. Same class as the gathering-room
 * freeze (2026-08-12): never place a hook below an early return.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE_PATH = resolve(__dirname, '../index.tsx')
const source = readFileSync(PAGE_PATH, 'utf8')

const FIRST_EARLY_RETURN = 'if (isPageLoading)'
const HOOK_PATTERNS = ['useMemo(', 'useEffect(', 'useCallback(', 'useState(', 'useRef('] as const

describe('event-ticket-payment page structure source-lock', () => {
  it('keeps ticketFooter as a plain const (not a hook)', () => {
    expect(source).toContain('const ticketFooter = (')
    expect(source).not.toContain('const ticketFooter = useMemo(')
  })

  it('has zero hook calls below the first early return', () => {
    const returnIdx = source.indexOf(FIRST_EARLY_RETURN)
    expect(returnIdx).toBeGreaterThan(-1)
    const belowReturns = source.slice(returnIdx)
    for (const pattern of HOOK_PATTERNS) {
      expect(
        belowReturns.includes(pattern),
        `Found "${pattern}" below "${FIRST_EARLY_RETURN}" — hooks must run unconditionally above the early returns`,
      ).toBe(false)
    }
  })
})
