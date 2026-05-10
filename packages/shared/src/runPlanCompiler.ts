// Run Plan Compiler — Deterministic rule engine for Social Icebreaker tier plans

import type { TierMachineId } from './socialIcebreakerTierManifest.js';
import type { SocialIcebreakerPhase } from './socialIcebreaker.js';
import type { IcebreakerRunPlan, PhaseSegment, PhaseModule } from './phaseModule.js';
import { createRunPlan } from './phaseModule.js';
import { getPhaseModule } from './phaseRegistry.js';

export interface CompilationContext {
  tier: TierMachineId;
  playerCount: number;
  enabledPhases: SocialIcebreakerPhase[];
  /** Vibe preference — defaults to 'balanced' if not provided. */
  vibe?: 'chat' | 'balanced' | 'game';
  /** Archetype mix — e.g. { "开心柯基": 2, "布偶猫": 1 }. Reserved for future weighting. */
  archetypeMix?: Record<string, number>;
  /** Enable LLM enhancement layer — reserved for future sprint. */
  llmEnhancement?: boolean;
}

// ─── Tier budgets (minutes) ───────────────────────────────────────────────

const TIER_BUDGETS: Record<TierMachineId, number> = {
  breeze: 40,
  glow: 60,
  blaze: 90,
};

/** Core phases that are always included, in fixed order. */
const CORE_PHASES: SocialIcebreakerPhase[] = ['warmup', 'micro_challenge'];

/** The phase that always closes the session. */
const CLOSING_PHASE: SocialIcebreakerPhase = 'recap';

/** Energy arc sort priority (lower = earlier). */
const ENERGY_ARC_ORDER: Record<PhaseModule['energyArc'], number> = {
  warmup: 1,
  rising: 2,
  peak: 3,
  falling: 4,
  variable: 2, // treat as rising for ordering
};

/** Non-core phase pool per tier (ordered by preference). */
const TIER_NON_CORE_POOLS: Record<TierMachineId, SocialIcebreakerPhase[]> = {
  breeze: ['lie_detective'],
  glow: ['lie_detective', 'personality_dice', 'group_mirror'],
  blaze: ['lie_detective', 'personality_dice', 'undercover_word', 'auction', 'quip_battle', 'group_mirror'],
};

/** Target number of non-core slots per tier. */
const TIER_SLOT_TARGETS: Record<TierMachineId, number> = {
  breeze: 1,
  glow: 3,
  blaze: 6,
};

