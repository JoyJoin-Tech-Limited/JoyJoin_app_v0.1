/**
 * MiniScript V2 P3 audit fixes (sprint miniscript-v2-p3-audit-fixes):
 *  - sanitizeStateForClient server-side reveal gating for presentedEvidence
 *    (replaces the broken client clock compare — 2026-08-13 clock-skew canon)
 *  - POST /api/miniscript/confirm-read: presenter-only, idempotent, guards
 *  - POST /api/miniscript/advance-ceremony: host-only ceremony beats (Q14)
 *  - bot simulation walks ceremony beats so the single-test chain terminates
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SocialSessionState,
  MiniScriptPresentedEvidence,
} from '@shared/socialIcebreaker';
import { MINISCRIPT_CEREMONY_MAX_BEAT } from '@shared/socialIcebreaker';
import type { MiniScriptStoryFrameworkPublic } from '@shared/miniscriptStoryFramework';
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
const { sanitizeStateForClient, MINISCRIPT_REACTION_REVEAL_DELAY_MS } =
  await import('../routes/socialIcebreakerHelpers');

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
const REACTION = '这不是我撕的，真的。';

function makeFramework(): MiniScriptStoryFrameworkPublic {
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
        beats: ['介绍场景'],
        evidence: [{ id: 'e1', name: '撕掉的便利贴', description: '垃圾桶里的便利贴。', iconKey: 'note' }],
      },
      { actNumber: 2, title: '投票', beats: ['共识表决'] },
    ],
    ending: { resolutionSummary: '真相是误会。', confessionMechanic: '每人认领一个小秘密。' },
    voteOptions: { what: ['喝了燕麦奶'], why: ['善意'] },
    motiveOptions: ['太渴了', '想开玩笑', '拿错了盒子'],
  } as MiniScriptStoryFrameworkPublic;
}

function makeSecrets() {
  return {
    solution: { who: '运维', what: '喝了燕麦奶', why: '太渴了', whoSlot: 4 },
    playerKnowledge: [],
    redHerrings: [],
    deductionChain: [],
    allClues: [],
    correctMotiveIndex: 0,
    evidenceReactions: { e1: { '2': REACTION } },
  };
}

function makePresentedEntry(overrides: Partial<MiniScriptPresentedEvidence> = {}): MiniScriptPresentedEvidence {
  return {
    evidenceId: 'e1',
    targetRoleSlot: 2,
    presentedBy: 'p1',
    actNo: 1,
    presentedAt: Date.now(),
    reactionText: REACTION,
    ...overrides,
  };
}

function makeSession(id: string, overrides: Partial<SocialSessionState> = {}): SocialSessionState {
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
    miniScriptV2Enabled: true,
    miniScriptRoleAssignments: { 'host-user': 0, p1: 1, p2: 2, p3: 3 },
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
  sessionState: SocialSessionState,
  secrets: unknown = makeSecrets(),
): Promise<Ctx> {
  const cookies = new Map<string, string>();
  for (const userId of USER_IDS) {
    const login = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
    cookies.set(userId, cookieHeader(login));
  }
  testSessions.set(id, sessionState);
  testMiniScriptSecrets.set(id, secrets);
  const post = (userId: string, path: string, body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/miniscript/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookies.get(userId)! },
      body: JSON.stringify({ socialSessionId: id, ...body }),
    });
  return { post, sessionId: id };
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
});

// ─── AC-01: sanitize server-side reveal gating ───────────────────────────────

describe('sanitizeStateForClient presentedEvidence gating (AC-01)', () => {
  it('omits reactionText for non-presenters while the entry is younger than 8s', () => {
    const state = makeSession('gate-1', {
      miniScriptPresentedEvidence: [makePresentedEntry({ presentedAt: Date.now() - 1_000 })],
    });
    const client = sanitizeStateForClient(state, 'p2');
    expect(client.miniScriptPresentedEvidence).toHaveLength(1);
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBeUndefined();
    // The entry itself (ids/slots/timing) still rides the payload.
    expect(client.miniScriptPresentedEvidence![0]).toMatchObject({
      evidenceId: 'e1',
      targetRoleSlot: 2,
      presentedBy: 'p1',
    });
  });

  it('releases reactionText to non-presenters once the entry is server-side ≥8s old', () => {
    const state = makeSession('gate-2', {
      miniScriptPresentedEvidence: [
        makePresentedEntry({ presentedAt: Date.now() - MINISCRIPT_REACTION_REVEAL_DELAY_MS - 1 }),
      ],
    });
    const client = sanitizeStateForClient(state, 'p2');
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
  });

  it('holds the boundary exactly at the 8s mark minus a millisecond', () => {
    const state = makeSession('gate-3', {
      miniScriptPresentedEvidence: [
        makePresentedEntry({ presentedAt: Date.now() - MINISCRIPT_REACTION_REVEAL_DELAY_MS + 50 }),
      ],
    });
    const client = sanitizeStateForClient(state, 'p2');
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBeUndefined();
  });

  it('the presenter always sees their own entries immediately', () => {
    const state = makeSession('gate-4', {
      miniScriptPresentedEvidence: [makePresentedEntry({ presentedAt: Date.now() })],
    });
    const client = sanitizeStateForClient(state, 'p1');
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
  });

  it('readConfirmedAt releases the reaction to everyone immediately', () => {
    const state = makeSession('gate-5', {
      miniScriptPresentedEvidence: [
        makePresentedEntry({ presentedAt: Date.now(), readConfirmedAt: Date.now() }),
      ],
    });
    const client = sanitizeStateForClient(state, 'p3');
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
  });

  it('an anonymous sanitize gates like a non-presenter', () => {
    const state = makeSession('gate-6', {
      miniScriptPresentedEvidence: [makePresentedEntry({ presentedAt: Date.now() })],
    });
    const client = sanitizeStateForClient(state);
    expect(client.miniScriptPresentedEvidence![0].reactionText).toBeUndefined();
  });

  it('does not mutate the persisted state entries', () => {
    const entry = makePresentedEntry({ presentedAt: Date.now() });
    const state = makeSession('gate-7', { miniScriptPresentedEvidence: [entry] });
    sanitizeStateForClient(state, 'p2');
    expect(state.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
  });
});

// ─── AC-02: POST /confirm-read ───────────────────────────────────────────────

describe('POST /api/miniscript/confirm-read (AC-02)', () => {
  it('sets readConfirmedAt on the presented entry (happy path)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-1', makeSession('cr-1', {
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; readConfirmedAt: number };
      expect(body.ok).toBe(true);
      expect(typeof body.readConfirmedAt).toBe('number');

      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptPresentedEvidence![0].readConfirmedAt).toBe(body.readConfirmedAt);
      // The stored entry keeps its reactionText (state is the full truth).
      expect(stored.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
      // …and non-presenters now receive it via sanitize.
      const client = sanitizeStateForClient(stored, 'p2');
      expect(client.miniScriptPresentedEvidence![0].reactionText).toBe(REACTION);
    });
  });

  it('is idempotent: a repeat confirm returns 200 with the original timestamp', async () => {
    await withServer(async (baseUrl) => {
      const confirmedAt = Date.now() - 5_000;
      const ctx = await boot(baseUrl, 'cr-2', makeSession('cr-2', {
        miniScriptPresentedEvidence: [makePresentedEntry({ readConfirmedAt: confirmedAt })],
      }));
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { alreadyConfirmed: boolean; readConfirmedAt: number };
      expect(body.alreadyConfirmed).toBe(true);
      expect(body.readConfirmedAt).toBe(confirmedAt);
    });
  });

  it('rejects a non-presenter with 403 PRESENTER_ONLY', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-3', makeSession('cr-3', {
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      const res = await ctx.post('p2', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('PRESENTER_ONLY');
      expect(testSessions.get(ctx.sessionId)!.miniScriptPresentedEvidence![0].readConfirmedAt).toBeUndefined();
    });
  });

  it('rejects an unknown (evidenceId, targetRoleSlot) with 404', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-4', makeSession('cr-4', {
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 3 });
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: string }).error).toBe('PRESENTED_ENTRY_NOT_FOUND');
    });
  });

  it('rejects with WRONG_PHASE outside mini_script', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-5', makeSession('cr-5', {
        currentPhase: 'warmup',
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_PHASE');
    });
  });

  it('fails closed with 403 FEATURE_DISABLED when the flag snapshot is off', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-6', makeSession('cr-6', {
        miniScriptV2Enabled: false,
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('FEATURE_DISABLED');
    });
  });

  it('returns 410 when the session is expired', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-7', makeSession('cr-7', {
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      testExpiredSessions.add(ctx.sessionId);
      testSessions.delete(ctx.sessionId);
      const res = await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 });
      expect(res.status).toBe(410);
      expect(((await res.json()) as { error: string }).error).toBe('SESSION_EXPIRED');
    });
  });

  it('logs carry no spoilers (no reaction text in info/warn payloads)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'cr-8', makeSession('cr-8', {
        miniScriptPresentedEvidence: [makePresentedEntry()],
      }));
      expect((await ctx.post('p1', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 })).status).toBe(200);
      expect((await ctx.post('p2', 'confirm-read', { evidenceId: 'e1', targetRoleSlot: 2 })).status).toBe(403);
      const infoArgs = JSON.stringify(vi.mocked(logger.info).mock.calls);
      const warnArgs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
      expect(infoArgs).not.toContain(REACTION);
      expect(warnArgs).not.toContain(REACTION);
      expect(infoArgs).not.toContain('correctMotiveIndex');
      expect(warnArgs).not.toContain('correctMotiveIndex');
    });
  });
});

// ─── AC-03: POST /advance-ceremony ───────────────────────────────────────────

describe('POST /api/miniscript/advance-ceremony (AC-03, Q14)', () => {
  const revealed = (id: string) =>
    makeSession(id, {
      miniScriptSolutionRevealed: true,
      miniScriptRevealedSolution: { who: '运维', what: '喝了燕麦奶', why: '太渴了', whoSlot: 4 },
    });

  it('advances beats 0 → 1 → 2 in sequence, then idempotently stays at max', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-1', revealed('ac-1'));

      const first = await ctx.post('host-user', 'advance-ceremony', {});
      expect(first.status).toBe(200);
      expect(((await first.json()) as { ceremonyBeat: number; advanced: boolean }))
        .toMatchObject({ ceremonyBeat: 1, advanced: true });

      const second = await ctx.post('host-user', 'advance-ceremony', {});
      expect(((await second.json()) as { ceremonyBeat: number; advanced: boolean }))
        .toMatchObject({ ceremonyBeat: MINISCRIPT_CEREMONY_MAX_BEAT, advanced: true });

      const third = await ctx.post('host-user', 'advance-ceremony', {});
      expect(third.status).toBe(200);
      expect(((await third.json()) as { ceremonyBeat: number; advanced: boolean }))
        .toMatchObject({ ceremonyBeat: MINISCRIPT_CEREMONY_MAX_BEAT, advanced: false });

      expect(testSessions.get(ctx.sessionId)!.miniScriptCeremonyBeat).toBe(MINISCRIPT_CEREMONY_MAX_BEAT);
    });
  });

  it('rejects non-host with 403', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-2', revealed('ac-2'));
      const res = await ctx.post('p1', 'advance-ceremony', {});
      expect(res.status).toBe(403);
      expect(testSessions.get(ctx.sessionId)!.miniScriptCeremonyBeat).toBeUndefined();
    });
  });

  it('rejects before the solution is revealed (SOLUTION_NOT_REVEALED)', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-3', makeSession('ac-3'));
      const res = await ctx.post('host-user', 'advance-ceremony', {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('SOLUTION_NOT_REVEALED');
    });
  });

  it('rejects with WRONG_PHASE outside mini_script', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-4', revealed('ac-4'));
      testSessions.get(ctx.sessionId)!.currentPhase = 'recap';
      const res = await ctx.post('host-user', 'advance-ceremony', {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('WRONG_PHASE');
    });
  });

  it('fails closed with 403 FEATURE_DISABLED when the flag snapshot is off', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-5', revealed('ac-5'));
      testSessions.get(ctx.sessionId)!.miniScriptV2Enabled = false;
      const res = await ctx.post('host-user', 'advance-ceremony', {});
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('FEATURE_DISABLED');
    });
  });

  it('returns 410 when the session is expired', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-6', revealed('ac-6'));
      testExpiredSessions.add(ctx.sessionId);
      testSessions.delete(ctx.sessionId);
      const res = await ctx.post('host-user', 'advance-ceremony', {});
      expect(res.status).toBe(410);
    });
  });

  it('the beat rides the sanitized client state for every member', async () => {
    await withServer(async (baseUrl) => {
      const ctx = await boot(baseUrl, 'ac-7', revealed('ac-7'));
      await ctx.post('host-user', 'advance-ceremony', {});
      const stored = testSessions.get(ctx.sessionId)!;
      expect(sanitizeStateForClient(stored, 'p2').miniScriptCeremonyBeat).toBe(1);
      expect(sanitizeStateForClient(stored, 'host-user').miniScriptCeremonyBeat).toBe(1);
    });
  });
});

// ─── AC-05: bot simulation walks the ceremony beats ──────────────────────────

describe('bot ceremony auto-advance (AC-05)', () => {
  const BOT_USER_IDS = ['bot-user-1', 'bot-user-2', 'bot-user-3', 'bot-user-4', 'bot-user-5'] as const;

  function makeBotSession(id: string): SocialSessionState {
    const base = makeSession(id, { miniScriptSolutionRevealed: false });
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
        characters: [0, 1, 2, 3, 4, 5].map((slotIndex) => ({
          slotIndex,
          roleLabel: `角色${slotIndex + 1}`,
          sinHook: '嘴硬',
          alibi: '有不在场证明',
        })),
      },
      miniScriptRoleAssignments: { 'host-user': 0, 'bot-user-1': 1, 'bot-user-2': 2, 'bot-user-3': 3, 'bot-user-4': 4, 'bot-user-5': 5 },
      singleTest: {
        version: 2,
        groupId: 'group-bot-ceremony',
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

  it('reveal-solution triggers the first ceremony beat and the chain reaches truth', async () => {
    process.env.ENABLE_SINGLE_TEST_MODE = 'true';
    process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED = 'true';

    await withServer(async (baseUrl) => {
      const cookies = new Map<string, string>();
      const login = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      cookies.set('host-user', cookieHeader(login));
      const sessionState = makeBotSession('bot-ceremony');
      // Vote sub-stage reached: all acts revealed, all ballots in.
      sessionState.miniScriptCurrentAct = 2;
      sessionState.miniScriptVoteOpenedAt = Date.now() - 5_000;
      sessionState.miniScriptVoteRound = 2;
      sessionState.miniScriptMotiveVoteOpenedAt = Date.now() - 2_000;
      sessionState.miniScriptVotes = [
        ...Object.keys(sessionState.miniScriptRoleAssignments!).map((userId) => ({
          userId, voteRound: 1 as const, suspectRoleSlot: 4, votedAt: Date.now(),
        })),
        ...Object.keys(sessionState.miniScriptRoleAssignments!).map((userId) => ({
          userId, voteRound: 2 as const, motiveChoice: 0, votedAt: Date.now(),
        })),
      ];
      testSessions.set('bot-ceremony', sessionState);
      testMiniScriptSecrets.set('bot-ceremony', makeSecrets());

      const reveal = await fetch(`${baseUrl}/api/miniscript/reveal-solution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookies.get('host-user')! },
        body: JSON.stringify({ socialSessionId: 'bot-ceremony' }),
      });
      expect(reveal.status).toBe(200);

      const stored = testSessions.get('bot-ceremony')!;
      expect(stored.miniScriptSolutionRevealed).toBe(true);
      // The reveal hook fired the bot simulation → beat 1 (culprit) already.
      expect(stored.miniScriptCeremonyBeat).toBe(1);

      // The next simulation run (e.g. the phase /advance hook) walks beat 2.
      const { simulateBotsForSession } = await import('../services/socialIcebreakerBotService');
      await simulateBotsForSession('bot-ceremony', stored);
      expect(stored.miniScriptCeremonyBeat).toBe(MINISCRIPT_CEREMONY_MAX_BEAT);

      // …and further runs hold at max.
      await simulateBotsForSession('bot-ceremony', stored);
      expect(stored.miniScriptCeremonyBeat).toBe(MINISCRIPT_CEREMONY_MAX_BEAT);
    });

    delete process.env.ENABLE_SINGLE_TEST_MODE;
    delete process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED;
  });
});
