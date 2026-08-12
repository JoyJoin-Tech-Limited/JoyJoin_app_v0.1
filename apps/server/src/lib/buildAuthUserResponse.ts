/**
 * buildAuthUserResponse — shared auth-user response builder
 *
 * Extracted from routes/domains/auth.ts so that composite shells (Profile,
 * Discover, etc.) can return the exact same sanitized user shape as
 * GET /api/auth/user without duplicating logic.
 */

import type { AuthUserResponse } from "@shared/api";
import { buildMascotConfigFromEnv } from "@shared/mascotConfig";
import type { TierDisplayFlags } from "@shared/socialIcebreakerTierManifest";
import { sanitizeAuthUser } from "../auth/sanitizeAuthUser";
import { peekCachedAnalysis } from "../xiaoyueAnalysisService";
import type { ArchetypeAnalysisInput } from "../xiaoyueAnalysisService";
import { storage } from "../storage";
import { logger } from "./logger";
import { computeOnboardingNextStep } from "./computeOnboardingNextStep";
import { resolveEntitlementMode } from "./entitlement";
import { getFeatureFlag } from "./featureFlags";
import { isSingleTestMode } from "./isSingleTestMode";

// Module-level cached mascot config (env vars are immutable after startup)
const mascotConfig = buildMascotConfigFromEnv({
  MASCOT_DISPLAY_NAME: process.env.MASCOT_DISPLAY_NAME,
  MASCOT_BACKSTORY_ENABLED: process.env.MASCOT_BACKSTORY_ENABLED,
  MASCOT_ORIGIN_LORE_ENABLED: process.env.MASCOT_ORIGIN_LORE_ENABLED,
});

const VALID_GLOW_VARIANTS: TierDisplayFlags['glowVariant'][] = ['default', 'tipsy', 'kill'];
const resolvedGlowVariant = VALID_GLOW_VARIANTS.includes(
  process.env.SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT as TierDisplayFlags['glowVariant']
)
  ? (process.env.SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT as TierDisplayFlags['glowVariant'])
  : 'default';

/**
 * Build a complete AuthUserResponse for a given userId.
 * Mirrors the logic in GET /api/auth/user exactly.
 */
