/**
 * Undercover Word Phase Tests
 *
 * Routes under test:
 *   POST /api/social-icebreaker/:socialSessionId/undercover-word/generate
 *   POST /api/social-icebreaker/:socialSessionId/undercover-word/describe
 *   POST /api/social-icebreaker/:socialSessionId/undercover-word/vote
 *   POST /api/social-icebreaker/:socialSessionId/undercover-word/reveal
 *   POST /api/social-icebreaker/:socialSessionId/undercover-word/next-round
 */
import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  const lieTruthsStore = new Map<string, Map<string, unknown[]>>();
  return { sessions, participants, lieTruthsStore };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants, lieTruthsStore } = storeCtx;
  return {
    SESSION_TTL_MS: 6 * 60 * 60 * 1000,
    PRESENCE_THRESHOLD_MS: 30_000,
    getSocialSessionId: (id: string) => `social_${id}`,
    getSession: async (socialSessionId: string) => sessions.get(socialSessionId) ?? null,
    getSessionWithExpiry: async (socialSessionId: string) => ({
      state: sessions.get(socialSessionId) ?? null,
      expired: false,
    }),
    getSessionByIcebreakerSessionId: async (icebreakerSessionId: string) => {
      const socialSessionId = `social_${icebreakerSessionId}`;
      const state = sessions.get(socialSessionId);
      return state ? { socialSessionId, state, expired: false } : null;
    },
    createSession: async (st: SocialSessionState) => {
      sessions.set(st.socialSessionId, st);
    },
    updateSession: async (socialSessionId: string, st: SocialSessionState) => {
      sessions.set(socialSessionId, st);
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
    heartbeat: async (_sid: string, _uid: string) => {},
    getRosterCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
      return participants.get(socialSessionId)?.size ?? 0;
    },
    getActiveParticipantCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
      const ps = participants.get(socialSessionId);
      if (!ps) return 0;
      const cutoff = Date.now() - 30_000;
      return [...ps.values()].filter((p) => p.lastSeenAt > cutoff).length;
    },
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
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
    setLieTruths: async (socialSessionId: string, userId: string, truths: unknown[]) => {
      if (!lieTruthsStore.has(socialSessionId)) lieTruthsStore.set(socialSessionId, new Map());
      lieTruthsStore.get(socialSessionId)!.set(userId, truths);
    },
    getLieTruths: async (socialSessionId: string, userId: string) =>
      lieTruthsStore.get(socialSessionId)?.get(userId) ?? null,
    loadSessionLieTruths: async (socialSessionId: string) => {
      const m = lieTruthsStore.get(socialSessionId);
      if (!m) return new Map();
      return new Map(m.entries());
    },
    getPreGenerationResult: vi.fn().mockResolvedValue(null),
    getInFlightJobForPhase: vi.fn().mockResolvedValue(null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn(),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

const seenOps = vi.hoisted(() => new Set<string>());

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn(async (payload: any, validate: () => Promise<boolean>, apply: () => Promise<void>) => {
    const seen = seenOps;
    if (seen.has(payload.operationId)) {
      return { accepted: true };
    }
    const valid = await validate();
    if (!valid) {
      return { accepted: false, conflict: 'validation_failed' };
    }
    await apply();
    seen.add(payload.operationId);
    return { accepted: true };
  }),
}));

vi.mock('../rateLimiter', () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
  momentCardLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../contentFilter', () => ({
  filterContent: (text: string) => text,
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
const { generateUndercoverWordPair } = await import('../socialIcebreakerAIService');
const { shouldSkipOnDemandGeneration } = await import('../jobs/preGenerationQueue');
const { getPreGenerationResult } = await import('../lib/socialIcebreakerStore');

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
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  return app;
}

function cookieHeader(response: Response): string {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    const addr = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function baseUndercoverSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: overrides.socialSessionId ?? 'social_uw-test',
    icebreakerSessionId: 'uw-test',
    currentPhase: 'undercover_word',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'glow',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'undercover_word', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: GLOW_RUN_PLAN,
    ...overrides,
  };
}

function seedUndercoverParticipants(socialSessionId: string): void {
  const pmap = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  pmap.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now() - 10000, lastSeenAt: Date.now() });
  pmap.set('guest-1', { userId: 'guest-1', displayName: 'Alice', joinedAt: Date.now() - 8000, lastSeenAt: Date.now() });
  pmap.set('guest-2', { userId: 'guest-2', displayName: 'Bob', joinedAt: Date.now() - 6000, lastSeenAt: Date.now() });
  pmap.set('guest-3', { userId: 'guest-3', displayName: 'Carol', joinedAt: Date.now() - 4000, lastSeenAt: Date.now() });
  storeCtx.participants.set(socialSessionId, pmap);
}

