/**
 * POST phase "generate" routes must require auth + host + correct phase.
 * Regression: unauthenticated callers could mutate session state and burn LLM quota.
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { BLAZE_RUN_PLAN, GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  return { sessions, participants };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants } = storeCtx;
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
    heartbeat: async () => {},
    getRosterCount: async (socialSessionId: string) => participants.get(socialSessionId)?.size ?? 0,
    getActiveParticipantCount: async () => 2,
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
    setLieTruths: vi.fn(),
    getLieTruths: vi.fn(),
    loadSessionLieTruths: vi.fn(async () => new Map()),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    logMomentCardInteraction: vi.fn(),
    getMomentCardStats: vi.fn(),
  };
});

const generateQuipBattlePrompts = vi.fn();
const generateUndercoverWordPair = vi.fn();
const generateGroupMirrorQuestions = vi.fn();
const generateLieDetectiveStatements = vi.fn();

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements,
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  buildLieDetectiveV2RecapData: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts,
  generateUndercoverWordPair,
  generateGroupMirrorQuestions,
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn(),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false }),
}));

vi.mock('../lib/icebreakerAccess', () => ({
  getIcebreakerSessionParticipantAccess: vi.fn(async () => ({
    allowed: true,
    session: { id: 'stub' },
  })),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');

function baseSession(overrides: Partial<SocialSessionState> & { socialSessionId: string }): SocialSessionState {
  return {
    icebreakerSessionId: 'gen-auth-test',
    currentPhase: overrides.currentPhase ?? 'quip_battle',
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
    ...overrides,
  } as SocialSessionState;
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

function seedParticipants(socialSessionId: string): void {
  const m = storeCtx.participants.get(socialSessionId) ?? new Map();
  m.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now(), lastSeenAt: Date.now() });
  m.set('guest-user', { userId: 'guest-user', displayName: 'Guest', joinedAt: Date.now(), lastSeenAt: Date.now() });
  storeCtx.participants.set(socialSessionId, m);
}

describe('POST quip-battle/generate host auth', () => {
  it('returns 401 without session', async () => {
    const id = 'social_quip-gen-401';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'quip_battle' }));
    seedParticipants(id);
    generateQuipBattlePrompts.mockClear();

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/quip-battle/generate`, { method: 'POST' });
      expect(res.status).toBe(401);
      expect(generateQuipBattlePrompts).not.toHaveBeenCalled();
    });
  });

  it('returns 403 for non-host', async () => {
    const id = 'social_quip-gen-403';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'quip_battle' }));
    seedParticipants(id);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'guest-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in quip_battle phase', async () => {
    const id = 'social_quip-gen-phase';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'warmup' }));
    seedParticipants(id);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it('allows host to generate prompts', async () => {
    const id = 'social_quip-gen-200';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'quip_battle' }));
    seedParticipants(id);
    generateQuipBattlePrompts.mockResolvedValueOnce({
      data: [{ id: 'p1', promptText: 'Say something funny', category: 'fun' }],
      meta: { model: 'stub' },
    } as any);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/quip-battle/generate`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { prompts?: { id: string }[] };
      expect(body.prompts?.[0]?.id).toBe('p1');
      expect(storeCtx.sessions.get(id)?.quipBattlePrompts?.[0]?.id).toBe('p1');
    });
  });
});

describe('POST undercover-word/generate host auth', () => {
  it('returns 401 without session', async () => {
    const id = 'social_uc-gen-401';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'undercover_word' }));
    seedParticipants(id);
    generateUndercoverWordPair.mockClear();

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, { method: 'POST' });
      expect(res.status).toBe(401);
      expect(generateUndercoverWordPair).not.toHaveBeenCalled();
    });
  });

  it('allows host in undercover_word phase', async () => {
    const id = 'social_uc-gen-200';
    storeCtx.sessions.set(
      id,
      baseSession({
        socialSessionId: id,
        currentPhase: 'undercover_word',
        runPlan: GLOW_RUN_PLAN,
      }),
    );
    seedParticipants(id);
    generateUndercoverWordPair.mockResolvedValueOnce({
      data: { civilianWord: '苹果', undercoverWord: '梨' },
      meta: {},
    } as any);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/undercover-word/generate`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      expect(storeCtx.sessions.get(id)?.undercoverWordPair?.civilianWord).toBe('苹果');
    });
  });
});

describe('POST lie-detective/generate participant auth', () => {
  it('returns 401 without session', async () => {
    const id = 'social_ld-gen-401';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'lie_detective' }));
    seedParticipants(id);
    generateLieDetectiveStatements.mockClear();

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'X' }),
      });
      expect(res.status).toBe(401);
      expect(generateLieDetectiveStatements).not.toHaveBeenCalled();
    });
  });

  it('returns 403 when authenticated but not a session participant', async () => {
    const id = 'social_ld-gen-403';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'lie_detective' }));
    seedParticipants(id);
    generateLieDetectiveStatements.mockClear();

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'stranger-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ displayName: 'Intruder' }),
      });
      expect(res.status).toBe(403);
      expect(generateLieDetectiveStatements).not.toHaveBeenCalled();
    });
  });

  it('allows roster participant to generate statements', async () => {
    const id = 'social_ld-gen-200';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'lie_detective' }));
    seedParticipants(id);
    generateLieDetectiveStatements.mockResolvedValueOnce({
      data: [
        { index: 0, text: 'A', isLie: false },
        { index: 1, text: 'B', isLie: false },
        { index: 2, text: 'C', isLie: true },
      ],
      meta: { model: 'stub' },
    } as any);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'guest-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ displayName: 'Guest' }),
      });
      expect(res.status).toBe(200);
      expect(generateLieDetectiveStatements).toHaveBeenCalled();
      const players = storeCtx.sessions.get(id)?.lieDetectivePlayers;
      expect(players?.some((p) => p.userId === 'guest-user')).toBe(true);
    });
  });
});

describe('POST group-mirror/generate host auth', () => {
  it('returns 401 without session', async () => {
    const id = 'social_gm-gen-401';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'group_mirror' }));
    seedParticipants(id);
    generateGroupMirrorQuestions.mockClear();

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/group-mirror/generate`, { method: 'POST' });
      expect(res.status).toBe(401);
      expect(generateGroupMirrorQuestions).not.toHaveBeenCalled();
    });
  });

  it('allows host in group_mirror phase', async () => {
    const id = 'social_gm-gen-200';
    storeCtx.sessions.set(id, baseSession({ socialSessionId: id, currentPhase: 'group_mirror' }));
    seedParticipants(id);
    generateGroupMirrorQuestions.mockResolvedValueOnce({
      data: [{ id: 'q1', promptText: 'Who would...?' }],
      meta: {},
    } as any);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/group-mirror/generate`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      expect(storeCtx.sessions.get(id)?.groupMirrorQuestions?.[0]?.id).toBe('q1');
    });
  });
});
