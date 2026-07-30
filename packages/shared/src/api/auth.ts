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

export interface AuthUserResponse extends SanitizedAuthUser {
  /** APP_MODE — 'production' (WeChat OAuth) or 'test' (local phone login). */
  appMode?: 'production' | 'test'
  /** Server-authoritative marker for non-production single-test tools. */
  singleTestMode?: boolean
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
  }
}

export type AuthUserSummary = AuthUserResponse

export function getCurrentUser(api: ApiTransport): Promise<AuthUserResponse> {
  return api<AuthUserResponse>({ path: '/api/auth/user' })
}
