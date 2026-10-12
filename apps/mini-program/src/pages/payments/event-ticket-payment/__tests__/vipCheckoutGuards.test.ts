import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { ApiError } from '../../../../lib/api/api'
import {
  getTerminalRegistrationCode,
  getTerminalRegistrationCopy,
  getVipMonthlyAnchorLabel,
  isSubscriptionActive,
  resolveSubscriptionConflictMessage,
  resolveVipMonthlyOffer,
  SUBSCRIPTION_STATUS_QUERY_KEY,
} from '../ticketHelpers'

/**
 * HIGH-1 / HIGH-2 / MEDIUM-1 coverage for the D2 悦聚月卡 checkout review
 * (2026-10-12). Pure-helper units plus page source-scan wiring contracts,
 * mirroring the established style in ticketHelpers.test.ts.
 */

function makeApiError(
  code: string | undefined,
  message?: string,
  statusCode = 400,
): ApiError {
  const err = new Error(message ?? `Request failed with status ${statusCode}`) as ApiError
  err.statusCode = statusCode
  err.data = code === undefined ? undefined : { code, ...(message ? { message } : {}) }
  return err
}

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u

// ─── HIGH-1: subscription-status suppression helpers ───────────────────────

describe('isSubscriptionActive (HIGH-1 fail-open read)', () => {
  it('is true ONLY on an affirmative active signal', () => {
    expect(isSubscriptionActive({ hasActiveSubscription: true })).toBe(true)
  })

  it('fail-opens to false for loading / error / malformed reads', () => {
    expect(isSubscriptionActive(undefined)).toBe(false)
    expect(isSubscriptionActive(null)).toBe(false)
    expect(isSubscriptionActive({})).toBe(false)
    expect(isSubscriptionActive({ hasActiveSubscription: false })).toBe(false)
    // Truthy wire junk stays inactive (fail-open renders the card; the
    // server-side 409 is the real backstop).
    expect(isSubscriptionActive({ hasActiveSubscription: 1 as never })).toBe(false)
  })

  it('exposes a stable shared query key for the 409 invalidation', () => {
    expect(SUBSCRIPTION_STATUS_QUERY_KEY).toEqual(['mini-program', 'subscription-status'])
  })
})

describe('resolveSubscriptionConflictMessage (HIGH-1 409 surface)', () => {
  it('prefers the server-provided Chinese message verbatim', () => {
    const err = makeApiError('SUBSCRIPTION_ALREADY_ACTIVE', '你的悦聚月卡还在有效期内', 409)
    expect(resolveSubscriptionConflictMessage(err)).toBe('你的悦聚月卡还在有效期内')
  })

  it('never collapses to a bare machine code or English wire text', () => {
    expect(resolveSubscriptionConflictMessage(makeApiError('SUBSCRIPTION_ALREADY_ACTIVE', 'SUBSCRIPTION_ALREADY_ACTIVE', 409))).not.toBe('SUBSCRIPTION_ALREADY_ACTIVE')
    expect(resolveSubscriptionConflictMessage(makeApiError('SUBSCRIPTION_ALREADY_ACTIVE', 'Subscription already active', 409))).toBe('你的悦聚月卡还在有效期内，无需再次购买')
  })

  it('falls back to an honest local line when the wire carries nothing', () => {
    const fallback = resolveSubscriptionConflictMessage(new Error('network down'))
    expect(fallback).toBe('你的悦聚月卡还在有效期内，无需再次购买')
    expect(fallback).not.toContain('会员')
    expect(fallback).not.toContain('VIP')
    expect(EMOJI_PATTERN.test(fallback)).toBe(false)
  })
})

// ─── HIGH-2: terminal seat-booking classification + copy ───────────────────

