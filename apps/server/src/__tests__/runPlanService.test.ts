import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { getNextEligiblePhase } from '@shared/socialIcebreaker';
import { appendMiniScriptBonusSegment, compileForSession } from '../services/runPlanService';
import { getNextPhaseFromPlan } from '@shared/phaseModule';
import type { IcebreakerRunPlan } from '@shared/phaseModule';

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
    expect(plan.segments[miniIndex].allocatedMinutes).toBe(25);

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
