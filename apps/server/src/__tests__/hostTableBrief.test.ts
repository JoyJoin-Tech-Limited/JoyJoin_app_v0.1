import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HostTableBrief,
  SocialSessionParticipantSummary,
  SocialSessionState,
} from '@shared/socialIcebreaker';
import { buildClientState, sanitizeStateForClient } from '../routes/socialIcebreakerHelpers';
import { listParticipants } from '../lib/socialIcebreakerStore';
import { getFeatureFlag } from '../lib/featureFlags';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { HOST_TABLE_BRIEF_PACE_BY_PERSONA, HOST_TABLE_BRIEF_PACE_SHORT } from '../lib/hostTableBrief';

vi.mock('../lib/socialIcebreakerStore', () => ({
  listParticipants: vi.fn(),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => false),
}));

const PHASE_STARTED_AT = 1_700_000_060_000;

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_host_brief_test',
    icebreakerSessionId: 'icebreaker_host_brief_test',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: PHASE_STARTED_AT,
    sessionStartedAt: 1_700_000_000_000,
    completedPhases: [],
    ...overrides,
  } as SocialSessionState;
}

function validRoster(lastSeenAt = '2026-10-27T10:00:00.000Z'): SocialSessionParticipantSummary[] {
  const interests = [
    ['咖啡', '摄影'],
    ['咖啡', '徒步'],
    ['咖啡', '阅读'],
    ['徒步'],
    ['摄影'],
    ['阅读'],
  ];
  return interests.map((labels, index) => ({
    userId: index === 0 ? 'host-user' : `participant-${index}`,
    displayName: `Member ${index + 1}`,
    archetype: 'corgi',
    interests: labels,
    joinedAt: `2026-10-27T09:00:0${index}.000Z`,
    lastSeenAt,
    isActive: true,
  }));
}

