// Run Plan Service — Server-side wrapper for compileAgentRunPlan() and template compiler

import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { PHASE_ORDER } from '@shared/socialIcebreaker';
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest';
import type { IcebreakerRunPlan, PhaseSegment } from '@shared/phaseModule';
import { createRunPlan } from '@shared/phaseModule';
import {
  compileAgentRunPlan,
  resolveTemplateSlots,
  TEMPLATE_DEFAULTS,
  buildArchetypeMix,
  deriveArchetypeComposition,
  deriveLieDetectiveMinutes,
  getBudgetForTier,
  normalizeRunPlanTiming,
  NON_CORE_FLOOR_MINUTES,
} from '@shared/runPlanCompiler';
import { getPhaseModule } from '@shared/phaseRegistry';
import type {
  TemplateVibeId,
  RunPlanTemplate,
  ArchetypeComposition,
} from '@shared/runPlanCompiler';
import type { RunPlanTemplateRow } from '@shared/schema';
import { getRunPlanForTier, BREEZE_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { getServerEnabledPhases } from '../socialIcebreakerPhaseConfig';
import { getFeatureFlag } from '../lib/featureFlags';
import { getTemplateByVibeAndTier } from '../repositories/runPlanTemplatesRepo';
import { logger } from '../lib/logger';

const RUN_PLAN_COMPILE_BUDGET_MS =
  process.env.NODE_ENV === 'test' ? 25 : 2500;

const MINI_SCRIPT_BONUS_MINUTES = 25;
/** W9 (AC-W9.4): the bonus is dropped entirely below this — a shorter script is not worth the pause. */
const MINI_SCRIPT_MIN_MINUTES = 12;

/** Phases whose allocation is fixed by the registry (never rebalanced for the bonus). */
const FIXED_TIMING_PHASES: ReadonlySet<SocialIcebreakerPhase> = new Set([
  'warmup',
  'micro_challenge',
  'recap',
]);

export interface MiniScriptBudgetDecision {
  plan: IcebreakerRunPlan;
  /** Allocated bonus minutes (0 when no bonus was appended). */
  miniScriptMinutes: number;
  /** Over-budget minutes surfaced to logs/observability (0 when reconciled). */
  overBudgetMinutes: number;
  /** True when a bonus segment was appended. */
  accepted: boolean;
}

/**
 * Distribute `total` minutes across non-core `phases`, guaranteeing each phase
 * at least `NON_CORE_FLOOR_MINUTES` and allocating the remainder proportional to
 * nominal duration (largest-remainder rounding).
 */
function distributeNonCoreBudget(
  phases: SocialIcebreakerPhase[],
  total: number,
): Map<SocialIcebreakerPhase, number> {
  const allocations = new Map<SocialIcebreakerPhase, number>();
  if (phases.length === 0) return allocations;
  const floorTotal = phases.length * NON_CORE_FLOOR_MINUTES;
  const budget = Math.max(total, floorTotal);
  for (const phase of phases) allocations.set(phase, NON_CORE_FLOOR_MINUTES);
  const rest = budget - floorTotal;
  if (rest <= 0) return allocations;

  const nominalSum = phases.reduce((sum, phase) => sum + getPhaseModule(phase).durationMinutes, 0);
  const raw = phases.map((phase) => {
    const value = (getPhaseModule(phase).durationMinutes / nominalSum) * rest;
    return { phase, floor: Math.floor(value), remainder: value - Math.floor(value) };
  });
  let assigned = 0;
  for (const item of raw) {
    allocations.set(item.phase, (allocations.get(item.phase) ?? 0) + item.floor);
    assigned += item.floor;
  }
  const sorted = [...raw].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < rest - assigned; i++) {
    const phase = sorted[i % sorted.length].phase;
    allocations.set(phase, (allocations.get(phase) ?? 0) + 1);
  }
  return allocations;
}

/**
 * AC-W9.4: fund the mini_script bonus by shrinking existing non-core phases to
 * their floors (`lie_detective` never below its roster-derived floor), then size
 * the bonus to the remainder (≤25, ≥12). Total stays within the booked tier
 * budget by construction. When there is no room for a meaningful bonus the plan
 * is returned unchanged (`accepted: false`); if a floor-rounding edge ever
 * overruns, `overBudgetMinutes` is surfaced for observability.
 */