function seedUndercoverSession(
  socialSessionId: string,
  opts?: {
    phase?: string;
    withPair?: boolean;
    withDescriptions?: boolean;
    undercoverUserId?: string;
  },
): void {
  const state = baseUndercoverSession({
    socialSessionId,
    currentPhase: (opts?.phase as SocialSessionState['currentPhase']) ?? 'undercover_word',
  });

  if (opts?.withPair) {
    state.undercoverWordPair = {
      civilianWord: '奶茶',
      undercoverWord: '咖啡',
      category: '饮品',
    };
    state.undercoverWordPairMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
      promptVersion: 'social-undercover-word-v1',
    };
    state.undercoverUserId = opts.undercoverUserId ?? 'guest-2';
    state.undercoverWordRounds = [];
    state.undercoverWordCurrentRound = 0;
    state.undercoverWordVotes = [];
    state.undercoverWordVotedUserIds = [];
    state.undercoverWordRevealed = false;
    state.undercoverWordResults = undefined;

    if (opts?.withDescriptions) {
      state.undercoverWordRounds = [
        {
          roundNumber: 1,
          descriptions: [
            { userId: 'host-user', displayName: 'Host', text: '甜甜的饮料' },
            { userId: 'guest-1', displayName: 'Alice', text: '下午茶必备' },
            { userId: 'guest-2', displayName: 'Bob', text: '有点苦但有提神效果' },
            { userId: 'guest-3', displayName: 'Carol', text: '夏天喝凉的冬天喝热的' },
          ],
        },
      ];
    }
  }

  storeCtx.sessions.set(socialSessionId, state);
  seedUndercoverParticipants(socialSessionId);
}

// --- POST /undercover-word/generate ---

describe('POST /api/social-icebreaker/:id/undercover-word/generate', () => {
  beforeEach(() => {
    vi.mocked(generateUndercoverWordPair).mockReset();
    vi.mocked(generateUndercoverWordPair).mockResolvedValue({
      data: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-undercover-word-v1',
      },
    });
    vi.mocked(shouldSkipOnDemandGeneration).mockReset();
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
    vi.mocked(getPreGenerationResult).mockReset();
    vi.mocked(getPreGenerationResult).mockResolvedValue(null);
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_uw-gen-401';
    seedUndercoverSession(id);
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_uw-gen-403';
    seedUndercoverSession(id);
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in undercover_word phase', async () => {
    const id = 'social_uw-gen-phase';
    seedUndercoverSession(id, { phase: 'warmup' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Not in undercover_word phase');
    });
  });

  it('returns 400 when word pair already generated', async () => {
    const id = 'social_uw-gen-already';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Word pair already generated');
    });
  });

  it('generates word pair and assigns undercover to a random player', async () => {
    const id = 'social_uw-gen-200';
    seedUndercoverSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.pair.civilianWord).toBe('奶茶');
      expect(body.pair.undercoverWord).toBe('咖啡');
      expect(body.undercoverAssigned).toBe(true);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordPair).toBeDefined();
      expect(stored?.undercoverUserId).toBeDefined();
      expect(stored?.undercoverWordCurrentRound).toBe(0);
      expect(stored?.undercoverWordVotes).toEqual([]);
      expect(stored?.undercoverWordRevealed).toBe(false);
    });
  });

  it('only one player gets the undercover word', async () => {
    const id = 'social_uw-gen-one';
    seedUndercoverSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverUserId).toBeDefined();
      // undercoverUserId must be one of the participants
      expect(['host-user', 'guest-1', 'guest-2', 'guest-3']).toContain(stored?.undercoverUserId);
    });
  });

  it('returns 200 with pre-generated result when available', async () => {
    const id = 'social_uw-gen-pregen';
    seedUndercoverSession(id);
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
    vi.mocked(getPreGenerationResult).mockResolvedValue({
      contentJson: { civilianWord: '火锅', undercoverWord: '烧烤', category: '美食' },
      aiMeta: {
        generatedAt: new Date().toISOString(),
        fromCache: true,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-undercover-word-v1',
      },
    });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.pair.civilianWord).toBe('火锅');
      expect(body.pair.undercoverWord).toBe('烧烤');
      expect(generateUndercoverWordPair).not.toHaveBeenCalled();
    });
  });

  it('returns 202 when pre-generation is in-flight', async () => {
    const id = 'social_uw-gen-inflight';
    seedUndercoverSession(id);
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(202);
      const body = await res.json() as any;
      expect(body.status).toBe('generating');
    });
  });
});

// --- POST /undercover-word/describe ---

describe('POST /api/social-icebreaker/:id/undercover-word/describe', () => {
  beforeEach(() => {
    seenOps.clear();
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_uw-desc-401';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '甜甜的饮料' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for empty text', async () => {
    const id = 'social_uw-desc-empty';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ text: '' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('player can submit a description', async () => {
    const id = 'social_uw-desc-ok';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ text: '甜甜的，喝了心情好' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.submitted).toBe(true);
      expect(body.round).toBe(1);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordRounds).toHaveLength(1);
      expect(stored?.undercoverWordRounds![0].descriptions).toHaveLength(1);
      expect(stored?.undercoverWordRounds![0].descriptions[0].userId).toBe('guest-1');
    });
  });

  it('multiple players can submit descriptions in same round', async () => {
    const id = 'social_uw-desc-multi';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');

      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ text: '提神醒脑' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ text: '下午茶必备' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ text: '有点苦苦的' }),
      });

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordRounds![0].descriptions).toHaveLength(3);
    });
  });
});