describe('getTerminalRegistrationCode (HIGH-2a)', () => {
  it('maps every pool-availability rejection to terminal', () => {
    expect(getTerminalRegistrationCode(makeApiError('POOL_FULL'))).toBe('POOL_FULL')
    expect(getTerminalRegistrationCode(makeApiError('POOL_CLOSED'))).toBe('POOL_CLOSED')
    expect(getTerminalRegistrationCode(makeApiError('POOL_CANCELLED'))).toBe('POOL_CANCELLED')
    expect(getTerminalRegistrationCode(makeApiError('REGISTRATION_DEADLINE_PASSED', undefined, 410))).toBe('REGISTRATION_DEADLINE_PASSED')
  })

  it('keeps ALREADY_REGISTERED off the terminal list (terminal JOINED state, handled as success)', () => {
    expect(getTerminalRegistrationCode(makeApiError('ALREADY_REGISTERED', '你已经报名过这个活动了'))).toBeNull()
  })

  it('keeps transient/server/network failures on the retry path', () => {
    expect(getTerminalRegistrationCode(makeApiError('REGISTRATION_FAILED'))).toBeNull()
    expect(getTerminalRegistrationCode(makeApiError('NO_ACTIVE_ENTITLEMENT'))).toBeNull()
    expect(getTerminalRegistrationCode(makeApiError(undefined, undefined, 500))).toBeNull()
    expect(getTerminalRegistrationCode(new Error('request:fail timeout'))).toBeNull()
    expect(getTerminalRegistrationCode(undefined)).toBeNull()
  })
})

describe('getTerminalRegistrationCopy (HIGH-2 honest System-UI copy)', () => {
  it('paid POOL_FULL: leads with the truthful 月卡已生效 and no consumed quota', () => {
    const copy = getTerminalRegistrationCopy({ code: 'POOL_FULL', paid: true })
    expect(copy.title).toBe('这桌刚刚满员')
    expect(copy.body).toContain('悦聚月卡已生效')
    expect(copy.body).toContain('名额没有消耗')
  })

  it('unpaid pre-charge block: must NOT claim the card is active', () => {
    const copy = getTerminalRegistrationCopy({ code: 'POOL_FULL', paid: false })
    expect(copy.body).not.toContain('已生效')
    expect(copy.body).toContain('没有扣款')
  })

  it('gives each terminal code a distinct honest title', () => {
    expect(getTerminalRegistrationCopy({ code: 'POOL_CANCELLED', paid: true }).title).toBe('这场活动已取消')
    expect(getTerminalRegistrationCopy({ code: 'POOL_CLOSED', paid: true }).title).toBe('这场报名已截止')
    expect(getTerminalRegistrationCopy({ code: 'REGISTRATION_DEADLINE_PASSED', paid: true }).title).toBe('这场报名已截止')
  })

  it('stays inside copy governance: zero emoji, no 会员/VIP vocabulary', () => {
    for (const code of ['POOL_FULL', 'POOL_CLOSED', 'POOL_CANCELLED', 'REGISTRATION_DEADLINE_PASSED'] as const) {
      for (const paid of [true, false]) {
        const copy = getTerminalRegistrationCopy({ code, paid })
        expect(EMOJI_PATTERN.test(copy.title)).toBe(false)
        expect(EMOJI_PATTERN.test(copy.body)).toBe(false)
        expect(copy.title + copy.body).not.toContain('会员')
        expect(copy.title + copy.body).not.toContain('VIP')
      }
    }
  })
})

// ─── NIT-a companion: the TRUE subscriptionPlans wire shape resolves ───────

describe('resolveVipMonthlyOffer against the real ritual-context wire shape (NIT-a)', () => {
  it('reads planType monthly + priceInCents + durationDays; quota stays copy-only', () => {
    // Mirrors the server builder in routes/domains/payments.ts (2026-10-11).
    const offer = resolveVipMonthlyOffer({
      subscriptionPlans: [
        {
          planType: 'monthly',
          displayName: '悦聚月卡',
          description: '每月 6 场局，说走就走',
          priceInCents: 9800,
          originalPriceInCents: null,
          durationDays: 30,
        },
        {
          planType: 'quarterly',
          displayName: '悦聚季卡',
          description: null,
          priceInCents: 29400,
          originalPriceInCents: null,
          durationDays: 90,
        },
      ],
    })
    expect(offer).not.toBeNull()
    expect(offer?.priceInCents).toBe(9800)
    expect(offer?.durationDays).toBe(30)
    expect(offer?.displayName).toBe('悦聚月卡')
    // No structured quota on the wire → anchor derived-or-omitted (omitted).
    expect(offer?.eventQuota).toBeNull()
    expect(getVipMonthlyAnchorLabel(offer)).toBeNull()
  })
})

// ─── Page wiring contracts (source scan, mirrors ticketHelpers.test.ts) ────

