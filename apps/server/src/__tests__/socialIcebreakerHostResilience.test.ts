/**
 * Sprint Contract gm-debrief-w1 — Host resilience & session recovery.
 *
 * AC-W1.1: red repro — a non-host cannot advance while the host is absent, and
 *          a claim path must exist to recover the room.
 * AC-W1.2: POST /:id/transfer-host — any active non-host may claim after the
 *          host has been heartbeat-silent past SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS;
 *          idempotent; 403 while the host is fresh.
 * AC-W1.5: non-host claim while host active is 403.
 *
 * The PostgreSQL-backed store is mocked with an in-memory equivalent that
 * implements the same transferHost contract (atomic CAS semantics).
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import {
  getHostClaimGraceMs,
  evaluateHostClaimEligibility,
  SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS,
} from '../lib/socialIcebreakerHostResilience';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  return { sessions, participants, raceHostHeartbeatBeforeTransfer: false };
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
    getActiveParticipantCount: async (socialSessionId: string) =>
      participants.get(socialSessionId)?.size ?? 0,
    getParticipant: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? { displayName: p.displayName } : null;
    },
    getParticipantLastSeenAt: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? new Date(p.lastSeenAt) : null;
    },
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
    transferHost: async (
      socialSessionId: string,
      newHostUserId: string,
      newHostDisplayName: string,
      expectedHostUserId?: string,
      expectedHostLastSeenAtMs?: number | null,
    ) => {
      const state = sessions.get(socialSessionId);
      if (!state) return { outcome: 'not_found' as const };

      // Simulate a host heartbeat landing AFTER the route's eligibility read
      // but BEFORE the store's row-locked re-verify.
      if (storeCtx.raceHostHeartbeatBeforeTransfer) {
        const hostRow = participants.get(socialSessionId)?.get(state.hostUserId);
        if (hostRow) hostRow.lastSeenAt = Date.now();
      }

      if (state.hostUserId === newHostUserId) {
        return { outcome: 'already_host' as const, state };
      }
      if (expectedHostUserId !== undefined && state.hostUserId !== expectedHostUserId) {
        return { outcome: 'conflict' as const, currentHostUserId: state.hostUserId };
      }
      if (expectedHostLastSeenAtMs !== undefined) {
        const hostRow = participants.get(socialSessionId)?.get(state.hostUserId);
        const currentHostLastSeenMs = hostRow ? hostRow.lastSeenAt : null;
        const hostHeartbeatAdvanced =
          expectedHostLastSeenAtMs === null
            ? currentHostLastSeenMs !== null
            : currentHostLastSeenMs !== null && currentHostLastSeenMs > expectedHostLastSeenAtMs;
        if (hostHeartbeatAdvanced) {
          return {
            outcome: 'host_active' as const,
            currentHostUserId: state.hostUserId,
            hostLastSeenAt: currentHostLastSeenMs ? new Date(currentHostLastSeenMs) : null,
          };
        }
      }
      state.hostUserId = newHostUserId;
      state.hostDisplayName = newHostDisplayName;
      return { outcome: 'transferred' as const, state };
    },
    setLieTruths: vi.fn(),
    getLieTruths: vi.fn(),
    loadSessionLieTruths: vi.fn(async () => new Map()),
    setMiniScriptSecrets: vi.fn(),
    getMiniScriptSecrets: vi.fn(),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    logMomentCardInteraction: vi.fn(),
    getMomentCardStats: vi.fn(),
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

/**
 * Seed a session + roster. `hostSilenceMsAgo` controls the host heartbeat age;
 * omit it to leave the host freshly active.
 */
function seedSession(
  shortId: string,
  overrides: Partial<SocialSessionState> = {},
  hostSilenceMsAgo: number = 0,
): void {
  const socialSessionId = `social_${shortId}`;
  const now = Date.now();
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: 'host-resilience-test',
    currentPhase: 'auction',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 2,
    phaseStartedAt: now - 120_000,
    sessionStartedAt: now - 600_000,
    completedPhases: ['warmup', 'micro_challenge'],
    eventTier: 'glow',
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
  storeCtx.sessions.set(socialSessionId, state);
  storeCtx.participants.set(
    socialSessionId,
    new Map([
      ['host-user', { userId: 'host-user', displayName: 'Host', joinedAt: now - 600_000, lastSeenAt: now - hostSilenceMsAgo }],
      ['p2', { userId: 'p2', displayName: 'P2', joinedAt: now - 600_000, lastSeenAt: now }],
    ]),
  );
}

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
  storeCtx.raceHostHeartbeatBeforeTransfer = false;
});

