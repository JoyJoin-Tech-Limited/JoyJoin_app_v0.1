/**
 * MiniScript V2 P2 gameplay layer (sprint miniscript-v2-p2, contract AC-01..AC-07 + AC-13):
 *  - POST /api/miniscript/present-evidence: happy path + every guard (AC-01/02)
 *  - POST /api/miniscript/open-motive-vote: host-only + all edge guards (AC-03)
 *  - /vote round routing + correctMotiveIndex resolution chain (AC-04)
 *  - reveal-solution two-step player results, dual path + edge (AC-05)
 *  - flag snapshot at phase entry, immutability, fail-closed routes (AC-06)
 *  - bot simulation round1→round2→reveal full chain, no human input (AC-07)
 *  - sanitizeStateForClient per-round progress + passthrough (AC-13)
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SocialSessionState,
  MiniScriptStoryFrameworkPublic,
  MiniScriptPresentedEvidence,
} from '@shared/socialIcebreaker';
import {
  MINISCRIPT_VOTE_MIN_OPEN_MS,
  resolveCorrectMotiveIndex,
  type MiniScriptStoryFramework,
  type MiniScriptVoteProgress,
} from '@shared/miniscriptStoryFramework';
import { logger } from '../lib/logger';

const { testSessions, testMiniScriptSecrets, testExpiredSessions } = vi.hoisted(() => ({
  testSessions: new Map<string, SocialSessionState>(),
  testMiniScriptSecrets: new Map<string, unknown>(),
  testExpiredSessions: new Set<string>(),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: testExpiredSessions.has(socialSessionId),
  }),
  updateSession: async (socialSessionId: string, state: SocialSessionState) => {
    testSessions.set(socialSessionId, state);
  },
  setMiniScriptSecrets: async (socialSessionId: string, secrets: unknown) => {
    testMiniScriptSecrets.set(socialSessionId, secrets);
  },
  getMiniScriptSecrets: async (socialSessionId: string) => {
    return (testMiniScriptSecrets.get(socialSessionId) as any) ?? null;
  },
  listParticipants: async (socialSessionId: string) => {
    const state = testSessions.get(socialSessionId);
    return state?.joinedParticipants?.map((p) => ({
      ...p,
      joinedAt: p.joinedAt ?? new Date().toISOString(),
      lastSeenAt: p.lastSeenAt ?? new Date().toISOString(),
      isActive: true,
    })) ?? [];
  },
  savePhaseMetric: async () => {},
}));

const { default: miniscriptRouter } = await import('../routes/domains/miniscript');
const { extractSecrets } = await import('../routes/domains/miniscript');
const { sanitizeStateForClient, transitionPhase } = await import('../routes/socialIcebreakerHelpers');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  app.use('/api/miniscript', miniscriptRouter);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

const USER_IDS = ['host-user', 'p1', 'p2', 'p3'] as const;
const BOT_USER_IDS = ['bot-user-1', 'bot-user-2', 'bot-user-3', 'bot-user-4', 'bot-user-5'] as const;

function makeFramework(opts: { withMotive?: boolean } = {}): MiniScriptStoryFrameworkPublic {
  const withMotive = opts.withMotive ?? true;
  return {
    schemaVersion: 2,
    style: 'modern_urban',
    genres: ['light_reasoning'],
    title: '茶水间悬案',
    premise: '茶水间的燕麦奶不见了。',
    characters: [
      { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '一直在工位' },
      { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在会议室培训' },
      { slotIndex: 2, roleLabel: '产品经理', sinHook: '逞强', alibi: '整天开会' },
      { slotIndex: 3, roleLabel: '运维', sinHook: '逃避', alibi: '在机房' },
    ],
    act_flow: [
      {
        actNumber: 1,
        title: '开场',
        beats: ['介绍场景', '每人一句话'],
        evidence: [
          { id: 'e1', name: '撕掉的便利贴', description: '垃圾桶里撕掉一半的便利贴。', iconKey: 'note' },
        ],
      },
      {
        actNumber: 2,
        title: '线索',
        beats: ['交换信息', '发现矛盾'],
        evidence: [
          { id: 'e2', name: '监控截图', description: '茶水间门口的模糊身影。', iconKey: 'camera' },
        ],
      },
      { actNumber: 3, title: '投票', beats: ['共识表决', '揭晓'] },
    ],
    ending: { resolutionSummary: '真相是误会。', confessionMechanic: '每人认领自己的小秘密。' },
    voteOptions: { what: ['喝了燕麦奶', '写了纸条', '只是误会'], why: ['善意', '胆怯', '好面子'] },
    ...(withMotive ? { motiveOptions: ['太渴了', '想开玩笑', '拿错了盒子'] } : {}),
  };
}

function makeSecrets(opts: { correctMotiveIndex?: number | null } = {}) {
  return {
    solution: { who: '运维', what: '喝了燕麦奶', why: '太渴了', whoSlot: 4 },
    playerKnowledge: [0, 1, 2, 3, 4, 5].map((slotIndex) => ({
      slotIndex,
      knownFacts: ['fact'],
      secretAgenda: 'agenda',
      truthfulAlibi: 'alibi',
    })),
    redHerrings: [],
    deductionChain: [],
    allClues: [
      { clueId: 'c1', text: '监控显示下午3:15有人进入茶水间。', revealedInAct: 2, implies: [] },
      { clueId: 'c2', text: '垃圾桶里有撕掉的便利贴草稿。', revealedInAct: 3, implies: [] },
    ],
    correctMotiveIndex: opts.correctMotiveIndex === undefined ? 0 : opts.correctMotiveIndex,
    evidenceReactions: {
      e1: {
        '1': '啊？我、我没注意到这个……',
        '2': '这不是我撕的，真的。',
        '3': '便利贴？什么便利贴？',
        '4': '呃……我只是路过茶水间。',
      },
      e2: {
        '1': '那个身影绝对不是我。',
        '2': '我那时候在会议室。',
        '3': '看不清脸吧这个。',
        '4': '好吧，我是去过茶水间。',
      },
    },
  };
}

type SessionOverrides = Partial<SocialSessionState>;

function makeSession(id: string, overrides: SessionOverrides = {}): SocialSessionState {
  return {
    socialSessionId: id,
    icebreakerSessionId: `ice-${id}`,
    currentPhase: 'mini_script',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['mini_script', 'recap'],
    joinedParticipants: USER_IDS.map((userId, index) => ({
      userId,
      displayName: userId,
      joinedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      lastSeenAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      isActive: true,
    })),
    miniScriptFramework: makeFramework(),
    miniScriptFrameworkGeneratedAt: Date.now(),
    miniScriptFrameworkGeneratedByUserId: 'host-user',
    miniScriptV2Enabled: true,
    ...overrides,
  };
}

type Ctx = {
  post: (userId: string, path: string, body: Record<string, unknown>) => Promise<Response>;
  sessionId: string;
};

async function boot(
  baseUrl: string,
  id: string,
  session: SocialSessionState,
  secrets: unknown = makeSecrets(),
  userIds: readonly string[] = USER_IDS,
): Promise<Ctx> {
  const cookies = new Map<string, string>();
  for (const userId of userIds) {
    const login = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
    cookies.set(userId, cookieHeader(login));
  }
  testSessions.set(id, session);
  testMiniScriptSecrets.set(id, secrets);
  const post = (userId: string, path: string, body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/miniscript/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookies.get(userId)! },
      body: JSON.stringify({ socialSessionId: id, ...body }),
    });
  return { post, sessionId: id };
}

/** Assign roles + reveal acts 1..2 (still in the act sub-stage, vote not open). */
async function reachActSubStage(ctx: Ctx) {
  expect((await ctx.post('host-user', 'assign-roles', {})).status).toBe(200);
  expect((await ctx.post('host-user', 'reveal-act', { targetAct: 1 })).status).toBe(200);
  expect((await ctx.post('host-user', 'reveal-act', { targetAct: 2 })).status).toBe(200);
}

