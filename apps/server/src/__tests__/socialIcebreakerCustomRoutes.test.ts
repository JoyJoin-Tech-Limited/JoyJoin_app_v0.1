/**
 * Custom mode (自由局) route tests:
 *   POST /api/social-icebreaker/:id/select-phase
 *   POST /api/social-icebreaker/:id/end-session
 *
 * Plus unit coverage for the host-only phase-selection data stripping
 * (phaseSelectionId + selectablePhases) in sanitizeStateForClient /
 * buildClientState.
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
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'ch-custom-1',
        title: '每人说一件今天的小事',
        description: '不设限，随便聊',
        durationSeconds: 180,
        completionCTA: '轮到下一位',
      },
    ],
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  }),
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

const customRouter = (await import('../routes/socialIcebreakerCustom')).default;
const { sanitizeStateForClient, buildClientState } = await import('../routes/socialIcebreakerHelpers');

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
  router.use(customRouter);
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
    icebreakerSessionId: 'custom-mode-test',
    currentPhase: 'phase_selection',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now() - 30_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: ['warmup'],
    enabledPhases: ['warmup', 'micro_challenge', 'auction', 'speed_friending', 'lie_detective', 'recap'],
    eventTier: 'custom',
    phaseSelectionId: 'ps_test',
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
  storeCtx.sessions.set(socialSessionId, state);
  storeCtx.participants.set(socialSessionId, new Map([
    ['host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now(), lastSeenAt: Date.now() }],
    ['p2', { userId: 'p2', displayName: 'P2', joinedAt: Date.now(), lastSeenAt: Date.now() }],
    ['p3', { userId: 'p3', displayName: 'P3', joinedAt: Date.now(), lastSeenAt: Date.now() }],
  ]));
}

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
});

describe('POST /api/social-icebreaker/:id/select-phase', () => {
  it('401 when unauthenticated', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-401');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-401/select-phase`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(401);
    });
  });

  it('403 for non-host participant', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-403');
      const cookie = await login(baseUrl, 'p2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-403/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(403);
    });
  });

  it('400 when the session is not in custom mode', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-tier', { eventTier: 'glow' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-tier/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('400 when the session is not in phase selection', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-phase', { currentPhase: 'warmup' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-phase/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
      const body = await response.json() as any;
      expect(body.error).toMatch(/not in phase selection/);
    });
  });

  it('400 when the phase selection nonce is stale', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-nonce', { phaseSelectionId: 'ps_older' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-nonce/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
      const body = await response.json() as any;
      expect(body.error).toMatch(/expired/);
    });
  });

  it('400 for an unknown phase', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-unknown');
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-unknown/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'not_a_phase', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('400 when the phase needs more players than the roster', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-players', { playerCount: 2 });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-players/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'lie_detective', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
      const body = await response.json() as any;
      expect(body.error).toMatch(/at least 3 players/);
    });
  });

  it('advances the host into the selected phase and clears the picker', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-select-ok');
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-select-ok/select-phase`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'micro_challenge', phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('custom-select-ok')!;
      expect(state.currentPhase).toBe('micro_challenge');
      expect(state.phaseSelectionId).toBeUndefined();
      expect(state.pulseChecks).toEqual([]);
      expect(state.autoAdvanceScheduledAt).toBeUndefined();
      expect(state.challengeCompletedBy).toEqual([]);
      expect(state.currentChallenge?.id).toBe('ch-custom-1');
      const body = await response.json() as any;
      expect(body.state.currentPhase).toBe('micro_challenge');
      expect(Array.isArray(body.state.selectablePhases)).toBe(true);
    });
  });
});

describe('POST /api/social-icebreaker/:id/end-session', () => {
  it('401 when unauthenticated', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-401');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-401/end-session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(401);
    });
  });

  it('403 for non-host participant', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-403');
      const cookie = await login(baseUrl, 'p2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-403/end-session`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(403);
    });
  });

  it('400 when the session is not in custom mode', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-tier', { eventTier: 'blaze' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-tier/end-session`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('400 when the session is not in phase selection', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-phase', { currentPhase: 'warmup' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-phase/end-session`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
      const body = await response.json() as any;
      expect(body.error).toMatch(/phase selection screen/);
    });
  });

  it('400 when the phase selection nonce is stale', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-nonce', { phaseSelectionId: 'ps_older' });
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-nonce/end-session`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('moves the host to recap and records phase_selection as completed', async () => {
    await withServer(async (baseUrl) => {
      seedSession('custom-end-ok');
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-end-ok/end-session`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ phaseSelectionId: 'ps_test' }),
      });
      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('custom-end-ok')!;
      expect(state.currentPhase).toBe('recap');
      expect(state.completedPhases).toEqual(['warmup', 'phase_selection']);
      expect(state.phaseSelectionId).toBeUndefined();
      expect(state.recapSnapshot?.recapSummary?.headline).toBe('今晚到这儿，刚刚好');
    });
  });
});

describe('host-only phase-selection data stripping', () => {
  it('sanitizeStateForClient keeps the nonce for the host but strips it for players', () => {
    seedSession('custom-sanitize');
    const state = storeCtx.sessions.get('custom-sanitize')!;

    const playerState = sanitizeStateForClient(state, 'p2');
    expect((playerState as Partial<SocialSessionState>).phaseSelectionId).toBeUndefined();

    const hostState = sanitizeStateForClient(state, 'host-user');
    expect(hostState.phaseSelectionId).toBe('ps_test');

    const anonymousState = sanitizeStateForClient(state);
    expect(anonymousState.phaseSelectionId).toBe('ps_test');
  });

  it('buildClientState attaches selectablePhases only for the host', async () => {
    seedSession('custom-build');
    const state = storeCtx.sessions.get('custom-build')!;

    const playerState = await buildClientState(state, 'p2');
    expect((playerState as Partial<SocialSessionState>).phaseSelectionId).toBeUndefined();
    expect((playerState as Partial<SocialSessionState>).selectablePhases).toBeUndefined();

    const hostState = await buildClientState(state, 'host-user');
    expect(hostState.phaseSelectionId).toBe('ps_test');
    expect(hostState.selectablePhases?.map((p) => p.phase)).toContain('micro_challenge');
  });
});
