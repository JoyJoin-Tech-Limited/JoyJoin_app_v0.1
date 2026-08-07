// Run Plan Service — Server-side wrapper for compileAgentRunPlan() and template compiler

import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { PHASE_ORDER } from '@shared/socialIcebreaker';
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest';
import type { IcebreakerRunPlan, PhaseSegment } from '@shared/phaseModule';
import { createRunPlan } from '@shared/phaseModule';
import { compileAgentRunPlan, resolveTemplateSlots, TEMPLATE_DEFAULTS } from '@shared/runPlanCompiler';
import type { TemplateVibeId, RunPlanTemplate } from '@shared/runPlanCompiler';
import type { RunPlanTemplateRow } from '@shared/schema';
import { getRunPlanForTier, BREEZE_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { getServerEnabledPhases } from '../socialIcebreakerPhaseConfig';
import { getFeatureFlag } from '../lib/featureFlags';
import { getTemplateByVibeAndTier } from '../repositories/runPlanTemplatesRepo';
import { logger } from '../lib/logger';

const RUN_PLAN_COMPILE_BUDGET_MS =
  process.env.NODE_ENV === 'test' ? 25 : 2500;

const MINI_SCRIPT_BONUS_MINUTES = 25;

/**
 * The mini_script bonus phase is feature-flagged (`SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`)
 * and intentionally excluded from every run-plan source (hardcoded tier fallbacks,
 * template slots, agent compiler). Without a plan entry, `getNextEligiblePhase` is
 * plan-driven and never returns `mini_script` — the phase (and its bonus-gate pause)
 * is permanently unreachable in preset-tier sessions, single-test 调试局 included
 * (2026-08-07).
 *
 * When the flag is on (reflected in `enabledPhases`) and the roster meets the
 * 4-player minimum, splice a bonus segment in immediately before `recap` so the
 * host+player bonus gate fires on advance into it, exactly as designed.
 */
export function appendMiniScriptBonusSegment(
  plan: IcebreakerRunPlan,
  enabledPhases: SocialIcebreakerPhase[],
  playerCount: number,
): IcebreakerRunPlan {
  if (!enabledPhases.includes('mini_script')) return plan;
  if (playerCount < 4) return plan;
  if (plan.segments.some((s) => s.phase === 'mini_script')) return plan;

  const recapIndex = plan.segments.findIndex((s) => s.phase === 'recap');
  const insertAt = recapIndex >= 0 ? recapIndex : plan.segments.length;
  const bonus: PhaseSegment = {
    phase: 'mini_script',
    allocatedMinutes: MINI_SCRIPT_BONUS_MINUTES,
    energyWeight: 1,
    participation: 'full',
    tone: 'playful',
    rationale: 'feature-flagged mini_script bonus appended before recap',
  };
  const segments = [...plan.segments.slice(0, insertAt), bonus, ...plan.segments.slice(insertAt)];
  return {
    ...plan,
    segments,
    totalMinutes: segments.reduce((sum, s) => sum + s.allocatedMinutes, 0),
  };
}

function getFallbackRunPlan(tier: TierMachineId): IcebreakerRunPlan {
  return getRunPlanForTier(tier) ?? BREEZE_RUN_PLAN;
}

function withCompileBudget<T>(
  promise: Promise<T>,
  budgetMs: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), budgetMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function mapVibeToTemplateVibe(vibe: SocialSessionState['vibe']): TemplateVibeId {
  switch (vibe) {
    case 'chat':
      return 'deep_chat';
    case 'game':
      return 'play_fun';
    case 'balanced':
    default:
      return 'balanced';
  }
}

function dbRowToTemplate(row: RunPlanTemplateRow): RunPlanTemplate | null {
  try {
    const slotsData = row.slots as {
      coreWarmupMinutes: number;
      coreMicroChallengeMinutes: number;
      coreRecapMinutes: number;
      slots: Array<{
        slotType: 'deep_chat' | 'play_fun' | 'flexible';
        eligiblePhases: SocialIcebreakerPhase[];
        allocatedMinutes: number;
      }>;
    };
    if (
      typeof slotsData.coreWarmupMinutes !== 'number' ||
      typeof slotsData.coreMicroChallengeMinutes !== 'number' ||
      typeof slotsData.coreRecapMinutes !== 'number' ||
      !Array.isArray(slotsData.slots)
    ) {
      return null;
    }
    for (const slot of slotsData.slots) {
      if (!['deep_chat', 'play_fun', 'flexible'].includes(slot.slotType)) {
        return null;
      }
      if (!slot.eligiblePhases.every((p: SocialIcebreakerPhase) => PHASE_ORDER.includes(p))) {
        return null;
      }
    }
    return {
      vibe: row.vibe as TemplateVibeId,
      tier: row.tier as TierMachineId,
      playerCountMin: row.playerCountMin,
      playerCountMax: row.playerCountMax,
      coreWarmupMinutes: slotsData.coreWarmupMinutes,
      coreMicroChallengeMinutes: slotsData.coreMicroChallengeMinutes,
      coreRecapMinutes: slotsData.coreRecapMinutes,
      slots: slotsData.slots,
    };
  } catch {
    return null;
  }
}

/**
 * Compile a run plan for a session, with template-driven compilation behind
 * the `RUN_PLAN_TEMPLATES_ENABLED` feature flag.
 *
 * Flag = false  → uses existing `compileAgentRunPlan()` (regression guard).
 * Flag = true   → queries `run_plan_templates` table; if found, uses template
 *                 compiler; otherwise falls back to `compileAgentRunPlan()`.
 */
export async function compileForSession(
  state: SocialSessionState,
  tier: TierMachineId,
): Promise<IcebreakerRunPlan> {
  const basePhases = state.enabledPhases ?? getServerEnabledPhases();
  const enabledPhases: SocialIcebreakerPhase[] = basePhases.includes('recap') ? basePhases : [...basePhases, 'recap'];
  const playerCount = state.playerCount ?? 1;

  const plan = await compileForSessionWithinBudget(state, tier, {
    enabledPhases,
    playerCount,
  });

  return appendMiniScriptBonusSegment(plan, enabledPhases, playerCount);
}

async function compileForSessionWithinBudget(
  state: SocialSessionState,
  tier: TierMachineId,
  context: {
    enabledPhases: SocialIcebreakerPhase[];
    playerCount: number;
  },
): Promise<IcebreakerRunPlan> {
  const plan = await withCompileBudget(
    compileForSessionUnsafe(state, tier, context),
    RUN_PLAN_COMPILE_BUDGET_MS,
  );

  if (plan) return plan;

  logger.warn('Run plan compilation exceeded start budget, using static fallback', {
    socialSessionId: state.socialSessionId,
    tier,
    vibe: state.vibe,
    budgetMs: RUN_PLAN_COMPILE_BUDGET_MS,
  });
  return getFallbackRunPlan(tier);
}

async function compileForSessionUnsafe(
  state: SocialSessionState,
  tier: TierMachineId,
  context: {
    enabledPhases: SocialIcebreakerPhase[];
    playerCount: number;
  },
): Promise<IcebreakerRunPlan> {
  const { enabledPhases, playerCount } = context;
  const flagEnabled = await getFeatureFlag('runPlanTemplatesEnabled', true);

  if (flagEnabled) {
    try {
      const templateVibe = mapVibeToTemplateVibe(state.vibe);
      const dbRow = await getTemplateByVibeAndTier(templateVibe, tier);

      let template: RunPlanTemplate | null = null;
      if (dbRow) {
        template = dbRowToTemplate(dbRow);
      }

      const segments = resolveTemplateSlots(templateVibe, tier, playerCount, enabledPhases, template);
      const plan = createRunPlan(segments, `compiler-template-v1-${templateVibe}-${tier}`);

      logger.info('Run plan compiled from template', {
        socialSessionId: state.socialSessionId,
        tier,
        vibe: templateVibe,
        compilerId: plan.compilerId,
        totalMinutes: plan.totalMinutes,
        phases: plan.segments.map((s) => s.phase),
        source: template ? 'db' : 'default',
      });
      return plan;
    } catch (error) {
      logger.warn('Template compilation failed, falling back to rule engine', {
        socialSessionId: state.socialSessionId,
        tier,
        vibe: state.vibe,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall through to legacy compiler below
    }
  }

  // Legacy path (unchanged when flag is false or template fails)
  const ctx = {
    tier,
    playerCount,
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
    return getFallbackRunPlan(tier);
  }
}