/** Assign roles + reveal every act (vote round 1 now open). */
async function reachVoteSubStage(ctx: Ctx) {
  expect((await ctx.post('host-user', 'assign-roles', {})).status).toBe(200);
  for (let act = 1; act <= 3; act += 1) {
    expect((await ctx.post('host-user', 'reveal-act', { targetAct: act })).status).toBe(200);
  }
}

beforeEach(() => {
  testSessions.clear();
  testMiniScriptSecrets.clear();
  testExpiredSessions.clear();
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED;
  delete process.env.ENABLE_SINGLE_TEST_MODE;
  delete process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED;
});

// ─── AC-01 / AC-02: present-evidence ─────────────────────────────────────────

describe('POST /api/miniscript/present-evidence', () => {
  it('AC-01: returns the reaction text and records the presented entry in state', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-happy', makeSession('pe-happy'));
      await reachActSubStage(ctx);

      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        reactionText: string;
        presented: MiniScriptPresentedEvidence;
      };
      expect(body.ok).toBe(true);
      expect(body.reactionText).toBe('这不是我撕的，真的。');
      expect(body.presented).toMatchObject({
        evidenceId: 'e1',
        targetRoleSlot: 2,
        presentedBy: 'p1',
        actNo: 2,
        reactionText: '这不是我撕的，真的。',
      });

      // Response and persisted state share the same source (rejoin / delayed
      // rendering read the state entry).
      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptPresentedEvidence).toHaveLength(1);
      expect(stored.miniScriptPresentedEvidence![0]).toMatchObject(body.presented);
      expect(logger.info).toHaveBeenCalledWith(
        '[miniscript] evidence presented',
        expect.objectContaining({ socialSessionId: ctx.sessionId, evidenceId: 'e1', targetRoleSlot: 2 }),
      );
    });
  });

  it('AC-02a: rejects when the session is not in mini_script (WRONG_PHASE)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(
        baseUrl,
        'pe-phase',
        makeSession('pe-phase', {
          currentPhase: 'warmup',
          miniScriptRoleAssignments: { 'host-user': 0, p1: 1, p2: 2, p3: 3 },
          miniScriptCurrentAct: 1,
        }),
      );
      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_PHASE');
      expect(logger.warn).toHaveBeenCalledWith(
        '[miniscript] present-evidence rejected',
        expect.objectContaining({ code: 'WRONG_PHASE' }),
      );
    });
  });

  it('AC-02b: rejects once the vote sub-stage has opened (WRONG_SUB_PHASE)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-subphase', makeSession('pe-subphase'));
      await reachVoteSubStage(ctx); // final act opens the vote
      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_SUB_PHASE');
    });
  });

  it('AC-02c: enforces the per-player per-act budget of 2 (PRESENT_BUDGET_EXCEEDED)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-budget', makeSession('pe-budget'));
      await reachActSubStage(ctx);

      expect((await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 })).status).toBe(200);
      expect((await ctx.post('p1', 'present-evidence', { evidenceId: 'e2', targetRoleSlot: 1 })).status).toBe(200);
      const third = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 3 });
      expect(third.status).toBe(400);
      expect(((await third.json()) as { error: string }).error).toBe('PRESENT_BUDGET_EXCEEDED');

      // Another player still has their own budget.
      expect((await ctx.post('p2', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 3 })).status).toBe(200);
    });
  });

  it('AC-02d: duplicate (evidenceId, targetRoleSlot) is idempotent and does not consume budget', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-dupe', makeSession('pe-dupe'));
      await reachActSubStage(ctx);

      const first = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(first.status).toBe(200);
      const dupe = await ctx.post('p2', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(dupe.status).toBe(200);
      const dupeBody = (await dupe.json()) as { duplicate?: boolean; reactionText: string };
      expect(dupeBody.duplicate).toBe(true);
      expect(dupeBody.reactionText).toBe('啊？我、我没注意到这个……');

      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptPresentedEvidence).toHaveLength(1);

      // The duplicate did not count: p2 still has both budget slots for a new combo.
      expect((await ctx.post('p2', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 2 })).status).toBe(200);
    });
  });

  it('AC-02e: rejects out-of-range evidenceId / targetRoleSlot', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-range', makeSession('pe-range'));
      await reachActSubStage(ctx);

      const badEvidence = await ctx.post('p1', 'present-evidence', { evidenceId: 'nope', targetRoleSlot: 1 });
      expect(badEvidence.status).toBe(400);
      expect(((await badEvidence.json()) as { error: string }).error).toBe('INVALID_EVIDENCE');

      const badSlot = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 6 });
      expect(badSlot.status).toBe(400);
      expect(((await badSlot.json()) as { error: string }).error).toBe('INVALID_TARGET_SLOT');
    });
  });

  it('AC-02f: returns 410 when the session is expired', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-expired', makeSession('pe-expired'));
      // Expired sessions no longer load — mirror the real store contract.
      testSessions.delete(ctx.sessionId);
      testExpiredSessions.add(ctx.sessionId);
      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(res.status).toBe(410);
      expect(((await res.json()) as { error: string }).error).toBe('SESSION_EXPIRED');
    });
  });

  it('AC-02g: rejects evidence from a future act (EVIDENCE_NOT_REVEALED)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-future', makeSession('pe-future'));
      expect((await ctx.post('host-user', 'assign-roles', {})).status).toBe(200);
      expect((await ctx.post('host-user', 'reveal-act', { targetAct: 1 })).status).toBe(200);

      // e2 belongs to act 2, which has not been revealed yet.
      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e2', targetRoleSlot: 1 });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('EVIDENCE_NOT_REVEALED');

      // Evidence from the revealed act is fine.
      expect((await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 })).status).toBe(200);
    });
  });

  it('AC-06: fails closed with 403 FEATURE_DISABLED when the flag snapshot is off', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(
        baseUrl,
        'pe-flagoff',
        makeSession('pe-flagoff', {
          miniScriptV2Enabled: false,
          miniScriptRoleAssignments: { 'host-user': 0, p1: 1, p2: 2, p3: 3 },
          miniScriptCurrentAct: 1,
        }),
      );
      const res = await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 1 });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('FEATURE_DISABLED');
    });
  });

  it('SEC-02: requires authentication and a role assignment', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-auth', makeSession('pe-auth'));
      await reachActSubStage(ctx);

      const unauthenticated = await fetch(`${baseUrl}/api/miniscript/present-evidence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ socialSessionId: ctx.sessionId, evidenceId: 'e1', targetRoleSlot: 1 }),
      });
      expect(unauthenticated.status).toBe(401);

      // Logged-in but not part of the game (no role) → NO_ROLE_ASSIGNED.
      const outsiderLogin = await fetch(`${baseUrl}/__test__/login/outsider`, { method: 'POST' });
      const outsiderCookie = cookieHeader(outsiderLogin);
      const noRole = await fetch(`${baseUrl}/api/miniscript/present-evidence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: outsiderCookie },
        body: JSON.stringify({ socialSessionId: ctx.sessionId, evidenceId: 'e1', targetRoleSlot: 1 }),
      });
      expect(noRole.status).toBe(400);
      expect(((await noRole.json()) as { error: string }).error).toBe('NO_ROLE_ASSIGNED');
    });
  });

  it('SEC-01: unpresented reactions never appear in sanitized client state', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'pe-secrecy', makeSession('pe-secrecy'));
      await reachActSubStage(ctx);
      expect((await ctx.post('p1', 'present-evidence', { evidenceId: 'e1', targetRoleSlot: 2 })).status).toBe(200);

      // V2 P3: the presented reaction is initially gated for non-presenters
      // (server-side 8s delay / readConfirmedAt) — the presenter sees it now.
      const presenterState = JSON.stringify(sanitizeStateForClient(testSessions.get(ctx.sessionId)!, 'p1'));
      expect(presenterState).toContain('这不是我撕的，真的。');

      const gatedState = JSON.stringify(sanitizeStateForClient(testSessions.get(ctx.sessionId)!, 'p2'));
      expect(gatedState).not.toContain('这不是我撕的，真的。');

      // After the server-side reveal window the reaction becomes public…
      const stored = testSessions.get(ctx.sessionId)!;
      stored.miniScriptPresentedEvidence = stored.miniScriptPresentedEvidence!.map((entry) => ({
        ...entry,
        presentedAt: entry.presentedAt - 9_000,
      }));
      const clientState = sanitizeStateForClient(stored, 'p2');
      const serialized = JSON.stringify(clientState);
      expect(serialized).toContain('这不是我撕的，真的。');
      // …but every other reaction stays server-only.
      expect(serialized).not.toContain('啊？我、我没注意到这个……');
      expect(serialized).not.toContain('便利贴？什么便利贴？');
      expect(serialized).not.toContain('那个身影绝对不是我。');
      expect(serialized).not.toContain('evidenceReactions');
    });
  });
});

