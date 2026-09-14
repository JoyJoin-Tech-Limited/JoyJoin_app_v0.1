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

// ---------------------------------------------------------------------------
// perf-W1: volatile presence/TTL timestamps must not reach the client, so the
// poll payload stays structurally identical while a session is idle. This is
// what lets TanStack structural sharing hold and the idle-poll backoff climb to
// its 12s tier.
// ---------------------------------------------------------------------------
describe('buildClientState - perf-W1 idle payload structural stability', () => {
  function stableState(expiresAt: string): SocialSessionState {
    return {
      socialSessionId: 'social_stable',
      icebreakerSessionId: 'icebreaker_stable',
      currentPhase: 'warmup',
      hostUserId: 'host-user',
      hostDisplayName: 'Host',
      playerCount: 2,
      activePlayerCount: 2,
      phaseStartedAt: 1_000_000,
      sessionStartedAt: 1_000_000,
      completedPhases: [],
      // Server-owned sliding TTL: the real store attaches this on every read.
      expiresAt,
    } as SocialSessionState;
  }

  const participantAt = (lastSeenAt: string) =>
    ({
      userId: 'host-user',
      displayName: 'Host',
      archetype: '社牛柯基',
      joinedAt: '2026-09-14T00:00:00.000Z',
      lastSeenAt,
      isActive: true,
    }) as any;

  it('omits volatile lastSeenAt/expiresAt and yields an identical payload across two idle reads', async () => {
    vi.mocked(isSingleTestMode).mockReturnValue(false);

    // Read #1: presence + TTL at T0.
    vi.mocked(listParticipants).mockResolvedValueOnce([
      participantAt('2026-09-14T00:00:00.000Z'),
    ]);
    const first = await buildClientState(stableState('2026-09-14T06:00:00.000Z'), 'host-user');

    // Read #2 ~10s later: heartbeat bumped lastSeenAt and the sliding TTL moved.
    vi.mocked(listParticipants).mockResolvedValueOnce([
      participantAt('2026-09-14T00:00:10.000Z'),
    ]);
    const second = await buildClientState(stableState('2026-09-14T06:00:10.000Z'), 'host-user');

    // Neither volatile field is exposed...
    expect(first.expiresAt).toBeUndefined();
    expect(second.expiresAt).toBeUndefined();
    expect(second.joinedParticipants?.[0]?.lastSeenAt).toBeUndefined();
    // ...but presence is still communicated via `isActive`.
    expect(second.joinedParticipants?.[0]?.isActive).toBe(true);

    // No ISO-timestamp field changed between the two idle reads.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
