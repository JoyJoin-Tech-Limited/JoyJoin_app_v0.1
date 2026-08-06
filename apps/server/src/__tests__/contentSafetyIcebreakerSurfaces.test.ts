/**
 * S5 — undercover-word describe, S6 — /start displayName, S8 — lie-detective
 * submit-tags content-moderation gates.
 *
 * All three live on the social icebreaker router: severe → 400
 * CONTENT_VIOLATION + recordViolation exactly once + state NOT mutated;
 * benign → 2xx + persisted.
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';

const logRows: Array<Record<string, unknown>> = [];
const mockRecordViolation = vi.fn();
const mockCheckTextWithMsgSecCheck = vi.fn();
const mockGetFeatureFlag = vi.fn();
const mockGetFeatureFlagSync = vi.fn();
const mockValidateLieDetectiveV2Tags = vi.fn();
const mockRunBotSimulationSafely = vi.fn();

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: mockGetFeatureFlag,
  getFeatureFlagSync: mockGetFeatureFlagSync,
  refreshFeatureFlag: vi.fn(),
  listFeatureFlags: vi.fn(),
}));

vi.mock('../lib/wechatMsgSecCheck', () => ({
  checkTextWithMsgSecCheck: mockCheckTextWithMsgSecCheck,
  warmWechatAccessToken: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ wechatOpenId: 'openid-test' }])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        logRows.push(values);
        return { execute: vi.fn(() => Promise.resolve()) };
      },
    })),
  },
}));

vi.mock('../abuseDetection', () => ({
  recordViolation: mockRecordViolation,
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string }>>();
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
    createSession: async (st: SocialSessionState) => {
      sessions.set(st.socialSessionId, st);
    },
    updateSession: async (socialSessionId: string, st: SocialSessionState) => {
      sessions.set(socialSessionId, st);
    },
    upsertParticipant: async (socialSessionId: string, userId: string, displayName: string) => {
      if (!participants.has(socialSessionId)) participants.set(socialSessionId, new Map());
      participants.get(socialSessionId)!.set(userId, { userId, displayName });
    },
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
    listParticipants: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return [];
      return [...ps.values()].map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        isActive: true,
      }));
    },
    heartbeat: async () => {},
    getRosterCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
      return participants.get(socialSessionId)?.size ?? 0;
    },
    getActiveParticipantCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
      return participants.get(socialSessionId)?.size ?? 0;
    },
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    getPreGenerationResult: vi.fn().mockResolvedValue(null),
    getInFlightJobForPhase: vi.fn().mockResolvedValue(null),
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
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
  getLieDetectiveMode: vi.fn().mockReturnValue('v2'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: mockValidateLieDetectiveV2Tags,
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  runBotSimulationSafely: mockRunBotSimulationSafely,
  seedSingleTestBotsWarmupReady: vi.fn(),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn(async (_payload: any, validate: () => Promise<boolean>, apply: () => Promise<void>) => {
    const valid = await validate();
    if (!valid) return { accepted: false, conflict: 'validation_failed' };
    await apply();
    return { accepted: true };
  }),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../rateLimiter', () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
  momentCardLimiter: (_req: any, _res: any, next: any) => next(),
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

function baseSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: overrides.socialSessionId ?? 'social_s1-test',
    icebreakerSessionId: 's1-test',
    currentPhase: 'undercover_word',
    hostUserId: 'host-1',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'glow',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'undercover_word', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: GLOW_RUN_PLAN,
    ...overrides,
  };
}

describe('social icebreaker surface content moderation (S5/S6/S8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    storeCtx.sessions.clear();
    storeCtx.participants.clear();
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    mockRunBotSimulationSafely.mockResolvedValue(undefined);
    mockValidateLieDetectiveV2Tags.mockReturnValue({ valid: true, tags: ['爱旅行', '喜欢咖啡'] });
  });

  // ─── S5: undercover-word describe ─────────────────────────────────────────

  it('S5 severe describe text → 400 CONTENT_VIOLATION + recordViolation once + state NOT mutated', async () => {
    storeCtx.sessions.set('social_uw-s1', baseSession({
      socialSessionId: 'social_uw-s1',
      icebreakerSessionId: 'uw-s1',
      undercoverWordPair: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
      undercoverWordCurrentRound: 0,
      undercoverWordRounds: [],
    }));
    storeCtx.participants.set('social_uw-s1', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_uw-s1/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ text: '这个东西像毒品一样让人上瘾' }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      const state = storeCtx.sessions.get('social_uw-s1')!;
      expect(state.undercoverWordRounds ?? []).toHaveLength(0);
    });
  });

  it('S5 benign describe text → 200 + description persisted', async () => {
    storeCtx.sessions.set('social_uw-s1', baseSession({
      socialSessionId: 'social_uw-s1',
      icebreakerSessionId: 'uw-s1',
      undercoverWordPair: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
      undercoverWordCurrentRound: 0,
      undercoverWordRounds: [],
    }));
    storeCtx.participants.set('social_uw-s1', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_uw-s1/undercover-word/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ text: '甜甜的饮料，下午茶必备' }),
      });

      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('social_uw-s1')!;
      expect(state.undercoverWordRounds?.[0]?.descriptions?.[0]?.text).toBe('甜甜的饮料，下午茶必备');
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── S6: /start displayName ───────────────────────────────────────────────

  it('S6 severe displayName → 400 CONTENT_VIOLATION + recordViolation once + participant NOT upserted', async () => {
    storeCtx.sessions.set('social_start-s1', baseSession({
      socialSessionId: 'social_start-s1',
      icebreakerSessionId: 'start-s1',
      currentPhase: 'warmup',
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ sessionId: 'start-s1', displayName: '我是杀人狂魔' }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      const participantMap = storeCtx.participants.get('social_start-s1');
      expect(participantMap?.has('tester-1') ?? false).toBe(false);
    });
  });

  it('S6 benign displayName → 200 + participant upserted with the name', async () => {
    storeCtx.sessions.set('social_start-s1', baseSession({
      socialSessionId: 'social_start-s1',
      icebreakerSessionId: 'start-s1',
      currentPhase: 'warmup',
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ sessionId: 'start-s1', displayName: '爱笑的小柯基' }),
      });

      expect(response.status).toBe(200);
      expect(storeCtx.participants.get('social_start-s1')?.get('tester-1')?.displayName).toBe('爱笑的小柯基');
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── S8: lie-detective submit-tags ────────────────────────────────────────

  it('S8 severe tag → 400 CONTENT_VIOLATION + recordViolation once + tags NOT stored', async () => {
    storeCtx.sessions.set('social_ld-s1', baseSession({
      socialSessionId: 'social_ld-s1',
      icebreakerSessionId: 'ld-s1',
      currentPhase: 'lie_detective',
      lieDetectiveMode: 'v2',
      lieDetectiveV2Tags: {},
    }));
    mockValidateLieDetectiveV2Tags.mockReturnValue({ valid: true, tags: ['喜欢旅行', '宣传恐怖袭击'] });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_ld-s1/lie-detective/submit-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ tags: ['喜欢旅行', '宣传恐怖袭击'] }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      const state = storeCtx.sessions.get('social_ld-s1')!;
      expect(state.lieDetectiveV2Tags?.['tester-1']).toBeUndefined();
    });
  });

  it('S8 benign tags → 200 + tags stored', async () => {
    storeCtx.sessions.set('social_ld-s1', baseSession({
      socialSessionId: 'social_ld-s1',
      icebreakerSessionId: 'ld-s1',
      currentPhase: 'lie_detective',
      lieDetectiveMode: 'v2',
      lieDetectiveV2Tags: {},
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_ld-s1/lie-detective/submit-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ tags: ['爱旅行', '喜欢咖啡'] }),
      });

      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('social_ld-s1')!;
      expect(state.lieDetectiveV2Tags?.['tester-1']).toEqual(['爱旅行', '喜欢咖啡']);
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });
});
