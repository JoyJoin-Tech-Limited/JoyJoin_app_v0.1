/**
 * POST /api/social-icebreaker/:id/moment-card-event — Wave 5 T-1 (§2-f G3-a).
 *
 * Locks the action whitelist after adding 'generate': the G3 moment-card
 * generation-rate numerator is a `moment_card_interactions` row with
 * action='generate', written ONLY through this route (the action column is
 * plain varchar — no pgEnum — so this whitelist is the sole validator).
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const { logMomentCardInteractionMock } = vi.hoisted(() => ({
  logMomentCardInteractionMock: vi.fn(),
}));

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
    upsertParticipant: async () => {},
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
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    recordRecapDwellMetric: vi.fn().mockResolvedValue(undefined),
    computeRecapDwellMs: vi.fn(() => null),
    logMomentCardInteraction: logMomentCardInteractionMock,
    getMomentCardStats: vi.fn(),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  buildLieDetectiveV2RecapData: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
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
    icebreakerSessionId: 'moment-card-event-test',
    currentPhase: 'recap',
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

function seedSession(socialSessionId: string): void {
  storeCtx.sessions.set(socialSessionId, baseSession({ socialSessionId }));
  const m = new Map();
  m.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now(), lastSeenAt: Date.now() });
  storeCtx.participants.set(socialSessionId, m);
}

describe('POST /:socialSessionId/moment-card-event (Wave 5 T-1)', () => {
  beforeEach(() => {
    logMomentCardInteractionMock.mockReset();
    logMomentCardInteractionMock.mockResolvedValue(undefined);
  });

  it('returns 401 without an authenticated session', async () => {
    const id = 'social_mc-401';
    seedSession(id);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/moment-card-event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      expect(res.status).toBe(401);
      expect(logMomentCardInteractionMock).not.toHaveBeenCalled();
    });
  });

  it('rejects an unknown action with 400 (whitelist is the sole validator)', async () => {
    const id = 'social_mc-400';
    seedSession(id);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/moment-card-event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'delete' }),
      });
      expect(res.status).toBe(400);
      expect(logMomentCardInteractionMock).not.toHaveBeenCalled();
    });
  });

  it("accepts 'generate' and records the G3 numerator row", async () => {
    const id = 'social_mc-generate';
    seedSession(id);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/moment-card-event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'generate' }),
      });
      expect(res.status).toBe(200);
      expect(logMomentCardInteractionMock).toHaveBeenCalledTimes(1);
      expect(logMomentCardInteractionMock).toHaveBeenCalledWith(id, 'host-user', 'generate', undefined);
    });
  });

  it("keeps legacy actions accepted ('save' regression)", async () => {
    const id = 'social_mc-save';
    seedSession(id);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/moment-card-event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'save' }),
      });
      expect(res.status).toBe(200);
      expect(logMomentCardInteractionMock).toHaveBeenCalledWith(id, 'host-user', 'save', undefined);
    });
  });
});
