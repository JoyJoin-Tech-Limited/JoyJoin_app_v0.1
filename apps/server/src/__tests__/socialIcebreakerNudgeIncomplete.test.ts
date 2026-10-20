/**
 * Host nudge-incomplete (「还差 N 人」) route tests.
 *
 * Route under test:
 *   POST /api/social-icebreaker/:id/nudge-incomplete
 *
 * Contract coverage:
 *   - Auth semantics: 401 unauthenticated, 404/410 via resolveSession,
 *     403 HOST_ONLY for non-hosts, 403 NOT_A_PARTICIPANT for a host with no
 *     roster row.
 *   - Per-phase target sets (warmup / lie_detective / undercover_word /
 *     group_mirror / quip_battle / personality_dice), guard-consistent
 *     universe (roster snapshot − departed; live roster fallback).
 *   - State-free: a successful nudge leaves the persisted session byte-identical.
 *   - Rate limit: one nudge per host per session per 30s → 429; a
 *     NUDGE_NOT_APPLICABLE 400 does NOT consume the slot.
 *   - NUDGE_NOT_APPLICABLE for phases without a primary-submission concept
 *     and for the all-complete case.
 *   - Emission: targeted broadcastToUsers with the state-free nudge payload,
 *     gated by `icebreakerGroupBeatsEnabled` (flag off → 200, beatEmitted false).
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  const expiredSessions = new Set<string>();
  return { sessions, participants, expiredSessions };
});

const featureFlagCtx = vi.hoisted(() => ({
  getFeatureFlagMock: vi.fn(async (_key: string, fallback?: boolean) => fallback ?? false),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: featureFlagCtx.getFeatureFlagMock,
}));

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants, expiredSessions } = storeCtx;
  return {
    SESSION_TTL_MS: 6 * 60 * 60 * 1000,
    PRESENCE_THRESHOLD_MS: 30_000,
    getSocialSessionId: (id: string) => `social_${id}`,
    getSession: async (socialSessionId: string) => sessions.get(socialSessionId) ?? null,
    getSessionWithExpiry: async (socialSessionId: string) => ({
      state: sessions.get(socialSessionId) ?? null,
      expired: expiredSessions.has(socialSessionId),
    }),
    createSession: async (state: SocialSessionState) => {
      sessions.set(state.socialSessionId, state);
    },
    updateSession: async (socialSessionId: string, state: SocialSessionState) => {
      sessions.set(socialSessionId, state);
    },
    upsertParticipant: async () => {},
    heartbeat: async () => {},
    getRosterCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      return typeof st?.playerCount === 'number' ? st.playerCount : (participants.get(socialSessionId)?.size ?? 0);
    },
    getActiveParticipantCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      return typeof st?.playerCount === 'number' ? st.playerCount : (participants.get(socialSessionId)?.size ?? 0);
    },
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
    getParticipantLastSeenAt: async (socialSessionId: string, userId: string) => {
      const participant = participants.get(socialSessionId)?.get(userId);
      return participant ? new Date(participant.lastSeenAt) : null;
    },
    listParticipants: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return [];
      return [...ps.values()].map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        joinedAt: new Date(participant.joinedAt).toISOString(),
        lastSeenAt: new Date(participant.lastSeenAt).toISOString(),
        isActive: true,
      }));
    },
    transferHost: vi.fn(),
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    setMiniScriptSecrets: vi.fn(),
    getMiniScriptSecrets: vi.fn(),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    computeRecapDwellMs: vi.fn(() => 0),
    recordRecapDwellMetric: vi.fn(),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  generateLieDetectiveStatementFromTag: vi.fn(),
  validateLieDetectiveTag: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: '今晚到这儿，刚刚好', closingLine: '', moments: [] },
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  }),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
  getCuratedWarmupTopics: vi.fn(() => []),
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
}));

vi.mock('../socialIcebreakerAuctionAI', () => ({
  resolveAuctionLotsPromptVersion: vi.fn(() => 'social-auction-lots-v1'),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  getBots: vi.fn(() => []),
  simulateBotsForSession: vi.fn().mockResolvedValue(undefined),
  runBotSimulationSafely: vi.fn().mockResolvedValue(undefined),
  seedSingleTestBotsWarmupReady: vi.fn(),
}));

vi.mock('../lib/lieDetectiveSubmission', () => ({
  buildCustomLieDetectiveStatements: vi.fn(),
  resolveLieDetectiveTargetUserId: vi.fn(),
}));

vi.mock('../lib/contentSafety', () => ({
  validateContentSafeAsync: vi.fn(async () => ({ safe: true })),
  contentViolationResponse: vi.fn(),
}));

vi.mock('../abuseDetection', () => ({
  recordViolation: vi.fn(async () => {}),
}));

const { registerExtendedRoutes } = await import('../routes/socialIcebreakerExtended');
const { __resetNudgeIncompleteRateLimitForTests, NUDGE_INCOMPLETE_MIN_INTERVAL_MS } = await import(
  '../lib/socialGroupBeats'
);
const { wsService } = await import('../wsService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.post('/__test__/login/:userId', (req, res) => {
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  const router = express.Router();
  registerExtendedRoutes(router);
  app.use('/api/social-icebreaker', router);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response): string {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

const ROSTER = [
  { userId: 'host-user', displayName: 'Host' },
  { userId: 'p1', displayName: 'P1' },
  { userId: 'p2', displayName: 'P2' },
  { userId: 'p3', displayName: 'P3' },
] as const;

function seedSession(
  socialSessionId: string,
  phase: SocialSessionState['currentPhase'],
  overrides: Partial<SocialSessionState> = {},
): SocialSessionState {
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: `icebreaker_${socialSessionId}`,
    currentPhase: phase,
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: ROSTER.length,
    phaseStartedAt: Date.now() - 120_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: [],
    eventTier: 'glow',
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
  storeCtx.sessions.set(socialSessionId, state);
  storeCtx.participants.set(
    socialSessionId,
    new Map(
      ROSTER.map((member) => [
        member.userId,
        { userId: member.userId, displayName: member.displayName, joinedAt: Date.now(), lastSeenAt: Date.now() },
      ]),
    ),
  );
  return state;
}

async function postNudge(baseUrl: string, socialSessionId: string, cookie?: string) {
  return fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/nudge-incomplete`, {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
  });
}

let broadcastToUsersSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
  storeCtx.expiredSessions.clear();
  featureFlagCtx.getFeatureFlagMock.mockReset();
  // Default ON for `icebreakerGroupBeatsEnabled` so emission-path tests
  // exercise the broadcast; the gating describe-block overrides this.
  featureFlagCtx.getFeatureFlagMock.mockImplementation(async (key: string, fallback?: boolean) =>
    key === 'icebreakerGroupBeatsEnabled' ? true : (fallback ?? false),
  );
  __resetNudgeIncompleteRateLimitForTests();
  // wsService is a module singleton: restore any prior spy wrapper so call
  // history never leaks between tests, then install a fresh spy.
  vi.restoreAllMocks();
  broadcastToUsersSpy = vi.spyOn(wsService, 'broadcastToUsers').mockImplementation(() => {});
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — auth gates', () => {
  it('401 when unauthenticated', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-auth-1', 'warmup');
      const response = await postNudge(baseUrl, 'nudge-auth-1');
      expect(response.status).toBe(401);
    });
  });

  it('404 when the session does not exist', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-missing', cookie);
      expect(response.status).toBe(404);
    });
  });

  it('410 when the session is expired', async () => {
    await withServer(async (baseUrl) => {
      storeCtx.expiredSessions.add('nudge-expired');
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-expired', cookie);
      expect(response.status).toBe(410);
    });
  });

  it('403 HOST_ONLY when the caller is a participant but not the host', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-auth-2', 'warmup', { warmupReadyUserIds: ['p1'] });
      const cookie = await login(baseUrl, 'p1');
      const response = await postNudge(baseUrl, 'nudge-auth-2', cookie);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe('HOST_ONLY');
      expect(broadcastToUsersSpy).not.toHaveBeenCalled();
    });
  });

  it('403 NOT_A_PARTICIPANT when the host has no roster row', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-auth-3', 'warmup', { warmupReadyUserIds: ['p1'] });
      storeCtx.participants.get('nudge-auth-3')!.delete('host-user');
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-auth-3', cookie);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe('NOT_A_PARTICIPANT');
      expect(broadcastToUsersSpy).not.toHaveBeenCalled();
    });
  });
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — per-phase target sets', () => {
  it('warmup: nudges exactly the not-ready participants', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-warmup', 'warmup', { warmupReadyUserIds: ['host-user', 'p1'] });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-warmup', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        ok: true,
        phase: 'warmup',
        segmentName: '话题卡',
        missingCount: 2,
        beatEmitted: true,
      });
      expect(broadcastToUsersSpy).toHaveBeenCalledTimes(1);
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['p2', 'p3']);
      expect(message.type).toBe('SOCIAL_GROUP_BEAT');
      expect(message.eventId).toBe('icebreaker_nudge-warmup');
      expect(message.data.pattern).toBe('nudge');
      expect(message.data.sessionId).toBe('icebreaker_nudge-warmup');
      expect(message.data.nudge).toEqual({ phase: 'warmup', missingCount: 2, segmentName: '话题卡' });
      expect(typeof message.data.nonce).toBe('string');
      expect(typeof message.data.sentAt).toBe('number');
    });
  });

  it('lie_detective: nudges participants who have not submitted statements', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-lie', 'lie_detective', {
        lieDetectivePlayers: [
          { userId: 'host-user', displayName: 'Host', statements: [{ index: 1, text: 'a' }] },
          { userId: 'p2', displayName: 'P2', statements: [{ index: 1, text: 'b' }] },
        ],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-lie', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(2);
      expect(body.segmentName).toBe('谎言侦探');
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['p1', 'p3']);
      expect(message.data.nudge).toEqual({ phase: 'lie_detective', missingCount: 2, segmentName: '谎言侦探' });
    });
  });

  it('undercover_word: nudges participants missing from the current round descriptions', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-undercover', 'undercover_word', {
        undercoverWordCurrentRound: 1,
        undercoverWordRounds: [
          { roundNumber: 1, descriptions: [{ userId: 'p1', displayName: 'P1', text: 'round one' }] },
          { roundNumber: 2, descriptions: [{ userId: 'host-user', displayName: 'Host', text: 'round two' }] },
        ],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-undercover', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      // Only the CURRENT round (index 1) counts — p1's round-1 description does not complete round 2.
      expect(body.missingCount).toBe(3);
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['p1', 'p2', 'p3']);
      expect(message.data.nudge).toEqual({ phase: 'undercover_word', missingCount: 3, segmentName: '谁是卧底' });
    });
  });

  it('group_mirror: nudges participants who have not voted', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-mirror', 'group_mirror', {
        groupMirrorSubmittedUserIds: ['p1', 'p2'],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-mirror', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(2);
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['host-user', 'p3']);
      expect(message.data.nudge).toEqual({ phase: 'group_mirror', missingCount: 2, segmentName: '群像镜像' });
    });
  });

  it('quip_battle: nudges participants missing from the answer map', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-quip', 'quip_battle', {
        quipBattleSubmittedUserIds: ['host-user', 'p1'],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-quip', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(2);
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['p2', 'p3']);
      expect(message.data.nudge).toEqual({ phase: 'quip_battle', missingCount: 2, segmentName: '机智对决' });
    });
  });

  it('personality_dice: nudges challenge-group members who have not chosen a difficulty', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-dice', 'personality_dice', {
        personalityDiceChallengeGroups: ROSTER.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          dominantTrait: 'E' as const,
          options: [],
        })),
        diceSelectedOption: { p1: 0, p3: 2 },
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-dice', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(2);
      const [targetUserIds, message] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds].sort()).toEqual(['host-user', 'p2']);
      expect(message.data.nudge).toEqual({ phase: 'personality_dice', missingCount: 2, segmentName: '人格骰子' });
    });
  });

  it('personality_dice without challenge groups → NUDGE_NOT_APPLICABLE (concept inactive)', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-dice-na', 'personality_dice', {});
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-dice-na', cookie);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('NUDGE_NOT_APPLICABLE');
    });
  });

  it('scopes the universe to the phase roster snapshot and excludes departed members', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-scoped', 'quip_battle', {
        // p3 joined late (not in the snapshot) and p2 opted out — neither is
        // someone the advance guard waits on, so neither is nudged.
        phaseRosterSnapshot: ['host-user', 'p1', 'p2'],
        phaseOptOutUserIds: ['p2'],
        quipBattleSubmittedUserIds: ['host-user'],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-scoped', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(1);
      const [targetUserIds] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds]).toEqual(['p1']);
    });
  });

  it('includes the host in the target set when the host themselves has not submitted', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-host-missing', 'warmup', { warmupReadyUserIds: ['p1', 'p2', 'p3'] });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-host-missing', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.missingCount).toBe(1);
      const [targetUserIds] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds]).toEqual(['host-user']);
    });
  });
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — state-free guarantee', () => {
  it('leaves the persisted session byte-identical after a successful nudge', async () => {
    await withServer(async (baseUrl) => {
      const state = seedSession('nudge-statefree', 'quip_battle', {
        quipBattleSubmittedUserIds: ['host-user', 'p1'],
      });
      const before = JSON.stringify(state);
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-statefree', cookie);
      expect(response.status).toBe(200);
      const stored = storeCtx.sessions.get('nudge-statefree');
      expect(stored).toBe(state);
      expect(JSON.stringify(stored)).toBe(before);
    });
  });
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — rate limit', () => {
  it('429 on the second nudge within 30s, with retryAfterMs', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-rl', 'warmup', { warmupReadyUserIds: ['p1'] });
      const cookie = await login(baseUrl, 'host-user');

      const first = await postNudge(baseUrl, 'nudge-rl', cookie);
      expect(first.status).toBe(200);

      const second = await postNudge(baseUrl, 'nudge-rl', cookie);
      expect(second.status).toBe(429);
      const body = await second.json();
      expect(body.code).toBe('NUDGE_RATE_LIMITED');
      expect(body.retryAfterMs).toBeGreaterThan(0);
      expect(body.retryAfterMs).toBeLessThanOrEqual(NUDGE_INCOMPLETE_MIN_INTERVAL_MS);
      // Only the first nudge emitted a beat.
      expect(broadcastToUsersSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('rate limit is per session: a different session is not throttled', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-rl-a', 'warmup', { warmupReadyUserIds: ['p1'] });
      seedSession('nudge-rl-b', 'warmup', { warmupReadyUserIds: ['p1'] });
      const cookie = await login(baseUrl, 'host-user');

      expect((await postNudge(baseUrl, 'nudge-rl-a', cookie)).status).toBe(200);
      expect((await postNudge(baseUrl, 'nudge-rl-b', cookie)).status).toBe(200);
      expect(broadcastToUsersSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('a NUDGE_NOT_APPLICABLE 400 does not consume the rate slot', async () => {
    await withServer(async (baseUrl) => {
      const state = seedSession('nudge-rl-na', 'recap');
      const cookie = await login(baseUrl, 'host-user');

      const notApplicable = await postNudge(baseUrl, 'nudge-rl-na', cookie);
      expect(notApplicable.status).toBe(400);

      state.currentPhase = 'warmup';
      state.warmupReadyUserIds = ['p1'];
      const applicable = await postNudge(baseUrl, 'nudge-rl-na', cookie);
      expect(applicable.status).toBe(200);
      expect(broadcastToUsersSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — NUDGE_NOT_APPLICABLE', () => {
  it.each([
    ['phase_selection'],
    ['micro_challenge'],
    ['speed_friending'],
    ['auction'],
    ['mini_script'],
    ['recap'],
  ] as const)('400 for phase %s (no primary-submission concept)', async (phase) => {
    await withServer(async (baseUrl) => {
      seedSession(`nudge-na-${phase}`, phase);
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, `nudge-na-${phase}`, cookie);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('NUDGE_NOT_APPLICABLE');
      expect(body.phase).toBe(phase);
      expect(broadcastToUsersSpy).not.toHaveBeenCalled();
    });
  });

  it('400 when everyone has already completed the primary submission', async () => {
    await withServer(async (baseUrl) => {
      seedSession('nudge-all-done', 'warmup', {
        warmupReadyUserIds: ['host-user', 'p1', 'p2', 'p3'],
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-all-done', cookie);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('NUDGE_NOT_APPLICABLE');
      expect(broadcastToUsersSpy).not.toHaveBeenCalled();
    });
  });
});

describe('POST /api/social-icebreaker/:id/nudge-incomplete — emission gating', () => {
  it('flag off → 200 with beatEmitted false and zero broadcast', async () => {
    await withServer(async (baseUrl) => {
      featureFlagCtx.getFeatureFlagMock.mockImplementation(async () => false);
      seedSession('nudge-flag-off', 'warmup', { warmupReadyUserIds: ['p1'] });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-flag-off', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ ok: true, missingCount: 3, beatEmitted: false });
      expect(broadcastToUsersSpy).not.toHaveBeenCalled();
      expect(featureFlagCtx.getFeatureFlagMock).toHaveBeenCalledWith('icebreakerGroupBeatsEnabled', false);
    });
  });

  it('flag on → targeted beat broadcast to the missing users only', async () => {
    await withServer(async (baseUrl) => {
      featureFlagCtx.getFeatureFlagMock.mockImplementation(async (_key: string, fallback?: boolean) =>
        _key === 'icebreakerGroupBeatsEnabled' ? true : (fallback ?? false),
      );
      seedSession('nudge-flag-on', 'warmup', { warmupReadyUserIds: ['host-user', 'p1', 'p3'] });
      const cookie = await login(baseUrl, 'host-user');
      const response = await postNudge(baseUrl, 'nudge-flag-on', cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.beatEmitted).toBe(true);
      expect(broadcastToUsersSpy).toHaveBeenCalledTimes(1);
      const [targetUserIds] = broadcastToUsersSpy.mock.calls[0];
      expect([...targetUserIds]).toEqual(['p2']);
    });
  });
});
