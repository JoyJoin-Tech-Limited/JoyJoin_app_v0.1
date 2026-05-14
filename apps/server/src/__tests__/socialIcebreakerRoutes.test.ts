import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory socialIcebreakerStore mock (replaces the PostgreSQL-backed store) ──
// The store was migrated to PostgreSQL in PR #405; these tests exercise the HTTP
// routing layer and need a working store but not a real database connection.
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();
  const lieTruthsStore = new Map<string, Map<string, any[]>>();
  const preGenStore = new Map<string, any>();

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
      const ps = participants.get(socialSessionId);
      if (!ps) return;
      const p = ps.get(userId);
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
    listParticipants: async (socialSessionId: string) => {
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
    },
    setLieTruths: async (socialSessionId: string, userId: string, truths: any[]) => {
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
    getPreGenerationResult: vi.fn(async (_socialSessionId: string, _phase: string) => {
      return preGenStore.get(`${_socialSessionId}:${_phase}`) ?? null;
    }),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    getInFlightJobForPhase: vi.fn(async () => null),
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn().mockImplementation((tags: unknown) => {
    if (!Array.isArray(tags) || tags.length !== 2) {
      return { valid: false, error: 'Exactly 2 tags are required' };
    }
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length < 2 || tag.length > 20) {
        return { valid: false, error: 'Each tag must be 2–20 characters' };
      }
    }
    return { valid: true, tags: [tags[0].trim(), tags[1].trim()] };
  }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
  generateWarmupTopics: vi.fn().mockResolvedValue({
    data: [
      { id: 't1', question: '你最近最开心的一件事？', mood: 'relaxed', emoji: '🌅', category: '快乐来源', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
      { id: 't2', question: '今天你最想感谢谁？', mood: 'relaxed', emoji: '✨', category: '温暖连接', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-warmup-topics-v2',
    },
  }),
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [
      { id: 'c1', title: '击掌', description: '和你左边的人击掌', durationSeconds: 30, completionCTA: '完成了' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-micro-challenges-v2',
    },
  }),
  generateLieDetectiveStatements: vi.fn().mockImplementation(async ({ displayName }) => {
    return {
      data: [
        { index: 0, text: `${displayName}-0`, isLie: false },
        { index: 1, text: `${displayName}-1`, isLie: true },
        { index: 2, text: `${displayName}-2`, isLie: false },
      ],
      meta: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-lie-detective-v1',
      },
    };
  }),
  generateXiaoYueComment: vi.fn().mockResolvedValue({
    data: 'ok',
    meta: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
    },
  }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-recap-summary-v2',
    },
  }),
  generatePersonalityDiceChallenges: vi.fn().mockImplementation(async ({ participants }: { participants: Array<{ userId: string; displayName: string }> }) => {
    return {
      data: participants.map((participant: { userId: string; displayName: string }, i: number) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        dominantTrait: 'A' as const,
        challengeTitle: `challenge-${i}`,
        challengeBody: 'do thing',
        challengeEmoji: '🎲',
        difficulty: 'easy' as const,
      })),
      meta: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v1',
      },
    };
  }),
  generateAuctionLots: vi.fn().mockResolvedValue({
    data: [
      { id: 'lot_1', title: 'Test lot one', teaser: 'fun' },
      { id: 'lot_2', title: 'Test lot two' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: true,
      promptVersion: 'social-auction-lots-v1',
    },
  }),
  generateUndercoverWordPair: vi.fn().mockResolvedValue({
    data: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-undercover-word-v1',
    },
  }),
  generateGroupMirrorQuestions: vi.fn().mockResolvedValue({
    data: [
      { id: 'gm_1', questionText: '谁最有可能在聚会后请大家吃夜宵？', category: 'perception' },
      { id: 'gm_2', questionText: '谁看起来最像会偷偷养猫的人？', category: 'perception' },
      { id: 'gm_3', questionText: '谁最可能在未来一年里突然辞职去旅行？', category: 'prediction' },
      { id: 'gm_4', questionText: '谁给在场大多数人的第一印象最反差？', category: 'perception' },
      { id: 'gm_5', questionText: '谁最可能是群里那个默默记住所有人喜好的角色？', category: 'perception' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-group-mirror-v1',
    },
  }),
  generateQuipBattlePrompts: vi.fn().mockResolvedValue({
    data: [
      { id: 'qb_1', promptText: '如果_____有段位，你已经是王者了', category: '自嘲' },
      { id: 'qb_2', promptText: '我最想对_____说的一句话是...', category: '吐槽' },
      { id: 'qb_3', promptText: '如果_____能说话，它一定会抱怨', category: '脑洞' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-quip-battle-v1',
    },
  }),
  generateXiaoyueSessionPack: vi.fn().mockResolvedValue({
    data: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      opener: '欢迎来到今晚的破冰时间，我是小悦。',
      phaseCoaching: {
        warmup: { toneLine: '先从轻松的话题暖暖场吧', hostHint: '如果没人开口，你可以先分享' },
        micro_challenge: { toneLine: '热身完毕，来个轻松的小挑战' },
        lie_detective: { toneLine: '侦探时间，仔细听每一句话' },
        auction: { toneLine: '虚拟拍卖开始，脑洞越大越好' },
        personality_dice: { toneLine: '人格骰子环节，看看大家敢不敢接招' },
        mini_script: { toneLine: '迷你剧本杀，今晚的高光时刻' },
        recap: { toneLine: '时间过得真快，来回顾一下今晚' },
      },
      backupPrompts: ['救场话术1', '救场话术2', '救场话术3'],
      recapFraming: { open: '回顾开场', highlightTemplate: '亮点模板', close: '结束语' },
      playerSkillRoles: [
        { userId: 'u1', displayName: 'User1', roleLabel: 'Connector', roleBlurb: '连接者' },
      ],
    },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-session-pack-v2',
    },
  }),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn(async (sessionId: string) => {
    if (sessionId.startsWith('forbidden')) {
      return { allowed: false, status: 403, body: { message: 'Forbidden' } };
    }
    if (sessionId.startsWith('missing')) {
      return { allowed: false, status: 404, body: { message: 'Icebreaker session not found' } };
    }
    return { allowed: true };
  }),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn().mockImplementation(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) {
      return { accepted: false, conflict: 'validation_failed' };
    }
    await apply(_payload);
    return { accepted: true };
  }),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');

