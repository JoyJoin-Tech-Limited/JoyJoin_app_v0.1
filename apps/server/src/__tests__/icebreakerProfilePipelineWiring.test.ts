/**
 * W1–W3 profile pipeline — WIRING regressions (FU-03 / FU-04).
 *
 * The green unit tests around `deriveTablePersona` / `buildRunPlanShapeKey`
 * proved the pure functions, but not that production code actually reaches
 * them. These tests assert the seams:
 *
 * - FU-04①: the group_mirror route passes derived `tableAnchors` into
 *   `generateGroupMirrorQuestions` when `icebreakerMatchingAwareEnabled` is on,
 *   and passes none when it is off (flag mocked, roster mocked).
 * - FU-03: the pre-generation worker's `group_mirror` generator and the HTTP
 *   route reach `generateGroupMirrorQuestions` with the SAME anchors from the
 *   same roster — i.e. the shared `deriveTableAnchorsForGeneration` helper is
 *   really used by both, and the dead pre-gen path is no longer latent drift.
 * - FU-04②: the warmup-growth recompile path compares run plans with
 *   `buildRunPlanShapeKey` (not phase names), so a duration-only recalibration
 *   is actually persisted.
 */

import express from 'express';
import session from 'express-session';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IcebreakerRunPlan } from '@shared/phaseModule';
import { createWithServer } from '../test-utils/withServer';
import { buildRunPlanShapeKey } from '../lib/runPlanShape';
import { PHASE_GENERATORS } from '../jobs/preGenerationWorker';

// ─── Hoisted test seams ─────────────────────────────────────────────────────

const {
  rosterProfiles,
  generateGroupMirrorQuestionsMock,
  getFeatureFlagMock,
  getLatestRoleResultsForUsersMock,
} = vi.hoisted(() => ({
  rosterProfiles: new Map<string, { archetype?: string; interests?: string[] }>(),
  generateGroupMirrorQuestionsMock: vi.fn(async (_params: Record<string, unknown>) => ({
    data: [
      { id: 'gm_1', questionText: '谁最可能组织下一次聚会？', category: 'perception' },
      { id: 'gm_2', questionText: '谁最会接住冷场？', category: 'perception' },
    ],
    meta: {
      generatedAt: '2026-10-29T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-group-mirror-v1',
    },
  })),
  getFeatureFlagMock: vi.fn(async (_key: string, fallback?: boolean) => fallback ?? false),
  getLatestRoleResultsForUsersMock: vi.fn(async () => new Map()),
}));

// ─── In-memory socialIcebreakerStore (no PostgreSQL) ────────────────────────
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();

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
    createSession: async (state: any) => {
      sessions.set(state.socialSessionId, state);
    },
    updateSession: async (socialSessionId: string, state: any) => {
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
      const participant = participants.get(socialSessionId)?.get(userId);
      if (participant) participant.lastSeenAt = Date.now();
    },
    getRosterCount: async (socialSessionId: string) => participants.get(socialSessionId)?.size ?? 0,
    getActiveParticipantCount: async (socialSessionId: string) =>
      participants.get(socialSessionId)?.size ?? 0,
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
    // The real store attaches `interests` only when the matching-aware flag is
    // on. This mock always attaches them, which is deliberate: it proves the
    // ROUTE's own flag gate is what drops anchors, not the roster projection.
    listParticipants: async (socialSessionId: string) => {
      const roster = participants.get(socialSessionId);
      if (!roster) return [];
      return [...roster.values()]
        .sort((left, right) => left.joinedAt - right.joinedAt)
        .map((participant) => {
          const profile = rosterProfiles.get(participant.userId);
          return {
            userId: participant.userId,
            displayName: participant.displayName,
            joinedAt: new Date(participant.joinedAt).toISOString(),
            lastSeenAt: new Date(participant.lastSeenAt).toISOString(),
            isActive: true,
            ...(profile?.archetype ? { archetype: profile.archetype } : {}),
            ...(profile?.interests ? { interests: profile.interests } : {}),
          };
        });
    },
    setLieTruths: vi.fn(async () => {}),
    getLieTruths: vi.fn(async () => null),
    loadSessionLieTruths: vi.fn(async () => new Map()),
    savePhaseMetric: vi.fn(async () => {}),
    getPhaseRatings: vi.fn(async () => []),
    logMomentCardInteraction: vi.fn(async () => {}),
    getMomentCardStats: vi.fn(async () => ({})),
    getPreGenerationResult: vi.fn(async () => null),
    getInFlightJobForPhase: vi.fn(async () => null),
    invalidatePreGenerationForSession: vi.fn(async () => {}),
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  getCuratedWarmupTopics: vi.fn(() => []),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  generateXiaoYueComment: vi.fn(),
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generatePersonalityDiceChallengeGroups: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: generateGroupMirrorQuestionsMock,
  generateMomentHighlights: vi.fn(),
  generateAdaptiveGameSuggestion: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  validateLieDetectiveV2Tags: vi.fn(() => ({ valid: true, violations: [] })),
  getLieDetectiveMode: vi.fn(() => 'v1'),
  getDynamicDifficulty: vi.fn(() => 'medium'),
  buildLieDetectiveV2RecapData: vi.fn(() => ({
    aiWinRate: 0,
    hardestRound: 0,
    fooledEveryone: 0,
  })),
}));

