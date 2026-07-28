import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-07-28 device-recording audit (反馈 flow): steps were top-pinned over a
// dead gradient expanse, had no progress indication, no step transitions,
// aria gaps, and the mutual-contact roster came from an endpoint that never
// existed server-side. These locks keep the polished flow + the shared
// participants contract in place.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('event-feedback flow polish (2026-07-28)', () => {
  it('fetches participants via the shared contract (endpoint exists server-side)', () => {
    expect(tsx).toContain('getEventParticipants')
    expect(tsx).toContain("from '@shared/api'")
    expect(tsx).not.toContain('/api/events/${encodeURIComponent(eventId)}/participants')
  })

  it('renders 1/2/3 progress dots on every interactive step', () => {
    expect(tsx).toContain('renderStepProgress')
    expect(tsx).toContain("renderStepProgress('rating')")
    expect(tsx).toContain("renderStepProgress('connections')")
    expect(tsx).toContain("renderStepProgress('comment')")
    expect(scss).toContain('&__progress-dot')
    // Active state is a nested modifier under &__progress-dot.
    const dotBlock = scss.split('&__progress-dot {')[1]?.split('}')[0] ?? ''
    expect(dotBlock).toContain('&--active')
  })

  it('promotes the step question to title typography (dead __subtitle removed)', () => {
    expect(tsx).toContain("className='event-feedback__title'")
    expect(tsx).not.toContain('event-feedback__subtitle')
    expect(scss).not.toContain('&__subtitle')
  })

  it('pins the CTA to the bottom safe area (flex column + auto margin)', () => {
    expect(scss).toContain('display: flex')
    expect(scss).toContain('flex-direction: column')
    const footerBlock = scss.split('&__footer {')[1]?.split('}')[0] ?? ''
    expect(footerBlock).toContain('margin-top: auto')
    expect(footerBlock).toContain('@include safe-area-bottom-padding')
  })

  it('gives every step a quiet RM-gated enter transition', () => {
    expect(scss).toContain('@keyframes event-feedback-step-enter')
    expect(scss).toContain('animation: event-feedback-step-enter')
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__card')
  })

  it('carries haptics on step advance, participant toggle, and submit', () => {
    expect(tsx).toContain("haptics('light')")
    expect(tsx).toContain("haptics('medium')")
  })

  it('closes the aria gaps on participant tiles and the comment textarea', () => {
    expect(tsx).toContain('aria-pressed={isSelected}')
    expect(tsx).toContain('aria-label={`选择${participantName}`}')
    expect(tsx).toContain("aria-label='分享你的感受和建议（可选）'")
  })
})