describe('event-ticket-payment vip guard wiring (HIGH-1 / HIGH-2 / MEDIUM-1)', () => {
  const pageSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx'),
    'utf8',
  )

  it('HIGH-1: suppresses the monthly card on an affirmative active subscription', () => {
    expect(pageSource).toContain("path: '/api/subscription/status'")
    expect(pageSource).toContain('queryKey: SUBSCRIPTION_STATUS_QUERY_KEY')
    expect(pageSource).toContain('isSubscriptionActive(subscriptionStatus)')
    expect(pageSource).toContain('checkoutSubscriptionUpsellEnabled && !subscriptionActive')
  })

  it('HIGH-1: maps the 409 backstop to the server message + status-query refresh', () => {
    expect(pageSource).toContain("intentErrorData?.code === 'SUBSCRIPTION_ALREADY_ACTIVE'")
    expect(pageSource).toContain('resolveSubscriptionConflictMessage(err)')
    expect(pageSource).toContain('invalidateQueries({ queryKey: SUBSCRIPTION_STATUS_QUERY_KEY })')
  })

  it('HIGH-2a: routes terminal registration codes to the terminal state, paid + truthful', () => {
    expect(pageSource).toContain('getTerminalRegistrationCode(err)')
    expect(pageSource).toContain('registrationTerminal: { code: terminalCode, paid: true }')
  })

  it('HIGH-2a: terminal surface renders BEFORE the footer retry — no retry loop possible', () => {
    const terminalBranch = pageSource.indexOf("payment.status === 'failed' && payment.registrationTerminal")
    const retryCta = pageSource.indexOf('ticket-cta--retry')
    expect(terminalBranch).toBeGreaterThanOrEqual(0)
    expect(retryCta).toBeGreaterThanOrEqual(0)
    expect(terminalBranch).toBeLessThan(retryCta)
    expect(pageSource).toContain('去看看其他局')
    expect(pageSource).toContain('MINI_PROGRAM_ROUTES.discover')
  })

  it('HIGH-2a: swipe-back never resets a paid terminal/pending state back to idle', () => {
    expect(pageSource).toContain(
      "payment.status === 'failed' && !payment.registrationPending && !payment.registrationTerminal",
    )
  })

  it('HIGH-2b: blocks the vip intent BEFORE charge when the page already knows the pool is full', () => {
    expect(pageSource).toContain("registrationTerminal: { code: 'POOL_FULL', paid: false }")
    // The pre-charge guard must sit before intent creation in the vip branch.
    const vipBranch = pageSource.indexOf("if (selectedPlan === 'vip_monthly')")
    const guard = pageSource.indexOf("registrationTerminal: { code: 'POOL_FULL', paid: false }")
    const intentCreate = pageSource.indexOf('createMiniProgramPaymentIntent(apiRequest, {')
    expect(vipBranch).toBeGreaterThanOrEqual(0)
    expect(guard).toBeGreaterThan(vipBranch)
    expect(intentCreate).toBeGreaterThan(guard)
  })

  it('HIGH-2c: transient paid-but-unregistered retry is preserved and never re-charges', () => {
    // The generic registration failure still sets the recovery marker…
    expect(pageSource).toContain('registrationPending: true')
    // …and handleRetry re-attempts ONLY the registration step.
    const retryStart = pageSource.indexOf('const handleRetry')
    const retryEnd = pageSource.indexOf('const [isNavigating', retryStart)
    expect(retryStart).toBeGreaterThanOrEqual(0)
    expect(retryEnd).toBeGreaterThan(retryStart)
    const retryBody = pageSource.slice(retryStart, retryEnd)
    expect(retryBody).toContain('finalizeVipRegistration(')
    expect(retryBody).not.toContain('createMiniProgramPaymentIntent')
    expect(retryBody).not.toContain('requestPayment')
  })

  it('MEDIUM-1: plan_selector_impression waits for settled pricing + subscription reads', () => {
    expect(pageSource).toContain('isFetched: ritualContextFetched')
    expect(pageSource).toContain('planSelectorMetadataReady')
    const gate = pageSource.indexOf('const planSelectorMetadataReady')
    const impression = pageSource.indexOf("discoverAnalytics.track('plan_selector_impression'")
    expect(gate).toBeGreaterThanOrEqual(0)
    expect(impression).toBeGreaterThan(gate)
    // The fire-once ref must still gate the track call.
    expect(pageSource).toContain('hasTrackedPlanSelectorImpressionRef.current = true')
  })
})
