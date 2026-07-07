/**
 * Quip battle auth: GET /quip-battle/results must not mutate session state without auth
 * (regression: unauthenticated requests could force reveal).
 * POST /quip-battle/generate must require host session (regression: unauthenticated could
 * overwrite prompts and burn LLM quota).
 */
import express from 'express';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { BLAZE_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { generateQuipBattlePrompts } from '../socialIcebreakerAIService';
import { createWithServer } from '../test-utils/withServer';

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
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn().mockReturnValue({ valid: true, tags: ['tag1', 'tag2'] }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
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
}));

vi.mock('../lib/icebreakerAccess', () => ({
  getIcebreakerSessionParticipantAccess: vi.fn(async () => ({
    allowed: true,
    session: { id: 'stub' },
  })),
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
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
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

function seedQuipSession(socialSessionId: string): void {
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: 'quip-auth-test',
    currentPhase: 'quip_battle',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 2,
    activePlayerCount: 2,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup'],
    eventType: '测试',
    eventTier: 'blaze',
    enabledPhases: [],
    commonGroundCount: 0,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: BLAZE_RUN_PLAN,
    quipBattlePrompts: [{ id: 'p1', promptText: '填空：我最喜欢的______', category: 'fun' }],
    quipBattleAnswers: [
      { userId: 'host-user', displayName: 'Host', answerText: '火锅', promptId: 'p1' },
      { userId: 'guest-user', displayName: 'Guest', answerText: '周末', promptId: 'p1' },
    ],
    quipBattleSubmittedUserIds: ['host-user', 'guest-user'],
    quipBattleVotes: [
      { voterId: 'host-user', answerId: 'guest-user::p1', promptId: 'p1' },
      { voterId: 'guest-user', answerId: 'host-user::p1', promptId: 'p1' },
    ],
    quipBattleVotedUserIds: ['host-user', 'guest-user'],
    quipBattleRevealed: false,
  };
  storeCtx.sessions.set(socialSessionId, state);
}

function seedQuipSessionForGenerate(
  socialSessionId: string,
  opts?: { phase?: SocialSessionState['currentPhase']; withPrompts?: boolean },
): void {
  const phase = opts?.phase ?? 'quip_battle';
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: 'quip-gen-test',
    currentPhase: phase,
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 2,
    activePlayerCount: 2,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup'],
    eventType: '测试',
    eventTier: 'blaze',
    enabledPhases: [],
    commonGroundCount: 0,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: BLAZE_RUN_PLAN,
  };
  if (opts?.withPrompts) {
    state.quipBattlePrompts = [{ id: 'p0', promptText: '已有题目', category: 'fun' }];
    state.quipBattlePromptsMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
      promptVersion: 'social-quip-battle-v1',
    };
  }
  storeCtx.sessions.set(socialSessionId, state);
  const pmap = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  pmap.set('host-user', {
    userId: 'host-user',
    displayName: 'Host',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  storeCtx.participants.set(socialSessionId, pmap);
}

describe('GET /api/social-icebreaker/:id/quip-battle/results', () => {
  it('returns 401 without session cookie and does not reveal', async () => {
    const socialSessionId = 'social_quip-auth-401';
    seedQuipSession(socialSessionId);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/results`);
      expect(res.status).toBe(401);
      expect(storeCtx.sessions.get(socialSessionId)?.quipBattleRevealed).toBe(false);
    });
  });

  it('returns 403 for non-host when autoAdvanceEnabled is false', async () => {
    const socialSessionId = 'social_quip-auth-403';
    seedQuipSession(socialSessionId);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-user');
      expect(guestCookie.length).toBeGreaterThan(0);

      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/results`, {
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
      expect(storeCtx.sessions.get(socialSessionId)?.quipBattleRevealed).toBe(false);
    });
  });

  it('returns 403 for non-participant and does not execute auto-advance before auth', async () => {
    const socialSessionId = 'social_quip-outsider-autoadvance';
    seedQuipSession(socialSessionId);
    const s = storeCtx.sessions.get(socialSessionId)!;
    s.autoAdvanceEnabled = true;
    s.autoAdvanceScheduledAt = Date.now() - 60_000;
    const pmap = new Map<
      string,
      { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
    >();
    pmap.set('host-user', {
      userId: 'host-user',
      displayName: 'Host',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    pmap.set('guest-user', {
      userId: 'guest-user',
      displayName: 'Guest',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    storeCtx.participants.set(socialSessionId, pmap);

    await withServer(async (baseUrl) => {
      const outsiderCookie = await login(baseUrl, 'outsider-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/results`, {
        headers: { cookie: outsiderCookie },
      });
      expect(res.status).toBe(403);
      const after = storeCtx.sessions.get(socialSessionId);
      expect(after?.currentPhase).toBe('quip_battle');
      expect(after?.autoAdvanceScheduledAt).toBeDefined();
      expect(after?.quipBattleRevealed).toBe(false);
    });
  });

  it('allows host to reveal when prerequisites are met', async () => {
    const socialSessionId = 'social_quip-auth-200';
    seedQuipSession(socialSessionId);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      expect(hostCookie.length).toBeGreaterThan(0);

      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/results`, {
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results?: unknown[]; allVoted?: boolean };
      expect(body.allVoted).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
      expect(storeCtx.sessions.get(socialSessionId)?.quipBattleRevealed).toBe(true);
    });
  });
});

describe('POST /api/social-icebreaker/:id/quip-battle/generate', () => {
  beforeEach(() => {
    vi.mocked(generateQuipBattlePrompts).mockReset();
    vi.mocked(generateQuipBattlePrompts).mockResolvedValue({
      data: [{ id: 'gen1', promptText: '新生成__', category: 'fun' }],
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: false,
        promptVersion: 'social-quip-battle-v1',
      },
    });
  });

  it('returns 401 without session and does not call LLM or persist prompts', async () => {
    const socialSessionId = 'social_quip-gen-401';
    seedQuipSessionForGenerate(socialSessionId);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
      expect(vi.mocked(generateQuipBattlePrompts)).not.toHaveBeenCalled();
      expect(storeCtx.sessions.get(socialSessionId)?.quipBattlePrompts).toBeUndefined();
    });
  });

  it('returns 403 for non-host', async () => {
    const socialSessionId = 'social_quip-gen-403';
    seedQuipSessionForGenerate(socialSessionId);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
      expect(vi.mocked(generateQuipBattlePrompts)).not.toHaveBeenCalled();
    });
  });

  it('returns 400 when not in quip_battle phase', async () => {
    const socialSessionId = 'social_quip-gen-phase';
    seedQuipSessionForGenerate(socialSessionId, { phase: 'warmup' });

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
      expect(vi.mocked(generateQuipBattlePrompts)).not.toHaveBeenCalled();
    });
  });

  it('allows host to generate prompts and persists state', async () => {
    const socialSessionId = 'social_quip-gen-200';
    seedQuipSessionForGenerate(socialSessionId);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      expect(vi.mocked(generateQuipBattlePrompts)).toHaveBeenCalledTimes(1);
      const stored = storeCtx.sessions.get(socialSessionId);
      expect(stored?.quipBattlePrompts?.[0]?.id).toBe('gen1');
    });
  });

  it('returns existing prompts without calling LLM when already generated', async () => {
    const socialSessionId = 'social_quip-gen-idem';
    seedQuipSessionForGenerate(socialSessionId, { withPrompts: true });

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { prompts?: { id: string }[] };
      expect(body.prompts?.[0]?.id).toBe('p0');
      expect(vi.mocked(generateQuipBattlePrompts)).not.toHaveBeenCalled();
    });
  });
});
