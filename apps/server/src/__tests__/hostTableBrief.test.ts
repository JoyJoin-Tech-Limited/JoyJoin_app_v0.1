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
import { getLatestRoleResultsForUsers } from '../repositories/assessmentRepo';
import { resetHostBriefRoleResultsMemo } from '../lib/hostBriefRoleResultsMemo';

vi.mock('../lib/socialIcebreakerStore', () => ({
  listParticipants: vi.fn(),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => false),
}));

// FU-02: the host brief now reads ACOEXP through the per-session memo. Mocking
// the repository keeps these projections tests database-free AND gives the
// FU-04③ guards a call counter to assert against.
vi.mock('../repositories/assessmentRepo', () => ({
  getLatestRoleResultsForUsers: vi.fn(async () => new Map()),
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
  resetHostBriefRoleResultsMemo();
  vi.mocked(isSingleTestMode).mockReturnValue(false);
  vi.mocked(getFeatureFlag).mockImplementation(
    async (key) => key === 'icebreakerMatchingAwareEnabled',
  );
  vi.mocked(listParticipants).mockResolvedValue(validRoster());
  vi.mocked(getLatestRoleResultsForUsers).mockResolvedValue(new Map());
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

// ─── FU-02: ACOEXP is a real consumer (energy band from roster traits) ──────

describe('HostTableBrief ACOEXP energy (FU-02)', () => {
  function traits(extraversion: number, affinity = 60) {
    return { extraversion, affinity, emotionalStability: 60 };
  }

  it('uses roster-average ACOEXP extraversion over the archetype composition', async () => {
    // Archetype composition alone says `high` (all corgi); ACOEXP says `low`.
    vi.mocked(getLatestRoleResultsForUsers).mockResolvedValue(
      new Map([
        ['host-user', traits(20)],
        ['participant-1', traits(25)],
        ['participant-2', traits(30)],
      ]),
    );

    const result = await buildClientState(makeState(), 'host-user');

    expect(result.hostTableBrief).toMatchObject({
      paceShort: HOST_TABLE_BRIEF_PACE_BY_PERSONA.mixed.low,
      anchorLabel: '咖啡',
      phaseKey: `warmup:${PHASE_STARTED_AT}:low:mixed`,
    });
    expect(getLatestRoleResultsForUsers).toHaveBeenCalledTimes(1);
  });

  it('falls back to the archetype band when ACOEXP coverage is too thin', async () => {
    vi.mocked(getLatestRoleResultsForUsers).mockResolvedValue(
      new Map([
        ['host-user', traits(20)],
        ['participant-1', traits(20)],
      ]),
    );

    const result = await buildClientState(makeState(), 'host-user');

    expect(result.hostTableBrief).toMatchObject({
      paceShort: HOST_TABLE_BRIEF_PACE_BY_PERSONA.mixed.high,
      phaseKey: `warmup:${PHASE_STARTED_AT}:high:mixed`,
    });
  });

  it('keeps the visible DTO at three fields with no score or user id', async () => {
    vi.mocked(getLatestRoleResultsForUsers).mockResolvedValue(
      new Map([
        ['host-user', traits(23)],
        ['participant-1', traits(24)],
        ['participant-2', traits(26)],
      ]),
    );

    const result = await buildClientState(makeState(), 'host-user');
    const serialized = JSON.stringify(result.hostTableBrief);

    expect(Object.keys(result.hostTableBrief ?? {})).toHaveLength(3);
    expect(serialized).not.toContain('host-user');
    expect(serialized).not.toContain('participant-1');
    expect(serialized).not.toContain('23');
    expect(serialized).not.toContain('extraversion');
  });

  it('issues one role_results query for repeated polls (memoized per session)', async () => {
    const first = await buildClientState(makeState(), 'host-user');
    const second = await buildClientState(makeState(), 'host-user');

    expect(first.hostTableBrief).toEqual(second.hostTableBrief);
    expect(getLatestRoleResultsForUsers).toHaveBeenCalledTimes(1);
  });
});

// ─── FU-04③: the memo guard — no query outside host + warmup + flag ─────────

describe('HostTableBrief role_results query guards (FU-04③)', () => {
  it('does not query when the matching-aware flag is off', async () => {
    vi.mocked(getFeatureFlag).mockResolvedValue(false);

    await buildClientState(makeState(), 'host-user');

    expect(getLatestRoleResultsForUsers).not.toHaveBeenCalled();
  });

  it('does not query for a non-host participant', async () => {
    await buildClientState(makeState(), 'participant-1');

    expect(getLatestRoleResultsForUsers).not.toHaveBeenCalled();
  });

  it('does not query for an anonymous projection', async () => {
    await buildClientState(makeState());

    expect(getLatestRoleResultsForUsers).not.toHaveBeenCalled();
  });

  it('does not query outside warmup', async () => {
    await buildClientState(makeState({ currentPhase: 'micro_challenge' }), 'host-user');

    expect(getLatestRoleResultsForUsers).not.toHaveBeenCalled();
  });

  it('does not query when the table has no shared-interest anchor', async () => {
    vi.mocked(listParticipants).mockResolvedValue(
      validRoster().map(({ interests: _interests, ...participant }) => participant),
    );

    await buildClientState(makeState(), 'host-user');

    expect(getLatestRoleResultsForUsers).not.toHaveBeenCalled();
  });
});
