/**
 * icebreaker-uiux-wave3 — Track B contract tests (AC-04, SEC-01, REL-02).
 *
 * AC-04①: POST /:id/leave — self-state only, idempotent, rejoin fully
 *   restores. Leave never kicks the player from the session, never affects
 *   others, never touches host authority; the only mutation is the
 *   informational `leftUserIds` marker.
 * AC-04②: `hostUnreachable` is derived per poll from the already-loaded
 *   roster's lastSeenAt (zero extra DB queries) using the same 180s
 *   SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS threshold as the manual
 *   /transfer-host claim (semantics unchanged).
 * AC-04③: no auto-advance, no auto host transfer is introduced.
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();

  return {
    SESSION_TTL_MS: 6 * 60 * 60 * 1000,
    PRESENCE_THRESHOLD_MS: 30_000,
    getSocialSessionId: (id: string) => `social_${id}`,
    getSession: async (socialSessionId: string) => sessions.get(socialSessionId) ?? null,
    getSessionWithExpiry: async (socialSessionId: string) => {
      const state = sessions.get(socialSessionId) ?? null;
      return { state, expired: false };
    },
    getSessionByIcebreakerSessionId: async (icebreakerSessionId: string) => {
      const socialSessionId = `social_${icebreakerSessionId}`;
      const state = sessions.get(socialSessionId);
      return state ? { socialSessionId, state, expired: false } : null;
    },
    createSession: async (state: any) => {
      sessions.set(state.socialSessionId, state);
    },
    updateSession: async (socialSessionId: string, state: any) => {
      sessions.set(socialSessionId, state);
    },
    updateSessionAtomic: async (socialSessionId: string, mutator: (state: any) => boolean | void) => {
      const current = sessions.get(socialSessionId);
      if (!current) return { outcome: 'not_found' };
      const draft = JSON.parse(JSON.stringify(current));
      const result = mutator(draft);
      if (result === false) return { outcome: 'aborted', state: current };
      sessions.set(socialSessionId, draft);
      return { outcome: 'updated', state: draft };
    },
    upsertParticipant: async (socialSessionId: string, userId: string, displayName: string) => {
      if (!participants.has(socialSessionId)) participants.set(socialSessionId, new Map());
      const existing = participants.get(socialSessionId)!.get(userId);
      participants.get(socialSessionId)!.set(userId, {
        userId,
        displayName,
        joinedAt: existing?.joinedAt ?? Date.now(),
        lastSeenAt: Date.now(),
      });
    },
    heartbeat: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      if (p) p.lastSeenAt = Date.now();
    },
    getRosterCount: async (socialSessionId: string) => participants.get(socialSessionId)?.size ?? 0,
    getActiveParticipantCount: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return 0;
      const cutoff = Date.now() - 30_000;
      return [...ps.values()].filter((p) => p.lastSeenAt > cutoff).length;
    },
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
    getParticipantLastSeenAt: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? new Date(p.lastSeenAt) : null;
    },
    listParticipants: vi.fn(async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return [];
      const cutoff = Date.now() - 30_000;
      return [...ps.values()]
        .sort((left, right) => left.joinedAt - right.joinedAt)
        .map((participant) => ({
          userId: participant.userId,
          displayName: participant.displayName,
          joinedAt: new Date(participant.joinedAt).toISOString(),
          lastSeenAt: new Date(participant.lastSeenAt).toISOString(),
          isActive: participant.lastSeenAt > cutoff,
        }));
    }),
    transferHost: vi.fn(async () => ({ outcome: 'not_found' })),
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    getPreGenerationResult: vi.fn(async () => null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    getInFlightJobForPhase: vi.fn(async () => null),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    getPhaseMetrics: vi.fn().mockResolvedValue([]),
    computeRecapDwellMs: vi.fn(() => 0),
    recordRecapDwellMetric: vi.fn().mockResolvedValue(undefined),
    renewSessionTtl: vi.fn(async () => true),
    __sessions: sessions,
    __participants: participants,
  };
});

const flagState = { icebreakerContentStatusEnabled: false };
vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async (key: string, fallback = false) =>
    key === 'icebreakerContentStatusEnabled' ? flagState.icebreakerContentStatusEnabled : fallback,
  ),
  getFeatureFlagSync: vi.fn((key: string, fallback = false) =>
    key === 'icebreakerContentStatusEnabled' ? flagState.icebreakerContentStatusEnabled : fallback,
  ),
}));

const aiMeta = {
  generatedAt: '2026-10-16T00:00:00.000Z',
  fromCache: false,
  provider: 'deepseek',
  fallbackUsed: false,
  promptVersion: 'test-v1',
};

vi.mock('../socialIcebreakerAIService', () => ({
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn().mockReturnValue({ valid: true, tags: ['a', 'b'] }),
  validateLieDetectiveTag: vi.fn().mockReturnValue({ valid: true }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
  generateWarmupTopics: vi.fn().mockResolvedValue({
    data: [{ id: 't1', question: 'Q1', mood: 'relaxed', emoji: '🌅', category: 'c', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' }],
    meta: { ...aiMeta, promptVersion: 'social-warmup-topics-v2' },
  }),
  getCuratedWarmupTopics: vi.fn().mockReturnValue([
    { id: 'fallback-1', question: 'FQ', mood: 'relaxed', emoji: '🌿', category: 'c', depthLevel: 1, promptStyle: 'experiential', safety: 'gentle' },
  ]),
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [{ id: 'c1', title: '击掌', description: '和你左边的人击掌', durationSeconds: 30, completionCTA: '完成了' }],
    meta: aiMeta,
  }),
  generateLieDetectiveStatements: vi.fn().mockResolvedValue({
    data: [
      { index: 0, text: 's0', isLie: false },
      { index: 1, text: 's1', isLie: true },
      { index: 2, text: 's2', isLie: false },
    ],
    meta: aiMeta,
  }),
  generateLieDetectiveStatementFromTag: vi.fn().mockResolvedValue({ data: 'stmt', meta: aiMeta }),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: 'ok', meta: aiMeta }),
  generateMomentHighlights: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: aiMeta,
  }),
  generatePersonalityDiceChallenges: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generatePersonalityDiceChallengeGroups: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateAuctionLots: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateUndercoverWordPair: vi.fn().mockResolvedValue({
    data: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
    meta: aiMeta,
  }),
  generateGroupMirrorQuestions: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateQuipBattlePrompts: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateXiaoyueSessionPack: vi.fn().mockResolvedValue({ data: { opener: 'hi' }, meta: aiMeta }),
}));

vi.mock('../socialIcebreakerAuctionAI', () => ({
  resolveAuctionLotsPromptVersion: vi.fn().mockReturnValue('social-auction-lots-v1'),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn(async () => ({ skip: false, reason: 'none' })),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn().mockImplementation(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) return { accepted: false, conflict: 'validation_failed' };
    await apply(_payload);
    return { accepted: true };
  }),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/singleTestService', () => ({
  getSingleTestMetaForSessionStart: vi.fn().mockResolvedValue(null),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
import { getSession, updateSession, upsertParticipant } from '../lib/socialIcebreakerStore';

/** Mock-store read with a non-null assertion (the real module types allow null). */
async function mustGetSession(socialSessionId: string): Promise<any> {
  const state = await getSession(socialSessionId);
  if (!state) throw new Error(`session ${socialSessionId} missing in mock store`);
  return state as any;
}

