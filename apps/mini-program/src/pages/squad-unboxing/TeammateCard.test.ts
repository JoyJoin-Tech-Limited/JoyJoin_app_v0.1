// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// TeammateCard's tap/longpress handlers are embedded in a Taro component and
// this workspace has no React render harness for Taro components (component
// internals are locked via source assertions — see DragRevealRibbon.test.ts).
// These assertions pin the structural guarantees of the trailing-tap guard:
// longpress-then-immediate-tap = single focus; longpress-then-late-tap = tap
// processed; the guard can never double-swallow.
const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), 'TeammateCard.tsx')

describe('TeammateCard longpress trailing-tap guard', () => {
  const source = readFileSync(componentPath, 'utf8')

  const handleTapBody = source.slice(
    source.indexOf('const handleTap = useCallback'),
    source.indexOf('const handleLongPress = useCallback'),
  )
  const handleLongPressBody = source.slice(
    source.indexOf('const handleLongPress = useCallback'),
    source.indexOf('const step ='),
  )

  it('arms a pending-trailing-tap flag on longpress (timestamp kept too)', () => {
    expect(handleLongPressBody).toContain('lastLongPressAtRef.current = Date.now()')
    expect(handleLongPressBody).toContain('pendingTrailingTapRef.current = true')
    expect(handleLongPressBody).toContain('onFocus()')
  })

  it('consumes the flag on the first tap regardless of the swallow decision (never double-swallow)', () => {
    const flagCheck = handleTapBody.indexOf('if (pendingTrailingTapRef.current)')
    const flagClear = handleTapBody.indexOf('pendingTrailingTapRef.current = false')
    expect(flagCheck).toBeGreaterThanOrEqual(0)
    expect(flagClear).toBeGreaterThan(flagCheck)
    // The flag is cleared before the swallow return, so a second tap is
    // always processed and an expired flag still falls through to onFocus().
    const swallowReturn = handleTapBody.indexOf('TRAILING_TAP_MAX_AGE_MS) return')
    expect(swallowReturn).toBeGreaterThan(flagClear)
    expect(handleTapBody.indexOf('onFocus()')).toBeGreaterThan(swallowReturn)
  })

  it('bounds the swallow window to 3s so a stale flag cannot eat an unrelated future tap', () => {
    expect(source).toContain('TRAILING_TAP_MAX_AGE_MS = 3000')
    expect(handleTapBody).toContain('Date.now() - lastLongPressAtRef.current < TRAILING_TAP_MAX_AGE_MS')
    // Regression lock: the old pure 600ms time window must not come back.
    expect(handleTapBody).not.toContain('< 600')
  })
})