// Import mocked AI service functions so tests can modify V1/V2 behaviour per-test.
import { generateLieDetectiveStatements, getLieDetectiveMode } from '../socialIcebreakerAIService';
import { getSession, updateSession, getPreGenerationResult } from '../lib/socialIcebreakerStore';
import { shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';

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
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });

  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  return app;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

describe('social icebreaker routes', () => {
  it('rejects unauthenticated GET session poll before resolveSession side effects', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'poll-auth-host');
      const sessionId = `session-poll-auth-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const startBody = await startResponse.json() as any;
      expect(startResponse.status).toBe(200);

      const unauthRes = await fetch(`${baseUrl}/api/social-icebreaker/${startBody.socialSessionId}`);
      expect(unauthRes.status).toBe(401);

      const otherCookie = await login(baseUrl, 'poll-auth-stranger');
      const strangerRes = await fetch(`${baseUrl}/api/social-icebreaker/${startBody.socialSessionId}`, {
        headers: { cookie: otherCookie },
      });
      expect(strangerRes.status).toBe(403);
    });
  });

  it('returns the joined participant roster in social session state responses', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'roster-host');
      const guestCookie = await login(baseUrl, 'roster-guest');
      const sessionId = `session-roster-${Date.now()}`;

      const hostStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const hostStartBody = await hostStartResponse.json() as any;

      expect(hostStartBody.state.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
      ]);

      const guestStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest' }),
      });
      const guestStartBody = await guestStartResponse.json() as any;

      expect(guestStartBody.state.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
        expect.objectContaining({ userId: 'roster-guest', displayName: 'Guest', isActive: true }),
      ]);

      const rosterResponse = await fetch(`${baseUrl}/api/social-icebreaker/${guestStartBody.socialSessionId}`, {
        headers: { cookie: hostCookie },
      });
      const rosterBody = await rosterResponse.json() as any;

      expect(rosterBody.playerCount).toBe(2);
      expect(rosterBody.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
        expect.objectContaining({ userId: 'roster-guest', displayName: 'Guest', isActive: true }),
      ]);
    });
  });

  it('creates a session with the requested tier and run plan', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-host');
      const sessionId = `session-tier-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('blaze');
      expect(startBody.state.runPlan).toMatchObject({
        compilerId: 'compiler-rule-v1-blaze',
        totalMinutes: 90,
      });
    });
  });

  it('defaults unknown tier strings to breeze on start', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-unknown-host');
      const sessionId = `session-tier-unknown-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'unknown' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('breeze');
      expect(startBody.state.runPlan).toMatchObject({
        compilerId: 'compiler-rule-v1-breeze',
        totalMinutes: 40,
      });
    });
  });

  it('allows the host to change tier via set-tier', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-set-host');
      const sessionId = `session-tier-set-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'breeze' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ tier: 'blaze' }),
      });
      const setTierBody = await setTierResponse.json() as any;

      expect(setTierResponse.status).toBe(200);
      expect(setTierBody.eventTier).toBe('blaze');
      expect(setTierBody.runPlan).toMatchObject({
        compilerId: 'compiler-rule-v1-blaze',
        totalMinutes: 90,
      });
    });
  });

  it('rejects set-tier from authenticated non-participants (auto-advance default)', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-stranger-host');
      const strangerCookie = await login(baseUrl, 'tier-stranger-outsider');
      const sessionId = `session-tier-stranger-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'breeze' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: strangerCookie },
        body: JSON.stringify({ tier: 'glow' }),
      });

      expect(setTierResponse.status).toBe(403);
    });
  });

  it('rejects set-tier for legacy tier strings', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-reject-host');
      const sessionId = `session-tier-reject-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ tier: 'premium' }),
      });

      expect(setTierResponse.status).toBe(400);
    });
  });

  describe('tier + vibe permutations', () => {
    const tiers = ['breeze', 'glow', 'blaze'] as const;
    const vibes = ['chat', 'balanced', 'game'] as const;
    const tierMinutes = { breeze: 40, glow: 60, blaze: 90 } as const;

    for (const tier of tiers) {
      for (const vibe of vibes) {
        it(`/start with tier=${tier} vibe=${vibe} produces a valid plan`, async () => {
          await withServer(async (baseUrl) => {
            const hostCookie = await login(baseUrl, `tier-${tier}-vibe-${vibe}`);
            const sessionId = `session-tier-${tier}-vibe-${vibe}-${Date.now()}`;

            const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie: hostCookie },
              body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: tier, vibe }),
            });
            const startBody = await startResponse.json() as any;

            expect(startResponse.status).toBe(200);
            expect(startBody.state.eventTier).toBe(tier);
            expect(startBody.state.vibe).toBe(vibe);
            expect(startBody.state.runPlan).toMatchObject({
              totalMinutes: tierMinutes[tier],
              version: 2,
            });
            const phases = startBody.state.runPlan.segments.map((s: any) => s.phase);
            expect(phases[0]).toBe('warmup');
            expect(phases[phases.length - 1]).toBe('recap');
            expect(new Set(phases).size).toBe(phases.length);
          });
        });
      }
    }
  });

  it('/start with legacy tier standard maps to glow', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'legacy-standard-host');
      const sessionId = `session-legacy-standard-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'standard' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('glow');
      expect(startBody.tierDisplayName).toBe('畅聊局');
    });
  });

  it('/start with legacy tier premium maps to blaze', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'legacy-premium-host');
      const sessionId = `session-legacy-premium-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'premium' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('blaze');
      expect(startBody.tierDisplayName).toBe('狂欢局');
    });
  });

  it('/start with legacy tier bar maps to breeze', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'legacy-bar-host');
      const sessionId = `session-legacy-bar-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'bar' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('breeze');
      expect(startBody.tierDisplayName).toBe('破冰局');
    });
  });

  it('vibe chat biases plan toward conversation phases', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'vibe-chat-host');
      const sessionId = `session-vibe-chat-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'chat' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      const phases = startBody.state.runPlan.segments.map((s: any) => s.phase);
      expect(phases).toContain('personality_dice');
    });
  });

  it('vibe game biases plan toward competition phases when enabled', async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true', SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE: 'true' };
    try {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'vibe-game-host');
        const sessionId = `session-vibe-game-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze', vibe: 'game' }),
        });
        const startBody = await startResponse.json() as any;

        expect(startResponse.status).toBe(200);
        const phases = startBody.state.runPlan.segments.map((s: any) => s.phase);
        expect(phases.some((p: string) => ['auction', 'quip_battle', 'undercover_word'].includes(p))).toBe(true);
      });
    } finally {
      process.env = originalEnv;
    }
  });

  it('/set-tier during warmup with vibe recompiles with new vibe', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-vibe-host');
      const sessionId = `session-tier-vibe-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'breeze' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ tier: 'blaze', vibe: 'game' }),
      });
      const setTierBody = await setTierResponse.json() as any;

      expect(setTierResponse.status).toBe(200);
      expect(setTierBody.eventTier).toBe('blaze');
      expect(setTierBody.state.vibe).toBe('game');
      expect(setTierBody.state.runPlan.totalMinutes).toBe(90);
    });
  });

  it('rejects set-tier with empty or missing tier', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-empty-host');
      const sessionId = `session-tier-empty-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });

      expect(setTierResponse.status).toBe(400);
    });
  });

  it('rejects set-tier after leaving warmup', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-lock-host');
      const sessionId = `session-tier-lock-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'breeze' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ ready: true }),
      });

      const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(advanceResponse.status).toBe(200);

      const setTierResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ tier: 'blaze' }),
      });

      expect(setTierResponse.status).toBe(400);
      const body = await setTierResponse.json() as { error?: string };
      expect(body.error).toContain('warmup');
    });
  });

  it('returns normalized AI metadata for warmup topics', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'topics-host');
      const sessionId = `session-topics-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const topicsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      const topicsBody = await topicsResponse.json() as any;

      expect(topicsResponse.status).toBe(200);
      expect(topicsBody.topics).toHaveLength(2);
      expect(topicsBody.meta).toMatchObject({
        provider: 'deepseek',
        fromCache: false,
        fallbackUsed: false,
        promptVersion: 'social-warmup-topics-v2',
      });
    });
  });

  it('requires shared warmup readiness before changing topics or advancing, and tracks common ground', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'warmup-host');
      const guestCookie = await login(baseUrl, 'warmup-guest');
      const sessionId = `session-warmup-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const guestStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest' }),
      });
      const { socialSessionId } = await guestStartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      const blockedAdvanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(blockedAdvanceResponse.status).toBe(400);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ ready: true }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ ready: true }),
      });

      const nextTopicResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/next-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      const nextTopicBody = await nextTopicResponse.json() as any;
      expect(nextTopicResponse.status).toBe(200);
      expect(nextTopicBody.currentTopicIndex).toBe(1);
      expect(nextTopicBody.commonGroundCount).toBe(1);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ ready: true }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ ready: true }),
      });

      const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      const advanceBody = await advanceResponse.json() as any;

      expect(advanceResponse.status).toBe(200);
      expect(advanceBody.nextPhase).toBe('micro_challenge');
      expect(advanceBody.state.commonGroundCount).toBe(2);
    });
  });

  it('rejects warmup readiness updates from non-participants', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'warmup-owner');
      const outsiderCookie = await login(baseUrl, 'warmup-outsider');
      const sessionId = `session-warmup-outsider-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const readyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: outsiderCookie },
        body: JSON.stringify({ ready: true }),
      });
      const readyBody = await readyResponse.json() as any;

      expect(readyResponse.status).toBe(403);
      expect(readyBody.error).toContain('Not a participant');
    });
  });

  it('accepts guessedStatementIndex=0 in lie-detective votes', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');
      const sessionId = `session-vote-0-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const startGuest2 = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await startGuest2.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      const statementResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ displayName: 'Host' }),
      });
      const statementBody = await statementResponse.json() as any;

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ displayName: 'Guest 1' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ displayName: 'Guest 2' }),
      });

      expect(statementBody.meta).toMatchObject({
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-lie-detective-v1',
      });

      const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host', guessedStatementIndex: 0 }),
      });
      const voteBody = await voteResponse.json() as any;

      expect(voteResponse.status).toBe(200);
      expect(voteBody.votes[0].guessedStatementIndex).toBe(0);
    });
  });

  it('rejects self-votes and uses server-owned reveal plus per-player progression in lie-detective', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-reveal');
      const guest1Cookie = await login(baseUrl, 'guest-reveal-1');
      const guest2Cookie = await login(baseUrl, 'guest-reveal-2');
      const sessionId = `session-reveal-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const guest2StartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await guest2StartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      for (const [cookie, displayName] of [
        [hostCookie, 'Host'],
        [guest1Cookie, 'Guest 1'],
        [guest2Cookie, 'Guest 2'],
      ] as const) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ displayName }),
        });
      }

      const selfVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 1 }),
      });
      expect(selfVoteResponse.status).toBe(400);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 0 }),
      });

      const revealResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 1 }),
      });
      const revealBody = await revealResponse.json() as any;

      expect(revealResponse.status).toBe(200);
      expect(revealBody.isRevealed).toBe(true);
      expect(revealBody.reveal).toMatchObject({
        targetUserId: 'host-reveal',
        lieIndex: 1,
        voteCount: 2,
        correctVoteCount: 1,
      });

      const nextPlayerResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      const nextPlayerBody = await nextPlayerResponse.json() as any;

      expect(nextPlayerResponse.status).toBe(200);
      expect(nextPlayerBody.currentLieDetectivePlayerIndex).toBe(1);
      expect(nextPlayerBody.currentPlayer.userId).toBe('guest-reveal-1');
    });
  });

  it('waits for the full roster to generate lie-detective statements before accepting votes', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-vote-gate');
      const guest1Cookie = await login(baseUrl, 'guest-vote-gate-1');
      const guest2Cookie = await login(baseUrl, 'guest-vote-gate-2');
      const sessionId = `session-vote-gate-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const guest2StartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await guest2StartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      for (const [cookie, displayName] of [
        [hostCookie, 'Host'],
        [guest1Cookie, 'Guest 1'],
      ] as const) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ displayName }),
        });
      }

      const blockedVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-vote-gate', guessedStatementIndex: 0 }),
      });
      const blockedVoteBody = await blockedVoteResponse.json() as any;

      expect(blockedVoteResponse.status).toBe(400);
      expect(blockedVoteBody.error).toContain('generate statements');

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ displayName: 'Guest 2' }),
      });

      const acceptedVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-vote-gate', guessedStatementIndex: 0 }),
      });
      const acceptedVoteBody = await acceptedVoteResponse.json() as any;

      expect(acceptedVoteResponse.status).toBe(200);
      expect(acceptedVoteBody.isRevealed).toBe(false);
      expect(acceptedVoteBody.votes).toHaveLength(1);
    });
  });

  it('rejects lie-detective votes in the wrong phase', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-wrong-phase');
      const sessionId = `session-wrong-phase-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ targetUserId: 'someone', guessedStatementIndex: 0 }),
      });
      const voteBody = await voteResponse.json() as any;

      expect(voteResponse.status).toBe(400);
      expect(voteBody.error).toContain('lie_detective');
    });
  });

  it.skip('uses the authenticated session user for personality-dice completion instead of a spoofed body userId', async () => {
    // TODO: Fix module-level await import (line 223) racing with vi.mock hoisting.
    // Schema split changed module graph timing; router is imported before mock is applied.
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'dice-host');
      const guest1Cookie = await login(baseUrl, 'dice-guest-1');
      const sessionId = `session-dice-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const startGuest1 = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const { socialSessionId } = await startGuest1.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, guest1Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({
          participants: [
            { userId: 'dice-host', displayName: 'Host' },
            { userId: 'dice-guest-1', displayName: 'Guest 1' },
          ],
        }),
      });
      const generateBody = await generateResponse.json() as any;

      expect(generateBody.meta).toMatchObject({
        provider: 'deepseek',
        fromCache: false,
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v1',
      });

      const completeResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ userId: 'dice-host' }),
      });
      const completeBody = await completeResponse.json() as any;

      expect(completeResponse.status).toBe(200);
      expect(completeBody.diceCompletedBy).toContain('dice-guest-1');
      expect(completeBody.diceCompletedBy).not.toContain('dice-host');
    });
  });

  it('rejects social start for unauthorized users before creating a social session', async () => {
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-forbidden');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'forbidden-session', displayName: 'Guest' }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ message: 'Forbidden' });
    });
  });

  describe('POST /xiaoyue/session-pack', () => {
    it('returns session pack when host requests it during warmup', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pack-host');
        const sessionId = `session-pack-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        const packResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/session-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const packBody = await packResponse.json() as any;

        expect(packResponse.status).toBe(200);
        expect(packBody.pack).toMatchObject({
          opener: expect.any(String),
          phaseCoaching: expect.any(Object),
          backupPrompts: expect.any(Array),
          recapFraming: expect.any(Object),
          playerSkillRoles: expect.any(Array),
        });
        expect(packBody.meta.promptVersion).toBe('social-session-pack-v2');
        expect(packBody.state.xiaoyueSessionPack).toBeDefined();
      });
    });

    it('returns cached pack on second call without invoking LLM again', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pack-host-cache');
        const sessionId = `session-pack-cache-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        const firstResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/session-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const firstBody = await firstResponse.json() as any;
        expect(firstResponse.status).toBe(200);

        const secondResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/session-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const secondBody = await secondResponse.json() as any;

        expect(secondResponse.status).toBe(200);
        expect(secondBody.pack.opener).toBe(firstBody.pack.opener);
        expect(secondBody.meta.fromCache).toBe(true);
      });
    });

    it('allows non-host users to generate session pack when auto-advance is enabled', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pack-host-403');
        const guestCookie = await login(baseUrl, 'pack-guest-403');
        const sessionId = `session-pack-auto-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const guestStart = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest' }),
        });
        const { socialSessionId } = await guestStart.json() as { socialSessionId: string };

        const packResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/session-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        });

        expect(packResponse.status).toBe(200);
      });
    });

    it('rejects session pack generation outside warmup phase', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pack-host-phase');
        const guestCookie = await login(baseUrl, 'pack-guest-phase');
        const sessionId = `session-pack-phase-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const guestStart = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest' }),
        });
        const { socialSessionId } = await guestStart.json() as { socialSessionId: string };

        // Advance to micro_challenge
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ mood: 'relaxed' }),
        });
        for (const cookie of [hostCookie, guestCookie]) {
          await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ ready: true }),
          });
        }
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ currentPhase: 'warmup' }),
        });

        const packResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/session-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });

        expect(packResponse.status).toBe(400);
      });
    });
  });

  describe('POST /xiaoyue/adaptive-suggestion', () => {
    it('returns adaptive suggestion for host during active phase', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'adapt-host');
        const sessionId = `adapt-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/adaptive-suggestion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.suggestion).toMatchObject({
          type: expect.any(String),
          message: expect.any(String),
          actionableHint: expect.any(String),
          basedOnSignals: expect.any(Object),
          generatedAt: expect.any(String),
        });
        // Host-only fields are stripped from client-visible state
        expect(body.state.xiaoyueAdaptiveSuggestion).toBeUndefined();
      });
    });

    it('allows non-host users to request adaptive suggestions when auto-advance is enabled', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'adapt-host-403');
        const guestCookie = await login(baseUrl, 'adapt-guest-403');
        const sessionId = `adapt-auto-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const guestStart = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest' }),
        });
        const { socialSessionId } = await guestStart.json() as { socialSessionId: string };

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/adaptive-suggestion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        });

        expect(response.status).toBe(200);
      });
    });

    it('sanitizes host-only suggestion from client-visible state', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'adapt-state');
        const sessionId = `adapt-state-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        // Generate suggestion
        const suggestResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/xiaoyue/adaptive-suggestion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(suggestResponse.status).toBe(200);

        // Poll state and verify host-only fields are stripped
        const stateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}`, {
          headers: { cookie: hostCookie },
        });
        const stateBody = await stateResponse.json() as any;

        expect(stateBody.xiaoyueAdaptiveSuggestion).toBeUndefined();
        expect(stateBody.xiaoyueSessionPackMeta).toBeUndefined();
      });
    });
  });

  describe('Lie Detective V2 — route integration', () => {
    async function advanceToLieDetective(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-ld-v2-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      // Get socialSessionId from any participant
      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Warmup
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      const advanceWarmupResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(advanceWarmupResponse.status).toBe(200);

      // Micro challenge
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      const advanceMicroResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });
      expect(advanceMicroResponse.status).toBe(200);

      return socialSessionId;
    }

    beforeEach(() => {
      // Reset to V1 default; individual tests override for V2
      vi.mocked(getLieDetectiveMode).mockReturnValue('v1');
      vi.mocked(generateLieDetectiveStatements).mockImplementation(async ({ displayName }) => ({
        data: [
          { index: 0, text: `${displayName}-0`, isLie: false },
          { index: 1, text: `${displayName}-1`, isLie: true },
          { index: 2, text: `${displayName}-2`, isLie: false },
        ],
        meta: {
          generatedAt: '2026-04-02T00:00:00.000Z',
          fromCache: false,
          provider: 'deepseek',
          fallbackUsed: false,
          promptVersion: 'social-lie-detective-v1',
        },
      }));
    });

    it('V2 end-to-end: submit tags, generate statements, vote, reveal, next player', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'v2-host');
        const guest1Cookie = await login(baseUrl, 'v2-guest-1');
        const guest2Cookie = await login(baseUrl, 'v2-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // Switch to V2 mode
        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');
        vi.mocked(generateLieDetectiveStatements).mockImplementation(async ({ mode, tags, displayName }) => {
          if (mode === 'v2' && tags) {
            return {
              data: [
                { index: 0, text: `${tags[0]} expanded`, isLie: false, is_ai: false, source_tag: tags[0] },
                { index: 1, text: 'AI fake statement', isLie: true, is_ai: true, source_tag: null },
                { index: 2, text: `${tags[1]} expanded`, isLie: false, is_ai: false, source_tag: tags[1] },
              ],
              meta: {
                generatedAt: '2026-04-02T00:00:00.000Z',
                fromCache: false,
                provider: 'deepseek',
                fallbackUsed: false,
                promptVersion: 'social-lie-detective-v2',
              },
            };
          }
          return {
            data: [
              { index: 0, text: `${displayName}-0`, isLie: false },
              { index: 1, text: `${displayName}-1`, isLie: true },
              { index: 2, text: `${displayName}-2`, isLie: false },
            ],
            meta: {
              generatedAt: '2026-04-02T00:00:00.000Z',
              fromCache: false,
              provider: 'deepseek',
              fallbackUsed: false,
              promptVersion: 'social-lie-detective-v1',
            },
          };
        });

        // Submit tags
        const hostTagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['爬山', '怕蟑螂'] }),
        });
        const hostTagsBody = await hostTagsResponse.json() as any;
        expect(hostTagsResponse.status).toBe(200);
        expect(hostTagsBody.submitted).toBe(true);
        expect(hostTagsBody.tags).toEqual(['爬山', '怕蟑螂']);
        expect(hostTagsBody.allPlayersSubmitted).toBe(false);

        const guest1TagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ tags: ['游泳', '爱吃辣'] }),
        });
        expect(guest1TagsResponse.status).toBe(200);

        const guest2TagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ tags: ['跑步', '咖啡'] }),
        });
        const guest2TagsBody = await guest2TagsResponse.json() as any;
        expect(guest2TagsResponse.status).toBe(200);
        expect(guest2TagsBody.allPlayersSubmitted).toBe(true);

        // Verify tags stored in session state
        const stateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}`, {
          headers: { cookie: hostCookie },
        });
        const stateBody = await stateResponse.json() as any;
        expect(stateBody.lieDetectiveV2Tags['v2-host']).toEqual(['爬山', '怕蟑螂']);
        expect(stateBody.lieDetectiveV2Tags['v2-guest-1']).toEqual(['游泳', '爱吃辣']);
        expect(stateBody.lieDetectiveV2Tags['v2-guest-2']).toEqual(['跑步', '咖啡']);

        // Generate statements for all 3 players
        for (const [cookie, displayName] of [
          [hostCookie, 'Host'],
          [guest1Cookie, 'Guest 1'],
          [guest2Cookie, 'Guest 2'],
        ] as const) {
          const genResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ displayName }),
          });
          const genBody = await genResponse.json() as any;
          expect(genResponse.status).toBe(200);
          expect(genBody.statements).toHaveLength(3);

          // Verify public statements are sanitized (no isLie, no is_ai, no source_tag)
          for (const stmt of genBody.statements) {
            expect(stmt).not.toHaveProperty('isLie');
            expect(stmt).not.toHaveProperty('is_ai');
            expect(stmt).not.toHaveProperty('source_tag');
            expect(stmt).toHaveProperty('index');
            expect(stmt).toHaveProperty('text');
          }
          // Verify V2 prompt version on the first (host) generation
          if (displayName === 'Host') {
            expect(genBody.meta.promptVersion).toBe('social-lie-detective-v2');
          }
        }

        // Vote from guest1
        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'v2-host', guessedStatementIndex: 0 }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.isRevealed).toBe(false); // Need 2 votes for 3 players

        // Vote from guest2 → reveal
        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ targetUserId: 'v2-host', guessedStatementIndex: 0 }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.isRevealed).toBe(true);
        expect(vote2Body.reveal).toMatchObject({
          targetUserId: 'v2-host',
          lieIndex: 1,
          voteCount: 2,
        });

        // Next player
        const nextPlayerResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const nextPlayerBody = await nextPlayerResponse.json() as any;
        expect(nextPlayerResponse.status).toBe(200);
        expect(nextPlayerBody.currentLieDetectivePlayerIndex).toBe(1);
      });
    });

    it('V1 regression: generate statements without tags, exactly 1 isLie', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'v1-host');
        const guest1Cookie = await login(baseUrl, 'v1-guest-1');
        const guest2Cookie = await login(baseUrl, 'v1-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // getLieDetectiveMode stays at default 'v1'
        const hostGenResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ displayName: 'Host' }),
        });
        const hostGenBody = await hostGenResponse.json() as any;
        expect(hostGenResponse.status).toBe(200);
        expect(hostGenBody.statements).toHaveLength(3);
        expect(hostGenBody.meta.promptVersion).toBe('social-lie-detective-v1');

        // No tag requirement error
        expect(hostGenBody.error).toBeUndefined();
      });
    });

    it('submit-tags rejects when not in lie_detective phase', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-phase-host');
        const sessionId = `session-tag-phase-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(400);
        expect(tagsBody.error).toContain('lie_detective');
      });
    });

    it('submit-tags rejects when mode is v1', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-v1-host');
        const guest1Cookie = await login(baseUrl, 'tag-v1-guest-1');
        const guest2Cookie = await login(baseUrl, 'tag-v1-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // getLieDetectiveMode stays at default 'v1'
        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(400);
        expect(tagsBody.error).toContain('V2');
      });
    });

    it('submit-tags rejects unauthenticated', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-auth-host');
        const guest1Cookie = await login(baseUrl, 'tag-auth-guest-1');
        const guest2Cookie = await login(baseUrl, 'tag-auth-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(401);
        expect(tagsBody.error).toContain('Authentication');
      });
    });

    it('generate rejects when tags not submitted first in V2 mode', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gen-tags-host');
        const guest1Cookie = await login(baseUrl, 'gen-tags-guest-1');
        const guest2Cookie = await login(baseUrl, 'gen-tags-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const genResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ displayName: 'Host' }),
        });
        const genBody = await genResponse.json() as any;
        expect(genResponse.status).toBe(400);
        expect(genBody.error).toContain('Tags not submitted');
      });
    });

    it('host-only next-player route rejects non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'next-host');
        const guest1Cookie = await login(baseUrl, 'next-guest-1');
        const guest2Cookie = await login(baseUrl, 'next-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (!stateBefore) throw new Error('Session not found');
        stateBefore.autoAdvanceEnabled = false;
        await updateSession(socialSessionId, stateBefore);

        // Generate for all so voting can happen
        for (const [cookie, displayName] of [
          [hostCookie, 'Host'],
          [guest1Cookie, 'Guest 1'],
          [guest2Cookie, 'Guest 2'],
        ] as const) {
          await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ displayName }),
          });
        }

        // Guests vote to reveal (need 2 votes for 3 players)
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'next-host', guessedStatementIndex: 0 }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ targetUserId: 'next-host', guessedStatementIndex: 0 }),
        });

        // Non-host tries to advance
        const nextResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        const nextBody = await nextResponse.json() as any;
        expect(nextResponse.status).toBe(403);
        expect(nextBody.error).toContain('Only the host');
      });
    });
  });

  describe('Personality Dice V2 — pre-generation + optimistic sync', () => {
    async function advanceToPersonalityDice(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-pd-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Warmup
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      const advanceWarmupResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(advanceWarmupResponse.status).toBe(200);

      // Micro challenge
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      const advanceMicroResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });
      expect(advanceMicroResponse.status).toBe(200);

      // Now in personality_dice
      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-pregen-host');
        const guest1Cookie = await login(baseUrl, 'pd-pregen-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        const preGenChallenges = [
          { userId: 'pd-pregen-host', displayName: 'Host', archetype: 'corgi', dominantTrait: 'A', challengeTitle: 'Pre-gen 1', challengeBody: 'do it', challengeEmoji: '🎲', difficulty: 'easy' },
          { userId: 'pd-pregen-guest', displayName: 'Guest 1', archetype: 'rooster', dominantTrait: 'C', challengeTitle: 'Pre-gen 2', challengeBody: 'do it', challengeEmoji: '🎲', difficulty: 'easy' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenChallenges as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-personality-dice-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-pregen-host', displayName: 'Host' },
              { userId: 'pd-pregen-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenges).toHaveLength(2);
        expect(generateBody.challenges[0].challengeTitle).toBe('Pre-gen 1');
        expect(generateBody.challenges[0].archetypeColor).toBeDefined();
        expect(generateBody.meta.promptVersion).toBe('social-personality-dice-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-inflight-host');
        const guest1Cookie = await login(baseUrl, 'pd-inflight-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-inflight-host', displayName: 'Host' },
              { userId: 'pd-inflight-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-op-id-host');
        const guest1Cookie = await login(baseUrl, 'pd-op-id-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-op-id-host', displayName: 'Host' },
              { userId: 'pd-op-id-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-123-abc';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First completion
        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId }),
        });
        const complete1Body = await complete1Response.json() as any;
        expect(complete1Response.status).toBe(200);
        expect(complete1Body.diceCompletedBy).toContain('pd-op-id-guest');
        expect(complete1Body.operationId).toBe(operationId);

        // Second completion with same operationId
        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(200);
        expect(complete2Body.diceCompletedBy).toContain('pd-op-id-guest');
        expect(complete2Body.operationId).toBe(operationId);
      });
    });

    it('optimistic sync: different operationId for same user is rejected', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-reject-host');
        const guest1Cookie = await login(baseUrl, 'pd-reject-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-reject-host', displayName: 'Host' },
              { userId: 'pd-reject-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        expect(generateResponse.status).toBe(200);

        // First completion
        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId: 'op-first' }),
        });
        expect(complete1Response.status).toBe(200);

        // Second completion with different operationId
        vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate) => {
          const valid = await validate(_payload);
          if (!valid) {
            return { accepted: false, conflict: 'already_responded' };
          }
          return { accepted: true };
        });

        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId: 'op-second' }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(409);
        expect(complete2Body.error).toContain('already_responded');
      });
    });

    it('backward compatibility: no operationId works as before', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-compat-host');
        const guest1Cookie = await login(baseUrl, 'pd-compat-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-compat-host', displayName: 'Host' },
              { userId: 'pd-compat-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;
        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenges[0].archetypeColor).toBeDefined();

        // Complete without operationId
        const completeResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false }),
        });
        const completeBody = await completeResponse.json() as any;

        expect(completeResponse.status).toBe(200);
        expect(completeBody.diceCompletedBy).toContain('pd-compat-guest');
        expect(completeBody.operationId).toBeNull();
      });
    });
  });

  describe('undercover word', () => {
    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-pregen-host');
        const sessionId = `session-uw-pregen-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const socialSessionId = `social_${sessionId}`;

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: { civilianWord: '火锅', undercoverWord: '烧烤', category: '美食' } as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-undercover-word-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.pair.civilianWord).toBe('火锅');
        expect(generateBody.pair.undercoverWord).toBe('烧烤');
        expect(generateBody.undercoverAssigned).toBe(true);
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-inflight-host');
        const sessionId = `session-uw-inflight-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const socialSessionId = `social_${sessionId}`;

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic describe: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-desc-host');
        const guest1Cookie = await login(baseUrl, 'uw-desc-guest');
        const sessionId = `session-uw-desc-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-uw-desc-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First describe
        const desc1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '甜甜的饮料', operationId }),
        });
        const desc1Body = await desc1Response.json() as any;
        expect(desc1Response.status).toBe(200);
        expect(desc1Body.submitted).toBe(true);
        expect(desc1Body.operationId).toBe(operationId);

        // Second describe with same operationId
        const desc2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '甜甜的饮料', operationId }),
        });
        const desc2Body = await desc2Response.json() as any;
        expect(desc2Response.status).toBe(200);
        expect(desc2Body.submitted).toBe(true);
        expect(desc2Body.operationId).toBe(operationId);
      });
    });

    it('optimistic vote: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-vote-host');
        const guest1Cookie = await login(baseUrl, 'uw-vote-guest');
        const sessionId = `session-uw-vote-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-uw-vote-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First vote
        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-vote-host', operationId }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.voted).toBe(true);
        expect(vote1Body.operationId).toBe(operationId);

        // Second vote with same operationId
        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-vote-host', operationId }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.voted).toBe(true);
        expect(vote2Body.operationId).toBe(operationId);
      });
    });

    it('backward compatibility: no operationId works as before', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-compat-host');
        const guest1Cookie = await login(baseUrl, 'uw-compat-guest');
        const sessionId = `session-uw-compat-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        // Describe without operationId
        const descResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '好喝的' }),
        });
        const descBody = await descResponse.json() as any;
        expect(descResponse.status).toBe(200);
        expect(descBody.submitted).toBe(true);
        expect(descBody.operationId).toBeNull();

        // Vote without operationId
        const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-compat-host' }),
        });
        const voteBody = await voteResponse.json() as any;
        expect(voteResponse.status).toBe(200);
        expect(voteBody.voted).toBe(true);
        expect(voteBody.operationId).toBeNull();
      });
    });
  });

  describe('Micro Challenge V2 — pre-generation + optimistic sync', () => {
    async function advanceToMicroChallenge(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-mc-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to micro_challenge (skip warmup advance which needs 2+ players for micro_challenge)
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'micro_challenge';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-pregen-host');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie);

        const preGenChallenge = { id: 'c_pre', title: 'Pre-gen Challenge', description: 'do it', durationSeconds: 120, completionCTA: '完成' };

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: [preGenChallenge] as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-micro-challenges-v2', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenge.title).toBe('Pre-gen Challenge');
        expect(generateBody.meta.promptVersion).toBe('social-micro-challenges-v2');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-inflight-host');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-op-id-host');
        const guest1Cookie = await login(baseUrl, 'mc-op-id-guest');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie, guest1Cookie);

        // Generate challenge first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-mc-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ operationId }),
        });
        const complete1Body = await complete1Response.json() as any;
        expect(complete1Response.status).toBe(200);
        expect(complete1Body.completedBy).toContain('mc-op-id-guest');
        expect(complete1Body.operationId).toBe(operationId);

        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ operationId }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(200);
        expect(complete2Body.completedBy).toContain('mc-op-id-guest');
        expect(complete2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-auth-host');
        const guest1Cookie = await login(baseUrl, 'mc-auth-guest');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Group Mirror V2 — pre-generation + optimistic sync', () => {
    async function advanceToGroupMirror(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-gm-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to group_mirror
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'group_mirror';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-pregen-host');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie);

        const preGenQuestions = [
          { id: 'gm_pre_1', questionText: 'Pre-gen Q1', category: 'perception' },
          { id: 'gm_pre_2', questionText: 'Pre-gen Q2', category: 'prediction' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenQuestions as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-group-mirror-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.questions).toHaveLength(2);
        expect(generateBody.questions[0].questionText).toBe('Pre-gen Q1');
        expect(generateBody.meta.promptVersion).toBe('social-group-mirror-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-inflight-host');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-op-id-host');
        const guest1Cookie = await login(baseUrl, 'gm-op-id-guest');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie, guest1Cookie);

        // Generate questions first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-gm-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const submit1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ questionId: 'gm_1', targetUserId: 'gm-host' }],
            operationId,
          }),
        });
        const submit1Body = await submit1Response.json() as any;
        expect(submit1Response.status).toBe(200);
        expect(submit1Body.submitted).toBe(true);
        expect(submit1Body.operationId).toBe(operationId);

        const submit2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ questionId: 'gm_1', targetUserId: 'gm-host' }],
            operationId,
          }),
        });
        const submit2Body = await submit2Response.json() as any;
        expect(submit2Response.status).toBe(200);
        expect(submit2Body.submitted).toBe(true);
        expect(submit2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-auth-host');
        const guest1Cookie = await login(baseUrl, 'gm-auth-guest');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Quip Battle V2 — pre-generation + optimistic sync', () => {
    async function advanceToQuipBattle(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-qb-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to quip_battle
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'quip_battle';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-pregen-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);

        const preGenPrompts = [
          { id: 'qb_pre_1', promptText: 'Pre-gen Q1', category: 'fun' },
          { id: 'qb_pre_2', promptText: 'Pre-gen Q2', category: 'fun' },
          { id: 'qb_pre_3', promptText: 'Pre-gen Q3', category: 'fun' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenPrompts as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-quip-battle-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.prompts).toHaveLength(3);
        expect(generateBody.prompts[0].promptText).toBe('Pre-gen Q1');
        expect(generateBody.meta.promptVersion).toBe('social-quip-battle-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-inflight-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic submit: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-submit-host');
        const guest1Cookie = await login(baseUrl, 'qb-submit-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Generate prompts first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-qb-submit-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const submit1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ promptId: 'qb_1', answerText: '测试答案' }],
            operationId,
          }),
        });
        const submit1Body = await submit1Response.json() as any;
        expect(submit1Response.status).toBe(200);
        expect(submit1Body.submitted).toBe(true);
        expect(submit1Body.operationId).toBe(operationId);

        const submit2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ promptId: 'qb_1', answerText: '测试答案' }],
            operationId,
          }),
        });
        const submit2Body = await submit2Response.json() as any;
        expect(submit2Response.status).toBe(200);
        expect(submit2Body.submitted).toBe(true);
        expect(submit2Body.operationId).toBe(operationId);
      });
    });

    it('optimistic vote: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-vote-host');
        const guest1Cookie = await login(baseUrl, 'qb-vote-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Generate prompts and submit answers first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ answers: [{ promptId: 'qb_1', answerText: 'host answer' }] }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ answers: [{ promptId: 'qb_1', answerText: 'guest answer' }] }),
        });

        const operationId = 'op-qb-vote-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            votes: [{ answerId: 'qb-vote-host::qb_1', promptId: 'qb_1' }],
            operationId,
          }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.voted).toBe(true);
        expect(vote1Body.operationId).toBe(operationId);

        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            votes: [{ answerId: 'qb-vote-host::qb_1', promptId: 'qb_1' }],
            operationId,
          }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.voted).toBe(true);
        expect(vote2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-auth-host');
        const guest1Cookie = await login(baseUrl, 'qb-auth-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Recap V2 — extended data fields', () => {
    it('returns V2 data fields in recap when phase data exists', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'recap-v2-host');
        const guest1Cookie = await login(baseUrl, 'recap-v2-guest');
        const sessionId = `session-recap-v2-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Seed phase data directly
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'recap';
          storeState.completedPhases = ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'undercover_word', 'group_mirror'];
          storeState.challengeCompletedBy = ['recap-v2-host', 'recap-v2-guest'];
          storeState.diceCompletedBy = ['recap-v2-host'];
          storeState.dicePassedBy = ['recap-v2-guest'];
          storeState.lieDetectiveRevealHistory = [{ round: 1, correctRate: 0.3 }, { round: 2, correctRate: 0.7 }];
          storeState.undercoverWordResults = {
            undercoverUserId: 'recap-v2-guest',
            undercoverDisplayName: 'Guest 1',
            civilianWord: '火锅',
            undercoverWord: '烧烤',
            voteCounts: { 'recap-v2-host': 1, 'recap-v2-guest': 0 },
            caught: false,
          };
          storeState.groupMirrorAnswers = [
            { userId: 'recap-v2-host', displayName: 'Host', questionId: 'gm_1', targetUserId: 'recap-v2-guest', reasonText: '很贴心' },
            { userId: 'recap-v2-guest', displayName: 'Guest 1', questionId: 'gm_1', targetUserId: 'recap-v2-guest', reasonText: '同意' },
          ];
          storeState.groupMirrorQuestions = [{ id: 'gm_1', questionText: '谁最有可能请客？', category: 'perception' }];
          await updateSession(socialSessionId, storeState);
        }

        const recapResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/recap`, {
          headers: { cookie: hostCookie },
        });
        const recapBody = await recapResponse.json() as any;

        expect(recapResponse.status).toBe(200);
        expect(recapBody.lieDetectiveV2Stats).toEqual({
          aiWinRate: 50,
          hardestRound: 1,
          fooledEveryone: 0,
        });
        expect(recapBody.personalityDiceHighlights).toMatchObject({
          completedCount: 1,
          passedCount: 1,
          completionRate: expect.any(Number),
        });
        expect(recapBody.undercoverWordResult).toEqual({
          caught: false,
          undercoverDisplayName: 'Guest 1',
        });
        expect(recapBody.microChallengeHighlights).toMatchObject({
          completedCount: 2,
          totalCount: 2,
          completionRate: 100,
        });
        expect(recapBody.groupMirrorHighlights).toMatchObject({
          topVotedDisplayName: 'Guest 1',
          voteCount: 2,
        });
      });
    });
  });
});
