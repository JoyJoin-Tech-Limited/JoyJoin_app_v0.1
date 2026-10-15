import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Structural invariants for the extended-data gesture-feedback polish pass
// (2026-10 sweep). These lock the subtle, easy-to-silently-regress details:
// the --demo/--popping cascade order, per-level pop escalation, the demo exit
// crossfade, haptic arbitration, and reduced-motion coverage.

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const TSX = readFileSync(
  path.join(SRC_ROOT, 'pages/onboarding/extended-data/index.tsx'),
  'utf8',
)
const SCSS = readFileSync(
  path.join(SRC_ROOT, 'pages/onboarding/extended-data/index.scss'),
  'utf8',
)

const norm = (source: string) => source.replace(/\s+/g, ' ')
const TSX_N = norm(TSX)
const SCSS_N = norm(SCSS)

describe('extended-data gesture feedback invariants', () => {
  it('declares pop rules AFTER --demo so the first-tap pop replaces the demo dip on equal specificity', () => {
    const demoIndex = SCSS_N.indexOf('&--demo {')
    const popIndex = SCSS_N.indexOf('&--popping-l1 {')
    expect(demoIndex, '&--demo rule not found').toBeGreaterThan(-1)
    expect(popIndex, '&--popping-l1 rule not found').toBeGreaterThan(-1)
    expect(popIndex).toBeGreaterThan(demoIndex)
  })

  it('escalates pop scale 1.04 → 1.06 → 1.09 across per-level keyframes', () => {
    expect(SCSS_N).toContain(
      '@keyframes interest-pop-l1 { 0% { transform: scale(1); } 40% { transform: scale(1.04); }',
    )
    expect(SCSS_N).toContain(
      '@keyframes interest-pop-l2 { 0% { transform: scale(1); } 40% { transform: scale(1.06); }',
    )
    expect(SCSS_N).toContain(
      '@keyframes interest-pop-l3 { 0% { transform: scale(1); } 40% { transform: scale(1.09); }',
    )
  })

  it('ships static pop class literals resolvable by the class-coverage guard', () => {
    expect(TSX).toContain("'extended-data__interest-card--popping-l1'")
    expect(TSX).toContain("'extended-data__interest-card--popping-l2'")
    expect(TSX).toContain("'extended-data__interest-card--popping-l3'")
  })

  it('keeps the demo overlay mounted through its 200ms exit fade', () => {
    expect(SCSS_N).toContain(
      '&--exiting { opacity: 0; transition: opacity 0.2s ease; }',
    )
    expect(TSX_N).toContain('(selectedCount === 0 || tapDemoFading)')
  })

  it('arbitrates the milestone haptic synchronously in the tap handler', () => {
    expect(TSX_N).toContain('(prevCount < MIN_INTERESTS && nextCount >= MIN_INTERESTS)')
    expect(TSX_N).toContain('if (!milestoneFiresOnThisTap) {')
  })

  it('escalates tap haptics light/medium and gates the pop to heat gain', () => {
    expect(TSX_N).toContain(
      "if (reachedLevel === 3) { haptics('medium') } else if (reachedLevel != null) { haptics('light') }",
    )
    expect(TSX_N).toContain('if (reachedLevel != null) { setPoppingCardId(topicId)')
  })

  it('renders the footer thermometer as neutral unlock progress, not heat colours', () => {
    expect(TSX).toContain("const THERMOMETER_FILL_COLOR = '#8B5CF6'")
    const footerStart = TSX_N.indexOf('extended-data__footer-thermometer')
    const footerEnd = TSX_N.indexOf('extended-data__footer-combined-stat', footerStart)
    expect(footerStart, 'footer thermometer block not found').toBeGreaterThan(-1)
    expect(footerEnd).toBeGreaterThan(footerStart)
    const footer = TSX_N.slice(footerStart, footerEnd)
    expect(footer).toContain('backgroundColor: THERMOMETER_FILL_COLOR')
    expect(footer).not.toContain('backgroundColor: meta.color')
  })

  it('kills every new animation under prefers-reduced-motion', () => {
    const reducedMotionIndex = SCSS_N.indexOf('prefers-reduced-motion')
    expect(reducedMotionIndex, 'reduced-motion block not found').toBeGreaterThan(-1)
    const reducedMotion = SCSS_N.slice(reducedMotionIndex)
    expect(reducedMotion).toContain(
      '&--popping-l1, &--popping-l2, &--popping-l3 { animation: none; }',
    )
    expect(reducedMotion).toContain(
      '&__tier-indicator-segment { transition: none; animation: none; }',
    )
    expect(reducedMotion).toContain(
      '&__footer-thermometer-segment { transition: none; animation: none; }',
    )
  })
})
