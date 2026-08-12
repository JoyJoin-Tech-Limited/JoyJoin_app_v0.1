import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ── Mocks (hoisted) ─────────────────────────────────────────────────────────
const {
  getFeatureFlagMock,
  updateSessionMock,
  listParticipantsMock,
  savePhaseMetricMock,
  loadSessionLieTruthsMock,
  generateMicroChallengesMock,
  generateRecapSummaryMock,
  getSessionWithExpiryMock,
} = vi.hoisted(() => ({
  getFeatureFlagMock: vi.fn(async () => false),
  updateSessionMock: vi.fn(async () => {}),
  listParticipantsMock: vi.fn(async () => [
    { userId: 'host-user', displayName: 'Host', archetype: '社牛柯基', joinedAt: 1 },
  ]),
  savePhaseMetricMock: vi.fn(async () => {}),
  loadSessionLieTruthsMock: vi.fn(async () => new Map()),
  generateMicroChallengesMock: vi.fn(async () => ({
    data: [
      {
        id: 'mc-1',
        title: '互相问3个问题',
        description: '每人准备3个能真正了解对方的问题，轮流问。',
        durationSeconds: 180,
        completionCTA: '我完成了',
      },
    ],
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  })),
  generateRecapSummaryMock: vi.fn(async () => ({
    data: { headline: '今晚到这儿，刚刚好', closingLine: '下次见', moments: [] },
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  })),
  getSessionWithExpiryMock: vi.fn(async () => ({ state: null as SocialSessionState | null, expired: false })),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: getFeatureFlagMock,
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSession: updateSessionMock,
  listParticipants: listParticipantsMock,
  savePhaseMetric: savePhaseMetricMock,
  loadSessionLieTruths: loadSessionLieTruthsMock,
  getSessionWithExpiry: getSessionWithExpiryMock,
  getParticipant: vi.fn(async () => null),
  setLieTruths: vi.fn(async () => {}),
  getLieTruths: vi.fn(async () => null),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateMicroChallenges: generateMicroChallengesMock,
  generateRecapSummary: generateRecapSummaryMock,
  buildLieDetectiveV2RecapData: vi.fn(() => ({ aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 })),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  seedSingleTestBotsWarmupReady: vi.fn(() => {}),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => false),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../lib/contextInjector', () => ({
  buildArchetypeContext: vi.fn(() => ({ mixText: '' })),
}));

vi.mock('../services/customModeService', () => ({
  isCustomMode: vi.fn(() => false),
  computeSelectablePhases: vi.fn(() => []),
  generatePhaseSelectionId: vi.fn(() => 'psel_test'),
}));

import { wsService } from '../wsService';
import {
  GROUP_BEAT_KIND_PATTERN,
  buildSocialGroupBeatMessage,
  emitSocialGroupBeat,
} from '../lib/socialGroupBeats';
import { transitionPhase } from '../routes/socialIcebreakerHelpers';

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'icebreaker_test',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now() - 60_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: ['warmup'],
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
}

describe('S6 group beats — emitter', () => {
  let broadcastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getFeatureFlagMock.mockResolvedValue(false);
    broadcastSpy = vi.spyOn(wsService, 'broadcastToEvent').mockImplementation(() => {});
  });

  it('maps choke-point kinds to the S1 pattern vocabulary (config record)', () => {
    expect(GROUP_BEAT_KIND_PATTERN).toEqual({
      phase_advanced: 'nudge',
      session_recap: 'celebration',
      reveal: 'reveal',
    });
  });

  it('builds a STATE-FREE payload: pattern + nonce + sentAt + room scope only (ruling 6)', () => {
    const message = buildSocialGroupBeatMessage('icebreaker_test', 'reveal', 1234);
    expect(message.type).toBe('SOCIAL_GROUP_BEAT');
    expect(message.eventId).toBe('icebreaker_test');
    // The whole point of ruling 6: exactly these keys, nothing else.
    expect(Object.keys(message.data).sort()).toEqual(['nonce', 'pattern', 'sentAt', 'sessionId']);
    expect(message.data).toEqual({
      sessionId: 'icebreaker_test',
      pattern: 'reveal',
      nonce: 'icebreaker_test:1234:1',
      sentAt: 1234,
    });
  });

  it('generates a unique nonce per beat', () => {
    const a = buildSocialGroupBeatMessage('s', 'reveal', 1000);
    const b = buildSocialGroupBeatMessage('s', 'reveal', 1000);
    expect(a.data.nonce).not.toBe(b.data.nonce);
  });

  it('flag off → zero emission (wsService never touched)', async () => {
    getFeatureFlagMock.mockResolvedValue(false);
    const emitted = await emitSocialGroupBeat('icebreaker_test', 'reveal');
    expect(emitted).toBe(false);
    expect(broadcastSpy).not.toHaveBeenCalled();
    expect(getFeatureFlagMock).toHaveBeenCalledWith('icebreakerGroupBeatsEnabled', false);
  });

  it('flag on → one broadcast to the icebreakerSessionId room', async () => {
    getFeatureFlagMock.mockResolvedValue(true);
    const emitted = await emitSocialGroupBeat('icebreaker_test', 'phase_advanced');
    expect(emitted).toBe(true);
    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    const [room, message] = broadcastSpy.mock.calls[0];
    expect(room).toBe('icebreaker_test');
    expect(message.type).toBe('SOCIAL_GROUP_BEAT');
    expect(message.data.pattern).toBe('nudge');
  });

  it('never throws into the transition when the broadcast fails', async () => {
    getFeatureFlagMock.mockResolvedValue(true);
    broadcastSpy.mockImplementation(() => {
      throw new Error('socket down');
    });
    await expect(emitSocialGroupBeat('icebreaker_test', 'reveal')).resolves.toBe(false);
  });
});

describe('S6 group beats — transitionPhase choke point', () => {
  let broadcastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastSpy = vi.spyOn(wsService, 'broadcastToEvent').mockImplementation(() => {});
  });

  it('emits exactly one nudge beat after a committed phase advance', async () => {
    getFeatureFlagMock.mockResolvedValue(true);
    const result = await transitionPhase({
      state: makeState({ currentPhase: 'warmup', enabledPhases: ['warmup', 'micro_challenge', 'recap'] }),
      socialSessionId: 'social_test',
      trigger: 'host_tap',
    });
    expect(result.transitioned).toBe(true);
    expect(result.nextPhase).toBe('micro_challenge');
    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(broadcastSpy.mock.calls[0][1].data.pattern).toBe('nudge');
    // Emission happened after the state persist (notification layer).
    expect(updateSessionMock).toHaveBeenCalled();
  });

  it('emits a celebration beat when the transition lands in recap', async () => {
    getFeatureFlagMock.mockResolvedValue(true);
    const result = await transitionPhase({
      state: makeState({ currentPhase: 'group_mirror', enabledPhases: ['warmup', 'group_mirror', 'recap'] }),
      socialSessionId: 'social_test',
      trigger: 'early_end_jump',
      targetPhase: 'recap',
    });
    expect(result.transitioned).toBe(true);
    expect(result.nextPhase).toBe('recap');
    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(broadcastSpy.mock.calls[0][1].data.pattern).toBe('celebration');
  });

  it('flag off → transition still succeeds with zero emission', async () => {
    getFeatureFlagMock.mockResolvedValue(false);
    const result = await transitionPhase({
      state: makeState({ currentPhase: 'warmup', enabledPhases: ['warmup', 'micro_challenge', 'recap'] }),
      socialSessionId: 'social_test',
      trigger: 'host_tap',
    });
    expect(result.transitioned).toBe(true);
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
