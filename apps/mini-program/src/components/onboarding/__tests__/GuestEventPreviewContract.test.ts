import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumeGuestPreviewLoginPending,
  markGuestPreviewLoginPending,
  __resetGuestPreviewLoginPendingForTests,
} from '../../../lib/analytics/guestPreviewLoginPending'

/**
 * GuestEventPreview contract test (转化 P1c, sprint-contract AC-09 — 参照
 * guidanceQueueContract.test.ts 模式). Behavioral assertions live in the
 * sibling render test; this file locks the wiring that cannot run under
 * jsdom: structural (source) assertions on insertion order, subpackage
 * @use discipline, verify-subpackage-styles registration, wow-choreography
 * tokens, copy red lines, and S7.4 analytics emission points.
 */

const finalStageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/personality-test/results/FinalStage.tsx'),
  'utf8',
)
const resultsScssSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/personality-test/results/index.scss'),
  'utf8',
)
const cardTsxSource = readFileSync(
  resolve(process.cwd(), 'src/components/onboarding/GuestEventPreviewCard.tsx'),
  'utf8',
)
const cardScssSource = readFileSync(
  resolve(process.cwd(), 'src/components/onboarding/GuestEventPreviewCard.scss'),
  'utf8',
)
const sectionTsxSource = readFileSync(
  resolve(process.cwd(), 'src/components/onboarding/GuestEventPreviewSection.tsx'),
  'utf8',
)
const loginHandoffSource = readFileSync(
  resolve(
    process.cwd(),
    'src/pages/onboarding/personality-test/results/hooks/useResultsLoginHandoff.ts',
  ),
  'utf8',
)
const verifyScriptSource = readFileSync(
  resolve(process.cwd(), 'scripts/verify-subpackage-styles.mjs'),
  'utf8',
)
const discoverAnalyticsSource = readFileSync(
  resolve(process.cwd(), 'src/lib/analytics/discoverAnalytics.ts'),
  'utf8',
)
const guestAttemptIdSource = readFileSync(
  resolve(process.cwd(), 'src/lib/analytics/guestAttemptId.ts'),
  'utf8',
)

beforeEach(() => {
  __resetGuestPreviewLoginPendingForTests()
})

describe('AC-09 insertion contract', () => {
  it('the section mounts in FinalStage BEFORE __stack-actions, wired to the existing login path', () => {
    const sectionIndex = finalStageSource.indexOf('<GuestEventPreviewSection')
    const stackIndex = finalStageSource.indexOf("className='personality-results__stack-actions")
    expect(sectionIndex).toBeGreaterThan(-1)
    expect(stackIndex).toBeGreaterThan(sectionIndex)
    expect(finalStageSource).toContain('onLoginRequest={() => void onContinue()}')
  })

  it('guest-only gate reuses the results-page auth signals (same source as the login wall)', () => {
    expect(finalStageSource).toContain('isAuthenticated={Boolean(isAuthenticated)}')
    expect(finalStageSource).toContain('authIsLoading={authIsLoading}')
  })

  it('fail-closed render: auth-loading/authenticated → null; empty/errored supply → null', () => {
    expect(sectionTsxSource).toContain('if (authIsLoading || isAuthenticated) return null')
    expect(sectionTsxSource).toContain('if (items.length === 0) return null')
    expect(sectionTsxSource).toContain('retry: 0')
  })

  it('renders min(3, supply) with the query disabled for non-guests', () => {
    expect(sectionTsxSource).toContain('MAX_RENDER_COUNT')
    expect(sectionTsxSource).toContain('(data ?? []).slice(0, MAX_RENDER_COUNT)')
    expect(sectionTsxSource).toContain('enabled: !authIsLoading && !isAuthenticated')
  })
})

describe('AC-09 subpackage style contract', () => {
  it('components carry no TSX-side SCSS import; the page SCSS @use\'s them', () => {
    expect(cardTsxSource).not.toMatch(/import\s+['"][^'"]*\.scss['"]/)
    expect(sectionTsxSource).not.toMatch(/import\s+['"][^'"]*\.scss['"]/)
    expect(resultsScssSource).toContain(
      "@use '../../../../components/onboarding/GuestEventPreviewCard.scss'",
    )
  })

  it('verify-subpackage-styles.mjs registers the new selectors for the results page WXSS', () => {
    const resultsBlock = verifyScriptSource.slice(
      verifyScriptSource.indexOf("page: 'pages/onboarding/personality-test/results/index.wxss'"),
      verifyScriptSource.indexOf("page: 'pages/onboarding/essential-data/index.wxss'"),
    )
    for (const selector of [
      'guest-event-preview{',
      'guest-event-preview__cards{',
      'guest-event-preview__hook--entered{',
      'guest-event-card{',
      'guest-event-card__hero{',
      'guest-event-card__title{',
      'guest-event-card__facts{',
    ]) {
      expect(resultsBlock).toContain(selector)
    }
  })
})