/** Vibe bias: phases to prioritize in the non-core pool selection. */
const VIBE_BIAS: Record<NonNullable<CompilationContext['vibe']>, SocialIcebreakerPhase[]> = {
  chat: ['personality_dice', 'group_mirror'],
  balanced: [],
  game: ['undercover_word', 'quip_battle', 'auction'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function validateContext(ctx: CompilationContext): void {
  if (!ctx.tier || !TIER_BUDGETS[ctx.tier]) {
    throw new Error(`Invalid tier: ${ctx.tier}`);
  }
  if (typeof ctx.playerCount !== 'number' || ctx.playerCount < 1) {
    throw new Error(`Invalid playerCount: ${ctx.playerCount}`);
  }
  if (!Array.isArray(ctx.enabledPhases) || ctx.enabledPhases.length === 0) {
    throw new Error('enabledPhases must be a non-empty array');
  }
}

function isEnabled(phase: SocialIcebreakerPhase, enabledPhases: SocialIcebreakerPhase[]): boolean {
  return enabledPhases.includes(phase);
}

function getCoreTime(): number {
  return CORE_PHASES.reduce((sum, phase) => sum + getPhaseModule(phase).durationMinutes, 0);
}

function getClosingTime(): number {
  return getPhaseModule(CLOSING_PHASE).durationMinutes;
}

/**
 * Apply vibe-based bias to the non-core pool order.
 *
 * Boosted phases are moved to the front of the pool while preserving
 * relative order within each group.
 */
function applyVibeBias(
  pool: SocialIcebreakerPhase[],
  vibe: CompilationContext['vibe'],
): SocialIcebreakerPhase[] {
  const resolvedVibe = vibe && vibe in VIBE_BIAS ? vibe : 'balanced';
  if (resolvedVibe === 'balanced') return pool;

  const boostSet = new Set(VIBE_BIAS[resolvedVibe]);
  const boosted = pool.filter((p) => boostSet.has(p));
  const rest = pool.filter((p) => !boostSet.has(p));

  return [...boosted, ...rest];
}

/**
 * Select non-core phases for the given tier from the enabled pool.
 *
 * Strategy:
 * 1. Start with the tier's preferred pool order
 * 2. Filter to only enabled phases
 * 3. Apply vibe bias to reorder the eligible pool
 * 4. Take up to the tier's slot target
 */
function selectNonCorePhases(
  tier: TierMachineId,
  enabledPhases: SocialIcebreakerPhase[],
  vibe: CompilationContext['vibe'],
): SocialIcebreakerPhase[] {
  const pool = TIER_NON_CORE_POOLS[tier];
  const target = TIER_SLOT_TARGETS[tier];

  const eligible = pool.filter((phase) => isEnabled(phase, enabledPhases));
  const biased = applyVibeBias(eligible, vibe);

  return biased.slice(0, target);
}

/**
 * Sort phases by energy arc: warmup → rising → peak → falling.
 * Within the same energy arc, preserve input order (stable sort).
 */
function sortByEnergyArc(phases: SocialIcebreakerPhase[]): SocialIcebreakerPhase[] {
  return [...phases].sort((a, b) => {
    const orderA = ENERGY_ARC_ORDER[getPhaseModule(a).energyArc];
    const orderB = ENERGY_ARC_ORDER[getPhaseModule(b).energyArc];
    return orderA - orderB;
  });
}

/**
 * Apply category-spacing rule: no two consecutive phases may share the same category.
 * Uses a simple greedy swap algorithm.
 */
function applyCategorySpacing(phases: SocialIcebreakerPhase[]): SocialIcebreakerPhase[] {
  const result = [...phases];

  for (let i = 1; i < result.length; i++) {
    const prevCategory = getPhaseModule(result[i - 1]).category;
    const currCategory = getPhaseModule(result[i]).category;

    if (prevCategory === currCategory) {
      // Find the next phase with a different category to swap with
      for (let j = i + 1; j < result.length; j++) {
        const swapCategory = getPhaseModule(result[j]).category;
        if (swapCategory !== currCategory) {
          // Swap result[i] and result[j]
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
      // If no swap found, we keep the duplicate category (rare edge case)
    }
  }

  return result;
}

/**
 * Allocate time proportionally across selected non-core phases.
 *
 * Distributes the non-core budget based on each phase's nominal duration.
 * Uses integer rounding and ensures the sum equals the budget exactly.
 */
function allocateNonCoreTime(
  phases: SocialIcebreakerPhase[],
  budget: number,
): Map<SocialIcebreakerPhase, number> {
  if (phases.length === 0) {
    return new Map();
  }

  const totalNominal = phases.reduce((sum, phase) => sum + getPhaseModule(phase).durationMinutes, 0);

  // Calculate raw allocations
  const rawAllocations = phases.map((phase) => {
    const nominal = getPhaseModule(phase).durationMinutes;
    return {
      phase,
      raw: (nominal / totalNominal) * budget,
      nominal,
    };
  });

  // Round to integers using largest-remainder method
  const floored = rawAllocations.map((a) => ({
    phase: a.phase,
    floor: Math.floor(a.raw),
    remainder: a.raw - Math.floor(a.raw),
  }));

  const currentSum = floored.reduce((sum, a) => sum + a.floor, 0);
  const deficit = budget - currentSum;

  // Sort by largest remainder descending
  const sortedByRemainder = [...floored].sort((a, b) => b.remainder - a.remainder);

  // Distribute deficit to highest remainders
  const allocations = new Map<SocialIcebreakerPhase, number>();
  for (const item of floored) {
    allocations.set(item.phase, item.floor);
  }

  for (let i = 0; i < deficit; i++) {
    const phase = sortedByRemainder[i % sortedByRemainder.length].phase;
    allocations.set(phase, (allocations.get(phase) ?? 0) + 1);
  }

  return allocations;
}

/**
 * Build PhaseSegment objects with allocated minutes and metadata.
 */
function buildSegments(
  phases: SocialIcebreakerPhase[],
  timeAllocations: Map<SocialIcebreakerPhase, number>,
): PhaseSegment[] {
  return phases.map((phase) => {
    const module = getPhaseModule(phase);
    const allocatedMinutes =
      phase === 'warmup' || phase === 'micro_challenge' || phase === 'recap'
        ? module.durationMinutes
        : (timeAllocations.get(phase) ?? module.durationMinutes);

    return {
      phase,
      allocatedMinutes,
      energyWeight: energyArcToWeight(module.energyArc),
      participation: module.participation,
      tone: module.tone,
    };
  });
}

function energyArcToWeight(arc: PhaseModule['energyArc']): number {
  switch (arc) {
    case 'warmup':
      return 1;
    case 'rising':
      return 2;
    case 'peak':
      return 3;
    case 'falling':
      return 1;
    case 'variable':
      return 2;
    default:
      return 2;
  }
}

/**
 * Validate the compiled run plan.
 */
function validateRunPlan(plan: IcebreakerRunPlan, enabledPhases: SocialIcebreakerPhase[]): void {
  const phases = plan.segments.map((s) => s.phase);

  // No duplicates
  const uniquePhases = new Set(phases);
  if (uniquePhases.size !== phases.length) {
    throw new Error(`Duplicate phases detected: ${phases.join(' → ')}`);
  }

  // Recap is always last
  const lastPhase = phases[phases.length - 1];
  if (lastPhase !== CLOSING_PHASE) {
    throw new Error(`Last phase must be ${CLOSING_PHASE}, got ${lastPhase}`);
  }

  // Core phases are first and second
  if (phases[0] !== 'warmup') {
    throw new Error(`First phase must be warmup, got ${phases[0]}`);
  }
  if (phases[1] !== 'micro_challenge') {
    throw new Error(`Second phase must be micro_challenge, got ${phases[1]}`);
  }

  // All phases are in enabledPhases
  for (const phase of phases) {
    if (!enabledPhases.includes(phase)) {
      throw new Error(`Phase ${phase} is not in enabledPhases`);
    }
  }

  // totalMinutes equals sum of allocatedMinutes
  const sumMinutes = plan.segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  if (sumMinutes !== plan.totalMinutes) {
    throw new Error(`totalMinutes mismatch: ${plan.totalMinutes} !== ${sumMinutes}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Compile a dynamic IcebreakerRunPlan for the given tier and context.
 *
 * The rule engine:
 * 1. Includes core phases (warmup + micro_challenge) always
 * 2. Selects non-core phases from the enabled pool based on tier budget
 * 3. Sorts by energy arc (warmup → rising → peak → falling)
 * 4. Applies category-spacing (no consecutive same-category)
 * 5. Allocates time proportionally
 * 6. Closes with recap
 *
 * @throws if inputs are invalid or the compiled plan fails validation
 */
export function compileAgentRunPlan(ctx: CompilationContext): IcebreakerRunPlan {
  validateContext(ctx);

  const { tier, enabledPhases } = ctx;

  // 1. Core phases
  const corePhases = CORE_PHASES.filter((phase) => isEnabled(phase, enabledPhases));
  if (corePhases.length !== CORE_PHASES.length) {
    throw new Error(`Core phases must all be enabled: missing ${CORE_PHASES.filter((p) => !isEnabled(p, enabledPhases)).join(', ')}`);
  }

  // 2. Select non-core phases
  const nonCorePhases = selectNonCorePhases(tier, enabledPhases, ctx.vibe);

  // 3. Sort by energy arc
  const sortedNonCore = sortByEnergyArc(nonCorePhases);

  // 4. Apply category spacing
  const spacedNonCore = applyCategorySpacing(sortedNonCore);

  // 5. Build full phase order: core → non-core → closing
  const allPhases: SocialIcebreakerPhase[] = [
    ...corePhases,
    ...spacedNonCore,
    CLOSING_PHASE,
  ];

  // 6. Time budget enforcement
  const totalBudget = TIER_BUDGETS[tier];
  const coreTime = getCoreTime();
  const closingTime = getClosingTime();
  const nonCoreBudget = totalBudget - coreTime - closingTime;

  const nonCoreAllocations = allocateNonCoreTime(spacedNonCore, nonCoreBudget);

  // 7. Build segments
  const segments = buildSegments(allPhases, nonCoreAllocations);

  // 8. Create plan
  const plan = createRunPlan(segments, `compiler-rule-v1-${tier}`);

  // 9. Validate
  validateRunPlan(plan, enabledPhases);

  return plan;
}

/**
 * Get the total time budget for a tier.
 */
export function getBudgetForTier(tier: TierMachineId): number {
  return TIER_BUDGETS[tier];
}

/**
 * Get the non-core phase pool for a tier, filtered by enabled phases.
 */
export function getNonCorePoolForTier(
  tier: TierMachineId,
  enabledPhases: SocialIcebreakerPhase[],
): SocialIcebreakerPhase[] {
  return TIER_NON_CORE_POOLS[tier].filter((phase) => isEnabled(phase, enabledPhases));
}
