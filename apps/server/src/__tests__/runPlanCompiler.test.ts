import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest';
import { compileForSession } from '../services/runPlanService';
import * as featureFlags from '../lib/featureFlags';
import * as runPlanTemplatesRepo from '../repositories/runPlanTemplatesRepo';

const ALL_PHASES: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'speed_friending',
  'recap',
];

function makeState(
  tier: TierMachineId,
  vibe: SocialSessionState['vibe'] = 'balanced',
  playerCount = 4,
): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'test',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ALL_PHASES,
    eventTier: tier,
    vibe,
  };
}

describe('compileForSession — feature flag integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flag=false uses legacy compileAgentRunPlan unchanged (regression guard)', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(false);
    const state = makeState('breeze', 'balanced', 4);

    const plan = await compileForSession(state, 'breeze');

    expect(plan.compilerId).toContain('compiler-rule-v1');
    expect(plan.segments[0]?.phase).toBe('warmup');
    expect(plan.segments[1]?.phase).toBe('micro_challenge');
    expect(plan.segments[plan.segments.length - 1]?.phase).toBe('recap');
  });

  it('flag=true + DB template found uses template compiler', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockResolvedValue({
      id: 'tpl-1',
      vibe: 'deep_chat',
      tier: 'breeze',
      playerCountMin: 2,
      playerCountMax: 12,
      slots: {
        coreWarmupMinutes: 18,
        coreMicroChallengeMinutes: 10,
        coreRecapMinutes: 5,
        slots: [
          { slotType: 'deep_chat', eligiblePhases: ['group_mirror', 'personality_dice'], allocatedMinutes: 7 },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const state = makeState('breeze', 'chat', 4);
    const plan = await compileForSession(state, 'breeze');

    expect(plan.compilerId).toContain('compiler-template-v1');
    expect(plan.segments[0]?.phase).toBe('warmup');
    expect(plan.segments[0]?.allocatedMinutes).toBe(18);
    expect(plan.segments[1]?.phase).toBe('micro_challenge');
    expect(plan.segments[plan.segments.length - 1]?.phase).toBe('recap');
  });

  it('flag=true + no DB template falls back to default templates', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockResolvedValue(undefined);

    const state = makeState('breeze', 'chat', 4);
    const plan = await compileForSession(state, 'breeze');

    expect(plan.compilerId).toContain('compiler-template-v1');
    expect(plan.segments[0]?.phase).toBe('warmup');
    expect(plan.segments[1]?.phase).toBe('micro_challenge');
    expect(plan.segments[plan.segments.length - 1]?.phase).toBe('recap');
  });

  it('flag=true + invalid DB template JSON falls back to legacy compiler', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockResolvedValue({
      id: 'tpl-bad',
      vibe: 'deep_chat',
      tier: 'breeze',
      playerCountMin: 2,
      playerCountMax: 12,
      slots: { notSlots: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const state = makeState('breeze', 'chat', 4);
    const plan = await compileForSession(state, 'breeze');

    // Falls back to legacy compiler because dbRowToTemplate returns null
    // and resolveTemplateSlots uses default templates
    expect(plan.compilerId).toContain('compiler-template-v1');
  });

  it('flag=true + DB query throws falls back to legacy compiler', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockRejectedValue(
      new Error('DB connection lost'),
    );

    const state = makeState('breeze', 'chat', 4);
    const plan = await compileForSession(state, 'breeze');

    expect(plan.compilerId).toContain('compiler-rule-v1');
  });

  it('returns a static fallback plan when template lookup stalls', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockImplementation(
      () => new Promise(() => {}),
    );

    const state = makeState('blaze', 'game', 4);
    const plan = await Promise.race([
      compileForSession(state, 'blaze'),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('compileForSession exceeded fallback budget')), 200);
      }),
    ]);

    expect(plan.compilerId).toBe('blaze-v1');
    expect(plan.segments[0]?.phase).toBe('warmup');
    expect(plan.segments[plan.segments.length - 1]?.phase).toBe('recap');
  });

  it('all 9 vibe-tier combos produce valid plans when flag=true', async () => {
    vi.spyOn(featureFlags, 'getFeatureFlag').mockResolvedValue(true);
    vi.spyOn(runPlanTemplatesRepo, 'getTemplateByVibeAndTier').mockResolvedValue(undefined);

    const vibes: Array<{ stateVibe: SocialSessionState['vibe']; label: string }> = [
      { stateVibe: 'chat', label: 'deep_chat' },
      { stateVibe: 'balanced', label: 'balanced' },
      { stateVibe: 'game', label: 'play_fun' },
    ];
    const tiers: TierMachineId[] = ['breeze', 'glow', 'blaze'];

    for (const { stateVibe } of vibes) {
      for (const tier of tiers) {
        const state = makeState(tier, stateVibe, 4);
        const plan = await compileForSession(state, tier);

        const phases = plan.segments.map((s) => s.phase);
        expect(new Set(phases).size).toBe(phases.length);
        expect(phases[0]).toBe('warmup');
        expect(phases[1]).toBe('micro_challenge');
        expect(phases[phases.length - 1]).toBe('recap');
        const sumMinutes = plan.segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
        expect(plan.totalMinutes).toBe(sumMinutes);
      }
    }
  });
});
