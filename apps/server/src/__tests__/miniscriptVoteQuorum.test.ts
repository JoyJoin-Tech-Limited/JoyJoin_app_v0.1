/**
 * T5/T6(c) coverage: structured vote contract + quorum-based reveal.
 *  - suspectRoleSlot accepted and tallied by slot; invalid slot rejected
 *  - legacy free-text votes still accepted (roleLabel match → slot; otherwise participation only)
 *  - reveal-solution blocked below quorum before 90s, allowed at quorum, allowed after 90s
 *  - voteOpenedAt recorded when the final act is revealed
 *  - miniScriptVoteProgress exposed on sanitized client state
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi } from 'vitest';
import type { SocialSessionState, MiniScriptStoryFrameworkPublic } from '@shared/socialIcebreaker';
import { MINISCRIPT_VOTE_MIN_OPEN_MS, type MiniScriptVoteProgress } from '@shared/miniscriptStoryFramework';

const { testSessions, testMiniScriptSecrets } = vi.hoisted(() => ({
  testSessions: new Map<string, SocialSessionState>(),
  testMiniScriptSecrets: new Map<string, unknown>(),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: false,
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
}));

const { default: miniscriptRouter } = await import('../routes/domains/miniscript');
const { sanitizeStateForClient } = await import('../routes/socialIcebreakerHelpers');

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
      { actNumber: 1, title: '开场', beats: ['介绍场景', '每人一句话'] },
      { actNumber: 2, title: '线索', beats: ['交换信息', '发现矛盾'] },
      { actNumber: 3, title: '投票', beats: ['共识表决', '揭晓'] },
    ],
    ending: { resolutionSummary: '真相是误会。', confessionMechanic: '每人认领自己的小秘密。' },
    voteOptions: { what: ['喝了燕麦奶', '写了纸条', '只是误会'], why: ['善意', '胆怯', '好面子'] },
  };
}

function makeSecrets() {
  return {
    solution: { who: '运维', what: '喝了燕麦奶', why: '太渴了' },
    playerKnowledge: USER_IDS.map((_, slotIndex) => ({
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
  };
}

function makeSession(id: string): SocialSessionState {
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
  };
}

type Ctx = {
  post: (userId: string, path: string, body: Record<string, unknown>) => Promise<Response>;
  sessionId: string;
};

async function bootGame(baseUrl: string, id: string): Promise<Ctx> {
  const cookies = new Map<string, string>();
  for (const userId of USER_IDS) {
    const login = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
    cookies.set(userId, cookieHeader(login));
  }
  const sessionId = id;
  testSessions.set(sessionId, makeSession(sessionId));
  testMiniScriptSecrets.set(sessionId, makeSecrets());
  const post = (userId: string, path: string, body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/miniscript/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookies.get(userId)! },
      body: JSON.stringify({ socialSessionId: sessionId, ...body }),
    });
  return { post, sessionId };
}

/** Assign roles and reveal every act — the state a real session is in when voting starts. */
async function reachVotePhase(ctx: Ctx) {
  expect((await ctx.post('host-user', 'assign-roles', {})).status).toBe(200);
  for (let act = 1; act <= 3; act += 1) {
    expect((await ctx.post('host-user', 'reveal-act', { targetAct: act })).status).toBe(200);
  }
}

