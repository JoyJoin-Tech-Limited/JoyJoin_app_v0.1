import { eq } from "drizzle-orm";
import { db } from "../db";
import { featureFlags } from "@shared/schema";
import { logger } from "./logger";

/**
 * Feature flag resolver — DB-backed with env var fallback.
 *
 * Checks the `feature_flags` table first. If no row exists, falls back to
 * the corresponding env var. This lets ops toggle features at runtime
 * without redeploying.
 */

export const FLAG_ENV_MAP: Record<string, string> = {
  restartOnboarding: "RESTART_ONBOARDING_ENABLED",
  smartProfession: "SMART_PROFESSION_V1_ENABLED",
  onboardingForceSkip: "ONBOARDING_FORCE_SKIP_ENABLED",
  /** Auto-refund pipeline (2026-08-05): 场次未成行 → refunds + credit
   *  restoration. Default true; kill switch for money movement. */
  autoRefundEnabled: "AUTO_REFUND_ENABLED",
  matchingLiveReveal: "MATCHING_LIVE_REVEAL_ENABLED",
  socialIcebreakerClientForceEnd: "SOCIAL_ICEBREAKER_CLIENT_FORCE_END",
  /** Controls BOTH the template-driven run plan compiler (server) AND the 3×3 vibe grid UX (client).
   *  When false: legacy compileAgentRunPlan() runs unchanged; client hides vibe selector.
   *  When true: compileForSession() queries DB templates + falls back to compileAgentRunPlan();
   *            client shows the deep_chat / balanced / play_fun vibe selector.
   *  Default fallback is true: the preset-card UI is the active shipped experience. */
  runPlanTemplatesEnabled: "RUN_PLAN_TEMPLATES_ENABLED",
  personalityShareEnabled: "PERSONALITY_SHARE_ENABLED",
  personalitySlotAnimationEnabled: "PERSONALITY_SLOT_ANIMATION_ENABLED",
  /** K3 Phase 1+ (2026-08-01): remote-selectable slot timing profile.
   *  personalitySlotProfileDramatic wins over personalitySlotProfileFast;
   *  both false = baseline. Consumed by getAnimationProfile() in the
   *  mini-program results page. */
  personalitySlotProfileFast: "PERSONALITY_SLOT_PROFILE_FAST",
  personalitySlotProfileDramatic: "PERSONALITY_SLOT_PROFILE_DRAMATIC",
  /** K3 Phase 2c spike (2026-08-01): WebGL land-moment stage for the
   *  personality reveal. When true (and celebration tier is full), the land
   *  moment plays a ~2.5s WebGL overlay (dolly + bloom + GPU particles +
   *  foil card) instead of the CSS celebration. Any GL failure falls back
   *  to the CSS/ParticleBurst path. Default: false (spike not yet
   *  device-verified). Env fallback: WEBGL_REVEAL_ENABLED. */
  webglRevealEnabled: "WEBGL_REVEAL_ENABLED",
  /** K3 Phase 3 / B3 (2026-08-01): server-composed animated share clip
   *  (muted MP4 of the reveal moment, rendered via canvas frames + ffmpeg).
   *  When false, POST /api/personality/share-clip returns 503 and the client
   *  keeps the static poster as the share artifact. Default: false.
   *  Env fallback: SHARE_ANIMATED_CLIP_ENABLED. */
  shareAnimatedClipEnabled: "SHARE_ANIMATED_CLIP_ENABLED",
  /** When false, hides the Hero Promo Banner on discover entirely.
   *  Default: true. Use to A/B test banner variants or kill it during
   *  prom content audits. */
  promoBannerEnabled: "PROMO_BANNER_ENABLED",
  /** Master kill-switch for the entire payment system.
   *  When false, payment creation endpoints return 503 PAYMENTS_DISABLED.
   *  Also controls the paymentsEnabled flag in auth responses.
   *  Env fallback: PAYMENTS_ENABLED (default: false). */
  paymentsEnabled: "PAYMENTS_ENABLED",
  /** When false, falls back to a simple spinner instead of the answer-echo
   *  loading state in the personality test. Default: true. */
  personalityTestEchoEnabled: "PERSONALITY_TEST_ECHO_ENABLED",
  /** Master toggle for the drag-to-reveal ribbon on squad-unboxing.
   *  When false: falls back to the legacy "揭晓桌友" button.
   *  Default: true. */
  squadUnboxingDragRevealEnabled: "SQUAD_UNBOXING_DRAG_REVEAL_ENABLED",
  /** Squad-unboxing ready-state redesign. When true, renders the composed
   *  Xiaoyue+gift hero with a single tap gesture and a hidden drag delight.
   *  When false (default), keeps the existing header + gift + drag-ribbon
   *  layout. Safe to ship off in production while the composed hero asset is
   *  finalised. Env fallback: SOCIAL_SQUAD_COMPOSED_HERO_ENABLED (default: false). */
  socialSquadComposedHeroEnabled: "SOCIAL_SQUAD_COMPOSED_HERO_ENABLED",
  /** Master kill-switch for event pool registration.
   *  When false, POST /api/event-pools/:id/register returns 503.
   *  Env fallback: REGISTRATION_ENABLED (default: true). */
  registrationEnabled: "REGISTRATION_ENABLED",
  /** When false, creation of and tier changes to the custom Social Icebreaker
   *  mode are rejected. Existing preset-tier sessions are unaffected.
   *  Env fallback: SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED (default: true). */
  socialIcebreakerCustomModeEnabled: "SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED",
  /** Profile tab redesign kill-switch. When false, the mini-program renders a
   *  simplified legacy-style Profile layout without the new hero, milestones,
   *  or share-card entry point. Env fallback: PROFILE_REDESIGN_ENABLED
   *  (default: true). */
  profileRedesignEnabled: "PROFILE_REDESIGN_ENABLED",
  /** Profile-only pixel companion stage. Kept independent from the V1.7
   * layout rollback so art can be disabled without reverting Profile data. */
  profilePixelAvatarEnabled: "PROFILE_PIXEL_AVATAR_ENABLED",
  /** SD pixel avatar sprites (集结房间 chibi family) in 40rpx+ roster/list
   * slots via ArchetypeHead variant='sd'. Default false while the Lovart art
   * is pending (manifest currently holds synthesized placeholders).
   * Env fallback: SD_AVATAR_ENABLED (default: false). */
  sdAvatarEnabled: "SD_AVATAR_ENABLED",
  /** Server-authoritative equipment economy switch. No payment path exists. */
  equipmentRewardsEnabled: "EQUIPMENT_REWARDS_ENABLED",
  /** Private append-only personal story generation and reading surface. */
  personalStoryEnabled: "PERSONAL_STORY_ENABLED",
  /** Discover OracleCard corner participant-count badge kill-switch. When false,
   *  the mini-program hides the top-right registration-count badge on pool cards.
   *  Env fallback: ORACLE_CARD_CORNER_STAT_ENABLED (default: true). */
  oracleCardCornerStatEnabled: "ORACLE_CARD_CORNER_STAT_ENABLED",
  /** Master kill-switch for Social Icebreaker test-mode bot simulation.
   *  NOTE: intentionally NOT registered here — the fail-closed gate
   *  `isSocialIcebreakerTestMode()` reads process.env directly on hot paths
   *  (session start/advance), so a DB toggle would be a silent no-op.
   *  Env-only: SOCIAL_ICEBREAKER_TEST_MODE_ENABLED (default: false). */
  /** Master kill-switch for venue assignment after pool matching.
   *  When false, assignVenuesToGroups() marks all groups unassigned
   *  with reason 'feature_disabled'.
   *  Env fallback: VENUE_ASSIGNMENT_ENABLED (default: true). */
  venueAssignmentEnabled: "VENUE_ASSIGNMENT_ENABLED",
  /** Pool registration persona snapshot card kill-switch. When false, the
   *  mini-program hides the aggregate persona puzzle preview on the first
   *  screen of pool registration. Env fallback: PERSONA_SNAPSHOT_ENABLED
   *  (default: true). */
  personaSnapshotEnabled: "PERSONA_SNAPSHOT_ENABLED",
  /** When true, the matching-status live-reveal members stage shows an
   *  abstract puzzle-piece prelude instead of the member identity grid.
   *  Real identity reveal remains in squad-unboxing. Env fallback:
   *  MATCHING_PUZZLE_PRELUDE_ENABLED (default: false). */
  matchingPuzzlePreludeEnabled: "MATCHING_PUZZLE_PRELUDE_ENABLED",
  /** When true, AIGC labels ("AI 生成内容" / "AI 辅助生成") are rendered on
   *  AI-generated surfaces in the mini-program. The server always returns
   *  AIGC meta; the client gates rendering with this flag.
   *  Env fallback: AIGC_LABELS_ENABLED (default: false). */
  aigcLabelsEnabled: "AIGC_LABELS_ENABLED",
  /** When true, matching results are held in a pending operator-review state
   *  instead of immediately notifying users and assigning venues. Admin must
   *  approve or reject the formed groups. Default: true. Env fallback:
   *  MATCHING_OPERATOR_REVIEW_ENABLED. */
  matchingOperatorReviewEnabled: "MATCHING_OPERATOR_REVIEW_ENABLED",
  /** Magnetism Engine Phase 0 / W2: hard-skip (-1 sentinel) for pairs whose
   *  match_history says either member would NOT meet again. Policy-pending
   *  (docs/systems/MAGNETISM_ENGINE.md §7) — default false so writing real
   *  match_history rows activates only the +5 re-match boost, which stays
   *  unconditional. Env fallback: MATCH_NEVER_MEET_SENTINEL (default: false). */
  matchNeverMeetSentinel: "MATCH_NEVER_MEET_SENTINEL",
  /** Magnetism Engine 惊艳开局包 / P1: group-composition rules at the commit
   *  gate (no-isolate ≥60 strong tie, energizer presence with pool-level
   *  exemption, topic anchor with cold-start skip) + explore-intent
   *  dispersion nudge during expansion. Default false until test-pool
   *  dual-run validation. Env fallback: MAGNETISM_GROUP_RULES_ENABLED. */
  magnetismGroupRulesEnabled: "MAGNETISM_GROUP_RULES_ENABLED",
  /** Magnetism Engine 惊艳开局包 / P2: weight profile v2 (chemistry 28→20,
   *  interest 28→32, socialAffinity 20→23, language 4→5; 7D analogous).
   *  Theory-ranked rebalance, flag-gated; v1 stays default until validated.
   *  Env fallback: MAGNETISM_WEIGHT_PROFILE_V2_ENABLED. */
  magnetismWeightProfileV2Enabled: "MAGNETISM_WEIGHT_PROFILE_V2_ENABLED",
  /** Magnetism Engine Phase 0 / W3: gate the chemistry-calibration READ path.
   *  The stats writer went live with match_history derivation (Phase 0), but
   *  calibrated deltas are a Phase-3 activation — keep scoring on the
   *  hand-authored matrix until shadow evidence + operator sign-off.
   *  Env fallback: MATCH_CHEMISTRY_CALIBRATION_ENABLED (default: false). */
  matchChemistryCalibrationEnabled: "MATCH_CHEMISTRY_CALIBRATION_ENABLED",
  /** Alang/Flash digital-NPC kill-switch. When false, hides the legacy Alang
   * prototype and all formal Flash routes. Env fallback: ALANG_ENABLED
   * (default: false). */
  alangEnabled: "ALANG_ENABLED",
  /** Shenzhen GPS restriction for formal Flash. Production remains locked. */
  flashShenzhenLocationGateEnabled: "FLASH_SHENZHEN_LOCATION_GATE_ENABLED",
  /** Non-production QA escape hatch for restarting the same active Flash task. */
  flashTaskRetryTestEnabled: "FLASH_TASK_RETRY_TEST_ENABLED",
  /** Non-production QA escape hatch for completing the formal Flash arrival
   * and delivery chain from any valid GCJ-02 coordinate. */
  flashAnyLocationArrivalTestEnabled: "FLASH_ANY_LOCATION_ARRIVAL_TEST_ENABLED",
  /** Squad-unboxing pocket-deck collapse kill-switch. When false, the
   *  mini-program hides the "收起卡组" trigger and collapseDeck() is a no-op,
   *  so the deck stays in the fan phase. Users who previously collapsed stay
   *  collapsed (no forced re-fan).
   *  Env fallback: SQUAD_UNBOXING_POCKET_DECK_ENABLED (default: true). */
  squadUnboxingPocketDeckEnabled: "SQUAD_UNBOXING_POCKET_DECK_ENABLED",
  /** HD-2D Identity Stage background parallax scene. When false, the profile
   *  tab renders the existing static identity card without the multi-plane
   *  depth background. Env fallback: PROFILE_IDENTITY_STAGE_ENABLED
   *  (default: true). */
  profileIdentityStageEnabled: "PROFILE_IDENTITY_STAGE_ENABLED",
  /** Per-flow kill gate for the Flow 1 dual-world intro overlay
   *  (joyjoin-intro, shown once at profile-review completion). When false,
   *  the overlay is suppressed entirely and users route straight to nextStep.
   *  Env fallback: FLOW_INTRO_ENABLED (default: true). */
  flowIntroEnabled: "FLOW_INTRO_ENABLED",
  /** Per-flow kill gate for the Flow 2 blind-box lifecycle overlay
   *  (blind-box-lifecycle, shown once after first pool registration). When
   *  false, registration success skips the overlay and shows the standard
   *  success toast + terminal state. Env fallback: FLOW_LIFECYCLE_ENABLED
   *  (default: true). */
  flowLifecycleEnabled: "FLOW_LIFECYCLE_ENABLED",
  /** Pool-registration Step 0 in-letter teaser strip (悦仔-voiced "what
   *  happens after you join" node row inside XiaoyueLetterCard). Ships dark.
   *  Env fallback: POOL_TEASER_ENABLED (default: false). */
  poolTeaserEnabled: "POOL_TEASER_ENABLED",
  /** Tier-1 semantic content moderation via WeChat msgSecCheck. When on,
   *  user-input text that passes the deterministic Tier-0 filter is also
   *  checked by msgSecCheck (fail-open). Env fallback:
   *  CONTENT_MODERATION_MSGSECCHECK_ENABLED (default: false). */
  contentModerationMsgSecCheckEnabled: "CONTENT_MODERATION_MSGSECCHECK_ENABLED",
  /** Severe-tier fail-closed content moderation (decision-table rows 2/3 of
   *  content-mod-s1). When false, warning-tier Tier-0 violations are allowed
   *  through (still logged, NOT escalated) as an emergency rollback; the
   *  severe tier stays unconditionally blocking regardless of this flag.
   *  Read fail-closed: callers must use getFeatureFlag(key, true). Env
   *  fallback: CONTENT_MODERATION_SEVERE_FAIL_CLOSED_ENABLED (default: true). */
  contentModerationSevereFailClosedEnabled: "CONTENT_MODERATION_SEVERE_FAIL_CLOSED_ENABLED",
};

