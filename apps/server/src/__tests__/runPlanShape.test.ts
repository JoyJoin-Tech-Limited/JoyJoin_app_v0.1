import { describe, expect, it } from 'vitest';
import type { IcebreakerRunPlan } from '@shared/phaseModule';
import { buildRunPlanShapeKey } from '../lib/runPlanShape';

function plan(overrides: Partial<IcebreakerRunPlan> = {}): IcebreakerRunPlan {
  return {
    version: 2,
    segments: [
      { phase: 'warmup', allocatedMinutes: 20, energyWeight: 1 },
      { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
      { phase: 'recap', allocatedMinutes: 10, energyWeight: 1 },
    ],
    totalMinutes: 40,
    compiledAt: '2026-10-28T00:00:00.000Z',
    compilerId: 'shape-test',
    ...overrides,
  };
}

describe('buildRunPlanShapeKey — duration-only recompile persistence', () => {
  it('changes when M2 moves minutes without changing phase names', () => {
    const base = plan();
    const calibrated = plan({
      segments: [
        { phase: 'warmup', allocatedMinutes: 25, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
        { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
      ],
    });
    expect(buildRunPlanShapeKey(base)).not.toBe(buildRunPlanShapeKey(calibrated));
  });

  it('is stable for the same plan and empty for absent plans', () => {
    expect(buildRunPlanShapeKey(plan())).toBe(buildRunPlanShapeKey(plan()));
    expect(buildRunPlanShapeKey(undefined)).toBe('');
    expect(buildRunPlanShapeKey(null)).toBe('');
  });

  it('detects total-minute and phase-order changes', () => {
    const base = buildRunPlanShapeKey(plan());
    expect(buildRunPlanShapeKey(plan({ totalMinutes: 41 }))).not.toBe(base);
    expect(
      buildRunPlanShapeKey(
        plan({
          segments: [
            { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
            { phase: 'warmup', allocatedMinutes: 20, energyWeight: 1 },
            { phase: 'recap', allocatedMinutes: 10, energyWeight: 1 },
          ],
        }),
      ),
    ).not.toBe(base);
  });
});