describe('structured vote contract', () => {
  it('accepts suspectRoleSlot, tallies by slot, and exposes progress on client state', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-structured');
      await reachVotePhase(ctx);

      const res = await ctx.post('p1', 'vote', { vote: { suspectRoleSlot: 4, what: '喝了奶', why: '太渴' } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; vote: { suspectRoleSlot: number }; voteProgress: MiniScriptVoteProgress };
      expect(body.ok).toBe(true);
      expect(body.vote.suspectRoleSlot).toBe(4);
      expect(body.voteProgress).toMatchObject({ votedCount: 1, totalAssigned: 4, quorum: 3, canReveal: false });
      expect(body.voteProgress.tally).toEqual([{ roleSlot: 4, count: 1 }]);

      await ctx.post('p2', 'vote', { vote: { suspectRoleSlot: 4 } });
      await ctx.post('p3', 'vote', { vote: { suspectRoleSlot: 2 } });

      const stored = testSessions.get(ctx.sessionId)!;
      expect(stored.miniScriptVotes).toHaveLength(3);

      // voteOpenedAt was stamped when the final act was revealed.
      expect(typeof stored.miniScriptVoteOpenedAt).toBe('number');

      const clientState = sanitizeStateForClient(stored, 'p1');
      expect(clientState.miniScriptVoteProgress?.tally).toEqual([
        { roleSlot: 4, count: 2 },
        { roleSlot: 2, count: 1 },
      ]);
      expect(clientState.miniScriptVoteProgress?.canReveal).toBe(true); // 3 >= quorum 3
    });
  });

  it('rejects an out-of-range suspectRoleSlot', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-invalid-slot');
      await reachVotePhase(ctx);

      for (const bad of [0, 5, 99]) {
        const res = await ctx.post('p1', 'vote', { vote: { suspectRoleSlot: bad } });
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: string }).error).toBe('INVALID_SUSPECT_SLOT');
      }
      expect(testSessions.get(ctx.sessionId)!.miniScriptVotes ?? []).toHaveLength(0);
    });
  });

  it('rejects a ballot with neither suspectRoleSlot nor who', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-empty');
      await reachVotePhase(ctx);
      const res = await ctx.post('p1', 'vote', { vote: { what: '只有行为' } });
      expect(res.status).toBe(400);
    });
  });

  it('accepts legacy free-text votes and maps roleLabel matches to slots', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-legacy');
      await reachVotePhase(ctx);

      // Exact roleLabel match → slot 4.
      const res1 = await ctx.post('p1', 'vote', { vote: { who: '运维', what: '喝了奶', why: '太渴' } });
      expect(res1.status).toBe(200);
      expect(((await res1.json()) as { vote: { suspectRoleSlot?: number } }).vote.suspectRoleSlot).toBe(4);

      // Unmatched free text → ballot counts toward participation, no tally slot.
      const res2 = await ctx.post('p2', 'vote', { vote: { who: '那个最可疑的人', what: 'X', why: 'Y' } });
      expect(res2.status).toBe(200);
      const progress = (await res2.json()) as { voteProgress: MiniScriptVoteProgress };
      expect(progress.voteProgress.votedCount).toBe(2);
      expect(progress.voteProgress.tally).toEqual([{ roleSlot: 4, count: 1 }]);
    });
  });
});

describe('quorum reveal guard', () => {
  it('blocks below quorum before 90s, allows at quorum', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-quorum');
      await reachVotePhase(ctx);

      await ctx.post('p1', 'vote', { vote: { suspectRoleSlot: 4 } });
      await ctx.post('p2', 'vote', { vote: { suspectRoleSlot: 4 } });

      // 2 of 4 voted, quorum 3, vote just opened → blocked.
      const blocked = await ctx.post('host-user', 'reveal-solution', {});
      expect(blocked.status).toBe(400);
      const blockedBody = (await blocked.json()) as { error: string; remaining: number; voteProgress: MiniScriptVoteProgress };
      expect(blockedBody.error).toBe('WAITING_FOR_VOTES');
      expect(blockedBody.remaining).toBe(1);
      expect(blockedBody.voteProgress.canReveal).toBe(false);

      // Third distinct ballot reaches quorum → host may reveal.
      await ctx.post('p3', 'vote', { vote: { suspectRoleSlot: 2 } });
      const reveal = await ctx.post('host-user', 'reveal-solution', {});
      expect(reveal.status).toBe(200);
      const revealBody = (await reveal.json()) as { solution: { who: string }; voteProgress: MiniScriptVoteProgress };
      expect(revealBody.solution.who).toBe('运维');
      expect(revealBody.voteProgress.canReveal).toBe(true);
    });
  });

  it('allows reveal below quorum once the vote has been open for 90 seconds', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const ctx = await bootGame(baseUrl, 'vote-timeout');
      await reachVotePhase(ctx);

      await ctx.post('p1', 'vote', { vote: { suspectRoleSlot: 4 } });

      // Only 1 of 4 voted — below quorum — and the phase is fresh → blocked.
      expect((await ctx.post('host-user', 'reveal-solution', {})).status).toBe(400);

      // …but once the vote has been open ≥ 90s the host is unblocked.
      const stored = testSessions.get(ctx.sessionId)!;
      stored.miniScriptVoteOpenedAt = Date.now() - MINISCRIPT_VOTE_MIN_OPEN_MS - 1_000;
      const reveal = await ctx.post('host-user', 'reveal-solution', {});
      expect(reveal.status).toBe(200);
    });
  });
});
