import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-07-28 device-recording audit (反馈 flow): steps were top-pinned over a
// dead gradient expanse, had no progress indication, no step transitions,
// aria gaps, and the mutual-contact roster came from an endpoint that never
// existed server-side. These locks keep the polished flow + the shared
// participants contract in place.
//
// 2026-08-15 merge: the 6-screen flow (rating → connections → comment →
// invite → deep-atmosphere → deep-people) folded into 3 screens — the rating
// faces and the 均衡反馈 deep fields all describe the same event experience.
// The invite interstitial and the second "均衡反馈" progress language are gone;
// deep fields are inline and optional, and the server keeps keying
// hasDeepFeedback / XP tier off payload CONTENT, so no server change.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('event-feedback flow polish (2026-07-28)', () => {
  it('fetches participants via the shared contract (endpoint exists server-side)', () => {
    expect(tsx).toContain('getEventParticipants')
    expect(tsx).toContain("from '@shared/api'")
    expect(tsx).not.toContain('/api/events/${encodeURIComponent(eventId)}/participants')
  })

  it('submits when the optional rating was skipped (no rating gate on submit)', () => {
    expect(tsx).toContain('buildEventFeedbackPayload')
    expect(tsx).not.toContain('rating === 0 || isSubmitting')
  })

  it('renders 1/2/3 progress dots on every interactive step', () => {
    expect(tsx).toContain('renderStepProgress')
    expect(tsx).toContain("renderStepProgress('experience')")
    expect(tsx).toContain("renderStepProgress('connections')")
    expect(tsx).toContain("renderStepProgress('wrapup')")
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

describe('event-feedback merged 3-screen flow (2026-08-15)', () => {
  it('folds the flow into experience → connections → wrapup (+ revealed)', () => {
    expect(tsx).toContain("| 'experience'")
    expect(tsx).toContain("| 'connections'")
    expect(tsx).toContain("| 'wrapup'")
    expect(tsx).toContain("| 'revealed'")
    // The invite interstitial and the two deep screens are gone.
    expect(tsx).not.toContain("| 'invite'")
    expect(tsx).not.toContain("'deep-atmosphere'")
    expect(tsx).not.toContain("'deep-people'")
    expect(tsx).not.toContain("| 'comment'")
    expect(tsx).not.toContain("| 'rating'")
  })

  it('keeps the wrap-up step title echoing the card question', () => {
    expect(tsx).toContain('还有什么想说的？')
    expect(tsx).not.toContain('最后一步')
  })

  it('removes the invite interstitial and its second progress language', () => {
    expect(tsx).not.toContain('再花 30 秒聊聊这场局')
    expect(tsx).not.toContain('开启均衡反馈')
    expect(tsx).not.toContain('直接提交')
    expect(tsx).not.toContain('renderDeepProgress')
    expect(scss).not.toContain('&__invite')
    expect(scss).not.toContain('&__deep-progress')
    expect(scss).not.toContain('&__submit-secondary')
  })

  it('states why we ask for feedback — no points pitch (no 积分 redemption system)', () => {
    expect(tsx).toContain('你的观察，会让下一场更对味')
    expect(tsx).toContain("className='event-feedback__purpose-hint'")
    expect(tsx).not.toContain('+30 积分')
    expect(scss).toContain('&__purpose-hint')
  })

  it('puts the whole event experience on one screen (faces + thermometer + radar + venue/status)', () => {
    expect(tsx).toContain("if (step === 'experience')")
    expect(tsx).toContain('今晚这局怎么样？')
    expect(tsx).toContain('整体体验如何？')
    expect(tsx).toContain('氛围温度计')
    expect(tsx).toContain('连接雷达')
    expect(tsx).toContain('场地印象')
    expect(tsx).toContain('散场之后')
    expect(tsx).toContain('CONNECTION_STATUS_OPTIONS.map')
    expect(tsx).toContain('<RatingFace value={rating} onSelect={setRating} />')
  })

  it('merges comment + people into the wrap-up screen', () => {
    expect(tsx).toContain("if (step === 'wrapup')")
    expect(tsx).toContain('参与者印象')
    expect(tsx).toContain('改进建议')
    expect(tsx).toContain('想说点什么？（可选）')
    // The free comment textarea now lives inside the wrap-up scroll port.
    const wrapupBlock = tsx.split("if (step === 'wrapup')")[1] ?? ''
    expect(wrapupBlock).toContain("className='event-feedback__textarea'")
    expect(wrapupBlock).toContain('提交反馈')
  })

  it('always sends the balanced payload — the server tiers XP off content', () => {
    expect(tsx).toContain('balanced: {')
    // No client-side path gate remains (the old `step !== invite` fork).
    expect(tsx).not.toContain("step !== 'invite'")
    expect(tsx).toContain('hasNewConnections: selectedConnections.length > 0')
  })

  it('fires deep_submitted off filled deep fields, mirroring the server rule', () => {
    expect(tsx).toContain('const hasDeepFields =')
    expect(tsx).toContain('atmosphereScore > 0')
    expect(tsx).toContain('Object.values(radar).some((value) => value > 0)')
    expect(tsx).toContain("trackFeedbackEvent('feedback_deep_submitted', { eventId })")
  })

  it('fires deep_engaged exactly once, on the first deep field touched', () => {
    expect(tsx).toContain('const deepEngagedRef = useRef(false)')
    expect(tsx).toContain('markDeepEngaged')
    expect(tsx).toContain("trackFeedbackEvent('feedback_deep_engaged', { eventId })")
    expect(tsx).not.toContain('feedback_invite_seen')
  })

  it('shows attendee impression cards only for people selected in the connections step', () => {
    expect(tsx).toContain('participants.filter((p) => selectedConnections.includes(p.id))')
    // Whole block hidden when nobody was selected (轻量原则).
    expect(tsx).toContain('attendees.length > 0 ? (')
  })

  it('enforces the max-3 caps for tags and improvement areas', () => {
    expect(tsx).toContain('MAX_TAGS_PER_ATTENDEE')
    expect(tsx).toContain('MAX_IMPROVEMENT_AREAS')
    expect(tsx).toContain('entry.tags.length >= MAX_TAGS_PER_ATTENDEE')
    expect(tsx).toContain('improvementAreas.length >= MAX_IMPROVEMENT_AREAS')
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

  it('gates every motion behind prefers-reduced-motion', () => {
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__scale-dot--lit')
    expect(rmBlock).toContain('.event-feedback__thermo-fill')
    expect(rmBlock).toContain('.event-feedback__attendee')
    expect(rmBlock).toContain('.event-feedback__improve-item')
  })

  it('adds hover press states and haptics to every interactive surface', () => {
    expect(tsx).toContain("hoverClass='event-feedback__scale-dot--pressed'")
    expect(tsx).toContain("hoverClass='event-feedback__select-pill--pressed'")
    expect(tsx).toContain("hoverClass={disabled ? undefined : 'event-feedback__improve-item--pressed'}")
    // Each surface defines its pressed modifier (nested under its own
    // block: scale-dot, select-pill, improve-item).
    expect((scss.match(/&--pressed/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(tsx).toContain("haptics('light')")
    expect(tsx).toContain("haptics('medium')")
  })

  it('keeps the connections screen scrollable so the bottom CTA stays anchored', () => {
    const connectionsBlock = tsx.split("if (step === 'connections')")[1] ?? ''
    expect(connectionsBlock).toContain('event-feedback__deep-scroll')
    const scrollBlock = scss.split('&__deep-scroll {')[1]?.split('}')[0] ?? ''
    expect(scrollBlock).toContain('flex: 1')
    expect(scrollBlock).toContain('min-height: 0')
  })

  it('uses readable secondary tokens for hints on white cards (contrast ≥ 4.5)', () => {
    const hintBlocks = [
      scss.split('&__card-hint {')[1]?.split('}')[0] ?? '',
      scss.split('&__purpose-hint {')[1]?.split('}')[0] ?? '',
      scss.split('&__scale-label {')[1]?.split('}')[0] ?? '',
      scss.split('&__radar-hint {')[1]?.split('}')[0] ?? '',
      scss.split('&__attendee-hint {')[1]?.split('}')[0] ?? '',
    ]
    for (const block of hintBlocks) {
      expect(block).toContain('$color-text-tertiary-on-light')
    }
    // Larger hint copy also gets relaxed line-height for CJK readability.
    const cardHintBlock = scss.split('&__card-hint {')[1]?.split('}')[0] ?? ''
    const purposeHintBlock = scss.split('&__purpose-hint {')[1]?.split('}')[0] ?? ''
    expect(cardHintBlock).toContain('line-height: 1.6')
    expect(purposeHintBlock).toContain('line-height: 1.6')
  })

  it('replaces the revealed success inline flex with a BEM class', () => {
    expect(tsx).toContain("className='event-feedback__success-title-row'")
    expect(scss).toContain('&__success-title-row')
    expect(tsx).not.toContain("style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}")
  })

  it('adds press feedback to the wechat-copy row and keeps it accessible', () => {
    expect(tsx).toContain("hoverClass='event-feedback__match-wechat--pressed'")
    const block = scss.split('&__match-wechat {')[1]?.split('}')[0] ?? ''
    expect(block).toContain('&--pressed')
  })

  it('centers single-line inputs vertically with line-height', () => {
    const inputBlock = scss.split('&__deep-input,')[1]?.split('}')[0] ?? ''
    expect(inputBlock).toContain('line-height: $input-height')
  })

  it('provides in-flow back navigation from the wrap-up screen (2026-08-07 audit G2)', () => {
    expect(tsx).toContain("setStep('connections')")
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

  it('resets both the submitting and submitted transient flags on re-show', () => {
    expect(tsx).toContain('useResetOnShow(setIsSubmitting, setSubmitted)')
    expect(tsx).toContain("import { useResetOnShow } from '../../hooks/useResetOnShow'")
  })

  it('guards the wrap-up submit button against double taps and swipe-back resurrection', () => {
    const wrapupBlock = tsx.split("if (step === 'wrapup')")[1] ?? ''
    expect(wrapupBlock).toContain('disabled={isSubmitting || submitted}')
  })

  it('filters attendee impressions to only currently selected connections at submit', () => {
    expect(tsx).toContain('if (!selectedConnections.includes(userId)) continue')
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

  it('moves RatingFace sizes into SCSS so inline rpx does not break cross-platform rendering', () => {
    const ratingFaceTsx = readFileSync(resolve(here, '..', '..', '..', 'components', 'ui', 'RatingFace.tsx'), 'utf-8')
    const ratingFaceScss = readFileSync(resolve(here, '..', '..', '..', 'components', 'ui', 'RatingFace.scss'), 'utf-8')
    expect(ratingFaceTsx).toContain("import { haptics } from '../../lib/utils/haptics'")
    expect(ratingFaceTsx).not.toContain('Taro.vibrateShort')
    expect(ratingFaceTsx).toContain("className='rating-face__face'")
    expect(ratingFaceTsx).toContain("className='rating-face__emoji'")
    expect(ratingFaceTsx).not.toContain("borderRadius: '50%'")
    expect(ratingFaceScss).toContain('width: 112rpx')
    expect(ratingFaceScss).toContain('height: 112rpx')
    expect(ratingFaceScss).toContain('width: 88rpx')
    expect(ratingFaceScss).toContain('height: 88rpx')
  })

  it('renders participant avatar images with a safe archetype fallback', () => {
    expect(tsx).toContain('src={participant.avatarUrl}')
    expect(tsx).toContain('onError={() => setImageFailed(true)}')
    expect(tsx).toContain('<ParticipantAvatar participant={p} name={participantName} />')
    expect(scss).toContain('&__participant-avatar')
    expect(scss).toContain('border-radius: 50%')
  })
})
