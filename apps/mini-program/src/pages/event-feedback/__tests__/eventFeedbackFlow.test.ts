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
//
// 2026-10-16 feedback activation: render branches key off `effectiveStep`
// (server feedback-state 'submitted' forces the revealed/thank-you branch
// without a one-frame form flash); the block-content contracts below are
// unchanged.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')
// 2026-10-16 Batch C extraction: step renders moved to steps/*.tsx to keep
// index.tsx under the 1800-line harness gate. Assertions about the moved
// blocks read the extracted files (or the combined source) — same contract,
// new home.
const connectionsTsx = readFileSync(resolve(here, '..', 'steps', 'ConnectionsStep.tsx'), 'utf-8')
const wrapupTsx = readFileSync(resolve(here, '..', 'steps', 'WrapupStep.tsx'), 'utf-8')
const avatarTsx = readFileSync(resolve(here, '..', 'steps', 'ParticipantAvatar.tsx'), 'utf-8')
/** index + extracted steps — for assertions that hold across the whole page. */
const allTsx = [tsx, connectionsTsx, wrapupTsx].join('\n')

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

  it('renders 1/2/3(/4) progress dots on every interactive step', () => {
    expect(tsx).toContain('renderStepProgress')
    // 2026-10-16 Batch A (item 2): call sites pass `dotSteps` — a VISIT-STABLE
    // denominator keyed off collection eligibility (flag + no ID on file),
    // never the live selection count, so the dots no longer flip 3→4 mid-flow.
    expect(tsx).toContain("renderStepProgress('experience', dotSteps)")
    expect(tsx).toContain("renderStepProgress('connections', dotSteps)")
    expect(tsx).toContain("renderStepProgress('wrapup', dotSteps)")
    expect(tsx).toContain('? WECHAT_STEP_ORDER')
    expect(scss).toContain('&__progress-dot')
    // Past/current split: --done solid dot, --active capsule (nested modifiers
    // under &__progress-dot; extract up to the next block, not the first `}`).
    const dotBlock = scss.split('&__progress-dot {')[1]?.split('&__card {')[0] ?? ''
    expect(dotBlock).toContain('&--done')
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
    expect(connectionsTsx).toContain('aria-pressed={isSelected}')
    expect(connectionsTsx).toContain('aria-label={`选择${participantName}`}')
    expect(wrapupTsx).toContain("aria-label='分享你的感受和建议（可选）'")
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
    expect(wrapupTsx).toContain('最后，给选中的伙伴留个印象')
    expect(allTsx).not.toContain('最后一步')
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
    expect(tsx).toContain("if (effectiveStep === 'experience')")
    // Time-contextualized title (2026-10-16 #13): event-day label when the
    // registration resolves, honest fallback otherwise.
    expect(tsx).toContain('那局，怎么样？')
    expect(tsx).toContain('这局怎么样？')
    expect(tsx).toContain('整体体验如何？')
    expect(tsx).toContain('氛围温度计')
    expect(tsx).toContain('连接雷达')
    expect(tsx).toContain('场地印象')
    expect(tsx).toContain('散场之后')
    expect(tsx).toContain('CONNECTION_STATUS_OPTIONS.map')
    expect(tsx).toContain('<RatingFace value={rating} onSelect={setRating} />')
  })

  it('merges comment + people into the wrap-up screen', () => {
    expect(tsx).toContain("if (effectiveStep === 'wrapup')")
    expect(wrapupTsx).toContain('参与者印象')
    expect(wrapupTsx).toContain('改进建议')
    expect(wrapupTsx).toContain('想说点什么？（可选）')
    // The free comment textarea now lives inside the wrap-up scroll port.
    expect(wrapupTsx).toContain("className='event-feedback__textarea'")
    expect(wrapupTsx).toContain('提交反馈')
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
    expect(wrapupTsx).toContain('participants.filter((p) => selectedConnections.includes(p.id))')
    // Whole block hidden when nobody was selected (轻量原则).
    expect(wrapupTsx).toContain('attendees.length > 0 ? (')
  })

  it('enforces the max-3 caps for tags and improvement areas', () => {
    expect(allTsx).toContain('MAX_TAGS_PER_ATTENDEE')
    expect(allTsx).toContain('MAX_IMPROVEMENT_AREAS')
    expect(tsx).toContain('entry.tags.length >= MAX_TAGS_PER_ATTENDEE')
    expect(wrapupTsx).toContain('improvementAreas.length >= MAX_IMPROVEMENT_AREAS')
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
    expect(wrapupTsx).toContain("hoverClass={disabled ? undefined : 'event-feedback__improve-item--pressed'}")
    // Each surface defines its pressed modifier (nested under its own
    // block: scale-dot, select-pill, improve-item).
    expect((scss.match(/&--pressed/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(allTsx).toContain("haptics('light')")
    expect(allTsx).toContain("haptics('medium')")
  })

  it('keeps the connections screen scrollable so the bottom CTA stays anchored', () => {
    expect(connectionsTsx).toContain('event-feedback__deep-scroll')
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
      scss.split('&__attendee-tags-hint {')[1]?.split('}')[0] ?? '',
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
    const inputBlock = scss.split('&__attendee-note {')[1]?.split('}')[0] ?? ''
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
    expect(connectionsTsx).toContain('event-feedback__participants-error')
    expect(connectionsTsx).toContain("ariaLabel='重试加载参与者'")
    expect(scss).toContain('&__participants-error')
    expect(scss).toContain('&__participants-retry')
  })

  it('resets the submitting, submitted and remedy-saving transient flags on re-show', () => {
    // 2026-10-16: setRemedySaving joined the reset set (微信号 remedy card
    // mid-save swipe-back would otherwise leave 保存中… stuck).
    expect(tsx).toContain('useResetOnShow(setIsSubmitting, setSubmitted, setRemedySaving)')
    expect(tsx).toContain("import { useResetOnShow } from '../../hooks/useResetOnShow'")
  })

  it('guards the wrap-up submit button against double taps and swipe-back resurrection', () => {
    expect(wrapupTsx).toContain('disabled={isSubmitting || submitted}')
  })

  it('filters attendee impressions to only currently selected connections at submit', () => {
    expect(tsx).toContain('if (!selectedConnections.includes(userId)) continue')
  })

  it('wraps radio pills in radiogroups and marks capped checkboxes disabled (audit aria)', () => {
    expect(tsx).toContain("role='radiogroup'")
    expect(tsx).toContain("aria-label='场地风格满意度'")
    expect(tsx).toContain("aria-label='散场后与参与者的联系状态'")
    expect(wrapupTsx).toContain('aria-disabled={disabled || undefined}')
    expect(wrapupTsx).toContain('hoverClass={disabled ? undefined : \'event-feedback__improve-item--pressed\'}')
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

  it('falls back gracefully when the CDN mascot imagery fails (2026-08-07 audit G6)', () => {
    // Batch A item 1 (2026-10-16): the ceremony hero + its heroFailed chain
    // are retired; the mascot badge keeps the failure fallback.
    expect(tsx).not.toContain('heroFailed')
    expect(tsx).toContain('setMascotFailed(true)')
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
    expect(avatarTsx).toContain('src={participant.avatarUrl}')
    expect(avatarTsx).toContain('onError={() => setImageFailed(true)}')
    expect(connectionsTsx).toContain('<ParticipantAvatar participant={p} name={participantName}')
    expect(scss).toContain('&__participant-avatar')
    expect(scss).toContain('border-radius: 50%')
  })

  it('feeds the canonical outcome pipeline after the legacy feedback POST (W4 AC-W4.2a)', () => {
    // The shipping caller that reconnects the feedback fuel line: the feedback
    // page resolves the matched group from the shared registrations cache and
    // posts the canonical payload to the group-outcome route.
    expect(tsx).toContain('getMyPoolRegistrations')
    expect(tsx).toContain('REGISTRATIONS_QUERY_KEY')
    expect(tsx).toContain('buildGroupOutcomePayload')
    expect(tsx).toContain('/api/event-pools/${encodeURIComponent(matchedRegistration.poolId)}/group-outcome')
    // Fired only after the primary feedback POST succeeded, and fire-and-forget.
    const submitBlock = tsx.split("const submitGroupOutcome = useCallback")[1] ?? ''
    expect(submitBlock).toContain('.catch(')
    const handleSubmitBlock = tsx.split('const handleSubmit = useCallback')[1] ?? ''
    expect(handleSubmitBlock).toContain('submitGroupOutcome()')
    // Kept in the callback deps so a stale closure cannot drop the call.
    expect(handleSubmitBlock).toContain('submitGroupOutcome,')
  })

  it('does not silently drop the outcome when the registrations cache is cold (W4 review)', () => {
    const submitBlock = tsx.split('const submitGroupOutcome = useCallback')[1] ?? ''
    // Unresolved cache → explicit ensureQueryData before deciding, not a bare return.
    expect(submitBlock).toContain('ensureQueryData')
    expect(submitBlock).toContain('REGISTRATIONS_QUERY_KEY')
    expect(submitBlock).toContain('registrations unavailable')
    // Loaded-but-unmatched and no-signal are distinguished and logged.
    expect(submitBlock).toContain('no matched group for this event')
    expect(submitBlock).toContain('no usable feedback signal')
  })
})

describe('wechat contact-ID collection (2026-10-16, spec wechat-id-collection-spec-20261016)', () => {
  it('adds the conditional wechat step between connections and wrapup', () => {
    expect(tsx).toContain("| 'wechat'")
    expect(tsx).toContain("if (effectiveStep === 'wechat')")
    // Forward jump from connections and the mirrored back target on wrap-up.
    expect(tsx).toContain("setStep(needWechatStep ? 'wechat' : 'wrapup')")
    expect(tsx).toContain("setStep(needWechatStep ? 'wechat' : 'connections')")
    // Visit-stable dot denominator (Batch A item 2): the wechat step rides
    // the same dotSteps list — keyed off eligibility, not selections.
    expect(tsx).toContain("renderStepProgress('wechat', dotSteps)")
  })

  it('gates the step on selection + unset ID + the feature flag', () => {
    expect(tsx).toContain('currentUser?.features?.wechatIdCollectionEnabled')
    expect(tsx).toContain('selectedConnections.length > 0')
    expect(tsx).toContain('!currentUser?.wechatContactId')
  })

  it('sends the ID only after an explicit valid save — typing alone never leaks', () => {
    expect(tsx).toContain('wechatContactId: wechatSaved ? wechatIdInput : undefined')
    expect(tsx).toContain('validateWechatContactId')
    expect(tsx).toContain('@shared/wechatContactId')
  })

  it('fires the collection funnel with enum-only metadata (never the ID)', () => {
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_step_shown'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_saved'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_skipped'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_invalid'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_remedy_saved'")
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_remedy_failed'")
  })

  it('renders the revealed remedy card with the dedicated endpoint and a success swap', () => {
    expect(tsx).toContain('event-feedback__remedy-card')
    expect(tsx).toContain("path: '/api/user/wechat-contact'")
    expect(tsx).toContain('event-feedback__remedy-success')
    // The gate keeps the card mounted through the auth-cache sync flip.
    expect(tsx).toContain('remedySaved || (!currentUser?.wechatContactId && !wechatSaved)')
  })

  it('covers every new BEM class in the page stylesheet (same-PR CSS contract)', () => {
    for (const cls of [
      '&__wechat-lead',
      '&__wechat-input',
      '&__wechat-format-hint',
      '&__wechat-field-error',
      '&__wechat-privacy',
      '&__wechat-skip',
      '&__remedy-card',
      '&__remedy-title',
      '&__remedy-text',
      '&__remedy-row',
      '&__remedy-input',
      '&__remedy-save',
      '&__remedy-success',
    ]) {
      expect(scss).toContain(cls)
    }
    // The remedy card pop-in is RM-gated like every other motion.
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__remedy-card')
  })
})

describe('feedback batch solidification (2026-10-16 D1/D2/D5a)', () => {
  it('counts archetype-head asset double-fails — fallback=none is otherwise invisible', () => {
    expect(avatarTsx).toContain('onAssetError')
    expect(tsx).toContain('handleArchetypeAssetError')
    expect(tsx).toContain('archetypeAssetFailRef')
    expect(tsx).toContain("reason: 'asset_double_fail'")
    // Wired at the wrap-up row call site (the connections picker has its own
    // initials fallback path and does not report); the page hands the handler
    // down as onArchetypeAssetError after the Batch C extraction.
    expect(tsx).toContain('onArchetypeAssetError={handleArchetypeAssetError}')
    expect(wrapupTsx).toContain('onAssetError={() => onArchetypeAssetError(p.id)}')
  })

  it('keeps the wrap-up derivations in the extracted, unit-tested module', () => {
    expect(wrapupTsx).toContain("from '../feedbackSummary'")
    expect(wrapupTsx).toContain('buildWrapupSummaryParts({')
    // The inline copies are gone — one home for each rule.
    expect(allTsx).not.toContain('function formatEventDayLabel(')
  })

  it('lands on the honest thanks state when another device already submitted (race)', () => {
    expect(tsx).toContain("errorCode === 'FEEDBACK_ALREADY_SUBMITTED'")
    expect(tsx).toContain("queryKey: ['mini-program', 'event-feedback-state', eventId]")
    const catchBlock = tsx.split("const errorCode = (err as { data?: { code?: string } } | null)?.data?.code")[1] ?? ''
    expect(catchBlock).toContain("setStep('revealed')")
    expect(catchBlock).toContain('setSubmitted(true)')
  })
})

describe('premium uplift Batch A (2026-10-16, items 1/2/15/16/17)', () => {
  it('item 1 — retires the ceremony hero; the mascot badge is the single mascot moment', () => {
    expect(tsx).not.toContain('event-feedback__success-hero')
    expect(tsx).not.toContain('CEREMONY_HEROES')
    expect(scss).not.toContain('&__success-hero')
    expect(scss).not.toContain('.event-feedback__success-hero')
    // Badge enlarged 220→240rpx and now carries the hero entrance animation.
    const mascotBlock = scss.split('&__success-mascot {')[1]?.split('}')[0] ?? ''
    expect(mascotBlock).toContain('width: 240rpx')
    expect(mascotBlock).toContain('height: 240rpx')
    expect(mascotBlock).toContain('animation: event-feedback-hero-enter')
    // …and the entrance is statically downgraded under reduced motion.
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__success-mascot')
    // Gap retune: mascot→title 16rpx effective via the negative margin.
    const titleRowBlock = scss.split('&__success-title-row {')[1]?.split('}')[0] ?? ''
    expect(titleRowBlock).toContain('margin-top: -$spacing-xs')
    // Registry key retired (single consumer verified before removal).
    const registry = readFileSync(resolve(here, '..', '..', '..', 'lib', 'ceremonyHeroes.ts'), 'utf-8')
    expect(registry).not.toContain('eventFeedbackThanks')
  })

  it('item 1 — loading gates hide the mascot and delay the skeleton rows', () => {
    // All three gates on this page swap the mascot for the BrandLogo mark and
    // flash no skeleton rows before 800ms.
    expect((tsx.match(/hideMascot/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((tsx.match(/skeletonDelayMs=\{800\}/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(tsx).not.toContain('showSkeleton={false}')
    const loadingScreen = readFileSync(
      resolve(here, '..', '..', '..', 'components', 'loading', 'JoyJoinLoadingScreen.tsx'),
      'utf-8',
    )
    expect(loadingScreen).toContain('hideMascot?: boolean')
    expect(loadingScreen).toContain('skeletonDelayMs?: number')
    expect(loadingScreen).toContain("import BrandLogo from '../ui/BrandLogo'")
  })

  it('item 15 — remedy copy is one causal line; success row carries the check icon + light haptic', () => {
    expect(tsx).toContain('补上后，互选成功的伙伴就能看到你的微信号')
    expect(tsx).not.toContain('互选成功的伙伴看不到你的联系方式，现在补上还来得及')
    expect(tsx).toContain("className='event-feedback__remedy-success-row'")
    expect(scss).toContain('&__remedy-success-row')
    expect(tsx).toContain("setRemedySaved(true)")
    const remedyBlock = tsx.split('const handleRemedySave = useCallback')[1] ?? ''
    expect(remedyBlock).toContain("haptics('light')")
  })

  it('item 16 — matches and CTAs align on the 40rpx container edge (no double inset)', () => {
    const matchesBlock = scss.split('&__matches {')[1]?.split('}')[0] ?? ''
    expect(matchesBlock).not.toContain('padding: 0 $spacing-md')
    const actionsBlock = scss.split('&__success-actions {')[1]?.split('}')[0] ?? ''
    expect(actionsBlock).not.toContain('padding: 0 $spacing-md')
  })

  it('item 17 — honest three-branch copy; the no-ID line sells anticipation, not a dead end', () => {
    expect(tsx).toContain('你选的人，如果也选了你，连接里第一时间见')
    expect(tsx).toContain('!hasMatches && selectedConnections.length > 0')
    expect(tsx).toContain('TA 设置后，连接里就能看到')
    expect(tsx).not.toContain('对方尚未设置微信号')
    // The old one-branch-fits-all line is gone.
    expect(tsx).not.toContain('<Text className=\'event-feedback__success-subtext\'>如果 TA 也选了你，连接里见</Text>')
    // Particles stay match-only.
    expect(tsx).toContain('{hasMatches && <ParticleBurst')
  })
})

describe('premium uplift Batch B (2026-10-16, items 6/10/11/12/13 — wechat step)', () => {
  it('item 6 — wraps the wechat ScrollView content in the centering scroll-inner', () => {
    const wechatBlock = tsx.split("if (effectiveStep === 'wechat')")[1] ?? ''
    expect(wechatBlock).toContain("className='event-feedback__scroll-inner'")
    const innerBlock = scss.split('&__scroll-inner {')[1]?.split('&__recap {')[0] ?? ''
    expect(innerBlock).toContain('min-height: 100%')
    expect(innerBlock).toContain('display: flex')
    expect(innerBlock).toContain('flex-direction: column')
    expect(innerBlock).toContain('margin-top: auto')
    expect(innerBlock).toContain('margin-bottom: auto')
    // Batch C extended the same wrapper to the connections step (item 6C).
    expect(tsx).toContain("className='event-feedback__scroll-inner'")
    expect(connectionsTsx).toContain("className='event-feedback__scroll-inner'")
    expect((allTsx.match(/event-feedback__scroll-inner/g) ?? []).length).toBe(2)
    // Connections: the benefit strip takes the top auto margin (group grammar).
    const benefitRule = scss.split('> .event-feedback__benefit {')[1]?.split('}')[0] ?? ''
    expect(benefitRule).toContain('margin-top: auto')
  })

  it('item 10 — privacy contract block: lock icon, one font step up, set-once merged', () => {
    expect(tsx).toContain("className='event-feedback__wechat-privacy-icon'")
    expect(tsx).toContain("className='event-feedback__wechat-privacy-lines'")
    expect(tsx).toContain("className='event-feedback__wechat-privacy-sub'")
    // The standalone set-once line is gone from both surfaces.
    expect(tsx).not.toContain('event-feedback__wechat-setonce')
    expect(scss).not.toContain('&__wechat-setonce')
    // Lock mapping: shield emoji → icon-lock (ui tier, brand purple), asset verified.
    expect(tsx).toContain("emoji='🛡️'")
    const privacyBlock = scss.split('&__wechat-privacy {')[1]?.split('}')[0] ?? ''
    expect(privacyBlock).toContain('display: flex')
    const textBlock = scss.split('&__wechat-privacy-text {')[1]?.split('}')[0] ?? ''
    expect(textBlock).toContain('font-size: $font-size-sm')
    expect(textBlock).toContain('$color-text-primary')
    const subBlock = scss.split('&__wechat-privacy-sub {')[1]?.split('}')[0] ?? ''
    expect(subBlock).toContain('font-size: $font-size-xs')
  })

  it('item 10 — fires feedback_wechat_input_focus once per visit, in both union and whitelist', () => {
    expect(tsx).toContain('wechatFocusTrackedRef')
    expect(tsx).toContain("trackFeedbackEvent('feedback_wechat_input_focus', { eventId })")
    expect(tsx).toContain('onFocus={handleWechatFocus}')
    const analytics = readFileSync(
      resolve(here, '..', '..', '..', 'lib', 'analytics', 'feedbackAnalytics.ts'),
      'utf-8',
    )
    expect(analytics).toContain("'feedback_wechat_input_focus'")
    const serverRoute = readFileSync(
      resolve(here, '..', '..', '..', '..', '..', 'server', 'src', 'routes', 'domains', 'analytics.ts'),
      'utf-8',
    )
    expect(serverRoute).toContain('"feedback_wechat_input_focus"')
  })

  it('item 11 — header purpose-hint gone; hint and error share one slot; lead icon de-tinted', () => {
    const wechatBlock = tsx.split("if (effectiveStep === 'wechat')")[1] ?? ''
    expect(wechatBlock).not.toContain('event-feedback__purpose-hint')
    expect(wechatBlock).not.toContain('只有互相选中的伙伴能看到')
    // Exclusive slot: the hint renders only when there is no error.
    expect(wechatBlock).toContain(') : (\n                <Text className=\'event-feedback__wechat-format-hint\'>')
    // Both occupy the same margin-top slot in the stylesheet.
    const hintBlock = scss.split('&__wechat-format-hint {')[1]?.split('}')[0] ?? ''
    const errorBlock = scss.split('&__wechat-field-error {')[1]?.split('}')[0] ?? ''
    expect(hintBlock).toContain('margin-top: $spacing-xs')
    expect(errorBlock).toContain('margin-top: $spacing-xs')
    // The brown-tinted chemistry chat bubble is off this surface.
    expect(wechatBlock).not.toContain("emoji='💬'")
    expect(wechatBlock).not.toContain("tier='chemistry'")
    expect(wechatBlock).toContain("emoji='🔗'")
  })

  it('item 12 — skip hint merged into the skip bar; standalone hint deleted', () => {
    expect(tsx).toContain('暂不填写，结果页还能补')
    expect(tsx).not.toContain('互选成功后，还能在结果页补充')
    expect(tsx).not.toContain('event-feedback__wechat-skip-hint')
    expect(scss).not.toContain('&__wechat-skip-hint')
    // The skip control keeps its ≥88rpx touch target and press feedback.
    const skipBlock = scss.split('&__wechat-skip {')[1]?.split('}')[0] ?? ''
    expect(skipBlock).toContain('min-height: 88rpx')
    expect(tsx).toContain("hoverClass='event-feedback__wechat-skip--pressed'")
  })

  it('item 13 — selection recap bar: stacked faces + N-count line, capped at 4 with +N', () => {
    const wechatBlock = tsx.split("if (effectiveStep === 'wechat')")[1] ?? ''
    expect(wechatBlock).toContain("className='event-feedback__recap'")
    expect(wechatBlock).toContain('recapParticipants.slice(0, 4)')
    expect(wechatBlock).toContain('recapParticipants.length > recapVisible.length')
    expect(wechatBlock).toContain('你选了 {recapParticipants.length} 位伙伴，互选成功后 TA 们能看到')
    // Same roster + avatar identity chain as the connections grid.
    expect(wechatBlock).toContain('participants.filter((p) => selectedConnections.includes(p.id))')
    expect(wechatBlock).toContain('<ParticipantAvatar participant={p} name={participantName} size={56} mini />')
    // Recap sits directly above the card, inside the centering wrapper.
    expect(wechatBlock.indexOf("event-feedback__recap'")).toBeLessThan(
      wechatBlock.indexOf("event-feedback__card'"),
    )
    for (const cls of [
      '&__recap',
      '&__recap-avatars',
      '&__recap-avatar',
      '&__recap-overflow',
      '&__recap-overflow-text',
      '&__recap-text',
    ]) {
      expect(scss).toContain(cls)
    }
    // The 56rpx mini avatar variant is nested under &__participant-avatar.
    const avatarBlock = scss.split('&__participant-avatar {')[1]?.split('&__participant-name')[0] ?? ''
    expect(avatarBlock).toContain('&--mini')
    expect(avatarBlock).toContain('56rpx')
  })

  it('keeps the Batch A dot contract untouched on the wechat step', () => {
    const wechatBlock = tsx.split("if (effectiveStep === 'wechat')")[1] ?? ''
    expect(wechatBlock).toContain("renderStepProgress('wechat', dotSteps)")
    expect(wechatBlock).not.toContain('visibleSteps')
  })
})

describe('premium uplift Batch C (2026-10-16, items 3/4/5/6C/7/8/9/14)', () => {
  it('item 3 — thermometer stations ride the track; radar compact variant stays isolated', () => {
    const thermoBlock = scss.split('&__thermo {')[1]?.split('&__thermo-fill {')[0] ?? ''
    expect(thermoBlock).toContain('position: relative')
    // Track absolute behind the dot row, threading dot centers at 38rpx.
    const trackBlock = scss.split('&__thermo-track {')[1]?.split('}')[0] ?? ''
    expect(trackBlock).toContain('position: absolute')
    expect(trackBlock).toContain('top: 38rpx')
    expect(trackBlock).toContain('left: 0')
    expect(trackBlock).toContain('right: 0')
    // Dots above the track; stations are surface fill + border ring (thermo only).
    const dotBlock = scss.split('&__scale-dot {')[1]?.split('&--lit::after')[0] ?? ''
    expect(dotBlock).toContain('z-index: 1')
    expect(thermoBlock).toContain('.event-feedback__scale-dot::after')
    expect(thermoBlock).toContain('background: $color-surface')
    expect(thermoBlock).toContain('border: 2rpx solid $color-border')
    // Compact isolation: the base disc keeps the solid border token (radar).
    expect(dotBlock).toContain('background: $color-border')
    expect(dotBlock).not.toContain('$color-surface')
    // Fill math untouched.
    expect(tsx).toContain('transform: `scaleX(${value > 0 ? (value - 0.5) / 5 : 0})`')
    // Selected anchor word is brand purple + semibold (pre-existing contract).
    const labelBlock = scss.split('&__scale-label {')[1]?.split('&__thermo {')[0] ?? ''
    expect(labelBlock).toContain('&--active')
    expect(labelBlock).toContain('$color-primary')
  })

  it('item 4 — radar label/hint stack vertically; scale copy shows only when selected', () => {
    const headBlock = scss.split('&__radar-head {')[1]?.split('}')[0] ?? ''
    expect(headBlock).toContain('flex-direction: column')
    expect(headBlock).not.toContain('justify-content: space-between')
    const hintBlock = scss.split('&__radar-hint {')[1]?.split('}')[0] ?? ''
    expect(hintBlock).toContain('font-size: $font-size-xs')
    expect(hintBlock).toContain('$color-text-tertiary-on-light')
    // Radar rows carry the shared anchors but display them only once selected.
    expect(tsx).toContain('selectedOnlyLabels')
    expect(tsx).toContain('labels={ATMOSPHERE_LABELS}')
    expect(tsx).toContain('event-feedback__scale-label--hidden')
    // --hidden is nested under &__scale-label (opacity only, no layout shift).
    const labelBlock = scss.split('&__scale-label {')[1]?.split('&__thermo {')[0] ?? ''
    expect(labelBlock).toContain('&--hidden')
    expect(labelBlock).toContain('opacity: 0')
  })

  it('item 5 — deep fields collapse behind the expander; expand fires deep_engaged once', () => {
    const experienceBlock = tsx.split("if (effectiveStep === 'experience')")[1] ?? ''
    // Default collapsed (state lives at the top of the page component).
    expect(tsx).toContain('const [deepExpanded, setDeepExpanded] = useState(false)')
    expect(experienceBlock).toContain('{deepExpanded ? (')
    expect(experienceBlock).toContain('再多评几项（可选）')
    expect(experienceBlock).toContain('aria-expanded={deepExpanded}')
    expect(experienceBlock).toContain('if (!deepExpanded) markDeepEngaged()')
    // Always-visible head: rating faces + thermometer stay OUTSIDE the gate.
    expect(experienceBlock.indexOf('<RatingFace value={rating} onSelect={setRating} />')).toBeLessThan(
      experienceBlock.indexOf('{deepExpanded ? ('),
    )
    expect(experienceBlock.indexOf('<Thermometer')).toBeLessThan(
      experienceBlock.indexOf('{deepExpanded ? ('),
    )
    // Chevron is CSS-only (no chevron asset exists; copy law bars raw glyphs).
    expect(experienceBlock).toContain('event-feedback__expander-chevron')
    const chevronBlock = scss.split('&__expander-chevron {')[1]?.split('&--open {')[0] ?? ''
    expect(chevronBlock).toContain('transform: rotate(45deg)')
    expect(chevronBlock).toContain('transition: transform 0.2s ease')
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__expander-chevron')
    // Payload path untouched: the same balanced builder still runs at submit.
    expect(tsx).toContain('buildEventFeedbackPayload({')
    expect(tsx).toContain('connectionRadar: radar')
  })

  it('item 7 — benefit strip under the title; empty-selection CTA is a neutral 下一步', () => {
    expect(connectionsTsx).toContain("className='event-feedback__benefit'")
    expect(connectionsTsx).toContain("className='event-feedback__benefit-icon'")
    expect(connectionsTsx).toContain('互相选择后，即可看到对方的微信号')
    // The promise moved out of the card (dedupe) — the card keeps only its title.
    const benefitPos = connectionsTsx.indexOf("event-feedback__benefit'")
    const cardPos = connectionsTsx.indexOf("event-feedback__card'")
    expect(benefitPos).toBeLessThan(cardPos)
    const cardBlock = connectionsTsx.split("event-feedback__card'")[1] ?? ''
    expect(cardBlock).not.toContain('event-feedback__card-hint')
    expect(connectionsTsx).not.toContain('跳过，下一步')
    expect(connectionsTsx).not.toContain('跳过选择，进入下一步')
    expect(connectionsTsx).toContain('已选 ${selectedConnections.length} 人，下一步')
    const benefitBlock = scss.split('&__benefit {')[1]?.split('}')[0] ?? ''
    expect(benefitBlock).toContain('rgba($color-primary, 0.05)')
  })

  it('item 8 — selected card lifts with an archetype ring; count chip floats above the CTA', () => {
    // --selected is nested under &__participant-item (transform-only lift).
    const itemBlock = scss.split('&__participant-item {')[1]?.split('&__participant-ring {')[0] ?? ''
    expect(itemBlock).toContain('&--selected')
    expect(itemBlock).toContain('border-color: $color-primary')
    expect(itemBlock).toContain('transform: translateY(-4rpx)')
    const rmBlock = scss.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''
    expect(rmBlock).toContain('.event-feedback__participant-item')
    expect(rmBlock).toContain('.event-feedback__participant-item--selected')
    expect(connectionsTsx).toContain("className='event-feedback__participant-ring'")
    expect(connectionsTsx).toContain('SELECTED_RING_FALLBACK')
    expect(connectionsTsx).toContain('formatHSLAsRGBA(archetypeHsl, 0.5)')
    expect(connectionsTsx).toContain("className='event-feedback__selection-count'")
    expect(connectionsTsx).toContain('已选 {selectedConnections.length} 位')
    const ringBlock = scss.split('&__participant-ring {')[1]?.split('}')[0] ?? ''
    expect(ringBlock).toContain('border: 4rpx solid transparent')
    expect(ringBlock).toContain('border-radius: 50%')
  })

  it('item 9 — cards carry memory anchors; grid is 2 columns with enlarged avatars', () => {
    expect(connectionsTsx).toContain('p.ageLabel, p.gender, p.industryLabel')
    expect(connectionsTsx).toContain("className='event-feedback__participant-meta'")
    expect(connectionsTsx).toContain("className='event-feedback__participant-socialtag'")
    expect(connectionsTsx).toContain('「{p.socialTag}」')
    expect(connectionsTsx).toContain('size={112} large />')
    const gridBlock = scss.split('&__participant-grid {')[1]?.split('}')[0] ?? ''
    expect(gridBlock).toContain('grid-template-columns: repeat(2, 1fr)')
    expect(gridBlock).not.toContain('repeat(3, 1fr)')
    const avatarBlock = scss.split('&__participant-avatar {')[1]?.split('&__participant-name')[0] ?? ''
    expect(avatarBlock).toContain('&--large')
    expect(avatarBlock).toContain('112rpx')
  })

  it('item 14 — improvement areas become pills with a circle checkbox; hint has three clean branches', () => {
    const listBlock = scss.split('&__improve-list {')[1]?.split('}')[0] ?? ''
    expect(listBlock).toContain('flex-direction: row')
    expect(listBlock).toContain('flex-wrap: wrap')
    const itemBlock = scss.split('&__improve-item {')[1]?.split('&--selected {')[0] ?? ''
    expect(itemBlock).toContain('display: inline-flex')
    expect(itemBlock).toContain('min-height: 64rpx')
    expect(itemBlock).toContain('border-radius: $radius-pill')
    expect(itemBlock).toContain('justify-content: flex-start')
    // Empty ring unselected, brand check asset when selected — the old check disc is gone.
    expect(wrapupTsx).toContain("className='event-feedback__improve-ring'")
    expect(wrapupTsx).toContain("className='event-feedback__improve-check-icon'")
    expect(wrapupTsx).not.toContain('event-feedback__improve-check\'')
    expect(scss).not.toContain('&__improve-check {')
    expect(wrapupTsx).toContain("emoji='✅'")
    // Hint stutter fix: 0 → 最多选 3 个; partial → 还能选 N 个; full unchanged.
    expect(wrapupTsx).toContain('`最多选 ${MAX_IMPROVEMENT_AREAS} 个`')
    expect(wrapupTsx).toContain('`还能选 ${improvementRemaining} 个`')
    expect(wrapupTsx).toContain('`已经选满 ${MAX_IMPROVEMENT_AREAS} 个，先这样吧`')
    expect(wrapupTsx).not.toContain('最多选 ${MAX_IMPROVEMENT_AREAS} 个，还能选')
  })
})

describe('premium uplift item 19 (2026-10-16, 互选纪念卡)', () => {
  const keepsakeSource = readFileSync(resolve(here, '..', 'keepsakeCard.ts'), 'utf-8')
  const keepsakeHook = readFileSync(resolve(here, '..', 'hooks', 'useKeepsakeCard.ts'), 'utf-8')

  it('renders the promoted keepsake as the second action, hasMatches branch only', () => {
    const revealedBlock = tsx.split("if (effectiveStep === 'revealed')")[1] ?? ''
    expect(revealedBlock).toContain('存下这一刻')
    // Hierarchy (pre-ship USA audit Angle 6): primary 去连接看看 → secondary
    // 存下这一刻 (Button) → quiet text 返回, all inside the actions stack.
    const actionsPos = revealedBlock.indexOf("event-feedback__success-actions'")
    const primaryPos = revealedBlock.indexOf('event-feedback__success-primary')
    const secondaryPos = revealedBlock.indexOf('event-feedback__success-secondary')
    const backPos = revealedBlock.indexOf('event-feedback__success-back')
    expect(actionsPos).toBeGreaterThan(-1)
    expect(primaryPos).toBeGreaterThan(actionsPos)
    expect(secondaryPos).toBeGreaterThan(primaryPos)
    expect(backPos).toBeGreaterThan(secondaryPos)
    // The no-match branches never reach the entry: every render is behind hasMatches.
    expect(revealedBlock).toContain('{hasMatches && (\n              <Button\n                className={`event-feedback__success-secondary')
    // Busy state swaps copy; NO native disabled attribute (the platform
    // disabled colour would repaint the button — render-caught rule), the
    // busy guard is JS + aria.
    expect(revealedBlock).toContain('正在生成…')
    expect(revealedBlock).toContain('event-feedback__success-secondary--busy')
    expect(revealedBlock).toContain('aria-disabled={isKeepsakeGenerating}')
    expect(revealedBlock).toContain('if (isKeepsakeGenerating) return')
    // Zero inducement: the entry block never says 分享.
    const entryBlock = revealedBlock.slice(secondaryPos, secondaryPos + 700)
    expect(entryBlock).not.toContain('分享')
  })

  it('mounts the hidden full-bitmap canvas (hasMatches only) with the offscreen class', () => {
    expect(tsx).toContain('canvasId={KEEPSAKE_CARD_CANVAS_ID}')
    expect(tsx).toContain("className='event-feedback__keepsake-canvas'")
    expect(tsx).toContain("style={{ width: '1080px', height: '1560px' }}")
    const canvasBlock = scss.split('&__keepsake-canvas {')[1]?.split('}')[0] ?? ''
    expect(canvasBlock).toContain('position: fixed')
    expect(canvasBlock).toContain('left: -9999rpx')
    expect(canvasBlock).toContain('opacity: 0')
    // The old tertiary strip is gone (promoted pre-ship 2026-10-16); the
    // promoted secondary action + quiet back link carry the classes now.
    expect(scss).toContain('&__success-secondary')
    expect(scss).toContain('&__success-back')
    expect(scss).not.toContain('&__keepsake-text')
  })

  it('structurally excludes contact info at the page mapping boundary', () => {
    // The page maps MutualMatch → { displayName, archetype } — the wechat
    // field is dropped here, before anything reaches the canvas module.
    expect(tsx).toContain('mutualMatches.map((match) => ({ displayName: match.displayName, archetype: match.archetype }))')
    // The canvas module never references contact fields at all.
    expect(keepsakeSource).not.toContain('wechatContactId')
    const inputBlock = keepsakeSource.split('export interface KeepsakeCardInput')[1]?.split('}')[0] ?? ''
    expect(inputBlock).not.toContain('wechat')
  })

  it('reuses the proven insight-poster pipeline primitives (no parallel fork)', () => {
    expect(keepsakeSource).toContain("from '../../lib/utils/canvasHelpers'")
    expect(keepsakeSource).toContain('exportCanvasWithRetry')
    expect(keepsakeSource).toContain('resolveImagePath')
    expect(keepsakeSource).toContain('fillRoundedRect')
    expect(keepsakeSource).toContain("CANVAS_PALETTE as PALETTE")
    // QR via the existing referral-attributed pipeline, fail-open.
    expect(keepsakeHook).toContain('fetchShareQrCodeImage')
    expect(keepsakeSource).toContain('扫码，遇见对味的局')
    // Permission chain mirrors the precedent (denied → settings).
    expect(keepsakeHook).toContain('scope.writePhotosAlbum')
    expect(keepsakeHook).toContain('openSetting')
    expect(keepsakeHook).toContain('saveImageToPhotosAlbum')
    // Light haptic on save success, then telemetry.
    expect(keepsakeHook).toContain("haptics('light')")
  })

  it('registers feedback_keepsake_save in both the client union and the server whitelist', () => {
    expect(keepsakeHook).toContain("trackFeedbackEvent('feedback_keepsake_save', { eventId, matchCount: matches.length })")
    const analytics = readFileSync(
      resolve(here, '..', '..', '..', 'lib', 'analytics', 'feedbackAnalytics.ts'),
      'utf-8',
    )
    expect(analytics).toContain("'feedback_keepsake_save'")
    const serverRoute = readFileSync(
      resolve(here, '..', '..', '..', '..', '..', 'server', 'src', 'routes', 'domains', 'analytics.ts'),
      'utf-8',
    )
    expect(serverRoute).toContain('"feedback_keepsake_save"')
  })

  it('hooks the save flow at page top level (never inside the conditional branch)', () => {
    // The hook call must live above the early returns — hooks order safety.
    const hookPos = tsx.indexOf('useKeepsakeCard({')
    const firstGatePos = tsx.indexOf('if (authLoading || feedbackStateLoading)')
    expect(hookPos).toBeGreaterThan(-1)
    expect(firstGatePos).toBeGreaterThan(hookPos)
    expect(tsx).toContain("import { useKeepsakeCard } from './hooks/useKeepsakeCard'")
    expect(tsx).toContain("import { KEEPSAKE_CARD_CANVAS_ID } from './keepsakeCard'")
    // Entry tap is a no-op while generating.
    expect(tsx).toContain('if (isKeepsakeGenerating) return')
  })
})
