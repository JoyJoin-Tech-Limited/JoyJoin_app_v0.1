// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./SegmentedCountdownClock.tsx', import.meta.url), 'utf8')
const scssSource = readFileSync(new URL('./SegmentedCountdownClock.scss', import.meta.url), 'utf8')

describe('SegmentedCountdownClock shared leaf', () => {
  it('exposes an externalNow prop to support parent-owned ticks', () => {
    expect(source).toContain('externalNow?: number')
    expect(source).toContain('const usingExternal = externalNow != null')
    expect(source).toContain('const now = usingExternal ? externalNow')
  })

  it('adds granularity toggles without changing the default events-page behavior', () => {
    expect(source).toContain('showDays?: boolean')
    expect(source).toContain('showHours?: boolean')
    expect(source).toContain('showMinutes?: boolean')
    expect(source).toContain('showSeconds?: boolean')
    expect(source).toContain('showProgress?: boolean')
    expect(source).toContain('showDays = true')
    expect(source).toContain('showProgress = true')
  })

  it('owns its own class namespace and keyframes', () => {
    expect(scssSource).toContain('.segmented-countdown-clock {')
    expect(scssSource).toContain('@keyframes segmented-countdown-clock-digit-pop')
    expect(scssSource).toContain('@keyframes segmented-countdown-clock-block-pulse')
  })

  it('does not import its own SCSS (styles are owned by consuming pages)', () => {
    expect(source).not.toContain("import './SegmentedCountdownClock.scss'")
  })
})
