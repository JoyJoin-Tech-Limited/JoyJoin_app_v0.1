/**
 * POST /api/social-icebreaker/:id/force-end — Wave 5 T-2 (§2-f G3-b).
 *
 * Force-end is a terminal exit that bypasses transitionPhase. When the table
 * is sitting in recap, the route must write the terminal recap dwell row
 * (recap has no outgoing transition, so no other writer exists for this
 * path). From any other phase no recap row may be written.
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const { recordRecapDwellMetricMock, getFeatureFlagMock } = vi.hoisted(() => ({
  recordRecapDwellMetricMock: vi.fn(),
  getFeatureFlagMock: vi.fn(),
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
    recordRecapDwellMetric: recordRecapDwellMetricMock,
    // Real 口径 implementation (pure) so the route's floor/skip semantics
    // are exercised, not mocked away.
    computeRecapDwellMs: (phaseStartedAtMs: number | null | undefined, terminatedAtMs: number) => {
      if (typeof phaseStartedAtMs !== 'number' || !Number.isFinite(phaseStartedAtMs)) return null;
      const dwell = terminatedAtMs - phaseStartedAtMs;
      return dwell >= 1000 ? dwell : null;
    },
  };
});

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: getFeatureFlagMock,
}));

vi.mock('../socialIcebreakerAIService', () => ({
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
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  buildLieDetectiveV2RecapData: vi.fn(),
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

function baseSession(overrides: Partial<SocialSessionState> & { socialSessionId: string }): SocialSessionState {
  return {
    icebreakerSessionId: 'force-end-test',
    currentPhase: 'recap',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now() - 120_000,
    sessionStartedAt: Date.now() - 3_600_000,
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

function seedSession(state: SocialSessionState): void {
  storeCtx.sessions.set(state.socialSessionId, state);
  const m = new Map();
  m.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now(), lastSeenAt: Date.now() });
  storeCtx.participants.set(state.socialSessionId, m);
}

describe('POST /:socialSessionId/force-end recap dwell (Wave 5 T-2)', () => {
  beforeEach(() => {
    recordRecapDwellMetricMock.mockReset();
    recordRecapDwellMetricMock.mockResolvedValue(undefined);
    getFeatureFlagMock.mockReset();
    getFeatureFlagMock.mockResolvedValue(true);
  });

  it('writes a recap dwell row when the session is force-ended from recap', async () => {
    const id = 'social_fe-recap';
    const phaseStartedAt = Date.now() - 120_000;
    seedSession(baseSession({ socialSessionId: id, currentPhase: 'recap', phaseStartedAt }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/force-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(200);

      expect(recordRecapDwellMetricMock).toHaveBeenCalledTimes(1);
      const [calledSessionId, metric] = recordRecapDwellMetricMock.mock.calls[0];
      expect(calledSessionId).toBe(id);
      // dwell ≈ now − phaseStartedAt (route computes at call time)
      expect(metric.dwellTimeMs).toBeGreaterThanOrEqual(120_000);
      expect(metric.startedAt).toEqual(new Date(phaseStartedAt));
      expect(metric.participantCount).toBe(4);
      expect(storeCtx.sessions.get(id)?.currentPhase).toBe('ended');
    });
  });

  it('writes NO recap row when force-ended from a non-recap phase', async () => {
    const id = 'social_fe-auction';
    seedSession(baseSession({ socialSessionId: id, currentPhase: 'auction' }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/force-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      expect(recordRecapDwellMetricMock).not.toHaveBeenCalled();
    });
  });

  it('writes nothing when the force-end flag is off (503)', async () => {
    const id = 'social_fe-flagoff';
    seedSession(baseSession({ socialSessionId: id, currentPhase: 'recap' }));
    getFeatureFlagMock.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/force-end`, {
        method: 'POST',
        headers: { cookie },
      });
      expect(res.status).toBe(503);
      expect(recordRecapDwellMetricMock).not.toHaveBeenCalled();
    });
  });
});