// ─── AC-03: open-motive-vote ─────────────────────────────────────────────────

describe('POST /api/miniscript/open-motive-vote', () => {
  it('opens round 2 and is idempotent on repeat calls', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'omv-happy', makeSession('omv-happy'));
      await reachVoteSubStage(ctx);

      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        voteRound: number;
        motiveVoteOpenedAt: number;
        motiveOptions: string[];
        motiveVoteProgress: MiniScriptVoteProgress;
      };
      expect(body.ok).toBe(true);
      expect(body.voteRound).toBe(2);
      expect(body.motiveOptions).toEqual(['太渴了', '想开玩笑', '拿错了盒子']);
      expect(body.motiveVoteProgress).toMatchObject({ votedCount: 0, totalAssigned: 4 });

      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptVoteRound).toBe(2);
      expect(stored.miniScriptMotiveVoteOpenedAt).toBe(body.motiveVoteOpenedAt);

      // Idempotent: same openedAt, still 200.
      const again = await ctx.post('host-user', 'open-motive-vote', {});
      expect(again.status).toBe(200);
      const againBody = (await again.json()) as { motiveVoteOpenedAt: number };
      expect(againBody.motiveVoteOpenedAt).toBe(body.motiveVoteOpenedAt);

      expect(logger.info).toHaveBeenCalledWith(
        '[miniscript] motive vote opened',
        expect.objectContaining({ socialSessionId: ctx.sessionId }),
      );
    });
  });

  it('rejects non-host with 403', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'omv-nonhost', makeSession('omv-nonhost'));
      await reachVoteSubStage(ctx);
      const res = await ctx.post('p1', 'open-motive-vote', {});
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('HOST_ONLY');
    });
  });

  it('rejects when round 1 has not opened (WRONG_VOTE_ROUND)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'omv-round', makeSession('omv-round'));
      // Only acts 1-2 revealed → vote not open yet.
      await reachActSubStage(ctx);
      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_VOTE_ROUND');
    });
  });

  it('rejects when the framework has no motiveOptions (NO_MOTIVE_OPTIONS)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(
        baseUrl,
        'omv-nomotive',
        makeSession('omv-nomotive', { miniScriptFramework: makeFramework({ withMotive: false }) }),
        makeSecrets({ correctMotiveIndex: null }),
      );
      await reachVoteSubStage(ctx);
      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('NO_MOTIVE_OPTIONS');
    });
  });

  it('rejects when motiveOptions exist but the correct motive is unresolvable (NO_MOTIVE_OPTIONS)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(
        baseUrl,
        'omv-unresolvable',
        makeSession('omv-unresolvable'),
        // why does not match any option and no motiveIndex → resolution fails.
        { ...makeSecrets({ correctMotiveIndex: null }), solution: { who: '运维', what: '喝了燕麦奶', why: '不可告人的秘密', whoSlot: 4 } },
      );
      await reachVoteSubStage(ctx);
      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('NO_MOTIVE_OPTIONS');
    });
  });

  it('rejects after the solution has been revealed (409)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'omv-revealed', makeSession('omv-revealed'));
      await reachVoteSubStage(ctx);
      // Reach round-1 quorum and reveal.
      for (const userId of USER_IDS.slice(0, 3)) {
        expect((await ctx.post(userId, 'vote', { vote: { suspectRoleSlot: 4 } })).status).toBe(200);
      }
      expect((await ctx.post('host-user', 'reveal-solution', {})).status).toBe(200);

      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: string }).error).toBe('SOLUTION_ALREADY_REVEALED');
    });
  });

  it('AC-06: fails closed with 403 FEATURE_DISABLED when the flag snapshot is off', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'omv-flagoff', makeSession('omv-flagoff', { miniScriptV2Enabled: false }));
      await reachVoteSubStage(ctx);
      const res = await ctx.post('host-user', 'open-motive-vote', {});
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('FEATURE_DISABLED');
    });
  });
});

