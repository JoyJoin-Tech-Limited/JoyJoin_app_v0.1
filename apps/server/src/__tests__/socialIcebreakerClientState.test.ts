import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { buildClientState } from '../routes/socialIcebreakerHelpers';
import { listParticipants } from '../lib/socialIcebreakerStore';
import { isSingleTestMode } from '../lib/isSingleTestMode';

vi.mock('../lib/socialIcebreakerStore', () => ({
  listParticipants: vi.fn(async () => [
    { userId: 'host-user', displayName: 'Host', archetype: '社牛柯基', joinedAt: 1 },
    { userId: 'bot-user-1', displayName: 'Bot 1', archetype: '小太阳鸡', joinedAt: 2 },
  ]),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => true),
}));

function makeState(runBots: boolean): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'icebreaker_test',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: 1_000_000,
    sessionStartedAt: 1_000_000,
    completedPhases: [],
    singleTest: {
      version: 2,
      groupId: 'group-test',
      isTestModeSkip: true,
      runBots,
      bots: [
        { botId: 'bot-1', displayName: 'Bot 1', archetype: '社牛柯基' },
      ],
      botPersonas: [
        { botId: 'bot-1', userId: 'bot-user-1', displayName: 'Bot 1', archetype: '社牛柯基' },
      ],
    },
  } as SocialSessionState;
}

describe('buildClientState - runBots propagation', () => {
  beforeEach(() => {
    vi.mocked(isSingleTestMode).mockReturnValue(true);
    vi.mocked(listParticipants).mockResolvedValue([
      { userId: 'host-user', displayName: 'Host', archetype: '社牛柯基', joinedAt: 1 } as any,
      { userId: 'bot-user-1', displayName: 'Bot 1', archetype: '小太阳鸡', joinedAt: 2 } as any,
    ]);
  });

  it('propagates runBots=true when singleTest.runBots is true', async () => {
    const state = makeState(true);
    const clientState = await buildClientState(state);
    expect(clientState.isTestModeSkip).toBe(true);
    expect(clientState.runBots).toBe(true);
  });

  it('propagates runBots=false when singleTest.runBots is false', async () => {
    const state = makeState(false);
    const clientState = await buildClientState(state);
    expect(clientState.isTestModeSkip).toBe(true);
    expect(clientState.runBots).toBe(false);
  });

  it('does not expose runBots outside test mode', async () => {
    const { isSingleTestMode } = await import('../lib/isSingleTestMode');
    vi.mocked(isSingleTestMode).mockReturnValue(false);

    const state = makeState(true);
    const clientState = await buildClientState(state);
    expect(clientState.runBots).toBeUndefined();
    expect(clientState.isTestModeSkip).toBeUndefined();
  });

  it('returns playable client state when roster lookup fails', async () => {
    vi.mocked(listParticipants).mockRejectedValueOnce(new Error('roster query failed'));

    const state = makeState(true);
    const clientState = await buildClientState(state);

    expect(clientState.socialSessionId).toBe('social_test');
    expect(clientState.currentPhase).toBe('warmup');
    expect(clientState.joinedParticipants).toEqual([]);
  });
});