export function reconcileMiniScriptBudget(
  plan: IcebreakerRunPlan,
  playerCount: number,
  budgetMinutes: number,
): MiniScriptBudgetDecision {
  const recapIndex = plan.segments.findIndex((s) => s.phase === 'recap');
  const insertAt = recapIndex >= 0 ? recapIndex : plan.segments.length;
  const fixed = plan.segments.filter((s) => FIXED_TIMING_PHASES.has(s.phase));
  const lie = plan.segments.find((s) => s.phase === 'lie_detective');
  const others = plan.segments.filter(
    (s) => !FIXED_TIMING_PHASES.has(s.phase) && s.phase !== 'lie_detective',
  );
  const coreMinutes = fixed.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  const lieFloor = lie ? deriveLieDetectiveMinutes(playerCount) : 0;
  const othersFloorTotal = others.length * NON_CORE_FLOOR_MINUTES;
  const available = budgetMinutes - coreMinutes - lieFloor - othersFloorTotal;

  if (available < MINI_SCRIPT_MIN_MINUTES) {
    return { plan, miniScriptMinutes: 0, overBudgetMinutes: 0, accepted: false };
  }

  const miniMinutes = Math.min(MINI_SCRIPT_BONUS_MINUTES, Math.floor(available));
  const othersBudget = Math.max(
    budgetMinutes - coreMinutes - lieFloor - miniMinutes,
    othersFloorTotal,
  );
  const othersAllocations = distributeNonCoreBudget(
    others.map((s) => s.phase),
    othersBudget,
  );

  const resized = new Map<SocialIcebreakerPhase, PhaseSegment>();
  if (lie) {
    resized.set('lie_detective', { ...lie, allocatedMinutes: lieFloor });
  }
  for (const segment of others) {
    resized.set(segment.phase, {
      ...segment,
      allocatedMinutes: othersAllocations.get(segment.phase) ?? segment.allocatedMinutes,
    });
  }

  const baseSegments = plan.segments.map((s) => resized.get(s.phase) ?? s);
  const bonus: PhaseSegment = {
    phase: 'mini_script',
    allocatedMinutes: miniMinutes,
    energyWeight: 1,
    participation: 'full',
    tone: 'playful',
    rationale: `feature-flagged mini_script bonus funded from non-core (${miniMinutes} min, budget ${budgetMinutes})`,
  };
  const segments = [
    ...baseSegments.slice(0, insertAt),
    bonus,
    ...baseSegments.slice(insertAt),
  ];
  const totalMinutes = segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);

  logger.info('Mini-script budget reconciled', {
    compilerId: plan.compilerId,
    playerCount,
    budgetMinutes,
    miniScriptMinutes: miniMinutes,
    totalMinutes,
    overBudgetMinutes: Math.max(0, totalMinutes - budgetMinutes),
  });

  return {
    plan: {
      ...plan,
      segments,
      totalMinutes,
      compilerId: `${plan.compilerId}+mini`,
    },
    miniScriptMinutes: miniMinutes,
    overBudgetMinutes: Math.max(0, totalMinutes - budgetMinutes),
    accepted: true,
  };
}

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
 *
 * W9 (AC-W9.4): when `budgetMinutes` is provided, the bonus is *funded* from the
 * other non-core phases (see `reconcileMiniScriptBudget`) so the plan total stays
 * within the booked tier budget. Omitting the budget preserves the legacy additive
 * behavior (callers/tests that pre-date W9).
 */
export function appendMiniScriptBonusSegment(
  plan: IcebreakerRunPlan,
  enabledPhases: SocialIcebreakerPhase[],
  playerCount: number,
  budgetMinutes?: number,
): IcebreakerRunPlan {
  if (!enabledPhases.includes('mini_script')) return plan;
  if (playerCount < 4) return plan;
  if (plan.segments.some((s) => s.phase === 'mini_script')) return plan;

  if (budgetMinutes !== undefined && budgetMinutes > 0) {
    return reconcileMiniScriptBudget(plan, playerCount, budgetMinutes).plan;
  }

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
  roster?: ReadonlyArray<{ archetype?: string | null }>,
): Promise<IcebreakerRunPlan> {
  const basePhases = state.enabledPhases ?? getServerEnabledPhases();
  const enabledPhases: SocialIcebreakerPhase[] = basePhases.includes('recap') ? basePhases : [...basePhases, 'recap'];
  const playerCount = state.playerCount ?? 1;

  // W5 (gm-debrief): feed the matched roster into compilation, behind the
  // `icebreakerMatchingAwareEnabled` kill switch. Flag off (or no roster)
  // leaves `composition` null and the compiled plan byte-identical to pre-W5.
  const matchingAware = await getFeatureFlag('icebreakerMatchingAwareEnabled', false);
  const archetypeMix =
    matchingAware && roster && roster.length > 0 ? buildArchetypeMix(roster) : undefined;
  const composition = deriveArchetypeComposition(archetypeMix);

  if (composition) {
    logger.info('Run plan composition profile', {
      socialSessionId: state.socialSessionId,
      tier,
      members: composition.totalMembers,
      lowEnergyCount: composition.lowEnergyCount,
      highEnergyCount: composition.highEnergyCount,
      shyHeavy: composition.shyHeavy,
      outgoingHeavy: composition.outgoingHeavy,
    });
  }

  const plan = await compileForSessionWithinBudget(state, tier, {
    enabledPhases,
    playerCount,
    composition,
    archetypeMix,
  });

  // W9: normalize roster-derived timing + energy decompression for every plan
  // source (compiler, template, static fallback), then fund the feature-flagged
  // mini_script bonus from the non-core budget (AC-W9.2/W9.3/W9.4).
  const normalized = normalizeRunPlanTiming(plan, playerCount);
  return appendMiniScriptBonusSegment(
    normalized,
    enabledPhases,
    playerCount,
    getBudgetForTier(tier),
  );
}

async function compileForSessionWithinBudget(
  state: SocialSessionState,
  tier: TierMachineId,
  context: {
    enabledPhases: SocialIcebreakerPhase[];
    playerCount: number;
    composition: ArchetypeComposition | null;
    archetypeMix?: Record<string, number>;
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
    composition: ArchetypeComposition | null;
    archetypeMix?: Record<string, number>;
  },
): Promise<IcebreakerRunPlan> {
  const { enabledPhases, playerCount, composition, archetypeMix } = context;
  const flagEnabled = await getFeatureFlag('runPlanTemplatesEnabled', true);

  if (flagEnabled) {
    try {
      const templateVibe = mapVibeToTemplateVibe(state.vibe);
      const dbRow = await getTemplateByVibeAndTier(templateVibe, tier);

      let template: RunPlanTemplate | null = null;
      if (dbRow) {
        template = dbRowToTemplate(dbRow);
      }

      const segments = resolveTemplateSlots(
        templateVibe,
        tier,
        playerCount,
        enabledPhases,
        template,
        composition,
      );
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
    ...(archetypeMix ? { archetypeMix } : {}),
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
