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

  it('submits when the optional rating step was skipped', () => {
    expect(tsx).toContain('buildEventFeedbackPayload')
    expect(tsx).not.toContain('rating === 0 || isSubmitting')
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

describe('event-feedback balanced layer (均衡反馈, 2026-08-07)', () => {
  it('renames the step-3 title to echo the card question', () => {
    expect(tsx).toContain('还有什么想说的？')
    expect(tsx).not.toContain('最后一步')
  })

  it('surfaces the optional invite card after the comment step, before submit', () => {
    expect(tsx).toContain('再花 30 秒聊聊这场局')
    expect(tsx).toContain('开启均衡反馈')
    expect(tsx).toContain('直接提交')
    expect(tsx).toContain('完成可得 +30 积分')
    // The invite is an interstitial, not a numbered step — no 1/2/3 dots.
    expect(tsx).toContain("setStep('invite')")
  })

  it('renders the two compact deep screens with all five dimensions', () => {
    // Screen A — atmosphere
    expect(tsx).toContain('这场局的氛围')
    expect(tsx).toContain('氛围温度计')
    expect(tsx).toContain('连接雷达')
    expect(tsx).toContain('场地印象')
    expect(tsx).toContain('散场之后')
    expect(tsx).toContain('CONNECTION_STATUS_OPTIONS.map')
    // Screen B — people & suggestions
    expect(tsx).toContain('参与者与建议')
    expect(tsx).toContain('参与者印象')
    expect(tsx).toContain('改进建议')
  })

  it('shows a distinct label + 2-dot progress for the upgrade layer', () => {
    expect(tsx).toContain('renderDeepProgress')
    expect(tsx).toContain("renderDeepProgress('deep-atmosphere')")
    expect(tsx).toContain("renderDeepProgress('deep-people')")
    const progressBlock = scss.split('&__deep-progress-dot {')[1]?.split('}')[0] ?? ''
    expect(progressBlock).toContain('&--active')
  })

  it('enforces the max-3 caps for tags and improvement areas', () => {
    expect(tsx).toContain('MAX_TAGS_PER_ATTENDEE')
    expect(tsx).toContain('MAX_IMPROVEMENT_AREAS')
    expect(tsx).toContain('entry.tags.length >= MAX_TAGS_PER_ATTENDEE')
    expect(tsx).toContain('improvementAreas.length >= MAX_IMPROVEMENT_AREAS')
  })

  it('derives hasNewConnections from the connections step selection', () => {
    expect(tsx).toContain('hasNewConnections: selectedConnections.length > 0')
  })

  it('shows attendee impression cards only for people selected in the connections step', () => {
    expect(tsx).toContain('participants.filter((p) => selectedConnections.includes(p.id))')
    // Whole block hidden when nobody was selected (轻量原则).
    expect(tsx).toContain('attendees.length > 0 ? (')
  })

  it('uses one shared 1-5 dot language for thermometer and radar', () => {
    expect(tsx).toContain('function ScaleDots')
    expect(tsx).toContain('event-feedback__scale-dot--lit')
    // G8 (2026-08-07 audit): the fill animates via compositor transform
    // (scaleX), not layout-triggering width. RM-gated.
    expect(scss).toContain('transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)')
    expect(scss).toContain('transform-origin: left center')
    expect(tsx).toContain('transform: `scaleX(${value > 0 ? (value - 0.5) / 5 : 0})`')
  })

  it('applies the Alimama brand display font to titles with display line-height', () => {
    const titleBlock = scss.split('&__title {')[1]?.split('}')[0] ?? ''
    expect(titleBlock).toContain('@include font-cn-display')
    expect(titleBlock).toContain('line-height: $line-height-display')
    const successTitleBlock = scss.split('&__success-title {')[1]?.split('}')[0] ?? ''
    expect(successTitleBlock).toContain('@include font-cn-display')
    expect(successTitleBlock).toContain('line-height: $line-height-display')
  })

  it('gates every new motion behind prefers-reduced-motion', () => {
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__invite')
    expect(rmBlock).toContain('.event-feedback__scale-dot--lit')
    expect(rmBlock).toContain('.event-feedback__thermo-fill')
    expect(rmBlock).toContain('.event-feedback__attendee')
    expect(rmBlock).toContain('.event-feedback__improve-item')
  })

  it('adds hover press states and haptics to every new interactive surface', () => {
    expect(tsx).toContain("hoverClass='event-feedback__scale-dot--pressed'")
    expect(tsx).toContain("hoverClass='event-feedback__select-pill--pressed'")
    expect(tsx).toContain("hoverClass={disabled ? undefined : 'event-feedback__improve-item--pressed'}")
    // Each new surface defines its pressed modifier (nested under its own
    // block: scale-dot, select-pill, improve-item).
    expect((scss.match(/&--pressed/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(tsx).toContain("haptics('light')")
    expect(tsx).toContain("haptics('medium')")
  })

  it('keeps the deep screens scrollable with the CTA bottom-anchored', () => {
    expect(tsx).toContain('event-feedback__deep-scroll')
    expect(scss).toContain('&__deep-scroll')
    const scrollBlock = scss.split('&__deep-scroll {')[1]?.split('}')[0] ?? ''
    expect(scrollBlock).toContain('flex: 1')
    expect(scrollBlock).toContain('min-height: 0')
  })

  it('provides in-flow back navigation so deep entries survive (2026-08-07 audit G2)', () => {
    expect(tsx).toContain("setStep('invite')")
    expect(tsx).toContain("setStep('deep-atmosphere')")
    expect(tsx).toContain('event-feedback__submit-ghost')
    expect(scss).toContain('&__submit-ghost')
    const backBlock = scss.split('&__submit-ghost {')[1]?.split('}')[0] ?? ''
    expect(backBlock).toContain('@include button-secondary')
  })

  it('distinguishes participant fetch failure from an empty roster (2026-08-07 audit G3)', () => {
    expect(tsx).toContain('isError: participantsError')
    expect(tsx).toContain('event-feedback__participants-error')
    expect(tsx).toContain("ariaLabel='重试加载参与者'")
    expect(scss).toContain('&__participants-error')
    expect(scss).toContain('&__participants-retry')
  })

  it('resets the transient submit flag on re-show (2026-08-07 audit G12)', () => {
    expect(tsx).toContain('useResetOnShow(setIsSubmitting)')
    expect(tsx).toContain("import { useResetOnShow } from '../../hooks/useResetOnShow'")
  })

  it('wraps radio pills in radiogroups and marks capped checkboxes disabled (audit aria)', () => {
    expect(tsx).toContain("role='radiogroup'")
    expect(tsx).toContain("aria-label='场地风格满意度'")
    expect(tsx).toContain("aria-label='散场后与参与者的联系状态'")
    expect(tsx).toContain('aria-disabled={disabled || undefined}')
    expect(tsx).toContain('hoverClass={disabled ? undefined : \'event-feedback__improve-item--pressed\'}')
  })

  it('carries vh fallbacks before dvh and the brand font on title tiers (audit G7/G10/G11)', () => {
    expect(scss).toContain('min-height: 100vh')
    expect(scss).toContain('min-height: 100dvh')
    const successScrollBlock = scss.split('&__success-scroll {')[1]?.split('}')[0] ?? ''
    expect(successScrollBlock).toContain('flex: 1')
    expect(successScrollBlock).toContain('min-height: 0')
    expect(scss).toContain('font-family: $font-mono')
    expect(scss).not.toContain('font-family: monospace')
    const cardTitleBlock = scss.split('&__card-title {')[1]?.split('}')[0] ?? ''
    expect(cardTitleBlock).toContain('line-height: 1.4')
  })

  it('tracks the balanced-layer funnel via the shared analytics endpoint', () => {
    expect(tsx).toContain("trackFeedbackEvent('feedback_invite_seen'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_deep_engaged'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_deep_submitted'")
    expect(tsx).toContain("from '../../lib/analytics/feedbackAnalytics'")
  })

  it('falls back gracefully when the CDN celebration imagery fails (2026-08-07 audit G6)', () => {
    expect(tsx).toContain('setHeroFailed(true)')
    expect(tsx).toContain('setMascotFailed(true)')
    expect(tsx).toContain('onError={() => setHeroFailed(true)}')
    expect(tsx).toContain('onError={() => setMascotFailed(true)}')
  })
})
