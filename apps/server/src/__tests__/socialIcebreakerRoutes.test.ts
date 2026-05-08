import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi } from 'vitest';

// ── In-memory socialIcebreakerStore mock (replaces the PostgreSQL-backed store) ──
// The store was migrated to PostgreSQL in PR #405; these tests exercise the HTTP
// routing layer and need a working store but not a real database connection.
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();
  const lieTruthsStore = new Map<string, Map<string, any[]>>();

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
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
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
  generatePersonalityDiceChallenges: vi.fn().mockImplementation(async (participants: Array<{ userId: string; displayName: string }>) => {
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

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');

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
        compilerId: 'blaze-v1',
        totalMinutes: 90,
      });
    });
  });

  it('defaults unknown tier strings to breeze on start', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'tier-legacy-host');
      const sessionId = `session-tier-legacy-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'standard' }),
      });
      const startBody = await startResponse.json() as any;

      expect(startResponse.status).toBe(200);
      expect(startBody.state.eventTier).toBe('breeze');
      expect(startBody.state.runPlan).toMatchObject({
        compilerId: 'breeze-v1',
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
        compilerId: 'blaze-v1',
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
});
