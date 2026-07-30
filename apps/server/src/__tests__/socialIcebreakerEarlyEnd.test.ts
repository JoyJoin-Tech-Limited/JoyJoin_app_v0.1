/**
 * Early-end + stall-nudge/dismiss route tests (PR1 flow revamp).
 *
 * Routes under test:
 *   POST /api/social-icebreaker/:id/early-end
 *   POST /api/social-icebreaker/:id/stall-nudge/dismiss
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
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    setMiniScriptSecrets: vi.fn(),
    getMiniScriptSecrets: vi.fn(),
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
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  simulateBotsForSession: vi.fn().mockResolvedValue(undefined),
  runBotSimulationSafely: vi.fn().mockResolvedValue(undefined),
  seedSingleTestBotsWarmupReady: vi.fn(),
}));

const { registerExtendedRoutes } = await import('../routes/socialIcebreakerExtended');

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

function seedSession(socialSessionId: string, overrides: Partial<SocialSessionState> = {}): void {
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: 'early-end-test',
    currentPhase: 'auction',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now() - 120_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: ['warmup', 'micro_challenge'],
    eventTier: 'glow',
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
  storeCtx.sessions.set(socialSessionId, state);
  storeCtx.participants.set(socialSessionId, new Map([
    ['host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now(), lastSeenAt: Date.now() }],
    ['p2', { userId: 'p2', displayName: 'P2', joinedAt: Date.now(), lastSeenAt: Date.now() }],
  ]));
}

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
});

describe('POST /api/social-icebreaker/:id/early-end', () => {
  it('401 when unauthenticated', async () => {
    await withServer(async (baseUrl) => {
      seedSession('ee-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/ee-1/early-end`, { method: 'POST' });
      expect(response.status).toBe(401);
    });
  });

  it('403 for non-host participant', async () => {
    await withServer(async (baseUrl) => {
      seedSession('ee-2', { autoAdvanceEnabled: false });
      const cookie = await login(baseUrl, 'p2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/ee-2/early-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(response.status).toBe(403);
    });
  });

  it('400 from warmup (EARLY_END_PHASE_BLOCKED)', async () => {
    await withServer(async (baseUrl) => {
      seedSession('ee-3', { currentPhase: 'warmup' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/ee-3/early-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(response.status).toBe(400);
      const body = await response.json() as any;
      expect(body.code).toBe('EARLY_END_PHASE_BLOCKED');
    });
  });

  it('jumps to recap, skips counting the current phase, resolves a pending bonus gate', async () => {
    await withServer(async (baseUrl) => {
      seedSession('ee-4', {
        currentPhase: 'auction',
        bonusGateOffered: true,
        bonusGatePlayerSentiment: { p2: 'want' },
      });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/ee-4/early-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('ee-4')!;
      expect(state.currentPhase).toBe('recap');
      expect(state.completedPhases).toEqual(['warmup', 'micro_challenge']);
      expect(state.bonusGateDeclined).toBe(true);
      expect(state.bonusGatePlayerSentiment).toBeUndefined();
      expect(state.lastAdvanceTrigger).toBe('early_end_jump');
      expect(state.endedEarlyAt).toEqual(expect.any(String));
      expect(state.interruptedAtPhase).toBe('auction');
      const recapResponse = await fetch(`${baseUrl}/api/social-icebreaker/ee-4/recap`, {
        headers: { cookie },
      });
      expect(recapResponse.status).toBe(200);
      const completedState = storeCtx.sessions.get('ee-4')!;
      expect(completedState.recapSnapshot?.interrupted).toEqual({
        interrupted: true,
        phase: 'auction',
      });
    });
  });
});

describe('POST /api/social-icebreaker/:id/stall-nudge/dismiss', () => {
  it('401 when unauthenticated', async () => {
    await withServer(async (baseUrl) => {
      seedSession('sn-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/sn-1/stall-nudge/dismiss`, { method: 'POST' });
      expect(response.status).toBe(401);
    });
  });

  it('clears the nudge and suppresses stall automation for the current phase', async () => {
    await withServer(async (baseUrl) => {
      seedSession('sn-2', { currentPhase: 'micro_challenge', stallNudgeAt: Date.now() - 10_000 });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/sn-2/stall-nudge/dismiss`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('sn-2')!;
      expect(state.stallNudgeAt).toBeUndefined();
      expect(state.stallSuppressedForPhase).toBe('micro_challenge');
    });
  });
});