const LEAVE_SESSION_ID = 'social_wave3-leave';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

async function seedSession(extra: Partial<SocialSessionState> = {}) {
  const state = {
    socialSessionId: LEAVE_SESSION_ID,
    icebreakerSessionId: 'wave3-leave',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 3,
    phaseStartedAt: Date.now() - 60_000,
    sessionStartedAt: Date.now() - 300_000,
    completedPhases: [],
    warmupTopics: [{ id: 't1', question: 'Q1' }],
    warmupTopicsStatus: 'ready',
    warmupReadyUserIds: ['player-2'],
    ...extra,
  } as unknown as SocialSessionState;
  await updateSession(LEAVE_SESSION_ID, state);
  await upsertParticipant(LEAVE_SESSION_ID, 'host-user', 'Host');
  await upsertParticipant(LEAVE_SESSION_ID, 'player-2', 'Player Two');
  await upsertParticipant(LEAVE_SESSION_ID, 'player-3', 'Player Three');
  return state;
}

async function postLeave(baseUrl: string, cookie: string, body: unknown = {}) {
  return fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  flagState.icebreakerContentStatusEnabled = false;
});

describe.sequential('Wave 3 AC-04①: POST /:id/leave (self-state, idempotent, rejoin restores)', () => {
  it('requires authentication', async () => {
    await seedSession();
    await withServer(async (baseUrl) => {
      const response = await postLeave(baseUrl, '');
      expect(response.status).toBe(401);
    });
  });

  it('rejects non-participants with 403 and never mutates state', async () => {
    await seedSession();
    await withServer(async (baseUrl) => {
      const strangerCookie = await login(baseUrl, 'stranger');
      const response = await postLeave(baseUrl, strangerCookie);
      expect(response.status).toBe(403);
      const body = await response.json() as any;
      expect(body.code).toBe('NOT_A_PARTICIPANT');
      const persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(persisted.leftUserIds ?? []).toEqual([]);
    });
  });

  it('marks only the caller, is idempotent, and never touches host/phase/other state', async () => {
    const before = await seedSession();
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');

      const first = await postLeave(baseUrl, playerCookie);
      expect(first.status).toBe(200);
      let persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(persisted.leftUserIds).toEqual(['player-2']);
      // Nothing else moved: host, phase, roster counts, gameplay state.
      expect(persisted.hostUserId).toBe(before.hostUserId);
      expect(persisted.currentPhase).toBe(before.currentPhase);
      expect(persisted.playerCount).toBe(before.playerCount);
      expect(persisted.warmupReadyUserIds).toEqual(['player-2']);

      // Idempotent: a second leave keeps exactly one marker.
      const second = await postLeave(baseUrl, playerCookie);
      expect(second.status).toBe(200);
      persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(persisted.leftUserIds).toEqual(['player-2']);

      // Another player leaving adds only their own marker (self-state only).
      const otherCookie = await login(baseUrl, 'player-3');
      const third = await postLeave(baseUrl, otherCookie);
      expect(third.status).toBe(200);
      persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(new Set(persisted.leftUserIds)).toEqual(new Set(['player-2', 'player-3']));
    });
  });

  it('rejoin ({left:false}) restores full state — only the marker clears', async () => {
    await seedSession();
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      await postLeave(baseUrl, playerCookie);
      expect((await mustGetSession(LEAVE_SESSION_ID)).leftUserIds).toEqual(['player-2']);

      const rejoin = await postLeave(baseUrl, playerCookie, { left: false });
      expect(rejoin.status).toBe(200);
      const persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(persisted.leftUserIds ?? []).toEqual([]);
      // Full restore: everything the player had (ready mark) is intact —
      // leave never mutated it in the first place.
      expect(persisted.warmupReadyUserIds).toEqual(['player-2']);
      expect(persisted.warmupTopicsStatus).toBe('ready');

      // Rejoin is idempotent too (already back).
      const rejoinAgain = await postLeave(baseUrl, playerCookie, { left: false });
      expect(rejoinAgain.status).toBe(200);
      expect((await mustGetSession(LEAVE_SESSION_ID)).leftUserIds ?? []).toEqual([]);
    });
  });

  it('returns 404 for an unknown session and 410 semantics stay with resolveSession', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_never-existed/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(404);
    });
  });

  it('AC-04③: leave performs no auto-advance and no host transfer even when the host leaves', async () => {
    await seedSession();
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await postLeave(baseUrl, hostCookie);
      expect(response.status).toBe(200);
      const persisted = await mustGetSession(LEAVE_SESSION_ID);
      expect(persisted.leftUserIds).toEqual(['host-user']);
      // Host authority is untouched — no transfer, no phase movement.
      expect(persisted.hostUserId).toBe('host-user');
      expect(persisted.currentPhase).toBe('warmup');
      expect(persisted.completedPhases).toEqual([]);
    });
  });

  it('SEC-01: leftUserIds is a client-visible marker only when the Wave-3 flag is on', async () => {
    await seedSession({ leftUserIds: ['player-3'] });
    flagState.icebreakerContentStatusEnabled = true;
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      const body = await response.json() as any;
      expect(body.leftUserIds).toEqual(['player-3']);
    });
  });
});