// ─── AC-04: /vote round routing + correctMotiveIndex resolution chain ────────

describe('resolveCorrectMotiveIndex (AC-04 resolution chain)', () => {
  const options = ['太渴了', '想开玩笑', '拿错了盒子'];

  it('prefers an explicit solution.motiveIndex when valid', () => {
    expect(resolveCorrectMotiveIndex({ motiveOptions: options, solutionWhy: '想开玩笑', solutionMotiveIndex: 0 })).toBe(0);
  });

  it('falls back to exact solution.why ↔ motiveOptions match', () => {
    expect(resolveCorrectMotiveIndex({ motiveOptions: options, solutionWhy: '想开玩笑' })).toBe(1);
  });

  it('ignores an out-of-range motiveIndex and uses the exact match', () => {
    expect(resolveCorrectMotiveIndex({ motiveOptions: options, solutionWhy: '拿错了盒子', solutionMotiveIndex: 9 })).toBe(2);
  });

  it('returns null on resolution failure (framework degrades to single-step)', () => {
    expect(resolveCorrectMotiveIndex({ motiveOptions: options, solutionWhy: '不可告人的秘密' })).toBeNull();
    expect(resolveCorrectMotiveIndex({ motiveOptions: [], solutionWhy: '太渴了' })).toBeNull();
    expect(resolveCorrectMotiveIndex({ solutionWhy: '太渴了' })).toBeNull();
  });

  it('extractSecrets resolves correctMotiveIndex at story generate/select time', () => {
    const full = {
      ...makeFramework(),
      clues: [{ clueId: 'c1', text: '线索一', revealedInAct: 2 }],
      solution: { who: '运维', what: '喝了燕麦奶', why: '太渴了', whoSlot: 4 },
      playerKnowledge: [0, 1, 2, 3].map((slotIndex) => ({
        slotIndex, knownFacts: ['f'], secretAgenda: 'a', truthfulAlibi: 't',
      })),
      characters: [
        { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '在工位', secret: 's1' },
        { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在培训', secret: 's2' },
        { slotIndex: 2, roleLabel: '产品经理', sinHook: '逞强', alibi: '在开会', secret: 's3' },
        { slotIndex: 3, roleLabel: '运维', sinHook: '逃避', alibi: '在机房', secret: 's4' },
      ],
    } as unknown as MiniScriptStoryFramework;

    const secrets = extractSecrets(full);
    expect(secrets.correctMotiveIndex).toBe(0); // '太渴了' === motiveOptions[0]

    const unresolvable = {
      ...full,
      solution: { who: '运维', what: '喝了燕麦奶', why: '不匹配的动机', whoSlot: 4 },
    } as unknown as MiniScriptStoryFramework;
    expect(extractSecrets(unresolvable).correctMotiveIndex).toBeNull();
  });
});

describe('POST /api/miniscript/vote round routing (AC-04/AC-06)', () => {
  it('accepts round-2 motive ballots once round 2 is open and overwrites per round', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'vote-r2', makeSession('vote-r2'));
      await reachVoteSubStage(ctx);
      expect((await ctx.post('host-user', 'open-motive-vote', {})).status).toBe(200);

      const res = await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 1 } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { vote: { voteRound: number; motiveChoice: number }; voteProgress: MiniScriptVoteProgress };
      expect(body.vote).toMatchObject({ voteRound: 2, motiveChoice: 1 });
      expect(body.voteProgress).toMatchObject({ votedCount: 1, totalAssigned: 4 });

      // Re-voting round 2 overwrites only the round-2 ballot.
      expect((await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 2 } })).status).toBe(200);
      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptVotes).toHaveLength(1);
      expect(stored.miniScriptVotes![0]).toMatchObject({ userId: 'p1', voteRound: 2, motiveChoice: 2 });
    });
  });

  it('rejects a round-2 ballot before round 2 opens (WRONG_VOTE_ROUND)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'vote-r2-early', makeSession('vote-r2-early'));
      await reachVoteSubStage(ctx);
      const res = await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 0 } });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_VOTE_ROUND');
      expect(logger.warn).toHaveBeenCalledWith(
        '[miniscript] vote rejected',
        expect.objectContaining({ code: 'WRONG_VOTE_ROUND' }),
      );
    });
  });

  it('rejects an out-of-range motiveChoice (INVALID_MOTIVE_CHOICE)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'vote-r2-range', makeSession('vote-r2-range'));
      await reachVoteSubStage(ctx);
      expect((await ctx.post('host-user', 'open-motive-vote', {})).status).toBe(200);
      const res = await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 3 } });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('INVALID_MOTIVE_CHOICE');
    });
  });

  it('flag snapshot off silently treats voteRound=2/motiveChoice as a round-1 ballot', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'vote-flagoff', makeSession('vote-flagoff', { miniScriptV2Enabled: false }));
      await reachVoteSubStage(ctx);
      // voteRound=2 without suspect fields would 400 as round 1 (no suspect) —
      // prove the degrade by sending both: the motiveChoice is ignored and the
      // suspect ballot is recorded as round 1.
      const res = await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 0, suspectRoleSlot: 4 } });
      expect(res.status).toBe(200);
      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptVotes).toHaveLength(1);
      expect(stored.miniScriptVotes![0]).toMatchObject({ userId: 'p1', voteRound: 1, suspectRoleSlot: 4 });
      expect(stored.miniScriptVoteRound ?? 1).toBe(1);
    });
  });
});