vi.mock('../lib/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/featureFlags')>();
  return { ...actual, getFeatureFlag: getFeatureFlagMock };
});

vi.mock('../repositories/assessmentRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../repositories/assessmentRepo')>();
  return { ...actual, getLatestRoleResultsForUsers: getLatestRoleResultsForUsersMock };
});

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn(async () => ({ allowed: true })),
  resolveIcebreakerDefaultTier: vi.fn(async () => 'breeze'),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn(async () => []),
  shouldSkipOnDemandGeneration: vi.fn(async () => ({ skip: false, reason: 'none' })),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) return { accepted: false, conflict: 'validation_failed' };
    await apply(_payload);
    return { accepted: true };
  }),
  isOperationIdProcessed: vi.fn(async () => false),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
const { getSession, updateSession } = await import('../lib/socialIcebreakerStore');

// ─── Harness ────────────────────────────────────────────────────────────────

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
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  return app;
}

const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

/**
 * Six-person table: `咖啡` is shared by exactly three members, which clears the
 * large-roster anchor threshold (`TABLE_PERSONA_LARGE_ROSTER` → minMembers 3).
 * Every member is `corgi`, so the archetype-composition energy band is `high`;
 * ACOEXP rows supplied in a test can therefore be seen to override it.
 */
const ROSTER_FIXTURE = [
  { userId: 'host-user', displayName: 'Host', archetype: 'corgi', interests: ['咖啡', '摄影'] },
  { userId: 'p2', displayName: 'P2', archetype: 'corgi', interests: ['咖啡', '徒步'] },
  { userId: 'p3', displayName: 'P3', archetype: 'corgi', interests: ['咖啡', '阅读'] },
  { userId: 'p4', displayName: 'P4', archetype: 'corgi', interests: ['徒步'] },
  { userId: 'p5', displayName: 'P5', archetype: 'corgi', interests: ['摄影'] },
  { userId: 'p6', displayName: 'P6', archetype: 'corgi', interests: ['阅读'] },
];

async function seedGroupMirrorSession(baseUrl: string, sessionId: string) {
  for (const member of ROSTER_FIXTURE) {
    rosterProfiles.set(member.userId, {
      archetype: member.archetype,
      interests: member.interests,
    });
  }

  const hostCookie = await login(baseUrl, ROSTER_FIXTURE[0].userId);
  for (const member of ROSTER_FIXTURE) {
    const cookie = member.userId === ROSTER_FIXTURE[0].userId
      ? hostCookie
      : await login(baseUrl, member.userId);
    await fetch(`${baseUrl}/api/social-icebreaker/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ sessionId, displayName: member.displayName }),
    });
  }

  const socialSessionId = `social_${sessionId}`;
  const state = await getSession(socialSessionId);
  if (state) {
    // Jump straight to the closing act: the warmup-growth recompile path is a
    // separate concern (covered by the source-scan test below).
    state.currentPhase = 'group_mirror';
    state.autoAdvanceEnabled = false;
    await updateSession(socialSessionId, state);
  }
  return { socialSessionId, hostCookie };
}

async function generateGroupMirror(baseUrl: string, socialSessionId: string, hostCookie: string) {
  const response = await fetch(
    `${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: hostCookie } },
  );
  const body = (await response.json()) as any;
  return { response, body };
}

