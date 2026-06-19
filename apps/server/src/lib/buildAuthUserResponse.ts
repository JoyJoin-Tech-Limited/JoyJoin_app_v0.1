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
import { getFeatureFlag } from "./featureFlags";

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
    socialIcebreakerCustomModeEnabled,
    profileRedesignEnabled,
  ] = await Promise.all([
    getFeatureFlag('restartOnboarding', false),
    getFeatureFlag('smartProfession', true),
    getFeatureFlag('onboardingForceSkip', false),
    getFeatureFlag('matchingLiveReveal', true),
    getFeatureFlag('socialIcebreakerClientForceEnd', false),
    getFeatureFlag('runPlanTemplatesEnabled', false),
    getFeatureFlag('promoBannerEnabled', true),
    getFeatureFlag('personalitySlotAnimationEnabled', true),
    getFeatureFlag('personalityShareEnabled', true),
    getFeatureFlag('paymentsEnabled', false),
    getFeatureFlag('personalityTestEchoEnabled', true),
    getFeatureFlag('squadUnboxingDragRevealEnabled', true),
    getFeatureFlag('socialIcebreakerCustomModeEnabled', true),
    getFeatureFlag('profileRedesignEnabled', true),
  ]);

  const appMode: 'production' | 'test' = (process.env.APP_MODE === 'test') ? 'test' : 'production';

  const authUserResponse: AuthUserResponse = {
    ...sanitizeAuthUser(user),
    appMode,
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
      personalityShareEnabled,
      paymentsEnabled: paymentsEnabledFlag,
      personalityTestEchoEnabled,
      squadUnboxingDragRevealEnabled,
      socialIcebreakerCustomModeEnabled,
      profileRedesignEnabled,
    },
  };

  return authUserResponse;
}