// ─── AC-05: reveal-solution two-step results ─────────────────────────────────

describe('POST /api/miniscript/reveal-solution two-step results (AC-05)', () => {
  it('returns per-player round1Correct/round2Correct when the motive round ran', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'rs-dual', makeSession('rs-dual'));
      await reachVoteSubStage(ctx);

      // Round 1: p1 correct (culprit slot 4), p2 wrong, p3 correct.
      await ctx.post('p1', 'vote', { vote: { suspectRoleSlot: 4 } });
      await ctx.post('p2', 'vote', { vote: { suspectRoleSlot: 1 } });
      await ctx.post('p3', 'vote', { vote: { suspectRoleSlot: 4 } });

      expect((await ctx.post('host-user', 'open-motive-vote', {})).status).toBe(200);

      // Round 2: p1 correct (index 0), p2 wrong.
      await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 0 } });
      await ctx.post('p2', 'vote', { vote: { voteRound: 2, motiveChoice: 2 } });
      await ctx.post('p3', 'vote', { vote: { voteRound: 2, motiveChoice: 0 } });

      const res = await ctx.post('host-user', 'reveal-solution', {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        solution: { who: string; why: string };
        correctMotive: string;
        motiveVoteProgress: MiniScriptVoteProgress;
        playerResults: Array<{ userId: string; round1Correct?: boolean; round2Correct?: boolean }>;
      };
      expect(body.solution.who).toBe('运维');
      expect(body.correctMotive).toBe('太渴了');
      const results = Object.fromEntries(body.playerResults.map((r) => [r.userId, r]));
      expect(results['p1']).toMatchObject({ round1Correct: true, round2Correct: true });
      expect(results['p2']).toMatchObject({ round1Correct: false, round2Correct: false });
      expect(results['p3']).toMatchObject({ round1Correct: true, round2Correct: true });

      // Persisted for rejoin.
      expect(testSessions.get(ctx.sessionId)!.miniScriptRevealedPlayerResults).toEqual(body.playerResults);
    });
  });

  it('degrades to round-1-only results when the framework has no motiveOptions', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(
        baseUrl,
        'rs-legacy',
        makeSession('rs-legacy', { miniScriptFramework: makeFramework({ withMotive: false }) }),
        makeSecrets({ correctMotiveIndex: null }),
      );
      await reachVoteSubStage(ctx);
      for (const userId of USER_IDS.slice(0, 3)) {
        await ctx.post(userId, 'vote', { vote: { suspectRoleSlot: 4 } });
      }
      const res = await ctx.post('host-user', 'reveal-solution', {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        playerResults: Array<{ userId: string; round1Correct?: boolean; round2Correct?: boolean }>;
        motiveVoteProgress?: unknown;
      };
      expect(body.motiveVoteProgress).toBeUndefined();
      const results = Object.fromEntries(body.playerResults.map((r) => [r.userId, r]));
      for (const userId of USER_IDS.slice(0, 3)) {
        expect(results[userId]).toMatchObject({ round1Correct: true });
        expect(results[userId].round2Correct).toBeUndefined();
      }
      // p3 never voted → round1Correct false, round2Correct absent.
      expect(results['p3']).toMatchObject({ round1Correct: false });
      expect(results['p3'].round2Correct).toBeUndefined();
    });
  });

  it('edge: motiveOptions present but round 2 never opened → round-1-only response', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'rs-no-r2', makeSession('rs-no-r2'));
      await reachVoteSubStage(ctx);
      for (const userId of USER_IDS.slice(0, 3)) {
        await ctx.post(userId, 'vote', { vote: { suspectRoleSlot: 4 } });
      }
      const res = await ctx.post('host-user', 'reveal-solution', {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        playerResults: Array<{ userId: string; round1Correct?: boolean; round2Correct?: boolean }>;
        motiveVoteProgress?: unknown;
      };
      expect(body.motiveVoteProgress).toBeUndefined();
      const results = Object.fromEntries(body.playerResults.map((r) => [r.userId, r]));
      for (const userId of USER_IDS.slice(0, 3)) {
        expect(results[userId]).toMatchObject({ round1Correct: true });
        expect(results[userId].round2Correct).toBeUndefined();
      }
      expect(results['p3']).toMatchObject({ round1Correct: false });
      expect(results['p3'].round2Correct).toBeUndefined();
    });
  });

  it('REL-03: reveal below round-2 quorum is allowed once round 2 has been open for 90s', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'rs-timeout', makeSession('rs-timeout'));
      await reachVoteSubStage(ctx);
      for (const userId of USER_IDS.slice(0, 3)) {
        await ctx.post(userId, 'vote', { vote: { suspectRoleSlot: 4 } });
      }
      expect((await ctx.post('host-user', 'open-motive-vote', {})).status).toBe(200);

      // Only one motive ballot → below quorum, round 2 fresh → blocked.
      await ctx.post('p1', 'vote', { vote: { voteRound: 2, motiveChoice: 0 } });
      const blocked = await ctx.post('host-user', 'reveal-solution', {});
      expect(blocked.status).toBe(400);
      expect(((await blocked.json()) as { error: string }).error).toBe('WAITING_FOR_MOTIVE_VOTES');

      // …but the independent 90s escape hatch unblocks the host.
      const stored = testSessions.get(ctx.sessionId)!;
      stored.miniScriptMotiveVoteOpenedAt = Date.now() - MINISCRIPT_VOTE_MIN_OPEN_MS - 1_000;
      const reveal = await ctx.post('host-user', 'reveal-solution', {});
      expect(reveal.status).toBe(200);
    });
  });
});

