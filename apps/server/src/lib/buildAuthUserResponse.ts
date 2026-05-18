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

type OnboardingStep =
  | 'onboarding'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'discover';

const stepOrder: OnboardingStep[] = [
  'onboarding',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
  'discover',
];

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
    // Ignore errors — session lookup is optional
  }

  let nextStep: OnboardingStep;
  if (!user.hasCompletedPersonalityTest && !user.hasCompletedRegistration) {
    nextStep = 'onboarding';
  } else if (!user.hasCompletedPersonalityTest) {
    nextStep = 'personality-test';
  } else if (!profileEssentialComplete) {
    nextStep = 'essential-data';
  } else if (!user.hasCompletedInterestsCarousel) {
    nextStep = 'extended-data';
  } else if (!user.hasSeenProfileReview) {
    nextStep = 'profile-review';
  } else {
    nextStep = 'discover';
  }

  const baseIndex = stepOrder.indexOf(nextStep);
  const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
  const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;

  if (
    checkpointValue &&
    checkpointIndex !== -1 &&
    baseIndex !== -1 &&
    checkpointIndex > baseIndex &&
    checkpointIndex < stepOrder.indexOf('discover')
  ) {
    const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
    nextStep = stepOrder[nextStepIndex];
  }

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
      // Non-critical: if cache lookup fails, return null silently
    }
  }

  const authUserResponse: AuthUserResponse = {
    ...sanitizeAuthUser(user),
    nextStep,
    profileEssentialComplete,
    profileExtendedComplete,
    activeAssessmentSessionId,
    paymentsEnabled: (process.env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true",
    mascotDisplayName: mascotConfig.displayName,
    mascotBackstory: mascotConfig.backstory,
    tierDisplayFlags,
    xiaoyueAnalysis,
  };

  return authUserResponse;
}
