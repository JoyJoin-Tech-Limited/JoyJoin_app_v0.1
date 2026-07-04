import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { computeSelectablePhases } from '../services/customModeService';

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  const now = Date.now();
  return {
    socialSessionId: 'social-test',
    icebreakerSessionId: 'icebreaker-test',
    currentPhase: 'phase_selection',
    hostUserId: 'host-1',
    hostDisplayName: '主持人',
    playerCount: 2,
    phaseStartedAt: now,
    sessionStartedAt: now,
    completedPhases: [],
    eventTier: 'custom',
    enabledPhases: ['micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'mini_script'],
    ...overrides,
  };
}

describe('computeSelectablePhases', () => {
  it('disables custom-mode phases that do not have enough players', () => {
    const phases = computeSelectablePhases(makeState({ playerCount: 2 }));

    expect(phases.find((phase) => phase.phase === 'micro_challenge')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
    expect(phases.find((phase) => phase.phase === 'lie_detective')).toMatchObject({
      disabled: true,
      disabledReason: '至少 3 人',
    });
    expect(phases.find((phase) => phase.phase === 'mini_script')).toMatchObject({
      disabled: true,
      disabledReason: '至少 4 人',
    });
  });

  it('marks completed custom-mode phases as unavailable after player eligibility passes', () => {
    const phases = computeSelectablePhases(makeState({
      playerCount: 4,
      completedPhases: ['micro_challenge'],
    }));

    expect(phases.find((phase) => phase.phase === 'micro_challenge')).toMatchObject({
      disabled: true,
      disabledReason: '已经玩过',
    });
    expect(phases.find((phase) => phase.phase === 'lie_detective')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
  });
});
