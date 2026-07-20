// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), 'DragRevealRibbon.tsx')

describe('DragRevealRibbon tap/drag analytics deduplication', () => {
  const source = readFileSync(componentPath, 'utf8')

  it('uses a hasTrackedTapRef to avoid double-counting fallback taps', () => {
    expect(source).toContain('hasTrackedTapRef')
    expect(source).toMatch(/if \(!hasTrackedTapRef\.current\)/)
  })

  it('sets the revealing guard in both touchEnd and tap fallback paths', () => {
    expect(source).toMatch(/isRevealingRef\.current = true\s*setIsRevealing\(true\)/)
  })

  it('removes aria-live from the slider to avoid noisy drag announcements', () => {
    expect(source).not.toContain("aria-live='polite'")
    expect(source).not.toContain('aria-live="polite"')
  })

  it('stops scroll propagation only when drag is enabled', () => {
    expect(source).toContain('catchMove={!useTapFallback}')
  })
})
