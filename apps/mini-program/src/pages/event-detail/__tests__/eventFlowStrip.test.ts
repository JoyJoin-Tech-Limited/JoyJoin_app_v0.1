import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-10-21 对标平台 audit CONCERN C2 source-lock: the EventFlowStrip is a
// trust-surface expectation display whose four labels are FROZEN canonical
// copy (一字不改), whose connector draw is contractually one-shot
// (scaleX 0→1, ≤700ms total, never a loop), and whose reduced-motion tier
// must render fully static. These are the decisions easy to silently regress
// in a "quick polish" pass — lock them at source level, same pattern as
// eventDetailPage.test.ts.

const here = dirname(fileURLToPath(import.meta.url))
const compRoot = resolve(here, '..', '..', '..', 'components', 'event-detail')
const tsx = readFileSync(resolve(compRoot, 'EventFlowStrip.tsx'), 'utf-8')
const scss = readFileSync(resolve(compRoot, 'EventFlowStrip.scss'), 'utf-8')

describe('EventFlowStrip canonical beat order (转化 P0c, 2026-10-21 lock)', () => {
  it('ships the four frozen canonical labels in order', () => {
    for (const label of ['订座', '悦仔排桌', '集结房间等开席', '现场入座']) {
      expect(tsx).toContain(`label: '${label}'`)
    }
    const order = ['订座', '悦仔排桌', '集结房间等开席', '现场入座'].map(
      (label) => tsx.indexOf(`label: '${label}'`),
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // Exactly four beats — no fifth step may creep in.
    expect(tsx.match(/label: '/g)?.length).toBe(4)
  })

  it('exposes list semantics for the four beats', () => {
    expect(tsx).toContain("role='list'")
    expect(tsx).toContain("aria-label='参加流程'")
    expect(tsx).toContain("role='listitem'")
  })
})

describe('EventFlowStrip connector draw is one-shot (no loop, no replay)', () => {
  it('draws connectors with a scaleX(0→1) keyframe only', () => {
    expect(scss).toContain('@keyframes event-flow-strip-connector-draw')
    const keyframes = scss.slice(
      scss.indexOf('@keyframes event-flow-strip-connector-draw'),
    )
    expect(keyframes).toContain('transform: scaleX(0)')
    expect(keyframes).toContain('transform: scaleX(1)')
  })

  it('never declares an infinite or looping animation', () => {
    expect(scss).not.toMatch(/animation\s*:[^;]*infinite/i)
    expect(scss).not.toMatch(/animation\s*:[^;]*\bloop\b/i)
    // No animation-iteration-count override either.
    expect(scss).not.toContain('animation-iteration-count')
  })

  it('keeps the connector animation declaratively one-shot (duration + delay, fill both)', () => {
    // 0.3s draw starting at 0.33s (after the 250ms node entrance + 80ms gap).
    expect(scss).toMatch(
      /event-flow-strip-connector-draw\s+0\.3s\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)\s+0\.33s\s+both/,
    )
    expect(scss).toContain('transform-origin: left center')
  })

  it('renders fully static under reduced motion (JS modifier + media query)', () => {
    expect(tsx).toContain('getSystemReducedMotion()')
    expect(tsx).toContain("'event-flow-strip--rm'")
    expect(scss).toContain('&--rm')
    expect(scss).toMatch(/&--rm\s*\{[\s\S]*?animation:\s*none/)
    expect(scss).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

describe('EventFlowStrip brand + platform discipline', () => {
  it('marks the first beat (订座) with a solid primary outline — no gradient', () => {
    expect(scss).toContain('&__node--first')
    expect(scss).toContain('background: rgba($color-primary, 0.08)')
    expect(scss).toContain('border: 2rpx solid rgba($color-primary, 0.35)')
    expect(scss).not.toMatch(/linear-gradient|radial-gradient/)
  })

  it('keeps CJK labels free of overflow-wrap:anywhere (orphan-glyph trap)', () => {
    expect(scss).not.toContain('overflow-wrap: anywhere')
    // Strip comment lines before the min/max/clamp scan — the header comment
    // documents the ban, which is not a usage.
    const codeOnly = scss.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(codeOnly).not.toMatch(/min\(|max\(|clamp\(/)
  })

  it('does not side-effect import SCSS (subpackage WXSS rule — page @use\'s it)', () => {
    expect(tsx).not.toMatch(/^import\s+['"][^'"]*\.scss['"]/m)
  })

  it('resolves glyphs via localAsset() with a decode-failure dot fallback', () => {
    expect(tsx).toContain('localAsset(step.glyph)')
    expect(tsx).toContain('event-flow-strip__node-dot')
    expect(tsx).toContain('onError')
  })
})