// ─── AC-06: flag snapshot at phase entry + immutability ─────────────────────

describe('flag snapshot at mini_script phase entry (AC-06)', () => {
  it('snapshots the flag once at phase entry; mid-session flips do not affect the session', async () => {
    process.env.MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED = 'true';
    const state = makeSession('snap-1', { currentPhase: 'lie_detective', miniScriptV2Enabled: undefined });
    testSessions.set('snap-1', state);

    await transitionPhase({
      state,
      socialSessionId: 'snap-1',
      trigger: 'host_tap',
      targetPhase: 'mini_script',
      skipBonusGate: true,
    });
    expect(state.currentPhase).toBe('mini_script');
    expect(state.miniScriptV2Enabled).toBe(true);

    // Ops flips the flag off mid-session — the snapshot is immutable.
    process.env.MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED = 'false';
    await transitionPhase({
      state,
      socialSessionId: 'snap-1',
      trigger: 'host_tap',
      targetPhase: 'recap',
      skipBonusGate: true,
    });
    expect(state.miniScriptV2Enabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] miniscript v2 flag snapshot',
      expect.objectContaining({ socialSessionId: 'snap-1', miniScriptV2Enabled: true }),
    );
  });

  it('snapshots false when the flag is off, and later flips do not enable the session', async () => {
    process.env.MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED = 'false';
    const state = makeSession('snap-2', { currentPhase: 'lie_detective', miniScriptV2Enabled: undefined });
    testSessions.set('snap-2', state);

    await transitionPhase({
      state,
      socialSessionId: 'snap-2',
      trigger: 'host_tap',
      targetPhase: 'mini_script',
      skipBonusGate: true,
    });
    expect(state.miniScriptV2Enabled).toBe(false);

    process.env.MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED = 'true';
    // Re-entry keeps the original snapshot.
    await transitionPhase({
      state,
      socialSessionId: 'snap-2',
      trigger: 'host_tap',
      targetPhase: 'recap',
      skipBonusGate: true,
    });
    expect(state.miniScriptV2Enabled).toBe(false);
  });
});

