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
  /** WS-5 follow-up (2026-09-02): remote kill switch for the slot drum's
   *  fake-3D curvature (rotateX + perspective). When false, the mini-program
   *  flattens the drum to the 2.5D fallback (scale + opacity falloff only) —
   *  identical to the SLOT_CURVATURE_ENABLE_3D=false compile-time path,
   *  which remains the master build switch (flag AND constant both required
   *  for 3D). Default: true. */
  personalitySlotCurvatureEnabled: "PERSONALITY_SLOT_CURVATURE_ENABLED",
  /** K3 Phase 1+ (2026-08-01): remote-selectable slot timing profile.
   *  personalitySlotProfileDramatic wins over personalitySlotProfileFast;
   *  both false = baseline. Since the 2026-08-17 tempo retune the env
   *  fallback for personalitySlotProfileFast is TRUE (fast = product
   *  default) — set the DB flag to false to remotely roll back to baseline.
   *  Consumed by getAnimationProfile() in the mini-program results page. */
  personalitySlotProfileFast: "PERSONALITY_SLOT_PROFILE_FAST",
  personalitySlotProfileDramatic: "PERSONALITY_SLOT_PROFILE_DRAMATIC",
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
  /** 双人成行 (duo registration) kill-switch. When false, the mini-program
   *  hides the duo card/banner and POST /api/pools/:id/duo-invites returns 503.
   *  Existing duo codes and bound pairs continue to work. Env fallback:
   *  DUO_REGISTRATION_ENABLED (default: true). */
  duoRegistrationEnabled: "DUO_REGISTRATION_ENABLED",
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
  /** Gathering room (集结房间): pixel-scene pre-event waiting room for matched
   *  groups — entry CTAs + the room page. Ships dark until the room art and
   *  the presence WS flow are device-verified.
   *  Env fallback: GATHERING_ROOM_ENABLED (default: false). */
  gatheringRoomEnabled: "GATHERING_ROOM_ENABLED",
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
  /** Flash story episode v2 engine (multi-node state-driven branching).
   *  Enabled: v2 content (content.v === 2) routes through the v2 engine;
   *  v1 content keeps the flat-content path unchanged. Disable via env
   *  FLASH_STORY_V2_ENABLED=false for instant rollback. */
  flashStoryV2Enabled: "FLASH_STORY_V2_ENABLED",
  /** 叙事动作层（sprint_20260821_3kmkkw, AC-07）：interaction 节点结果提交开关。
   *  默认 false（ship dark）；staging 验收后由 super_admin 开启。关闭时服务端
   *  对 interaction 节点透明应用审核过的 defaultResultId 效果并推进到
   *  fallbackNext，不丢失或重复故事进度。
   *  Env fallback: FLASH_STORY_ACTIONS_ENABLED (default: false). */
  flashStoryActionsEnabled: "FLASH_STORY_ACTIONS_ENABLED",
  /** Optional reviewed-plan AI enrichment for Flash NPC responses. The model
   * never owns settlement, progress, fragments, endings, or traversal. */
  flashStoryAiResponsesEnabled: "FLASH_STORY_AI_RESPONSES_ENABLED",
  /** Social Icebreaker five-pattern social haptic grammar (Nudge / Your-turn /
   *  Confirm / Reveal / Celebration) fired from session-state transitions on
   *  the session page. Ships dark until the field protocols (playbook §5)
   *  validate pattern distinguishability and learnability.
   *  Env fallback: ICEBREAKER_HAPTIC_GRAMMAR_ENABLED (default: false). */
  icebreakerHapticGrammarEnabled: "ICEBREAKER_HAPTIC_GRAMMAR_ENABLED",
  /** Social Icebreaker mood-anchored ambient color field (S2): waiting/active/
   *  reveal field on the session page shell + Taro.setKeepScreenOn POCKET
   *  posture. Ships dark until the §5 squint/perf field protocols pass.
   *  Env fallback: ICEBREAKER_MOOD_FIELD_ENABLED (default: false). */
  icebreakerMoodFieldEnabled: "ICEBREAKER_MOOD_FIELD_ENABLED",
  /** Social Icebreaker three-layer glance stack (L1/L2/L3) pilot on warmup +
   *  micro_challenge, bundling the S8 Handshake Bridge opening ritual and S4
   *  weighted motion on those pilot surfaces. Ships dark until the Wave-3
   *  squint/eyes-up field protocols pass.
   *  Env fallback: ICEBREAKER_GLANCE_STACK_ENABLED (default: false). */
  icebreakerGlanceStackEnabled: "ICEBREAKER_GLANCE_STACK_ENABLED",
  /** S6 group-synchronized beats: gates BOTH server emission (state-free
   *  SOCIAL_GROUP_BEAT triggers from transition/reveal choke points) AND the
   *  mini-program's WS room join. Ships dark until the venue WS reliability
   *  field test passes (playbook §10 ruling 6 flag-on precondition).
   *  Env fallback: ICEBREAKER_GROUP_BEATS_ENABLED (default: false). */
  icebreakerGroupBeatsEnabled: "ICEBREAKER_GROUP_BEATS_ENABLED",
  /** S9 audio seasoning: delicate sub-1s ticks mirroring the S1 haptic
   *  grammar, fired alongside the haptic only. Ships dark until S1's grammar
   *  is field-validated (playbook ruling 3/9).
   *  Env fallback: ICEBREAKER_AUDIO_ENABLED (default: false). */
  icebreakerAudioEnabled: "ICEBREAKER_AUDIO_ENABLED",
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
  /** Phase 0 安心补位 (2026-08-27, sprint post-reveal-phase0 M1): pre-reveal
   *  cancel (registration matchStatus != 'matched') issues a real full refund —
   *  money via the claimPaymentForRefund atomic claim, credits via
   *  transactional reversal before delete. When false, pre-reveal cancel keeps
   *  exact legacy behavior (delete row, no refund). Independent from
   *  noRefundAfterReveal (either can roll back alone).
   *  Env fallback: PRE_REVEAL_REFUND_ENABLED (default: false). */
  preRevealRefundEnabled: "PRE_REVEAL_REFUND_ENABLED",
  /** Phase 0 安心补位 (2026-08-27, sprint post-reveal-phase0 M1): post-reveal
   *  cancel (registration matchStatus = 'matched') forfeits the fee and runs
   *  honest-group hygiene — memberCount decrement, event_attendance cancelled,
   *  remaining-member notifications, collapse (<4) → stayer refunds, WeCom +
   *  audit. When false, post-reveal cancel keeps exact legacy behavior.
   *  Env fallback: NO_REFUND_AFTER_REVEAL_ENABLED (default: false). */
  noRefundAfterReveal: "NO_REFUND_AFTER_REVEAL_ENABLED",
  /** C4 GuidanceQueue orchestrator (onboarding guidance iteration, 2026-08-27):
   *  server-persisted seen-state, ≤1 tip per session arbitration, and the
   *  discover arrival-coachmark absorption. Ships dark — flag-on happens only
   *  after the D7 2-week baseline. Env fallback: GUIDANCE_QUEUE_ENABLED
   *  (default: false). */
  guidanceQueueEnabled: "GUIDANCE_QUEUE_ENABLED",
  /** C5 discover registration spotlight (beacon + price caption). Skeleton
   *  registration in W1; consumed in W3. Env fallback:
   *  DISCOVER_SPOTLIGHT_ENABLED (default: false). */
  discoverSpotlightEnabled: "DISCOVER_SPOTLIGHT_ENABLED",
  /** A1 landing 3-beat step micro-loop. Skeleton registration in W1; consumed
   *  in W2a. Env fallback: LANDING_STEP_LOOP_ENABLED (default: false). */
  landingStepLoopEnabled: "LANDING_STEP_LOOP_ENABLED",
  /** A2 test-intro WHY line via shared copy. Skeleton registration in W1;
   *  consumed in W2b. Env fallback: TEST_INTRO_WHY_LINE_ENABLED
   *  (default: false). */
  testIntroWhyLineEnabled: "TEST_INTRO_WHY_LINE_ENABLED",
  /** B3 in-test gather-glow on answer submit. Skeleton registration in W1;
   *  consumed in W4. Env fallback: TEST_GATHER_GLOW_ENABLED (default: false). */
  testGatherGlowEnabled: "TEST_GATHER_GLOW_ENABLED",
  /** MiniScript V2 P2 gameplay layer (2026-08-28, sprint miniscript-v2-p2):
   *  evidence presentation (present-evidence) + two-round suspect→motive
   *  voting (open-motive-vote). Resolved once at mini_script phase entry and
   *  snapshotted into session state (miniScriptV2Enabled) — mid-session flips
   *  never affect a live session. Flag-off degrades to the single-step vote
   *  with no evidence surface. Env fallback:
   *  MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED (default: false). */
  miniscriptEvidenceVoteV2Enabled: "MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED",
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
  /** 双人成行 — default ON; ships enabled. */
  duoRegistrationEnabled: true,
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
  /** Gathering room ships dark until room art + presence flow are verified. */
  gatheringRoomEnabled: false,
  /** Haptic grammar ships dark until the playbook §5 field protocols pass. */
  icebreakerHapticGrammarEnabled: false,
  /** Mood field ships dark until the §5 squint/perf field protocols pass. */
  icebreakerMoodFieldEnabled: false,
  /** Glance-stack pilot ships dark until the Wave-3 field protocols pass. */
  icebreakerGlanceStackEnabled: false,
  /** Group beats ship dark until the venue WS field test passes (ruling 6). */
  icebreakerGroupBeatsEnabled: false,
  /** Audio seasoning ships dark until S1's grammar is field-validated. */
  icebreakerAudioEnabled: false,
  equipmentRewardsEnabled: false,
  personalStoryEnabled: false,
  profileIdentityStageEnabled: true,
  flashShenzhenLocationGateEnabled: true,
  flashTaskRetryTestEnabled: false,
  flashAnyLocationArrivalTestEnabled: false,
  flashStoryV2Enabled: true,
  /** 叙事动作层 ship dark — 见 FLAG_ENV_MAP 注释与契约 AC-07。 */
  flashStoryActionsEnabled: false,
  flashStoryAiResponsesEnabled: false,
  /** Tier-1 semantic moderation (WeChat msgSecCheck) is ON by default. The
   *  check is budget-bounded (see CONTENT_MODERATION_TIER1_BUDGET_MS) and
   *  fails open, so latency is bounded regardless. Ops can still disable via
   *  env CONTENT_MODERATION_MSGSECCHECK_ENABLED=false or an admin toggle. */
  contentModerationMsgSecCheckEnabled: true,
  /** Severe-tier fail-closed moderation — default ON. When disabled, only
   *  warning-tier Tier-0 violations are let through (logged, not escalated);
   *  the severe tier remains unconditionally blocking. */
  contentModerationSevereFailClosedEnabled: true,
  /** Phase 0 安心补位 — both ship dark (default off = exact legacy cancel
   *  behavior); explicit false so the admin toggle UI and listFeatureFlags()
   *  show a stable default. Flags are independent (M1). */
  preRevealRefundEnabled: false,
  noRefundAfterReveal: false,
  /** Onboarding guidance iteration (2026-08-27) — all 5 ship dark in W1;
   *  explicit false so the admin toggle UI and listFeatureFlags() show a
   *  stable default. Flag-on only after the D7 2-week baseline. */
  guidanceQueueEnabled: false,
  discoverSpotlightEnabled: false,
  landingStepLoopEnabled: false,
  testIntroWhyLineEnabled: false,
  testGatherGlowEnabled: false,
  /** MiniScript V2 P2 ships dark; explicit false so the admin toggle UI and
   *  listFeatureFlags() show a stable default. */
  miniscriptEvidenceVoteV2Enabled: false,
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