// --- POST /undercover-word/vote ---

describe('POST /api/social-icebreaker/:id/undercover-word/vote', () => {
  beforeEach(() => {
    seenOps.clear();
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_uw-vote-401';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'guest-2' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for missing targetUserId', async () => {
    const id = 'social_uw-vote-notarget';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  it('player can submit a vote', async () => {
    const id = 'social_uw-vote-ok';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ targetUserId: 'guest-2' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.voted).toBe(true);
      expect(body.totalVotes).toBe(1);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordVotes).toHaveLength(1);
      expect(stored?.undercoverWordVotes![0].voterId).toBe('guest-1');
      expect(stored?.undercoverWordVotes![0].targetUserId).toBe('guest-2');
    });
  });

  it('multiple players can vote, counts accumulate', async () => {
    const id = 'social_uw-vote-multi';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest3Cookie = await login(baseUrl, 'guest-3');

      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ targetUserId: 'guest-2' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'guest-2' }),
      });
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest3Cookie },
        body: JSON.stringify({ targetUserId: 'guest-1' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.totalVotes).toBe(3);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordVotes).toHaveLength(3);
    });
  });
});

// --- POST /undercover-word/reveal ---

describe('POST /api/social-icebreaker/:id/undercover-word/reveal', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_uw-rev-401';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    // Pre-populate votes: 3 votes for guest-2
    const s = storeCtx.sessions.get(id)!;
    s.undercoverWordVotes = [
      { voterId: 'host-user', targetUserId: 'guest-2' },
      { voterId: 'guest-1', targetUserId: 'guest-2' },
      { voterId: 'guest-3', targetUserId: 'guest-2' },
    ];
    s.undercoverWordVotedUserIds = ['host-user', 'guest-1', 'guest-3'];
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/reveal`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_uw-rev-403';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true, undercoverUserId: 'guest-2' });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/reveal`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('reveals and marks undercover as caught when majority voted correctly', async () => {
    const id = 'social_uw-rev-caught';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true, undercoverUserId: 'guest-2' });
    // Majority votes for the undercover
    const s = storeCtx.sessions.get(id)!;
    s.undercoverWordVotes = [
      { voterId: 'host-user', targetUserId: 'guest-2' },
      { voterId: 'guest-1', targetUserId: 'guest-2' },
      { voterId: 'guest-3', targetUserId: 'guest-2' },
    ];
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/reveal`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.revealed).toBe(true);
      expect(body.result.caught).toBe(true);
      expect(body.result.undercoverUserId).toBe('guest-2');
      expect(body.result.civilianWord).toBe('奶茶');
      expect(body.result.undercoverWord).toBe('咖啡');
      expect(body.result.voteCounts['guest-2']).toBe(3);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.undercoverWordRevealed).toBe(true);
    });
  });

  it('undercover survives when votes are split', async () => {
    const id = 'social_uw-rev-survives';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true, undercoverUserId: 'guest-2' });
    const s = storeCtx.sessions.get(id)!;
    s.undercoverWordVotes = [
      { voterId: 'host-user', targetUserId: 'guest-1' },
      { voterId: 'guest-1', targetUserId: 'guest-3' },
      { voterId: 'guest-3', targetUserId: 'guest-1' },
    ];
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/reveal`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.result.caught).toBe(false);
      expect(body.result.voteCounts['guest-1']).toBe(2); // top voted but not undercover
    });
  });

  it('handles reveal with no votes', async () => {
    const id = 'social_uw-rev-novotes';
    seedUndercoverSession(id, { withPair: true, undercoverUserId: 'guest-2' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/reveal`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.revealed).toBe(true);
      expect(body.result.caught).toBe(false);
      expect(Object.keys(body.result.voteCounts).length).toBe(0);
    });
  });
});

// --- POST /undercover-word/next-round ---

describe('POST /api/social-icebreaker/:id/undercover-word/next-round', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_uw-next-401';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_uw-next-403';
    seedUndercoverSession(id, { withPair: true, withDescriptions: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in undercover_word phase', async () => {
    const id = 'social_uw-next-phase';
    seedUndercoverSession(id, { phase: 'warmup', withPair: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it('advances to next round', async () => {
    const id = 'social_uw-next-ok';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.currentRound).toBe(1);
    });
  });

  it('advances multiple rounds', async () => {
    const id = 'social_uw-next-multi';
    seedUndercoverSession(id, { withPair: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/next-round`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.currentRound).toBe(2);
    });
  });
});
