import type { ApiTransport } from './core.js'
import type { User } from '../schema.js'
import type { OnboardingNextStep } from '../onboarding.js'
import type { MascotBackstory } from '../mascotConfig.js'
import type { TierDisplayFlags } from '../socialIcebreakerTierManifest.js'
import type { XiaoyueAnalysisPublicResult } from '../personality/discovery.js'

export const SENSITIVE_AUTH_USER_FIELD_NAMES = [
  'password',
  'passwordHash',
  'wechatOpenId',
  'wechatSessionKey',
  'sessionKey',
  'session_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secretKey',
  'secret_key',
  'credential',
  'credentials',
] as const

export type SensitiveAuthUserField = (typeof SENSITIVE_AUTH_USER_FIELD_NAMES)[number]

export type SanitizedAuthUser = Omit<User, SensitiveAuthUserField>

/**
 * Server-resolved pool-registration entitlement signal, computed EXACTLY like
 * the registration gate (`apps/server/src/lib/entitlement.ts`): subscription
 * first (credit read short-circuited), else event-pack credits > 0, else null;
 * APP_MODE=test → literal 'test' (skips both reads).
 */
export type EntitlementMode = 'subscription' | 'event_pack' | 'test' | null

export interface AuthUserResponse extends SanitizedAuthUser {
  /** APP_MODE — 'production' (WeChat OAuth) or 'test' (local phone login). */
  appMode?: 'production' | 'test'
  /** Server-authoritative marker for non-production single-test tools. */
  singleTestMode?: boolean
  /** Entitlement signal for optimistic pool registration (null = no entitlement). */
  entitlementMode?: EntitlementMode
  nextStep: OnboardingNextStep
  profileEssentialComplete: boolean
  profileExtendedComplete: boolean
  activeAssessmentSessionId: string | null
  paymentsEnabled: boolean
  birthYear?: number | string | null
  age?: number | string | null
  nickname?: string | null
  topInterests?: string[] | null
  primaryInterests?: string[] | null
  interests?: unknown[] | null
  /** Server-resolved mascot display name (China market). */
  mascotDisplayName?: string
  /** Server-resolved mascot backstory / lore. */
  mascotBackstory?: MascotBackstory
  /** Server-resolved tier display flags. */
  tierDisplayFlags?: TierDisplayFlags
  /** Cached Xiaoyue AI analysis (null when not yet computed). */
  xiaoyueAnalysis?: XiaoyueAnalysisPublicResult | null
  /** Match Compass v1 kill-switch — false hides the dashboard entirely. */
  matchCompassEnabled?: boolean
  /** Number of onboarding restarts remaining (capped at 5). */
  restartsRemaining?: number
  /** Referral code stored in session during login; used to pre-fill pool registration. */
  pendingReferralCode?: string
  /** Feature flags exposed to the client. */
  features?: {
    restartOnboarding?: boolean
    smartProfession?: boolean
    onboardingForceSkip?: boolean
    matchingLiveReveal?: boolean
    socialIcebreakerClientForceEnd?: boolean
    personalityDiceChooseMode?: boolean
    /** When true, the server uses template-driven run plan compilation (3×3 vibe×tier grid +
     *  deep_chat/play_fun/balanced vibes). When false, legacy compileAgentRunPlan() runs unchanged. */
    runPlanTemplatesEnabled?: boolean
    /** When false, disables the personality test share poster generation. */
    personalityShareEnabled?: boolean
    /** When false, skips the slot machine reveal animation and shows static result. */
    personalitySlotAnimationEnabled?: boolean
    /** K3 Phase 1+ (2026-08-01): remote-selectable slot timing profile.
     *  personalitySlotProfileDramatic wins over personalitySlotProfileFast;
     *  both false/absent = baseline. */
    personalitySlotProfileFast?: boolean
    personalitySlotProfileDramatic?: boolean
    /** K3 Phase 3 / B3 (2026-08-01): server-composed animated share clip
     *  (muted MP4 of the reveal moment). When false the share artifact stays
     *  the static poster. Default: false. */
    shareAnimatedClipEnabled?: boolean
    /** When false, hides the Hero Promo Banner entirely. Kill switch for the
     *  discover hero. Default: true. */
    promoBannerEnabled?: boolean
    /** When false, falls back to a simple spinner instead of the answer-echo
     *  loading state in the personality test. Default: true. */
    personalityTestEchoEnabled?: boolean
    /** Master kill-switch for the payment system. When false, payment endpoints return 503.
     *  Also surfaced as top-level paymentsEnabled on auth response. */
    paymentsEnabled?: boolean
    /** When false, falls back to the legacy tap button on squad-unboxing.
     *  Kill switch for the drag-to-reveal ribbon. Default: true. */
    squadUnboxingDragRevealEnabled?: boolean
    /** When true, renders the composed-hero ready state on squad-unboxing
     *  (redesign). Default: false (keeps existing layout). */
    socialSquadComposedHeroEnabled?: boolean
    /** When false, creation of and tier changes to the custom Social Icebreaker
     *  mode are rejected. Existing preset-tier sessions are unaffected.
     *  Default: true. */
    socialIcebreakerCustomModeEnabled?: boolean
    /** When true, enables the redesigned profile page UI. Default: true. */
    profileRedesignEnabled?: boolean
    /** Enables the Profile-only pixel avatar stage and My Image entry. */
    profilePixelAvatarEnabled?: boolean
    /** Enables the gathering room (集结房间): entry CTAs on pool-group-detail /
     *  squad-unboxing and the room page itself. Default: false. */
    gatheringRoomEnabled?: boolean
    /** Enables the Social Icebreaker five-pattern social haptic grammar
     *  (Nudge/Your-turn/Confirm/Reveal/Celebration) fired from session-state
     *  transitions. Default: false. */
    icebreakerHapticGrammarEnabled?: boolean
    /** Enables the Social Icebreaker mood-anchored ambient color field
     *  (waiting/active/reveal field on the session page shell + hold-screen-on
     *  POCKET posture). Default: false. */
    icebreakerMoodFieldEnabled?: boolean
    /** Enables the Social Icebreaker three-layer glance stack (L1/L2/L3) pilot
     *  on warmup + micro_challenge, bundling the Handshake Bridge opening
     *  ritual and S4 weighted motion on those surfaces. Default: false. */
    icebreakerGlanceStackEnabled?: boolean
    /** Enables S6 group-synchronized beats: server emits state-free beat
     *  triggers and the mini-program joins the session's WS room to fire
     *  haptic patterns on receipt. Default: false. */
    icebreakerGroupBeatsEnabled?: boolean
    /** Enables equipment draws, fragments and the fragment-only shop. */
    equipmentRewardsEnabled?: boolean
    /** Enables the private, append-only AI personal story surface. */
    personalStoryEnabled?: boolean
    /** When false, hides the corner participant-count badge on Discover OracleCards.
     *  Default: true. */
    oracleCardCornerStatEnabled?: boolean
    /** When false, hides the aggregate persona puzzle preview card on pool
     *  registration. Default: true. */
    personaSnapshotEnabled?: boolean
    /** When true, the matching-status live-reveal members stage shows an
     *  abstract puzzle-piece prelude instead of the member identity grid.
     *  Default: false. */
    matchingPuzzlePreludeEnabled?: boolean
    /** When true, AIGC labels are rendered on AI-generated surfaces.
     *  The server always returns AIGC meta; the client gates rendering. */
    aigcLabelsEnabled?: boolean
    /** When true, formed matching groups are held for operator approval
     *  before users are notified and venues are assigned. Default false. */
    matchingOperatorReviewEnabled?: boolean
    /** When true, enables the Alang NPC prototype system. Default: false. */
    alangEnabled?: boolean
    /** Non-production QA mode: allows restarting the same active Flash task. */
    flashTaskRetryTestEnabled?: boolean
    /** When false, hides the "收起卡组" collapse trigger on squad-unboxing and
     *  the deck stays in the fan phase (users already collapsed stay collapsed).
     *  Kill switch for the pocket-deck collapse. Default: true. */
    squadUnboxingPocketDeckEnabled?: boolean
    /** When false, the profile tab renders the existing static identity card
     *  without the HD-2D multi-plane depth background. Default: true. */
    profileIdentityStageEnabled?: boolean
    /** Per-flow kill gate for the Flow 1 dual-world intro overlay
     *  (joyjoin-intro at profile-review). Default: true. */
    flowIntroEnabled?: boolean
    /** Per-flow kill gate for the Flow 2 blind-box lifecycle overlay
     *  (blind-box-lifecycle post-registration). Default: true. */
    flowLifecycleEnabled?: boolean
    /** When true, the pool-registration Step 0 letter shows the 悦仔-voiced
     *  pre-registration teaser strip. Default: false (ships dark). */
    poolTeaserEnabled?: boolean
    /** 双人成行 (duo registration) kill-switch. Default: true. */
    duoRegistrationEnabled?: boolean
  }
}

export type AuthUserSummary = AuthUserResponse

export function getCurrentUser(api: ApiTransport): Promise<AuthUserResponse> {
  return api<AuthUserResponse>({ path: '/api/auth/user' })
}