function existingBrief(): HostTableBrief {
  return {
    paceShort: HOST_TABLE_BRIEF_PACE_BY_PERSONA.mixed.high,
    anchorLabel: '咖啡',
    phaseKey: `warmup:${PHASE_STARTED_AT}:high:mixed`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSingleTestMode).mockReturnValue(false);
  vi.mocked(getFeatureFlag).mockImplementation(
    async (key) => key === 'icebreakerMatchingAwareEnabled',
  );
  vi.mocked(listParticipants).mockResolvedValue(validRoster());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HostTableBrief client projection', () => {
  it('emits a real shared-interest anchor to the host with one roster load', async () => {
    const result = await buildClientState(makeState({ eventTier: 'blaze' }), 'host-user');

    expect(result.hostTableBrief).toEqual(existingBrief());
    expect(Object.keys(result.hostTableBrief ?? {})).toHaveLength(3);
    expect(result.hostTableBrief).not.toHaveProperty('avoidDomain');
    expect(result.joinedParticipants?.every((participant) => participant.interests === undefined)).toBe(true);
    expect(listParticipants).toHaveBeenCalledTimes(1);
    expect(getFeatureFlag).toHaveBeenCalledWith('icebreakerMatchingAwareEnabled', true);
  });

  it('uses aggregate persona pace for a deep table without exposing the raw preference', async () => {
    vi.mocked(listParticipants).mockResolvedValue(
      validRoster().map((participant, index) => ({
        ...participant,
        profile: { tableVibePreference: index < 4 ? '深度交流' : '轻松聊天' },
      })),
    );

    const result = await buildClientState(makeState(), 'host-user');

    expect(result.hostTableBrief).toMatchObject({
      paceShort: HOST_TABLE_BRIEF_PACE_BY_PERSONA.deep.high,
      anchorLabel: '咖啡',
      phaseKey: `warmup:${PHASE_STARTED_AT}:high:deep`,
    });
    expect(Object.keys(result.hostTableBrief ?? {})).toHaveLength(3);
    expect(JSON.stringify(result.hostTableBrief)).not.toContain('深度交流');
  });

  it('offers a slower pace for a low-energy, light-preference table', async () => {
    vi.mocked(listParticipants).mockResolvedValue(
      validRoster().map((participant, index) => ({
        ...participant,
        archetype: 'turtle',
        profile: { tableVibePreference: index < 4 ? '轻松聊天' : '深度交流' },
      })),
    );

    const result = await buildClientState(makeState(), 'host-user');

    expect(result.hostTableBrief).toMatchObject({
      paceShort: HOST_TABLE_BRIEF_PACE_BY_PERSONA.light.low,
      anchorLabel: '咖啡',
      phaseKey: `warmup:${PHASE_STARTED_AT}:low:light`,
    });
  });

  it('omits the field when matching-aware mode is off', async () => {
    vi.mocked(getFeatureFlag).mockResolvedValue(false);

    const result = await buildClientState(makeState(), 'host-user');

    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('omits the field when the roster has no interest data, despite tier/archetype data', async () => {
    vi.mocked(listParticipants).mockResolvedValue(
      validRoster().map(({ interests: _interests, ...participant }) => participant),
    );

    const result = await buildClientState(makeState({ eventTier: 'blaze' }), 'host-user');

    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('omits the field when shared interests are below the roster threshold', async () => {
    vi.mocked(listParticipants).mockResolvedValue(
      validRoster().map((participant, index) => ({
        ...participant,
        interests: index < 2 ? ['咖啡'] : [`独立兴趣${index}`],
      })),
    );

    const result = await buildClientState(makeState(), 'host-user');

    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('omits the field outside warmup even if stale state contains one', async () => {
    const result = await buildClientState(
      makeState({ currentPhase: 'micro_challenge', hostTableBrief: existingBrief() }),
      'host-user',
    );

    expect(result).not.toHaveProperty('hostTableBrief');
    expect(getFeatureFlag).not.toHaveBeenCalledWith('icebreakerMatchingAwareEnabled', true);
  });

  it('omits the field for a participant with an otherwise valid roster', async () => {
    const result = await buildClientState(
      makeState({ hostTableBrief: existingBrief() }),
      'participant-1',
    );

    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('omits the field for an anonymous projection with an otherwise valid roster', async () => {
    const result = await buildClientState(makeState({ hostTableBrief: existingBrief() }));

    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('stays playable without a brief when roster loading fails', async () => {
    vi.mocked(listParticipants).mockRejectedValueOnce(new Error('roster query failed'));

    const result = await buildClientState(makeState(), 'host-user');

    expect(result.socialSessionId).toBe('social_host_brief_test');
    expect(result.currentPhase).toBe('warmup');
    expect(result.joinedParticipants).toEqual([]);
    expect(result).not.toHaveProperty('hostTableBrief');
  });

  it('keeps phaseKey stable across polls and presence timestamps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-10-27T10:00:00.000Z');
    vi.mocked(listParticipants)
      .mockResolvedValueOnce(validRoster('2026-10-27T10:00:00.000Z'))
      .mockResolvedValueOnce(validRoster('2026-10-27T10:00:10.000Z'));

    const first = await buildClientState(makeState(), 'host-user');
    vi.setSystemTime('2026-10-27T10:00:13.000Z');
    const second = await buildClientState(makeState(), 'host-user');

    expect(first.hostTableBrief).toEqual(existingBrief());
    expect(second.hostTableBrief).toEqual(first.hostTableBrief);
    expect(JSON.stringify(second.hostTableBrief)).not.toContain('host-user');
    expect(JSON.stringify(second.hostTableBrief)).not.toContain('social_host_brief_test');
    expect(JSON.stringify(second.hostTableBrief)).not.toContain('2026-10-27T10:00:10.000Z');
    expect(listParticipants).toHaveBeenCalledTimes(2);
  });
});

describe('HostTableBrief sanitizer boundary', () => {
  it.each([
    ['host', 'host-user'],
    ['participant', 'participant-1'],
    ['anonymous', undefined],
  ])('strips an existing brief from every %s projection', (_label, requestingUserId) => {
    const state = makeState({ hostTableBrief: existingBrief() });

    const sanitized = sanitizeStateForClient(state, requestingUserId);

    expect(sanitized).not.toHaveProperty('hostTableBrief');
    expect(state.hostTableBrief).toEqual(existingBrief());
  });
});
