/**
 * Smoke: POST /api/miniscript/generate then GET /api/social-icebreaker/:id
 * sees `miniScriptFramework` on session state (Slice D).
 */
import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  const lieTruthsStore = new Map<string, Map<string, unknown[]>>();
  const miniscriptSecretsStore = new Map<string, unknown>();
  return { sessions, participants, lieTruthsStore, miniscriptSecretsStore };
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
    createSession: async (state: SocialSessionState) => {
      sessions.set(state.socialSessionId, state);
    },
    updateSession: async (socialSessionId: string, state: SocialSessionState) => {
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
    setMiniScriptSecrets: async (socialSessionId: string, secrets: unknown) => {
      storeCtx.miniscriptSecretsStore.set(socialSessionId, secrets);
    },
    getMiniScriptSecrets: async (socialSessionId: string) => {
      return (storeCtx.miniscriptSecretsStore.get(socialSessionId) as any) ?? null;
    },
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../socialIcebreakerAIService')>();
  return {
    ...actual,
    generateWarmupTopics: vi.fn().mockResolvedValue({
      data: [
        { id: 't1', question: '测试话题一', mood: 'relaxed', emoji: '🌅', category: '测试', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
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
        { id: 'c1', title: '击掌', description: '测试', durationSeconds: 30, completionCTA: '完成了' },
      ],
      meta: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-micro-challenges-v2',
      },
    }),
    generateLieDetectiveStatements: vi.fn().mockImplementation(async ({ displayName }: { displayName: string }) => ({
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
    })),
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
    generatePersonalityDiceChallenges: vi.fn().mockImplementation(
      async (parts: Array<{ userId: string; displayName: string }>) => ({
        data: parts.map((participant, i: number) => ({
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
      }),
    ),
  };
});

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
const { default: miniscriptRouter } = await import('../routes/domains/miniscript');

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

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
    req.session.save(() => res.json({ ok: true }));
  });
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  app.use('/api/miniscript', miniscriptRouter);
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

describe('MiniScript generate + social poll', () => {
  beforeEach(() => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  });

  it('GET social session includes miniScriptFramework after generate', async () => {
    storeCtx.sessions.clear();
    storeCtx.participants.clear();
    storeCtx.lieTruthsStore.clear();

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-smoke`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const socialSessionId = 'social-miniscript-smoke-1';
      const seed: SocialSessionState = {
        socialSessionId,
        icebreakerSessionId: 'ice-smoke-1',
        currentPhase: 'mini_script',
        hostUserId: 'host-smoke',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'],
      };
      storeCtx.sessions.set(socialSessionId, seed);

      const genRes = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId,
          playerCount: 4,
          style: 'modern_urban',
          genres: ['absurd_comedy'],
        }),
      });
      expect(genRes.status).toBe(200);
      const genBody = (await genRes.json()) as { premise: string; schemaVersion: number };
      expect(genBody.schemaVersion).toBe(2);

      const pollRes = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}`, {
        headers: { cookie },
      });
      expect(pollRes.status).toBe(200);
      const pollBody = (await pollRes.json()) as SocialSessionState;
      expect(pollBody.miniScriptFramework?.premise).toBe(genBody.premise);
      expect(pollBody.miniScriptFramework?.schemaVersion).toBe(2);
    });
  });
});
