import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

/**
 * D5 (2026-10-11): referral-attributed personality-results share.
 *
 * The results-page share card previously carried zero attribution — a guest
 * arriving from a results poster took the test anonymously and the inviter
 * was never credited. The landing page already persists `?invitationCode`
 * into `joyjoin_pending_referral_code` (lib/auth/pendingReferralCode.ts) and
 * the results login handoff forwards it to `login-with-test`, so appending
 * the sharer's own code to the share path closes the acquisition loop.
 *
 * Fail-open contract: no code (anonymous sharer, fetch still in flight, or
 * the stats call failed) → byte-identical path/query to the pre-D5 behavior.
 * Sharing must never block on code availability.
 *
 * The invite page keeps its own `buildReferralMiniProgramPath` (pool-scoped
 * share); this module owns the personality-results share targets only.
 */

function normalizeReferralCode(referralCode?: string | null): string {
  return typeof referralCode === 'string' ? referralCode.trim() : ''
}

/**
 * App-message share path. Always routes to the personality-test intro (the
 * pre-D5 target — preserved); the code rides as `?invitationCode=` and is
 * persisted by the intro page on arrival.
 */
export function buildPersonalityResultSharePath(referralCode?: string | null): string {
  const code = normalizeReferralCode(referralCode)
  const base = MINI_PROGRAM_ROUTES.personalityTest
  return code ? `${base}?invitationCode=${encodeURIComponent(code)}` : base
}

/**
 * Moments (timeline) share query. Timeline shares land on the CURRENT page
 * (results), so the results page persists the code on arrival — same storage,
 * same consumption point as the landing-persisted code.
 */
export function buildPersonalityResultTimelineQuery(referralCode?: string | null): string {
  const code = normalizeReferralCode(referralCode)
  const base = 'source=personality-result'
  return code ? `${base}&invitationCode=${encodeURIComponent(code)}` : base
}

/**
 * 悦仔-voice reward nudge under the share CTA (results final stage).
 * Generic by design — reward tiers are coupon-denominated and may change, so
 * the line never promises an amount or discount.
 */
export const RESULT_SHARE_REWARD_HINT = '朋友完成测试，你就多一张券'

/**
 * The reward promise is only true when the share actually carries attribution
 * — an anonymous sharer (or a failed stats fetch) produces a code-less share
 * that earns nothing, so the hint renders only when a code exists.
 */
export function getResultShareRewardHint(referralCode?: string | null): string {
  return normalizeReferralCode(referralCode) ? RESULT_SHARE_REWARD_HINT : ''
}
