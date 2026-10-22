/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report) — POST /api/social-icebreaker/:id/report-content
 *
 * Contract coverage:
 *  - AC-01: all six contentRef.kind snapshot to the original text; lieStatement
 *    snapshot carries NO isLie (SEC-02 secrecy boundary)
 *  - AC-02: cleaned/expired content degrades to metadata-only description
 *    marked 「内容已过期」
 *  - AC-03 (G4 self-harm trap lock): offensive snapshot text is written
 *    UNFILTERED (route still 201, no recordViolation, no filter log); the
 *    reporter's free-text note DOES go through validateContentSafeAsync
 *    (hit → 400 + recordViolation exactly once + no insert)
 *  - AC-04: rate limit 3/reporter/session/hour → 4th request 429 with
 *    retryAfterSeconds body field + Retry-After header; reporter must be a
 *    participant (403 NOT_A_PARTICIPANT); target must be a session member
 *    (403 TARGET_NOT_A_PARTICIPANT)
 *  - AC-09 / OBS-01: inserted row matches the admin moderation queue
 *    selector contract (status='pending' + category='inappropriate_content',
 *    i.e. exactly what moderationRepo.getPendingReports SELECTs) and the
 *    description prefix `[icebreaker:<phase>]` is machine-parseable
 *  - REL-02: bare getSessionWithExpiry read → 404 SESSION_NOT_FOUND /
 *    410 SESSION_EXPIRED; no auto-advance side effects on this path
 *
 * The rate limiter is intentionally NOT mocked — the 429 contract is part of
 * the acceptance criteria. Every test uses a unique session id so the shared
 * in-process limiter store never cross-talks between tests.
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { UgcContentRef } from '@shared/api';

const mockRecordViolation = vi.fn();
const mockCheckTextWithMsgSecCheck = vi.fn();
const mockGetFeatureFlag = vi.fn();
const mockGetFeatureFlagSync = vi.fn();

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

const dbCtx = vi.hoisted(() => ({
  insertedReports: [] as Array<Record<string, unknown>>,
  filterLogs: [] as Array<Record<string, unknown>>,
  groupEventId: 'event-group-1' as string | null,
}));

vi.mock('../db', async () => {
  const schema = await import('@shared/schema');
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (table === schema.eventPoolGroups) {
                return dbCtx.groupEventId ? [{ eventId: dbCtx.groupEventId }] : [];
              }
              // users (contentSafety resolveUserOpenid) + router middleware lookups
              return [{ wechatOpenId: 'openid-test' }];
            }),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          if (table === schema.reports) {
            dbCtx.insertedReports.push(values);
            return {
              returning: vi.fn(async () => [
                { ...values, id: `report-${dbCtx.insertedReports.length}` },
              ]),
            };
          }
          // contentFilterLogs fire-and-forget
          dbCtx.filterLogs.push(values);
          return { execute: vi.fn(async () => undefined) };
        },
      })),
    },
  };
});

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
  const expiredSessions = new Set<string>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string }>>();
  return { sessions, expiredSessions, participants };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, expiredSessions, participants } = storeCtx;
  return {
    SESSION_TTL_MS: 6 * 60 * 60 * 1000,
    PRESENCE_THRESHOLD_MS: 30_000,
    getSocialSessionId: (id: string) => `social_${id}`,
    getSession: async (socialSessionId: string) => sessions.get(socialSessionId) ?? null,
    getSessionWithExpiry: async (socialSessionId: string) => {
      if (expiredSessions.has(socialSessionId)) return { state: null, expired: true };
      return { state: sessions.get(socialSessionId) ?? null, expired: false };
    },
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
  validateLieDetectiveV2Tags: vi.fn().mockReturnValue({ valid: true, tags: [] }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  runBotSimulationSafely: vi.fn().mockResolvedValue(undefined),
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

// NOTE: '../rateLimiter' is deliberately NOT mocked — AC-04 locks the real
// 429 contract (retryAfterSeconds body field + Retry-After header).

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
const {
  snapshotIcebreakerUgc,
  buildIcebreakerUgcDescription,
  ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE,
  ICEBREAKER_UGC_DESCRIPTION_MAX,
} = await import('../lib/icebreakerUgcReport');

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
    socialSessionId: 'social_ugc-default',
    icebreakerSessionId: 'ugc-group-1',
    currentPhase: 'quip_battle',
    hostUserId: 'host-1',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    ...overrides,
  };
}

