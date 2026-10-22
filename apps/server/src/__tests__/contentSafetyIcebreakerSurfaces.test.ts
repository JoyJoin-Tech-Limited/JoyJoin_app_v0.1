/**
 * S5 — undercover-word describe, S6 — /start displayName, S8 — lie-detective
 * submit-tags content-moderation gates.
 *
 * All three live on the social icebreaker router: severe → 400
 * CONTENT_VIOLATION + recordViolation exactly once + state NOT mutated;
 * benign → 2xx + persisted.
 *
 * E9 extension (sprint e9-ugc-report, contract AC-05/AC-06) — named locks for
 * the four surfaces that gained filtering earlier but had no test lock, plus
 * the newly-gated avoidTopics input:
 *  - quip answer        socialIcebreakerGameplayCore.ts:1106 (optimistic) / :1143 (direct)
 *  - group-mirror reason socialIcebreakerGameplayExtra.ts:805 / :845
 *  - miniscript vote why domains/miniscript.ts:1126 (miniscript router)
 *  - V1 custom statements socialIcebreakerExtended.ts:908 (route :844)
 *  - avoidTopics (G3)   routes/socialIcebreaker.ts topics route — sync gate
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
const mockGenerateWarmupTopics = vi.fn();

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
    setMiniScriptSecrets: async () => {},
    getMiniScriptSecrets: async () => null,
    getPreGenerationResult: vi.fn().mockResolvedValue(null),
    getInFlightJobForPhase: vi.fn().mockResolvedValue(null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: mockGenerateWarmupTopics,
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
  getBots: vi.fn().mockReturnValue([]),
  simulateBotsForSession: vi.fn().mockResolvedValue(undefined),
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
  // Pass-through factory — the 429 contract is locked in
  // socialIcebreakerUgcReport.test.ts with the REAL limiter; this file only
  // exercises content gates.
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
// E9 AC-06: the miniscript vote surface lives on the top-level miniscript
// router (`/api/miniscript/vote`), so it is mounted here too.
const { default: miniscriptRouter } = await import('../routes/domains/miniscript');

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
  app.use('/api/miniscript', miniscriptRouter);
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

// ─────────────────────────────────────────────────────────────────────────────
// E9 (sprint e9-ugc-report, contract AC-05/AC-06) — named regression locks for
// the four previously-unlocked filtered surfaces + the newly gated avoidTopics.
// ─────────────────────────────────────────────────────────────────────────────

describe('E9 icebreaker content-safety surface locks (AC-05/AC-06)', () => {
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
    mockGenerateWarmupTopics.mockResolvedValue({
      data: [{ id: 't1', text: '安全话题', category: 'life' }],
      meta: { promptVersion: 'test', fallbackUsed: false },
    });
  });

  // ─── quip answer (socialIcebreakerGameplayCore.ts:1106/:1143) ─────────────

  it('quip severe answer → 400 CONTENT_VIOLATION + recordViolation once + answer NOT persisted', async () => {
    storeCtx.sessions.set('social_qp-s1', baseSession({
      socialSessionId: 'social_qp-s1',
      icebreakerSessionId: 'qp-s1',
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '最野的一次经历', category: 'story' }],
      quipBattleAnswers: [],
    }));
    storeCtx.participants.set('social_qp-s1', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_qp-s1/quip-battle/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ answers: [{ promptId: 'p1', answerText: '这个东西像毒品一样让人上瘾' }] }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storeCtx.sessions.get('social_qp-s1')!.quipBattleAnswers ?? []).toHaveLength(0);
    });
  });

  it('quip benign answer → 200 + answer persisted', async () => {
    storeCtx.sessions.set('social_qp-s2', baseSession({
      socialSessionId: 'social_qp-s2',
      icebreakerSessionId: 'qp-s2',
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '最野的一次经历', category: 'story' }],
      quipBattleAnswers: [],
    }));
    storeCtx.participants.set('social_qp-s2', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_qp-s2/quip-battle/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ answers: [{ promptId: 'p1', answerText: '在海边看日出的那个清晨' }] }),
      });

      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('social_qp-s2')!;
      expect(state.quipBattleAnswers?.[0]?.answerText).toBe('在海边看日出的那个清晨');
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── group-mirror reason (socialIcebreakerGameplayExtra.ts:805/:845) ──────

  it('group-mirror severe reasonText → 400 CONTENT_VIOLATION + recordViolation once + answer NOT persisted', async () => {
    storeCtx.sessions.set('social_gm-s1', baseSession({
      socialSessionId: 'social_gm-s1',
      icebreakerSessionId: 'gm-s1',
      currentPhase: 'group_mirror',
      groupMirrorQuestions: [{ id: 'q1', questionText: '谁最会暖场', category: 'appreciation' }],
      groupMirrorAnswers: [],
      groupMirrorSubmittedUserIds: [],
    }));
    storeCtx.participants.set('social_gm-s1', new Map([
      ['tester-1', { userId: 'tester-1', displayName: 'Tester' }],
      ['target-1', { userId: 'target-1', displayName: 'Target' }],
    ]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_gm-s1/group-mirror/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          answers: [{ questionId: 'q1', targetUserId: 'target-1', reasonText: '他是杀人不眨眼的恶魔' }],
        }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storeCtx.sessions.get('social_gm-s1')!.groupMirrorAnswers ?? []).toHaveLength(0);
    });
  });

  it('group-mirror benign reasonText → 200 + answer persisted', async () => {
    storeCtx.sessions.set('social_gm-s2', baseSession({
      socialSessionId: 'social_gm-s2',
      icebreakerSessionId: 'gm-s2',
      currentPhase: 'group_mirror',
      groupMirrorQuestions: [{ id: 'q1', questionText: '谁最会暖场', category: 'appreciation' }],
      groupMirrorAnswers: [],
      groupMirrorSubmittedUserIds: [],
    }));
    storeCtx.participants.set('social_gm-s2', new Map([
      ['tester-1', { userId: 'tester-1', displayName: 'Tester' }],
      ['target-1', { userId: 'target-1', displayName: 'Target' }],
    ]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_gm-s2/group-mirror/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          answers: [{ questionId: 'q1', targetUserId: 'target-1', reasonText: '他总是第一个破冰' }],
        }),
      });

      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('social_gm-s2')!;
      expect(state.groupMirrorAnswers?.[0]?.reasonText).toBe('他总是第一个破冰');
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── miniscript vote why (domains/miniscript.ts:1126) ─────────────────────

  it('miniscript-vote severe why → 400 CONTENT_VIOLATION + recordViolation once + vote NOT persisted', async () => {
    storeCtx.sessions.set('social_mv-s1', baseSession({
      socialSessionId: 'social_mv-s1',
      icebreakerSessionId: 'mv-s1',
      currentPhase: 'mini_script',
      miniScriptRoleAssignments: { 'tester-1': 0 },
      miniScriptFramework: {
        characters: [
          { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '在工位' },
          { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在培训' },
        ],
      } as any,
      miniScriptVotes: [],
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/miniscript/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId: 'social_mv-s1',
          vote: { suspectRoleSlot: 1, why: '宣传恐怖袭击内容' },
        }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storeCtx.sessions.get('social_mv-s1')!.miniScriptVotes ?? []).toHaveLength(0);
    });
  });

  it('miniscript-vote benign why → 200 + vote persisted with why', async () => {
    storeCtx.sessions.set('social_mv-s2', baseSession({
      socialSessionId: 'social_mv-s2',
      icebreakerSessionId: 'mv-s2',
      currentPhase: 'mini_script',
      miniScriptRoleAssignments: { 'tester-1': 0 },
      miniScriptFramework: {
        characters: [
          { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '在工位' },
          { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在培训' },
        ],
      } as any,
      miniScriptVotes: [],
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/miniscript/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId: 'social_mv-s2',
          vote: { suspectRoleSlot: 1, why: '他的不在场证明太完美了' },
        }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      const state = storeCtx.sessions.get('social_mv-s2')!;
      expect(state.miniScriptVotes?.[0]?.why).toBe('他的不在场证明太完美了');
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── lie-detective V1 custom statements (socialIcebreakerExtended.ts:908) ──

  it('V1 severe custom statement → 400 CONTENT_VIOLATION + recordViolation once + statements NOT persisted', async () => {
    storeCtx.sessions.set('social_v1-s1', baseSession({
      socialSessionId: 'social_v1-s1',
      icebreakerSessionId: 'v1-s1',
      currentPhase: 'lie_detective',
      lieDetectiveMode: 'v1',
    }));
    storeCtx.participants.set('social_v1-s1', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_v1-s1/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'Tester',
          statements: ['我去过三次南极', '宣传恐怖袭击内容', '我其实很怕黑'],
          lieIndex: 3,
        }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storeCtx.sessions.get('social_v1-s1')!.lieDetectivePlayers ?? []).toHaveLength(0);
    });
  });

  it('V1 benign custom statements → 200 + statements persisted WITHOUT isLie in public state', async () => {
    storeCtx.sessions.set('social_v1-s2', baseSession({
      socialSessionId: 'social_v1-s2',
      icebreakerSessionId: 'v1-s2',
      currentPhase: 'lie_detective',
      lieDetectiveMode: 'v1',
    }));
    storeCtx.participants.set('social_v1-s2', new Map([['tester-1', { userId: 'tester-1', displayName: 'Tester' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'tester-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_v1-s2/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'Tester',
          statements: ['我去过三次南极', '我会开滑翔伞', '我其实很怕黑'],
          lieIndex: 2,
        }),
      });

      expect(response.status).toBe(200);
      const state = storeCtx.sessions.get('social_v1-s2')!;
      const player = state.lieDetectivePlayers?.find((p) => p.userId === 'tester-1');
      expect(player?.statements).toHaveLength(3);
      for (const statement of player?.statements ?? []) {
        expect(statement).not.toHaveProperty('isLie');
      }
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  // ─── avoidTopics sync gate (AC-05, G3 — socialIcebreaker.ts topics route) ──

  it('avoidTopics severe entry → 400 CONTENT_VIOLATION + recordViolation exactly once (sync gate)', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_tp-s1/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ mood: 'relaxed', avoidTopics: ['前任', '毒品交易细节'] }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      // Exactly once — not more (one violation recorded), not less (not swallowed).
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      // The gate fires BEFORE resolveSession — no session state was touched.
      expect(storeCtx.sessions.has('social_tp-s1')).toBe(false);
    });
  });

  it('avoidTopics benign entries → 200 + topics generated', async () => {
    storeCtx.sessions.set('social_tp-s2', baseSession({
      socialSessionId: 'social_tp-s2',
      icebreakerSessionId: 'tp-s2',
      currentPhase: 'warmup',
    }));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'host-1');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_tp-s2/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ mood: 'relaxed', avoidTopics: ['前任', '收入'] }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.topics).toHaveLength(1);
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });
});
