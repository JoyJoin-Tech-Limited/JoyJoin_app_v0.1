import { describe, expect, it } from 'vitest';
import { buildCustomRunPlan, validateCustomGamePhases } from '../services/customRunPlanService';
import { getNextEligiblePhase } from '../socialIcebreakerPhaseConfig';
import type { SocialSessionState } from '@shared/socialIcebreaker';

describe('custom run plan service', () => {
  it('keeps the host-selected game order between warmup and recap', () => {
    const plan = buildCustomRunPlan(['auction', 'lie_detective', 'micro_challenge']);

    expect(plan.segments.map((segment) => segment.phase)).toEqual([
      'warmup',
      'auction',
      'lie_detective',
      'micro_challenge',
      'recap',
    ]);
    expect(plan.compilerId).toBe('custom-selection-v1');
    expect(plan.totalMinutes).toBe(
      plan.segments.reduce((total, segment) => total + segment.allocatedMinutes, 0),
    );
  });

  it('rejects empty, duplicate, and non-playable phase selections', () => {
    expect(validateCustomGamePhases([])).toEqual({ ok: false, reason: 'empty' });
    expect(validateCustomGamePhases(['auction', 'auction'])).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(validateCustomGamePhases(['warmup'])).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(validateCustomGamePhases(['unknown_phase' as any])).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(validateCustomGamePhases(['auction'])).toEqual({
      ok: true,
      phases: ['auction'],
    });
  });

  it('advances a custom session through the preselected order without the picker', () => {
    const state = {
      eventTier: 'custom',
      playerCount: 4,
      runPlan: buildCustomRunPlan(['auction', 'lie_detective']),
    } as SocialSessionState;

    expect(getNextEligiblePhase('warmup', state)).toBe('auction');
    expect(getNextEligiblePhase('auction', state)).toBe('lie_detective');
    expect(getNextEligiblePhase('lie_detective', state)).toBe('recap');
  });
});