export async function buildAuthUserResponse(userId: string): Promise<AuthUserResponse | null> {
  const user = await storage.getUser(userId);
  if (!user) {
    return null;
  }

  const profileEssentialComplete = !!(
    user.displayName &&
    user.gender &&
    user.currentCity
  );

  const profileExtendedComplete = !!(
    user.educationLevel &&
    (user.industryNicheLabel || user.industryCategoryLabel) &&
    user.hometownRegionCity
  );

  let activeAssessmentSessionId: string | null = null;
  try {
    const activeSession = await storage.getAssessmentSessionByUser(userId);
    if (activeSession?.id) {
      activeAssessmentSessionId = activeSession.id;
    }
  } catch (e) {
    logger.warn('Assessment session lookup failed (non-critical)', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const nextStep = computeOnboardingNextStep(user);

  const tierDisplayFlags: TierDisplayFlags = {
    glowVariant: resolvedGlowVariant,
  };

  let xiaoyueAnalysis: NonNullable<AuthUserResponse['xiaoyueAnalysis']> | null = null;
  if (user.primaryArchetype) {
    try {
      const roleResult = await storage.getRoleResult(userId);
      if (roleResult) {
        const analysisInput: ArchetypeAnalysisInput = {
          archetype: user.primaryArchetype,
          secondaryArchetype: user.secondaryArchetype ?? null,
          traitScores: {
            affinity: roleResult.affinityScore ?? 50,
            openness: roleResult.opennessScore ?? 50,
            conscientiousness: roleResult.conscientiousnessScore ?? 50,
            emotionalStability: roleResult.emotionalStabilityScore ?? 50,
            extraversion: roleResult.extraversionScore ?? 50,
            positivity: roleResult.positivityScore ?? 50,
          },
        };
        const cached = peekCachedAnalysis(analysisInput);
        if (cached) {
          const { ...publicResult } = cached;
          xiaoyueAnalysis = publicResult;
        }
      }
    } catch (e) {
      logger.warn('Xiaoyue analysis cache lookup failed (non-critical)', {
        userId,
        archetype: user.primaryArchetype,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

const [
    restartOnboarding,
    smartProfession,
    onboardingForceSkip,
    matchingLiveReveal,
    socialIcebreakerClientForceEnd,
    runPlanTemplatesEnabled,
    promoBannerEnabled,
    personalitySlotAnimationEnabled,
    personalityShareEnabled,
    paymentsEnabledFlag,
    personalityTestEchoEnabled,
    squadUnboxingDragRevealEnabled,
    socialSquadComposedHeroEnabled,
    socialIcebreakerCustomModeEnabled,
    profileRedesignEnabled,
    profilePixelAvatarEnabled,
    gatheringRoomEnabled,
    icebreakerHapticGrammarEnabled,
    icebreakerMoodFieldEnabled,
    icebreakerGlanceStackEnabled,
    icebreakerGroupBeatsEnabled,
    equipmentRewardsEnabled,
    personalStoryEnabled,
    oracleCardCornerStatEnabled,
    personaSnapshotEnabled,
    matchingPuzzlePreludeEnabled,
    aigcLabelsEnabled,
    matchingOperatorReviewEnabled,
    alangEnabled,
    flashTaskRetryTestEnabledFlag,
    squadUnboxingPocketDeckEnabled,
    profileIdentityStageEnabled,
    flowIntroEnabled,
    flowLifecycleEnabled,
    poolTeaserEnabled,
    personalitySlotProfileFast,
    personalitySlotProfileDramatic,
    shareAnimatedClipEnabled,
    duoRegistrationEnabled,
    entitlementMode,
  ] = await Promise.all([
    getFeatureFlag('restartOnboarding', false),
    getFeatureFlag('smartProfession', true),
    getFeatureFlag('onboardingForceSkip', false),
    getFeatureFlag('matchingLiveReveal', true),
    getFeatureFlag('socialIcebreakerClientForceEnd', false),
    getFeatureFlag('runPlanTemplatesEnabled', true),
    getFeatureFlag('promoBannerEnabled', true),
    getFeatureFlag('personalitySlotAnimationEnabled', true),
    getFeatureFlag('personalityShareEnabled', true),
    getFeatureFlag('paymentsEnabled', false),
    getFeatureFlag('personalityTestEchoEnabled', true),
    getFeatureFlag('squadUnboxingDragRevealEnabled', true),
    getFeatureFlag('socialSquadComposedHeroEnabled', false),
    getFeatureFlag('socialIcebreakerCustomModeEnabled', true),
    getFeatureFlag('profileRedesignEnabled', true),
    getFeatureFlag('profilePixelAvatarEnabled', false),
    getFeatureFlag('gatheringRoomEnabled', false),
    getFeatureFlag('icebreakerHapticGrammarEnabled', false),
    getFeatureFlag('icebreakerMoodFieldEnabled', false),
    getFeatureFlag('icebreakerGlanceStackEnabled', false),
    getFeatureFlag('icebreakerGroupBeatsEnabled', false),
    getFeatureFlag('equipmentRewardsEnabled', false),
    getFeatureFlag('personalStoryEnabled', false),
    getFeatureFlag('oracleCardCornerStatEnabled', true),
    getFeatureFlag('personaSnapshotEnabled', true),
    getFeatureFlag('matchingPuzzlePreludeEnabled', false),
    getFeatureFlag('aigcLabelsEnabled', false),
    getFeatureFlag('matchingOperatorReviewEnabled', false),
    getFeatureFlag('alangEnabled', false),
    getFeatureFlag('flashTaskRetryTestEnabled', false),
    getFeatureFlag('squadUnboxingPocketDeckEnabled', true),
    getFeatureFlag('profileIdentityStageEnabled', true),
    getFeatureFlag('flowIntroEnabled', true),
    getFeatureFlag('flowLifecycleEnabled', true),
    getFeatureFlag('poolTeaserEnabled', false),
    getFeatureFlag('personalitySlotProfileFast', false),
    getFeatureFlag('personalitySlotProfileDramatic', false),
    getFeatureFlag('shareAnimatedClipEnabled', false),
    getFeatureFlag('duoRegistrationEnabled', true),
    // Server-resolved entitlement signal (pool-registration gate semantics via
    // lib/entitlement.ts), joined into the flag batch so the cold-start auth
    // hot path resolves it in parallel (N-7 pre-ship finding). Fail-open: a
    // null signal only disables client-side optimism — the registration gate
    // itself remains the authorization authority (fail-closed there).
    resolveEntitlementMode(userId)
      .then((r) => r.mode)
      .catch((e) => {
        logger.warn('Entitlement mode lookup failed (non-critical)', {
          userId,
          error: e instanceof Error ? e.message : String(e),
        });
        return null;
      }),
  ]);

  // Never expose client debug surfaces in production, even if a stale
  // ENABLE_SINGLE_TEST_MODE variable is accidentally present.
  const singleTestMode =
    (process.env.APP_MODE ?? 'production') !== 'production' && isSingleTestMode();
  const appMode: 'production' | 'test' = singleTestMode ? 'test' : 'production';

  const authUserResponse: AuthUserResponse = {
    ...sanitizeAuthUser(user),
    appMode,
    singleTestMode,
    entitlementMode,
    nextStep,
    profileEssentialComplete,
    profileExtendedComplete,
    activeAssessmentSessionId,
    paymentsEnabled: paymentsEnabledFlag,
    mascotDisplayName: mascotConfig.displayName,
    mascotBackstory: mascotConfig.backstory,
    tierDisplayFlags,
    xiaoyueAnalysis,
    restartsRemaining: Math.max(0, 5 - (user.onboardingRestartCount ?? 0)),
    features: {
      restartOnboarding,
      smartProfession,
      onboardingForceSkip,
      matchingLiveReveal,
      socialIcebreakerClientForceEnd,
      runPlanTemplatesEnabled,
      promoBannerEnabled,
      personalitySlotAnimationEnabled,
      /** K3 Phase 1+ timing-profile selection (dramatic wins over fast). */
      personalitySlotProfileFast,
      personalitySlotProfileDramatic,
      /** K3 Phase 3 / B3: server-composed animated share clip. */
      shareAnimatedClipEnabled,
      personalityShareEnabled,
      paymentsEnabled: paymentsEnabledFlag,
      personalityTestEchoEnabled,
      squadUnboxingDragRevealEnabled,
      socialSquadComposedHeroEnabled,
      socialIcebreakerCustomModeEnabled,
      profileRedesignEnabled,
      profilePixelAvatarEnabled,
      /** Gathering room (集结房间) entry CTAs + room page. */
      gatheringRoomEnabled,
      /** Social Icebreaker social haptic grammar (ships dark). */
      icebreakerHapticGrammarEnabled,
      /** Social Icebreaker mood-anchored ambient field (ships dark). */
      icebreakerMoodFieldEnabled,
      /** Social Icebreaker glance-stack pilot (ships dark). */
      icebreakerGlanceStackEnabled,
      /** Social Icebreaker group beats (ships dark; gates emit + join). */
      icebreakerGroupBeatsEnabled,
      equipmentRewardsEnabled,
      personalStoryEnabled,
      oracleCardCornerStatEnabled,
      personaSnapshotEnabled,
      matchingPuzzlePreludeEnabled,
      aigcLabelsEnabled,
      matchingOperatorReviewEnabled,
      alangEnabled,
      flashTaskRetryTestEnabled:
        (process.env.APP_MODE ?? 'production') !== 'production' && flashTaskRetryTestEnabledFlag,
      squadUnboxingPocketDeckEnabled,
      profileIdentityStageEnabled,
      flowIntroEnabled,
      flowLifecycleEnabled,
      poolTeaserEnabled,
      duoRegistrationEnabled,
    },
  };

  return authUserResponse;
}