describe.sequential('Wave 3 AC-04②: hostUnreachable derivation', () => {
  it('is false while the host heartbeat is fresh and true past the 180s grace', async () => {
    flagState.icebreakerContentStatusEnabled = true;
    await seedSession();
    const store = await import('../lib/socialIcebreakerStore');
    const participants = (store as any).__participants as Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>;

    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');

      // Fresh host heartbeat (the seed just upserted it) → reachable.
      let response = await fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      let body = await response.json() as any;
      expect(body.hostUnreachable).toBe(false);

      // Age the host heartbeat past SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS.
      participants.get(LEAVE_SESSION_ID)!.get('host-user')!.lastSeenAt = Date.now() - 181_000;
      response = await fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      body = await response.json() as any;
      expect(body.hostUnreachable).toBe(true);

      // Host comes back (fresh heartbeat) → reachable again.
      participants.get(LEAVE_SESSION_ID)!.get('host-user')!.lastSeenAt = Date.now();
      response = await fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      body = await response.json() as any;
      expect(body.hostUnreachable).toBe(false);
    });
  });

  it('never fabricates the signal for anonymous polls and stays absent when the flag is off', async () => {
    flagState.icebreakerContentStatusEnabled = false;
    await seedSession();
    const store = await import('../lib/socialIcebreakerStore');
    const participants = (store as any).__participants as Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>;
    participants.get(LEAVE_SESSION_ID)!.get('host-user')!.lastSeenAt = Date.now() - 999_000;
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${LEAVE_SESSION_ID}`);
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body).not.toHaveProperty('hostUnreachable');
    });
  });
});