// ─── AC-13: sanitizeStateForClient per-round progress ───────────────────────

describe('sanitizeStateForClient per-round vote progress (AC-13)', () => {
  it('computes round-1 and round-2 progress independently under mixed ballots', () => {
    const state = makeSession('san-1', {
      miniScriptRoleAssignments: { 'host-user': 0, p1: 1, p2: 2, p3: 3 },
      miniScriptVoteRound: 2,
      miniScriptVoteOpenedAt: Date.now() - 1_000,
      miniScriptMotiveVoteOpenedAt: Date.now() - 500,
      miniScriptVotes: [
        { userId: 'host-user', voteRound: 1, suspectRoleSlot: 4, votedAt: Date.now() },
        { userId: 'p1', voteRound: 1, suspectRoleSlot: 4, votedAt: Date.now() },
        { userId: 'p2', voteRound: 1, suspectRoleSlot: 2, votedAt: Date.now() },
        // A legacy ballot without voteRound counts as round 1.
        { userId: 'p3', suspectRoleSlot: 2, votedAt: Date.now() },
        { userId: 'p1', voteRound: 2, motiveChoice: 0, votedAt: Date.now() },
      ],
      miniScriptPresentedEvidence: [
        {
          evidenceId: 'e1',
          targetRoleSlot: 2,
          presentedBy: 'p1',
          actNo: 2,
          presentedAt: Date.now(),
          reactionText: '这不是我撕的，真的。',
        },
      ],
    });

    const client = sanitizeStateForClient(state, 'p1');
    // Round 1: all 4 ballots (incl. the legacy one), tallied by suspect slot.
    expect(client.miniScriptVoteProgress).toMatchObject({ votedCount: 4, totalAssigned: 4, quorum: 3, canReveal: true });
    expect(client.miniScriptVoteProgress?.tally).toEqual([
      // Count desc, then slot asc on ties.
      { roleSlot: 2, count: 2 },
      { roleSlot: 4, count: 2 },
    ]);
    // Round 2: only the motive ballot, driven by the independent openedAt.
    expect(client.miniScriptMotiveVoteProgress).toMatchObject({ votedCount: 1, totalAssigned: 4, quorum: 3 });
    expect(client.miniScriptMotiveVoteProgress?.voteOpenedAt).toBe(state.miniScriptMotiveVoteOpenedAt);
    expect(client.miniScriptMotiveVoteProgress?.tally).toEqual([]);

    // Passthrough: presented evidence, flag snapshot, vote round.
    expect(client.miniScriptPresentedEvidence).toHaveLength(1);
    expect(client.miniScriptV2Enabled).toBe(true);
    expect(client.miniScriptVoteRound).toBe(2);
  });
});

// ─── AC-07: bot full chain round1→round2→reveal without human input ─────────