beforeEach(() => {
  vi.clearAllMocks();
  rosterProfiles.clear();
  getFeatureFlagMock.mockImplementation(
    async (key: string, fallback?: boolean) =>
      key === 'icebreakerMatchingAwareEnabled' ? true : (fallback ?? false),
  );
  getLatestRoleResultsForUsersMock.mockResolvedValue(new Map());
});

// ─── FU-04① + FU-03: group_mirror anchor wiring & pre-gen parity ─────────────

describe('group_mirror anchors — route wiring (FU-04①)', () => {
  it('passes derived anchors to generateGroupMirrorQuestions when the flag is on', async () => {
    await withServer(async (baseUrl) => {
      const { socialSessionId, hostCookie } = await seedGroupMirrorSession(baseUrl, 'fu04-on');

      const { response } = await generateGroupMirror(baseUrl, socialSessionId, hostCookie);
      expect(response.status).toBe(200);

      expect(generateGroupMirrorQuestionsMock).toHaveBeenCalledTimes(1);
      const callArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.tableAnchors).toEqual(['咖啡']);
      expect(callArg.participantCount).toBe(ROSTER_FIXTURE.length);
    });
  });

  it('passes NO anchors when the flag is off, even though the roster carries interests', async () => {
    await withServer(async (baseUrl) => {
      getFeatureFlagMock.mockImplementation(async () => false);
      const { socialSessionId, hostCookie } = await seedGroupMirrorSession(baseUrl, 'fu04-off');

      const { response } = await generateGroupMirror(baseUrl, socialSessionId, hostCookie);
      expect(response.status).toBe(200);

      expect(generateGroupMirrorQuestionsMock).toHaveBeenCalledTimes(1);
      const callArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty('tableAnchors');
      // Flag off must also skip the ACOEXP read entirely.
      expect(getLatestRoleResultsForUsersMock).not.toHaveBeenCalled();
    });
  });

  it('keeps anchors stable when ACOEXP rows are present (traits steer pace, not anchors)', async () => {
    await withServer(async (baseUrl) => {
      const traits = new Map(
        ROSTER_FIXTURE.map((member) => [
          member.userId,
          { extraversion: 15, affinity: 60, emotionalStability: 60 },
        ]),
      );
      getLatestRoleResultsForUsersMock.mockResolvedValue(traits);
      const { socialSessionId, hostCookie } = await seedGroupMirrorSession(baseUrl, 'fu04-acoexp');

      const { response } = await generateGroupMirror(baseUrl, socialSessionId, hostCookie);
      expect(response.status).toBe(200);

      const callArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.tableAnchors).toEqual(['咖啡']);
      expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('pre-generation parity — worker vs route (FU-03)', () => {
  it('the worker group_mirror generator reaches the same anchors and promptVersion', async () => {
    await withServer(async (baseUrl) => {
      const { socialSessionId, hostCookie } = await seedGroupMirrorSession(baseUrl, 'fu03-parity');

      const { response, body } = await generateGroupMirror(baseUrl, socialSessionId, hostCookie);
      expect(response.status).toBe(200);
      const routeArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;

      // Same roster through the pre-generation seam (the path that had no
      // caller, and therefore no parity proof, before FU-03).
      generateGroupMirrorQuestionsMock.mockClear();
      const workerResult = await PHASE_GENERATORS.group_mirror('social_fu03_worker', {
        eventType: '活动',
        participants: ROSTER_FIXTURE,
      });
      expect(generateGroupMirrorQuestionsMock).toHaveBeenCalledTimes(1);
      const workerArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;

      expect(workerArg.tableAnchors).toEqual(routeArg.tableAnchors);
      expect(workerArg.tableAnchors).toEqual(['咖啡']);
      expect(workerArg.participantCount).toBe(routeArg.participantCount);
      // The worker threads the generator meta through unchanged, so the
      // pre-generated deck advertises the same promptVersion as the live one.
      expect((workerResult.meta as Record<string, unknown>).promptVersion).toBe(
        (body.meta as Record<string, unknown>).promptVersion,
      );
    });
  });

  it('the worker omits anchors for a roster with no shared interest', async () => {
    generateGroupMirrorQuestionsMock.mockClear();
    await PHASE_GENERATORS.group_mirror('social_fu03_noanchor', {
      participants: [
        { userId: 'a', displayName: 'A', interests: ['咖啡'] },
        { userId: 'b', displayName: 'B', interests: ['徒步'] },
      ],
    });

    const callArg = generateGroupMirrorQuestionsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(generateGroupMirrorQuestionsMock).toHaveBeenCalledTimes(1);
    expect(callArg).not.toHaveProperty('tableAnchors');
  });
});

// ─── FU-04②: warmup-growth recompile persistence ────────────────────────────

describe('warmup-growth recompile persistence (FU-04②)', () => {
  function plan(overrides: Partial<IcebreakerRunPlan> = {}): IcebreakerRunPlan {
    return {
      version: 2,
      segments: [
        { phase: 'warmup', allocatedMinutes: 20, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
        { phase: 'recap', allocatedMinutes: 10, energyWeight: 1 },
      ],
      totalMinutes: 40,
      compiledAt: '2026-10-29T00:00:00.000Z',
      compilerId: 'fu04-shape-test',
      ...overrides,
    };
  }

  /** Mirrors the decision at `routes/socialIcebreaker.ts` warmup-growth branch. */
  function shouldPersist(previous: IcebreakerRunPlan, next: IcebreakerRunPlan): boolean {
    return buildRunPlanShapeKey(previous) !== buildRunPlanShapeKey(next);
  }

  it('persists a duration-only recalibration that phase names would hide', () => {
    const previous = plan();
    const calibrated = plan({
      segments: [
        { phase: 'warmup', allocatedMinutes: 25, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
        { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
      ],
    });

    // The regression this guards: comparing phase names alone returns false.
    expect(previous.segments.map((s) => s.phase)).toEqual(calibrated.segments.map((s) => s.phase));
    expect(shouldPersist(previous, calibrated)).toBe(true);
  });

  it('does not persist an unchanged plan', () => {
    expect(shouldPersist(plan(), plan())).toBe(false);
  });

  it('the route source compares with buildRunPlanShapeKey before persisting', () => {
    const source = readFileSync(
      new URL('../routes/socialIcebreaker.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      'if (buildRunPlanShapeKey(state.runPlan) !== buildRunPlanShapeKey(newRunPlan))',
    );
    expect(source).toMatch(/state\.runPlan = newRunPlan;[\s\S]{0,120}shouldPersist = true;/);
    // Guard against a regression back to phase-name comparison.
    expect(source).not.toMatch(/newRunPlan\.segments\.map\(\s*\(?\w*\)?\s*=>\s*\w+\.phase\s*\)/);
  });
});

/**
 * FU-04③ — the host brief is the only place ACOEXP is read, and it runs on the
 * 3s poll. A behavioural test would have to boot the whole `buildClientState`
 * graph (roster load, run plan, sanitizers), so this locks the guard ORDER at
 * the source instead: the authority check must come first, then the flag, then
 * the brief build, and only then the role_results thunk. Reordering any of them
 * re-opens the poll-time query this memo exists to prevent.
 */
describe('host brief role_results authority guards (FU-04③)', () => {
  const source = readFileSync(
    new URL('../routes/socialIcebreakerHelpers.ts', import.meta.url),
    'utf8',
  );

  it('gates the brief on host AND warmup before touching the flag or the memo', () => {
    const guardIndex = source.indexOf(
      "if (requestingUserId === state.hostUserId && state.currentPhase === 'warmup')",
    );
    const flagIndex = source.indexOf("getFeatureFlag('icebreakerMatchingAwareEnabled', true)");
    const briefIndex = source.indexOf('buildHostTableBrief({');
    const memoIndex = source.indexOf('getHostBriefRoleResults(');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(flagIndex).toBeGreaterThan(guardIndex);
    expect(briefIndex).toBeGreaterThan(flagIndex);
    expect(memoIndex).toBeGreaterThan(briefIndex);
  });

  it('passes the memo in as a lazy thunk, never as an awaited value', () => {
    // `resolveRoleResults: await getHostBriefRoleResults(...)` would query on
    // every poll regardless of whether a brief is actually built.
    expect(source).not.toMatch(/resolveRoleResults:\s*await\s+getHostBriefRoleResults/);
    expect(source).toMatch(/resolveRoleResults:\s*\(\)\s*=>/);
  });

  it('does not read role_results anywhere else in the client-state builder', () => {
    const callSites = source.split('getHostBriefRoleResults(').length - 1;
    expect(callSites).toBe(1);
    expect(source).not.toContain('getLatestRoleResultsForUsers');
  });
});