describe('AC-09 wow choreography contract (design §5.3.5)', () => {
  it('single easing curve + locked durations (400 rise / 90 stagger / 350 hook @ +530 → 880ms total ≤1000)', () => {
    expect(cardScssSource).toContain('cubic-bezier(0.22, 1, 0.36, 1)')
    expect(cardScssSource).toContain('$guest-preview-rise-ms: 400ms')
    expect(cardTsxSource).toContain('GUEST_PREVIEW_CARD_STAGGER_MS = 90')
    expect(sectionTsxSource).toContain('HOOK_LINE_DELAY_MS = 530')
    expect(sectionTsxSource).toContain('HOOK_LINE_ENTRANCE_MS = 350')
  })

  it('≥400ms settle isolation from the slot celebration (mount-time gate)', () => {
    expect(sectionTsxSource).toContain('MIN_SETTLE_GAP_MS = 400')
    expect(sectionTsxSource).toContain('Math.max(0, MIN_SETTLE_GAP_MS - elapsed)')
  })

  it('keyframes animate transform + opacity only — Ken Burns one-shot 1.04→1.0, no layout properties', () => {
    expect(cardScssSource).toContain('transform: scale(1.04)')
    expect(cardScssSource).toContain('transform: scale(1)')
    expect(cardScssSource).toContain('transform: translateY(24rpx)')
    expect(cardScssSource).toContain('transform: translateY(12rpx)')
  })

  it('the only loop is the loading shimmer; card/hook animations are one-shot', () => {
    const infiniteHits = cardScssSource.match(/infinite/g) ?? []
    expect(infiniteHits.length).toBe(1)
    const shimmerBlock = cardScssSource.slice(
      cardScssSource.indexOf('@keyframes guest-preview-shimmer'),
      cardScssSource.indexOf('// Defense-in-depth'),
    )
    expect(shimmerBlock).not.toMatch(/transform|background-position/)
  })

  it('observer: threshold 0.3, once-only (disconnect before start), fail-closed static on any failure', () => {
    expect(sectionTsxSource).toContain('OBSERVER_THRESHOLD = 0.3')
    expect(sectionTsxSource).toContain('thresholds: [OBSERVER_THRESHOLD]')
    expect(sectionTsxSource).toContain("setMotionPhase('static')")
    const disconnectCallIndex = sectionTsxSource.indexOf('cleanup()')
    const startCallIndex = sectionTsxSource.indexOf('startChoreography()')
    expect(disconnectCallIndex).toBeGreaterThan(-1)
    expect(disconnectCallIndex).toBeLessThan(startCallIndex)
  })

  it('reduced-motion static equivalent exists under the page-level class (WeChat has no media-query guarantee)', () => {
    expect(cardScssSource).toContain('.personality-results--reduce-motion')
    expect(cardScssSource).toContain('animation: none !important')
  })

  it('hero vignette is CDN-only via cdnAsset (single wrap, idempotent) and reuses manifest entries', () => {
    expect(cardTsxSource).toContain('cdnAsset(path)')
    expect(cardTsxSource).toContain('/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp')
    expect(cardTsxSource).toContain('/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp')
  })
})

describe('copy red lines (P1c)', () => {
  it('zero banned vocabulary and zero inline emoji in card + section sources', () => {
    for (const source of [cardTsxSource, sectionTsxSource]) {
      expect(source).not.toMatch(/匹配|社交|灵魂|撮合|AI|智能|算法/)
      expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  it('hook copy is the C1-A supply-fact line with live-query count; seat count is the live-query quiet fact, zero urgency vocabulary', () => {
    // C1=A (2026-10-21 user call): hook = 供给事实承接句, N = live preview
    // count via template literal; the retired 留座 line must not return.
    expect(sectionTsxSource).toContain('这周有 ${items.length} 场正在排桌')
    expect(sectionTsxSource).not.toContain('微信登录，为你留座')
    expect(cardTsxSource).toContain('还剩 ${item.spotsLeft} 座')
    expect(cardTsxSource).not.toMatch(/仅剩|抢手|马上|赶快|手慢/)
  })
})

describe('S7.4 analytics wiring', () => {
  it('card tap emits card_tap + login_tap (guestAttemptId auto-carried) and marks the login pending', () => {
    expect(sectionTsxSource).toContain("trackGuestPreviewCardTap({ destination: 'login' })")
    expect(sectionTsxSource).toContain("trackGuestPreviewLoginTap({ surface: 'guest_preview_card' })")
    expect(sectionTsxSource).toContain('markGuestPreviewLoginPending()')
  })

  it('login success is guarded by the pending flag — no phantom attempts for flag-off/supply<3 guests', () => {
    expect(loginHandoffSource).toContain('if (consumeGuestPreviewLoginPending())')
    expect(loginHandoffSource).toContain('trackGuestPreviewLoginSuccess()')
    // The frozen pre-existing handoff events stay intact.
    expect(loginHandoffSource).toContain("discoverAnalytics.track('login_cta_tap'")
    expect(loginHandoffSource).toContain("discoverAnalytics.track('login_handoff_duration'")
  })

  it('S1.2 landed files remain intact consumers (union entries + id helper lifecycle untouched)', () => {
    for (const eventType of [
      'guest_preview_card_impression',
      'guest_preview_card_tap',
      'guest_preview_login_tap',
      'guest_preview_login_success',
    ]) {
      expect(discoverAnalyticsSource).toContain(eventType)
    }
    expect(guestAttemptIdSource).toContain('export function beginGuestAttempt')
    expect(guestAttemptIdSource).toContain('export function getGuestAttemptId')
    expect(guestAttemptIdSource).toContain('export function consumeGuestAttemptId')
  })
})

describe('guestPreviewLoginPending guard module', () => {
  it('mark → consume(true) → consume(false); test-only reset clears', () => {
    expect(consumeGuestPreviewLoginPending()).toBe(false)
    markGuestPreviewLoginPending()
    expect(consumeGuestPreviewLoginPending()).toBe(true)
    expect(consumeGuestPreviewLoginPending()).toBe(false)
    markGuestPreviewLoginPending()
    __resetGuestPreviewLoginPendingForTests()
    expect(consumeGuestPreviewLoginPending()).toBe(false)
  })
})
