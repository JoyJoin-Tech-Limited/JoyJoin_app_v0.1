import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { getNextEligiblePhase } from '@shared/socialIcebreaker';
import { appendMiniScriptBonusSegment, compileForSession, reconcileMiniScriptBudget } from '../services/runPlanService';
import { getNextPhaseFromPlan } from '@shared/phaseModule';
import type { IcebreakerRunPlan } from '@shared/phaseModule';
import {
  BREEZE_RUN_PLAN,
  GLOW_RUN_PLAN,
  BLAZE_RUN_PLAN,
} from '@shared/socialIcebreakerRunPlans';

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn().mockResolvedValue(false),
}));

vi.mock('../repositories/runPlanTemplatesRepo', () => ({
  getTemplateByVibeAndTier: vi.fn().mockResolvedValue(null),
}));

const REAL_FLAG = process.env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT;

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test-plan',
    icebreakerSessionId: 'test-plan',
    currentPhase: 'warmup',
    hostUserId: 'host-1',
    playerCount: 6,
    phaseStartedAt: new Date().toISOString(),
    sessionStartedAt: new Date().toISOString(),
    completedPhases: [],
    eventTier: 'glow',
    vibe: 'balanced',
    enabledPhases: [],
    commonGroundCount: 0,
    ...overrides,
  } as SocialSessionState;
}

describe('compileForSession mini_script bonus segment', () => {
  beforeEach(() => {
    process.env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT = 'true';
  });

  afterEach(() => {
    if (REAL_FLAG === undefined) {
      delete process.env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT;
    } else {
      process.env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT = REAL_FLAG;
    }
  });

  it('appends mini_script before recap when the flag is on and roster >= 4', async () => {
    const state = makeState({ enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'mini_script', 'recap'] });
    const plan = await compileForSession(state, 'glow');

    const phases = plan.segments.map((s) => s.phase);
    expect(phases).toContain('mini_script');
    const recapIndex = phases.indexOf('recap');
    const miniIndex = phases.indexOf('mini_script');
    expect(miniIndex).toBeGreaterThanOrEqual(0);
    expect(recapIndex).toBeGreaterThan(miniIndex);
    // W9 (AC-W9.4): the bonus is funded from the non-core budget (glow = 60),
    // sized to the leftover then floored at MINI_SCRIPT_MIN_MINUTES (12).
    const miniMinutes = plan.segments[miniIndex].allocatedMinutes;
    expect(miniMinutes).toBeGreaterThanOrEqual(12);
    expect(miniMinutes).toBeLessThanOrEqual(25);
    expect(plan.totalMinutes).toBeLessThanOrEqual(60);

    // The bonus gate fires on advance INTO mini_script — the phase must be the
    // next eligible phase from whatever precedes it.
    const previous = phases[miniIndex - 1];
    expect(getNextPhaseFromPlan(previous, plan)).toBe('mini_script');

    // The /advance route uses the state overload — same plan-driven result.
    const stateWithPlan = makeState({
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'mini_script', 'recap'],
      runPlan: plan,
    });
    expect(getNextEligiblePhase(previous, stateWithPlan)).toBe('mini_script');
  });

  it('does not add mini_script when the flag is off', async () => {
    process.env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT = 'false';
    const state = makeState({ enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'recap'] });
    const plan = await compileForSession(state, 'glow');
    expect(plan.segments.map((s) => s.phase)).not.toContain('mini_script');
  });

  it('does not add mini_script for rosters below the 4-player minimum', async () => {
    const state = makeState({
      playerCount: 3,
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'mini_script', 'recap'],
    });
    const plan = await compileForSession(state, 'glow');
    expect(plan.segments.map((s) => s.phase)).not.toContain('mini_script');
  });
});

describe('appendMiniScriptBonusSegment', () => {
  const basePlan: IcebreakerRunPlan = {
    version: 2,
    segments: [
      { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
      { phase: 'group_mirror', allocatedMinutes: 15, energyWeight: 1 },
      { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
    ],
    totalMinutes: 28,
    compiledAt: new Date().toISOString(),
    compilerId: 'test',
  };

  it('splices the bonus before recap and recomputes totalMinutes', () => {
    const plan = appendMiniScriptBonusSegment(basePlan, ['mini_script', 'recap'], 6);
    expect(plan.segments.map((s) => s.phase)).toEqual([
      'warmup',
      'group_mirror',
      'mini_script',
      'recap',
    ]);
    expect(plan.totalMinutes).toBe(28 + 25);
  });

  it('leaves a plan that already contains mini_script untouched', () => {
    const withBonus: IcebreakerRunPlan = {
      ...basePlan,
      segments: [
        basePlan.segments[0],
        { phase: 'mini_script', allocatedMinutes: 25, energyWeight: 1 },
        basePlan.segments[1],
        basePlan.segments[2],
      ],
      totalMinutes: 53,
    };
    const plan = appendMiniScriptBonusSegment(withBonus, ['mini_script', 'recap'], 6);
    expect(plan.segments).toHaveLength(4);
    expect(plan.segments.filter((s) => s.phase === 'mini_script')).toHaveLength(1);
  });

  it('leaves plans untouched when mini_script is not enabled', () => {
    const plan = appendMiniScriptBonusSegment(basePlan, ['recap'], 6);
    expect(plan.segments.map((s) => s.phase)).toEqual(['warmup', 'group_mirror', 'recap']);
  });
});

// ─── W9 (AC-W9.4): mini_script budget reconciliation ─────────────────────────

describe('reconcileMiniScriptBudget (W9)', () => {
  it('funds the bonus from non-core and stays within the glow budget', () => {
    const decision = reconcileMiniScriptBudget(GLOW_RUN_PLAN, 6, 60);
    expect(decision.accepted).toBe(true);
    expect(decision.miniScriptMinutes).toBeGreaterThanOrEqual(12);
    expect(decision.miniScriptMinutes).toBeLessThanOrEqual(25);
    expect(decision.overBudgetMinutes).toBe(0);
    expect(decision.plan.totalMinutes).toBeLessThanOrEqual(60);
    const lie = decision.plan.segments.find((s) => s.phase === 'lie_detective');
    expect(lie?.allocatedMinutes).toBeGreaterThanOrEqual(15);
    // Bonus is spliced immediately before recap.
    const phases = decision.plan.segments.map((s) => s.phase);
    expect(phases[phases.length - 1]).toBe('recap');
    expect(phases[phases.length - 2]).toBe('mini_script');
  });

  it('fits the full 25-minute bonus inside the blaze budget', () => {
    const decision = reconcileMiniScriptBudget(BLAZE_RUN_PLAN, 6, 90);
    expect(decision.accepted).toBe(true);
    expect(decision.miniScriptMinutes).toBe(25);
    expect(decision.overBudgetMinutes).toBe(0);
    expect(decision.plan.totalMinutes).toBeLessThanOrEqual(90);
  });

  it('refuses the bonus when there is no meaningful room (breeze)', () => {
    const decision = reconcileMiniScriptBudget(BREEZE_RUN_PLAN, 6, 40);
    expect(decision.accepted).toBe(false);
    expect(decision.plan.segments.some((s) => s.phase === 'mini_script')).toBe(false);
  });

  it('budget-aware append never exceeds the booked budget', () => {
    const plan = appendMiniScriptBonusSegment(GLOW_RUN_PLAN, ['mini_script', 'recap'], 6, 60);
    expect(plan.segments.map((s) => s.phase)).toContain('mini_script');
    expect(plan.totalMinutes).toBeLessThanOrEqual(60);
  });
});