/**
 * Default values for flags when neither the DB row nor the env var is set.
 * Any flag not listed here defaults to false. Prefer this map for stable,
 * code-defined defaults rather than relying on every caller to pass the
 * same fallback value.
 */
export const DEFAULT_FLAG_VALUES: Record<string, boolean> = {
  matchingOperatorReviewEnabled: true,
  /** Auto-refund pipeline (2026-08-05) — default ON; ops kill switch. */
  autoRefundEnabled: true,
  /** Sentinel policy-pending — see FLAG_ENV_MAP note. Explicitly off so the
   *  admin toggle UI and listFeatureFlags() show a stable default. */
  matchNeverMeetSentinel: false,
  /** Chemistry calibration read path is Phase-3 scope — Phase 0 only
   *  accumulates stats. Explicitly off; see FLAG_ENV_MAP note. */
  matchChemistryCalibrationEnabled: false,
  /** 惊艳开局包 P1/P2 — both default off until test-pool dual-run
   *  validation; see FLAG_ENV_MAP notes and docs/systems/MAGNETISM_ENGINE.md. */
  magnetismGroupRulesEnabled: false,
  magnetismWeightProfileV2Enabled: false,
  profileRedesignEnabled: true,
  profilePixelAvatarEnabled: false,
  /** SD pixel avatar sprites ship dark until the real Lovart art replaces
   * the synthesized placeholders (docs/design/sd-pixel-avatar-style-guide.md). */
  sdAvatarEnabled: false,
  equipmentRewardsEnabled: false,
  personalStoryEnabled: false,
  profileIdentityStageEnabled: true,
  flashShenzhenLocationGateEnabled: true,
  flashTaskRetryTestEnabled: false,
  flashAnyLocationArrivalTestEnabled: false,
  /** Tier-1 semantic moderation (WeChat msgSecCheck) is ON by default. The
   *  check is budget-bounded (see CONTENT_MODERATION_TIER1_BUDGET_MS) and
   *  fails open, so latency is bounded regardless. Ops can still disable via
   *  env CONTENT_MODERATION_MSGSECCHECK_ENABLED=false or an admin toggle. */
  contentModerationMsgSecCheckEnabled: true,
  /** Severe-tier fail-closed moderation — default ON. When disabled, only
   *  warning-tier Tier-0 violations are let through (logged, not escalated);
   *  the severe tier remains unconditionally blocking. */
  contentModerationSevereFailClosedEnabled: true,
};

