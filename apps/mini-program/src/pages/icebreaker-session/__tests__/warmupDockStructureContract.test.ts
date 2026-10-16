import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.tsx'),
  'utf8',
)
const dockStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/components/WarmupActionBar.scss'),
  'utf8',
)
const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.scss'),
  'utf8',
)

/**
 * Warmup CTA dock structural contract (sprint icebreaker-uiux-wave1,
 * AC-01/AC-02 + verdict follow-up). The dock must stay a flex SIBLING of
 * the ScrollView (pool-reg footer pattern): full-bleed, zero side inset,
 * exactly one safe-area owner. Regression targets: the pre-Wave-1 white
 * patch (white bar inset by __inner padding + double safe-area) and the
 * forbidden position:fixed escape (phase shell keeps a transform, which
 * hijacks the fixed containing block).
 */
describe('Warmup CTA dock · structural contract (wave1 AC-01/02)', () => {
  it('renders WarmupActionBar AFTER the ScrollView closes (flex sibling footer)', () => {
    const scrollClose = pageSource.indexOf('</ScrollView>')
    const actionBar = pageSource.indexOf('<WarmupActionBar')
    expect(scrollClose).toBeGreaterThan(-1)
    expect(actionBar).toBeGreaterThan(-1)
    expect(actionBar).toBeGreaterThan(scrollClose)
  })

  it('dock never uses position:fixed (transform-hijack trap) nor negative-margin breakout', () => {
    // Strip comments first — the file documents the ban in prose ("never
    // position:fixed"), which must not trip the assertion.
    const code = dockStyles.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(code).not.toMatch(/position:\s*fixed/)
    expect(code).not.toMatch(/margin-(left|right):\s*-/)
  })

  it('dock owns the bottom safe-area exactly once', () => {
    const owners = dockStyles.match(/env\(safe-area-inset-bottom\)/g) ?? []
    expect(owners).toHaveLength(1)
  })

  it('warmup mode zeroes the __inner bottom padding (no double safe-area gap)', () => {
    const warmupInner = pageStyles.match(/&--warmup\s+&__inner\s*\{[^}]*\}/)
    expect(warmupInner).not.toBeNull()
    expect(warmupInner![0]).toMatch(/padding-bottom:\s*0/)
  })
})
