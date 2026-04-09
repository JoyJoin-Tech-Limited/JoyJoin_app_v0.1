import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi } from 'vitest';

// ── In-memory socialIcebreakerStore mock (replaces the PostgreSQL-backed store) ──
// The store was migrated to PostgreSQL in PR #405; these tests exercise the HTTP
// routing layer and need a working store but not a real database connection.
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; lastSeenAt: number }>>();
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
      participants.get(socialSessionId)!.set(userId, { userId, displayName, lastSeenAt: Date.now() });
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
    setLieTruths: async (socialSessionId: string, userId: string, truths: any[]) => {
      if (!lieTruthsStore.has(socialSessionId)) lieTruthsStore.set(socialSessionId, new Map());
      lieTruthsStore.get(socialSessionId)!.set(userId, truths);
    },
    getLieTruths: async (socialSessionId: string, userId: string) =>
      lieTruthsStore.get(socialSessionId)?.get(userId) ?? null,
    getAllSessionLieTruths: async (socialSessionId: string) => {
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
      promptVersion: 'social-warmup-topics-v1',
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
      promptVersion: 'social-micro-challenges-v1',
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
  generateXiaoYueComment: vi.fn().mockResolvedValue('ok'),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-recap-summary-v1',
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
}));

vi.mock('../lib/icebreakerAccess', () => ({
  getIcebreakerSessionParticipantAccess: vi.fn(async (sessionId: string) => {
    if (sessionId.startsWith('forbidden')) {
      return { allowed: false, status: 403, body: { message: 'Forbidden' } };
    }
    if (sessionId.startsWith('missing')) {
      return { allowed: false, status: 404, body: { message: 'Icebreaker session not found' } };
    }
    return { allowed: true, session: { id: sessionId } };
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
        promptVersion: 'social-warmup-topics-v1',
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

  it('uses the authenticated session user for personality-dice completion instead of a spoofed body userId', async () => {
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
});