function joinPair(socialSessionId: string, reporterId = 'reporter-1', targetId = 'target-1') {
  storeCtx.participants.set(
    socialSessionId,
    new Map([
      [reporterId, { userId: reporterId, displayName: 'Reporter' }],
      [targetId, { userId: targetId, displayName: '坏名字目标' }],
    ]),
  );
}

function reportBody(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'quip_battle',
    targetUserId: 'target-1',
    contentRef: { kind: 'quipAnswer' },
    ...overrides,
  };
}

async function postReport(baseUrl: string, cookie: string, socialSessionId: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/report-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot helper unit tests (pure — no server)
// ─────────────────────────────────────────────────────────────────────────────

describe('snapshotIcebreakerUgc helper (AC-01 six kinds)', () => {
  const participants = [
    { userId: 'reporter-1', displayName: 'Reporter' },
    { userId: 'target-1', displayName: '目标昵称' },
  ];

  it('quipAnswer → quipBattleAnswers answerText (promptId/index disambiguation)', () => {
    const state = baseSession({
      quipBattleAnswers: [
        { userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: '第一条答案' },
        { userId: 'reporter-1', displayName: 'R', promptId: 'p1', answerText: '别人的答案' },
        { userId: 'target-1', displayName: 'T', promptId: 'p2', answerText: '第二条答案' },
      ],
    });
    const latest = snapshotIcebreakerUgc(state, participants, { kind: 'quipAnswer' }, 'target-1');
    expect(latest).toEqual({ found: true, text: '第二条答案', locator: { promptId: 'p2' } });

    const byPrompt = snapshotIcebreakerUgc(state, participants, { kind: 'quipAnswer', promptId: 'p1' }, 'target-1');
    expect(byPrompt.text).toBe('第一条答案');

    const byIndex = snapshotIcebreakerUgc(
      state,
      participants,
      { kind: 'quipAnswer', index: 0 },
      'target-1',
    );
    expect(byIndex.text).toBe('第一条答案');
  });

  it('undercoverDescription → undercoverWordRounds[].descriptions[] text (round filter)', () => {
    const state = baseSession({
      undercoverWordRounds: [
        {
          roundNumber: 1,
          descriptions: [
            { userId: 'target-1', displayName: 'T', text: '第一轮描述' },
            { userId: 'reporter-1', displayName: 'R', text: '别人的描述' },
          ],
        },
        {
          roundNumber: 2,
          descriptions: [{ userId: 'target-1', displayName: 'T', text: '第二轮描述' }],
        },
      ],
    });
    const latest = snapshotIcebreakerUgc(state, participants, { kind: 'undercoverDescription' }, 'target-1');
    expect(latest).toEqual({ found: true, text: '第二轮描述', locator: { round: 2 } });

    const round1 = snapshotIcebreakerUgc(state, participants, { kind: 'undercoverDescription', round: 1 }, 'target-1');
    expect(round1.text).toBe('第一轮描述');
  });

  it('lieStatement → lieDetectivePlayers[].statements[] text only — NEVER isLie (SEC-02)', () => {
    // Simulate a hypothetical legacy leak where the runtime statement object
    // still carries server-secret keys; the helper must extract text only.
    const state = baseSession({
      lieDetectivePlayers: [
        {
          userId: 'target-1',
          displayName: 'T',
          statements: [
            { index: 1, text: '我去过南极', isLie: false, is_ai: true, source_tag: '旅行' },
            { index: 2, text: '我会开飞机', isLie: true, is_ai: false, source_tag: null },
            { index: 3, text: '我怕猫', isLie: false },
          ] as any,
        },
      ],
    });
    const latest = snapshotIcebreakerUgc(state, participants, { kind: 'lieStatement' }, 'target-1');
    expect(latest.found).toBe(true);
    expect(latest.text).toBe('我怕猫');
    expect(latest).not.toHaveProperty('isLie');
    expect(latest).not.toHaveProperty('is_ai');
    expect(latest).not.toHaveProperty('source_tag');
    expect(JSON.stringify(latest)).not.toContain('isLie');

    const byIndex = snapshotIcebreakerUgc(state, participants, { kind: 'lieStatement', index: 2 }, 'target-1');
    expect(byIndex.text).toBe('我会开飞机');
    expect(byIndex.locator).toEqual({ statementIndex: 2 });
    expect(JSON.stringify(byIndex)).not.toContain('isLie');
  });

  it('groupMirrorReason → groupMirrorAnswers[].reasonText (NOT .reason — verifier R1 field lock)', () => {
    const state = baseSession({
      groupMirrorAnswers: [
        { userId: 'target-1', displayName: 'T', questionId: 'q1', targetUserId: 'reporter-1', reasonText: '因为他总是暖场' },
        // A legacy/foreign shape carrying `.reason` instead must NOT resolve.
        { userId: 'target-1', displayName: 'T', questionId: 'q2', targetUserId: 'reporter-1', reason: '错误字段' } as any,
      ],
    });
    const found = snapshotIcebreakerUgc(state, participants, { kind: 'groupMirrorReason' }, 'target-1');
    expect(found).toEqual({ found: true, text: '因为他总是暖场', locator: { questionId: 'q1' } });

    const wrongFieldOnly = snapshotIcebreakerUgc(
      state,
      participants,
      { kind: 'groupMirrorReason', promptId: 'q2' },
      'target-1',
    );
    expect(wrongFieldOnly.found).toBe(false);
  });

  it('miniscriptVoteNote → miniScriptVotes[].why', () => {
    const state = baseSession({
      miniScriptVotes: [
        { userId: 'target-1', suspectRoleSlot: 2, why: '他眼神飘忽', votedAt: Date.now() },
        { userId: 'reporter-1', suspectRoleSlot: 1, why: '别人的附言', votedAt: Date.now() },
      ],
    });
    const found = snapshotIcebreakerUgc(state, participants, { kind: 'miniscriptVoteNote' }, 'target-1');
    expect(found).toEqual({ found: true, text: '他眼神飘忽' });
  });

  it('displayName → participants roster snapshot', () => {
    const state = baseSession();
    const found = snapshotIcebreakerUgc(state, participants, { kind: 'displayName' }, 'target-1');
    expect(found).toEqual({ found: true, text: '目标昵称' });
  });

  it('AC-02 degradation: cleaned/absent content → found:false for every kind', () => {
    const emptyState = baseSession();
    const kinds: UgcContentRef['kind'][] = [
      'quipAnswer',
      'undercoverDescription',
      'lieStatement',
      'groupMirrorReason',
      'miniscriptVoteNote',
      'displayName',
    ];
    for (const kind of kinds) {
      expect(snapshotIcebreakerUgc(emptyState, [], { kind }, 'target-1').found).toBe(false);
    }
    expect(snapshotIcebreakerUgc(null, participants, { kind: 'quipAnswer' }, 'target-1').found).toBe(false);
  });
});

describe('buildIcebreakerUgcDescription (AC-09/OBS-01 prefix lock)', () => {
  it('found snapshot: prefix machine-parseable + raw text + note suffix', () => {
    const description = buildIcebreakerUgcDescription({
      phase: 'quip_battle',
      kind: 'quipAnswer',
      targetUserId: 'target-1',
      snapshot: { found: true, text: '原文内容', locator: { promptId: 'p1' } },
      note: '这条很过分',
    });
    const match = description.match(ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE);
    expect(match?.[1]).toBe('quip_battle');
    expect(description).toContain('原文:「原文内容」');
    expect(description).toContain('promptId=p1');
    expect(description.endsWith(' — 备注:这条很过分')).toBe(true);
  });

  it('degraded: 内容已过期 + metadata, no 原文 segment', () => {
    const description = buildIcebreakerUgcDescription({
      phase: 'lie_detective',
      kind: 'lieStatement',
      targetUserId: 'target-1',
      snapshot: { found: false },
      reportedAt: new Date('2026-10-21T08:00:00.000Z'),
    });
    expect(ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE.test(description)).toBe(true);
    expect(description).toContain('内容已过期');
    expect(description).toContain('kind=lieStatement');
    expect(description).toContain('target=target-1');
    expect(description).toContain('at=2026-10-21T08:00:00.000Z');
    expect(description).not.toContain('原文:');
  });

  it('truncates to ≤2000 chars', () => {
    const description = buildIcebreakerUgcDescription({
      phase: 'quip_battle',
      kind: 'quipAnswer',
      targetUserId: 'target-1',
      snapshot: { found: true, text: '长'.repeat(5000) },
    });
    expect(description.length).toBeLessThanOrEqual(ICEBREAKER_UGC_DESCRIPTION_MAX);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/social-icebreaker/:socialSessionId/report-content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtx.insertedReports.length = 0;
    dbCtx.filterLogs.length = 0;
    dbCtx.groupEventId = 'event-group-1';
    storeCtx.sessions.clear();
    storeCtx.expiredSessions.clear();
    storeCtx.participants.clear();
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
  });

  it('AC-01 happy path: quip answer snapshot → 201 + reports row with raw text, prefix, group eventId', async () => {
    const sid = 'social_ugc-happy-quip';
    storeCtx.sessions.set(sid, baseSession({
      socialSessionId: sid,
      quipBattleAnswers: [
        { userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: '我觉得最野的一次旅行' },
      ],
    }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({ contentRef: { kind: 'quipAnswer', promptId: 'p1' } }));
      const body = await response.json() as any;

      expect(response.status).toBe(201);
      expect(body).toMatchObject({ id: 'report-1', category: 'inappropriate_content', status: 'pending', degraded: false });

      expect(dbCtx.insertedReports).toHaveLength(1);
      const inserted = dbCtx.insertedReports[0];
      expect(inserted.reporterId).toBe('reporter-1');
      expect(inserted.reportedUserId).toBe('target-1');
      expect(inserted.category).toBe('inappropriate_content');
      expect(inserted.status).toBe('pending');
      expect(inserted.relatedEventId).toBe('event-group-1');
      const description = String(inserted.description);
      expect(ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE.test(description)).toBe(true);
      expect(description).toContain('[icebreaker:quip_battle]');
      expect(description).toContain('原文:「我觉得最野的一次旅行」');
      expect(description.length).toBeLessThanOrEqual(2000);
    });
  });

  it('AC-01: displayName kind snapshots from the participants roster', async () => {
    const sid = 'social_ugc-happy-name';
    storeCtx.sessions.set(sid, baseSession({ socialSessionId: sid }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({
        phase: 'warmup',
        contentRef: { kind: 'displayName' },
      }));
      expect(response.status).toBe(201);
      const description = String(dbCtx.insertedReports[0].description);
      expect(description).toContain('[icebreaker:warmup]');
      expect(description).toContain('原文:「坏名字目标」');
    });
  });

  it('AC-02: content cleaned before report → degraded metadata description with 内容已过期', async () => {
    const sid = 'social_ugc-degraded';
    // State exists but the quip answers were already cleaned on phase advance.
    storeCtx.sessions.set(sid, baseSession({ socialSessionId: sid, currentPhase: 'recap' }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({ phase: 'quip_battle' }));
      const body = await response.json() as any;

      expect(response.status).toBe(201);
      expect(body.degraded).toBe(true);
      const description = String(dbCtx.insertedReports[0].description);
      expect(description).toContain('[icebreaker:quip_battle]');
      expect(description).toContain('内容已过期');
      expect(description).toContain('kind=quipAnswer');
      expect(description).toContain('target=target-1');
      expect(description).not.toContain('原文:');
    });
  });

  it('AC-03 (G4 lock): offensive snapshot text is stored UNFILTERED — 201, no recordViolation, no filter log', async () => {
    const sid = 'social_ugc-g4';
    const offensiveText = '这个东西像毒品一样让人上瘾';
    storeCtx.sessions.set(sid, baseSession({
      socialSessionId: sid,
      quipBattleAnswers: [
        { userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: offensiveText },
      ],
    }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({
        note: '他在答案里写违规内容',
      }));
      const body = await response.json() as any;

      // The report itself must NOT be rejected by the content filter even
      // though the evidence text contains a severe word.
      expect(response.status).toBe(201);
      expect(body.degraded).toBe(false);
      const description = String(dbCtx.insertedReports[0].description);
      expect(description).toContain(`原文:「${offensiveText}」`);
      // Reporter committed no violation: no escalation, no filter log rows.
      expect(mockRecordViolation).not.toHaveBeenCalled();
      expect(dbCtx.filterLogs).toHaveLength(0);
    });
  });

  it('AC-03: reporter note is content-gated — severe note → 400 CONTENT_VIOLATION + recordViolation exactly once + NO insert', async () => {
    const sid = 'social_ugc-note-gate';
    storeCtx.sessions.set(sid, baseSession({
      socialSessionId: sid,
      quipBattleAnswers: [
        { userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: '正常答案' },
      ],
    }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({
        note: '你就是个毒品贩子',
      }));
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe('CONTENT_VIOLATION');
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(dbCtx.insertedReports).toHaveLength(0);
    });
  });

  it('AC-04: rate limit 3/reporter/session/hour — 4th request → 429 + retryAfterSeconds + Retry-After header', async () => {
    const sid = 'social_ugc-ratelimit';
    storeCtx.sessions.set(sid, baseSession({
      socialSessionId: sid,
      quipBattleAnswers: [
        { userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: '答案内容' },
      ],
    }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      for (let i = 0; i < 3; i++) {
        const response = await postReport(baseUrl, cookie, sid, reportBody());
        expect(response.status).toBe(201);
      }
      const fourth = await postReport(baseUrl, cookie, sid, reportBody());
      const body = await fourth.json() as any;

      expect(fourth.status).toBe(429);
      expect(body.code).toBe('UGC_REPORT_RATE_LIMITED');
      expect(typeof body.retryAfterSeconds).toBe('number');
      expect(body.retryAfterSeconds).toBeGreaterThan(0);
      expect(fourth.headers.get('retry-after')).toBe(String(body.retryAfterSeconds));
      expect(dbCtx.insertedReports).toHaveLength(3);
    });
  });

  it('AC-04: rate limit key is reporter×session — a different session is unaffected', async () => {
    const sidA = 'social_ugc-rl-key-a';
    const sidB = 'social_ugc-rl-key-b';
    for (const sid of [sidA, sidB]) {
      storeCtx.sessions.set(sid, baseSession({
        socialSessionId: sid,
        quipBattleAnswers: [{ userId: 'target-1', displayName: 'T', promptId: 'p1', answerText: '答案' }],
      }));
      joinPair(sid);
    }

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      for (let i = 0; i < 3; i++) {
        expect((await postReport(baseUrl, cookie, sidA, reportBody())).status).toBe(201);
      }
      expect((await postReport(baseUrl, cookie, sidA, reportBody())).status).toBe(429);
      // Same reporter, different session → fresh budget.
      expect((await postReport(baseUrl, cookie, sidB, reportBody())).status).toBe(201);
    });
  });

  it('SEC-01: reporter not a participant → 403 NOT_A_PARTICIPANT', async () => {
    const sid = 'social_ugc-not-participant';
    storeCtx.sessions.set(sid, baseSession({ socialSessionId: sid }));
    storeCtx.participants.set(sid, new Map([['target-1', { userId: 'target-1', displayName: 'Target' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'outsider-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody());
      const body = await response.json() as any;
      expect(response.status).toBe(403);
      expect(body.code).toBe('NOT_A_PARTICIPANT');
      expect(dbCtx.insertedReports).toHaveLength(0);
    });
  });

  it('SEC-01: target not in session → 403 TARGET_NOT_A_PARTICIPANT', async () => {
    const sid = 'social_ugc-target-outside';
    storeCtx.sessions.set(sid, baseSession({ socialSessionId: sid }));
    storeCtx.participants.set(sid, new Map([['reporter-1', { userId: 'reporter-1', displayName: 'Reporter' }]]));

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody());
      const body = await response.json() as any;
      expect(response.status).toBe(403);
      expect(body.code).toBe('TARGET_NOT_A_PARTICIPANT');
      expect(dbCtx.insertedReports).toHaveLength(0);
    });
  });

  it('REL-02: unknown session → 404 SESSION_NOT_FOUND', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, 'social_ugc-missing', reportBody());
      const body = await response.json() as any;
      expect(response.status).toBe(404);
      expect(body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  it('REL-02: expired session → 410 SESSION_EXPIRED with expired flag', async () => {
    const sid = 'social_ugc-expired';
    storeCtx.expiredSessions.add(sid);
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody());
      const body = await response.json() as any;
      expect(response.status).toBe(410);
      expect(body.code).toBe('SESSION_EXPIRED');
      expect(body.expired).toBe(true);
      expect(dbCtx.insertedReports).toHaveLength(0);
    });
  });

  it('unauthenticated → 401', async () => {
    await withServer(async (baseUrl) => {
      const response = await postReport(baseUrl, '', 'social_ugc-unauth', reportBody());
      expect(response.status).toBe(401);
    });
  });

  it('invalid body (unknown kind) → 400 INVALID_BODY', async () => {
    const sid = 'social_ugc-badbody';
    storeCtx.sessions.set(sid, baseSession({ socialSessionId: sid }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({
        contentRef: { kind: 'notARealKind' },
      }));
      const body = await response.json() as any;
      expect(response.status).toBe(400);
      expect(body.code).toBe('INVALID_BODY');
      expect(dbCtx.insertedReports).toHaveLength(0);
    });
  });

  it('AC-09 admin-queue smoke: inserted row matches the /api/admin/moderation/reports pending selector contract', async () => {
    // moderationRepo.getPendingReports() runs `SELECT r.* FROM reports r WHERE
    // r.status = 'pending'` (no category filter) — so a row with
    // status='pending' + category='inappropriate_content' surfaces in the
    // existing admin UserReportsTab with zero admin-side change. This asserts
    // the exact selector semantics on the insert payload, plus the
    // machine-parseable phase prefix the admin reads.
    const sid = 'social_ugc-admin-smoke';
    storeCtx.sessions.set(sid, baseSession({
      socialSessionId: sid,
      undercoverWordRounds: [
        { roundNumber: 1, descriptions: [{ userId: 'target-1', displayName: 'T', text: '像某种饮料' }] },
      ],
    }));
    joinPair(sid);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'reporter-1');
      const response = await postReport(baseUrl, cookie, sid, reportBody({
        phase: 'undercover_word',
        contentRef: { kind: 'undercoverDescription', round: 1 },
        note: '请管理员看看',
      }));
      expect(response.status).toBe(201);

      const inserted = dbCtx.insertedReports[0];
      // Admin queue selector contract: WHERE status='pending' (all categories).
      expect(inserted.status).toBe('pending');
      expect(inserted.category).toBe('inappropriate_content');
      const description = String(inserted.description);
      const prefixMatch = description.match(ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE);
      expect(prefixMatch?.[1]).toBe('undercover_word');
      expect(description).toContain('原文:「像某种饮料」');
      expect(description).toContain('round=1');
      expect(description.endsWith(' — 备注:请管理员看看')).toBe(true);
    });
  });
});
