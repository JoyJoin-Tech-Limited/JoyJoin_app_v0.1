import type { IcebreakerRunPlan } from '@shared/phaseModule';

/**
 * Stable signature for comparing two compiled run plans.
 *
 * M2 table-rhythm calibration changes ONLY `allocatedMinutes` (the phase set
 * and order stay fixed), so a phase-name comparison silently discards it.
 * This key is the single comparison used when deciding whether a recompiled
 * plan must be persisted.
 */
export function buildRunPlanShapeKey(plan?: IcebreakerRunPlan | null): string {
  if (!plan) return '';
  const segments = plan.segments
    .map((segment) => `${segment.phase}:${segment.allocatedMinutes}`)
    .join('|');
  return `${segments}#${plan.totalMinutes}`;
}
