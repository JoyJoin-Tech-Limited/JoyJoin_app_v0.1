// Run Plan Service — Server-side wrapper for compileAgentRunPlan()

import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest';
import type { IcebreakerRunPlan } from '@shared/phaseModule';
import { compileAgentRunPlan } from '@shared/runPlanCompiler';
import { getRunPlanForTier, BREEZE_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { getServerEnabledPhases } from '../socialIcebreakerPhaseConfig';
import { logger } from '../lib/logger';

/**
 * Compile a run plan for a session, with fallback to hardcoded plans on error.
 *
 * This is the server-side entry point. It assembles the CompilationContext
 * from the current session state and calls the shared rule engine.
 */
export async function compileForSession(
  state: SocialSessionState,
  tier: TierMachineId,
): Promise<IcebreakerRunPlan> {
  const basePhases = state.enabledPhases ?? getServerEnabledPhases();
  const enabledPhases: SocialIcebreakerPhase[] = basePhases.includes('recap') ? basePhases : [...basePhases, 'recap'];

  const ctx = {
    tier,
    playerCount: state.playerCount ?? 1,
    enabledPhases,
    vibe: state.vibe ?? 'balanced',
  };

  try {
    const plan = compileAgentRunPlan(ctx);
    logger.info('Run plan compiled', {
      socialSessionId: state.socialSessionId,
      tier,
      compilerId: plan.compilerId,
      totalMinutes: plan.totalMinutes,
      phases: plan.segments.map((s) => s.phase),
    });
    return plan;
  } catch (error) {
    logger.error('Run plan compilation failed, using fallback', {
      socialSessionId: state.socialSessionId,
      tier,
      error: error instanceof Error ? error.message : String(error),
    });
    return getRunPlanForTier(tier) ?? BREEZE_RUN_PLAN;
  }
}