describe('AC-W1.1 host-absent red repro', () => {
  it('non-host cannot advance while host is absent; transfer-host recovers the room', async () => {
    await withServer(async (baseUrl) => {
      seedSession('w1red', {}, 200_000);
      const cookie = await login(baseUrl, 'p2');

      // The freeze: host absent for 200s, yet the non-host still cannot advance.
      const advance = await fetch(`${baseUrl}/api/social-icebreaker/social_w1red/advance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ currentPhase: 'auction' }),
      });
      expect(advance.status).toBe(403);

      // The recovery path: after grace the non-host can claim host...
      const claim = await fetch(`${baseUrl}/api/social-icebreaker/social_w1red/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(claim.status).toBe(200);
      expect(storeCtx.sessions.get('social_w1red')!.hostUserId).toBe('p2');
    });
  });
});

describe('AC-W1.2 host claim grace window', () => {
  it('responds exactly per grace window and is idempotent on repeat', async () => {
    await withServer(async (baseUrl) => {
      // 180s grace: 179s silence → denied, 181s → allowed.
      seedSession('w1grace', {}, 179_000);
      const cookie = await login(baseUrl, 'p2');

      const freshAttempt = await fetch(`${baseUrl}/api/social-icebreaker/social_w1grace/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(freshAttempt.status).toBe(403);
      const denied = (await freshAttempt.json()) as { code?: string };
      expect(denied.code).toBe('HOST_ACTIVE');

      // Cross the boundary.
      storeCtx.participants.get('social_w1grace')!.get('host-user')!.lastSeenAt = Date.now() - 181_000;

      const claim = await fetch(`${baseUrl}/api/social-icebreaker/social_w1grace/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(claim.status).toBe(200);
      const claimBody = (await claim.json()) as { transferred: boolean; alreadyHost: boolean };
      expect(claimBody.transferred).toBe(true);
      expect(claimBody.alreadyHost).toBe(false);

      // Idempotent: repeating the claim by the new host succeeds without error.
      const repeat = await fetch(`${baseUrl}/api/social-icebreaker/social_w1grace/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(repeat.status).toBe(200);
      const repeatBody = (await repeat.json()) as { transferred: boolean; alreadyHost: boolean };
      expect(repeatBody.alreadyHost).toBe(true);
      expect(repeatBody.transferred).toBe(false);
    });
  });
});

describe('AC-W1.5 non-host cannot claim while host active', () => {
  it('returns 403 with HOST_ACTIVE while the host heartbeat is fresh', async () => {
    await withServer(async (baseUrl) => {
      seedSession('w1active', {}, 5_000);
      const cookie = await login(baseUrl, 'p2');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/social_w1active/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(403);
      expect(storeCtx.sessions.get('social_w1active')!.hostUserId).toBe('host-user');
    });
  });

  it('rejects a non-participant even after the host goes silent', async () => {
    await withServer(async (baseUrl) => {
      seedSession('w1stranger', {}, 300_000);
      const cookie = await login(baseUrl, 'stranger');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/social_w1stranger/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(403);
      expect(storeCtx.sessions.get('social_w1stranger')!.hostUserId).toBe('host-user');
    });
  });
});

describe('AC-W1.2 TOCTOU host heartbeat race', () => {
  it('rejects the claim with HOST_ACTIVE when the host heartbeats after the eligibility read', async () => {
    await withServer(async (baseUrl) => {
      // Host is silent past grace at the moment the route reads eligibility...
      seedSession('w1race', {}, 200_000);
      const cookie = await login(baseUrl, 'p2');
      // ...but a heartbeat lands before the store's row-locked re-verify.
      storeCtx.raceHostHeartbeatBeforeTransfer = true;

      const res = await fetch(`${baseUrl}/api/social-icebreaker/social_w1race/transfer-host`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('HOST_ACTIVE');
      // The active host is never deposed by the race.
      expect(storeCtx.sessions.get('social_w1race')!.hostUserId).toBe('host-user');
    });
  });
});

describe('AC-W1.2 config', () => {
  it('defaults to 180000 and accepts a positive override', () => {
    expect(SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS).toBe(180_000);
    expect(getHostClaimGraceMs({} as NodeJS.ProcessEnv)).toBe(180_000);
    expect(getHostClaimGraceMs({ SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS: '90000' } as NodeJS.ProcessEnv)).toBe(90_000);
    expect(getHostClaimGraceMs({ SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS: 'nope' } as NodeJS.ProcessEnv)).toBe(180_000);
    expect(getHostClaimGraceMs({ SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS: '-1' } as NodeJS.ProcessEnv)).toBe(180_000);
  });

  it('falls back to session start when the host never joined', () => {
    const result = evaluateHostClaimEligibility({
      hostLastSeenAtMs: null,
      sessionStartedAtMs: 1_000_000,
      now: 1_000_000 + 5_000,
      graceMs: 180_000,
    });
    expect(result.eligible).toBe(false);
    expect(result.hostSilenceMs).toBe(5_000);
  });
});