describe('bot simulation full chain (AC-07)', () => {
  function makeBotSession(id: string): SocialSessionState {
    const base = makeSession(id);
    return {
      ...base,
      playerCount: 6,
      joinedParticipants: [
        { userId: 'host-user', displayName: 'Host', joinedAt: new Date('2026-01-01T00:00:00Z').toISOString(), lastSeenAt: new Date('2026-01-01T00:00:00Z').toISOString(), isActive: true },
        ...BOT_USER_IDS.map((userId, index) => ({
          userId,
          displayName: `Bot ${index + 1}`,
          joinedAt: new Date(Date.UTC(2026, 0, 1, 0, index + 1)).toISOString(),
          lastSeenAt: new Date(Date.UTC(2026, 0, 1, 0, index + 1)).toISOString(),
          isActive: true,
        })),
      ],
      miniScriptFramework: {
        ...makeFramework(),
        characters: [
          { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '一直在工位' },
          { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在会议室培训' },
          { slotIndex: 2, roleLabel: '产品经理', sinHook: '逞强', alibi: '整天开会' },
          { slotIndex: 3, roleLabel: '运维', sinHook: '逃避', alibi: '在机房' },
          { slotIndex: 4, roleLabel: '前台', sinHook: '好奇', alibi: '在前台' },
          { slotIndex: 5, roleLabel: '访客', sinHook: '拘谨', alibi: '在会客区' },
        ],
      },
      singleTest: {
        version: 2,
        groupId: 'group-bot-chain',
        isTestModeSkip: true,
        runBots: true,
        bots: BOT_USER_IDS.map((userId, index) => ({
          botId: `bot-${index + 1}`,
          displayName: `Bot ${index + 1}`,
          archetype: '社牛柯基',
        })),
        botPersonas: BOT_USER_IDS.map((userId, index) => ({
          botId: `bot-${index + 1}`,
          userId,
          displayName: `Bot ${index + 1}`,
          archetype: '社牛柯基',
        })),
      },
    } as SocialSessionState;
  }

  it('runs round1 → open-motive-vote → round2 → reveal to the truth sub-stage with only the host acting', async () => {
    process.env.ENABLE_SINGLE_TEST_MODE = 'true';
    process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED = 'true';

    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'bot-chain', makeBotSession('bot-chain'), makeSecrets());

      // Host assigns roles (host + 5 bots) and reveals act 1 — still act sub-stage.
      expect((await ctx.post('host-user', 'assign-roles', {})).status).toBe(200);
      expect((await ctx.post('host-user', 'reveal-act', { targetAct: 1 })).status).toBe(200);

      // A ready ping during the act sub-stage triggers bot simulation: bots
      // mark ready AND optionally present evidence (v2 snapshot on).
      expect((await ctx.post('host-user', 'ready', { ready: true })).status).toBe(200);
      const afterReady = testSessions.get(ctx.sessionId)!;
      expect(Object.keys(afterReady.miniScriptPlayerReady ?? {})).toHaveLength(6);

      // Host reveals the remaining acts — the vote round 1 opens.
      expect((await ctx.post('host-user', 'reveal-act', { targetAct: 2 })).status).toBe(200);
      expect((await ctx.post('host-user', 'reveal-act', { targetAct: 3 })).status).toBe(200);

      // The host's round-1 vote triggers bot simulation: all bots cast
      // structured suspect ballots (suspectRoleSlot, seeded).
      expect((await ctx.post('host-user', 'vote', { vote: { suspectRoleSlot: 4 } })).status).toBe(200);
      const afterRound1 = testSessions.get(ctx.sessionId)!;
      const round1Votes = (afterRound1.miniScriptVotes ?? []).filter((v) => (v.voteRound ?? 1) === 1);
      expect(round1Votes).toHaveLength(6);
      for (const botId of BOT_USER_IDS) {
        const botVote = round1Votes.find((v) => v.userId === botId);
        expect(botVote?.suspectRoleSlot).toBeGreaterThanOrEqual(1);
        expect(botVote?.suspectRoleSlot).toBeLessThanOrEqual(6);
      }

      // Host opens round 2 — the hook makes every bot cast a motive ballot.
      const omv = await ctx.post('host-user', 'open-motive-vote', {});
      expect(omv.status).toBe(200);
      const omvBody = (await omv.json()) as { motiveVoteProgress: MiniScriptVoteProgress };
      expect(omvBody.motiveVoteProgress.votedCount).toBe(5); // 5 bots already in
      const afterOpen = testSessions.get(ctx.sessionId)!;
      const round2Votes = (afterOpen.miniScriptVotes ?? []).filter((v) => v.voteRound === 2);
      expect(round2Votes).toHaveLength(5);
      for (const vote of round2Votes) {
        expect(vote.motiveChoice).toBeGreaterThanOrEqual(0);
        expect(vote.motiveChoice).toBeLessThan(3);
      }

      // Host casts their own motive ballot → 6/6 → reveal terminates at truth.
      expect((await ctx.post('host-user', 'vote', { vote: { voteRound: 2, motiveChoice: 0 } })).status).toBe(200);
      const reveal = await ctx.post('host-user', 'reveal-solution', {});
      expect(reveal.status).toBe(200);
      const revealBody = (await reveal.json()) as {
        revealed: boolean;
        solution: { who: string };
        playerResults: Array<{ userId: string; round1Correct?: boolean; round2Correct?: boolean }>;
      };
      expect(revealBody.revealed).toBe(true);
      expect(revealBody.solution.who).toBe('运维');
      expect(revealBody.playerResults).toHaveLength(6);
      // Host voted slot 4 (culprit) + motive 0 (correct) → double correct.
      const hostResult = revealBody.playerResults.find((r) => r.userId === 'host-user');
      expect(hostResult).toMatchObject({ round1Correct: true, round2Correct: true });
      // Every bot has a two-step result (no undefined round2Correct).
      for (const result of revealBody.playerResults) {
        expect(typeof result.round1Correct).toBe('boolean');
        expect(typeof result.round2Correct).toBe('boolean');
      }

      // Truth sub-stage: sanitized client state exposes the revealed solution.
      const clientState = sanitizeStateForClient(testSessions.get(ctx.sessionId)!, 'host-user');
      expect(clientState.miniScriptSolutionRevealed).toBe(true);
      expect(clientState.miniScriptRevealedSolution?.who).toBe('运维');
      expect(clientState.miniScriptRevealedPlayerResults).toHaveLength(6);
      // V2 P3: the reveal hook fired the bot simulation, so the host-paced
      // ceremony already walked to beat 1 (culprit) without human input.
      expect(testSessions.get(ctx.sessionId)!.miniScriptCeremonyBeat).toBe(1);
    });
  });
});