const cache = new Map<string, { value: boolean; ts: number }>();
const CACHE_TTL_MS = 5_000;
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

function envToBool(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === "true";
}

async function fetchFromDb(flagKey: string): Promise<
  | { value: boolean; updatedAt: Date | null; updatedBy: string | null }
  | null
> {
  try {
    const [row] = await db
      .select({
        value: featureFlags.value,
        updatedAt: featureFlags.updatedAt,
        updatedBy: featureFlags.updatedBy,
      })
      .from(featureFlags)
      .where(eq(featureFlags.key, flagKey))
      .limit(1);
    if (row) {
      return {
        value: row.value.toLowerCase() === "true",
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    }
  } catch (err) {
    logger.warn("[FeatureFlags] DB lookup failed, falling back to env", {
      flagKey,
      error: String(err),
    });
  }
  return null;
}

/**
 * Resolve a boolean feature flag.
 * @param flagKey — camelCase flag name (e.g. 'matchingLiveReveal')
 * @param fallback — default when DB and env are both absent
 */
export async function getFeatureFlag(
  flagKey: string,
  fallback = false,
): Promise<boolean> {
  if (!isTest) {
    const cached = cache.get(flagKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const dbRow = await fetchFromDb(flagKey);
  const effectiveFallback = DEFAULT_FLAG_VALUES[flagKey] ?? fallback;
  const resolved =
    dbRow !== null ? dbRow.value : envToBool(FLAG_ENV_MAP[flagKey] ?? "", effectiveFallback);

  if (!isTest) {
    cache.set(flagKey, { value: resolved, ts: Date.now() });
  }
  return resolved;
}

/**
 * Synchronous version for paths that cannot await.
 * Reads from env var only (no DB round-trip).
 */
export function getFeatureFlagSync(flagKey: string, fallback = false): boolean {
  const cached = cache.get(flagKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }
  const effectiveFallback = DEFAULT_FLAG_VALUES[flagKey] ?? fallback;
  const resolved = envToBool(FLAG_ENV_MAP[flagKey] ?? "", effectiveFallback);
  cache.set(flagKey, { value: resolved, ts: Date.now() });
  return resolved;
}

/**
 * Refresh a single flag (useful after admin update).
 */
export async function refreshFeatureFlag(flagKey: string): Promise<boolean> {
  cache.delete(flagKey);
  return getFeatureFlag(flagKey);
}

/**
 * List all known flags with their resolved values.
 */
export async function listFeatureFlags(): Promise<
  Array<{
    key: string;
    value: boolean;
    source: "db" | "env" | "fallback";
    updatedAt: string | null;
    updatedBy: string | null;
  }>
> {
  const results: Array<{
    key: string;
    value: boolean;
    source: "db" | "env" | "fallback";
    updatedAt: string | null;
    updatedBy: string | null;
  }> = [];

  for (const [key, envKey] of Object.entries(FLAG_ENV_MAP)) {
    const dbRow = await fetchFromDb(key);
    if (dbRow !== null) {
      results.push({
        key,
        value: dbRow.value,
        source: "db",
        updatedAt: dbRow.updatedAt ? dbRow.updatedAt.toISOString() : null,
        updatedBy: dbRow.updatedBy,
      });
    } else {
      const fallbackValue = DEFAULT_FLAG_VALUES[key] ?? false;
      const envVal = process.env[envKey];
      results.push({
        key,
        value: envToBool(envKey, fallbackValue),
        source: envVal !== undefined ? "env" : "fallback",
        updatedAt: null,
        updatedBy: null,
      });
    }
  }

  return results;
}
