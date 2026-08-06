import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi } from 'vitest';
import type { SocialSessionState, MiniScriptStoryFrameworkPublic } from '@shared/socialIcebreaker';

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
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
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

function makeTestFramework(): MiniScriptStoryFrameworkPublic {
  return {
    schemaVersion: 2,
    style: 'modern_urban',
    genres: ['light_reasoning'],
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
    ending: {
      resolutionSummary: '真相是误会。',
      confessionMechanic: '每人认领自己的小秘密。',
    },
    gameModeConfig: {
      clueCountRange: [2, 3],
      hasRedHerrings: false,
      hasHiddenAgendas: false,
      votingStyle: 'consensus',
      winCondition: 'solve_mystery',
      targetPlayMinutes: 12,
      difficulty: 'easy',
    },
  };
}

function makeTestSecrets() {
  return {
    solution: { who: '运维小哥', what: '喝了燕麦奶', why: '太渴了' },
    playerKnowledge: [
      { slotIndex: 0, knownFacts: ['我没喝'], secretAgenda: '想知道谁喝了', truthfulAlibi: '在工位' },
      { slotIndex: 1, knownFacts: ['培训五点结束'], secretAgenda: '溜号泡咖啡', truthfulAlibi: '在培训' },
      { slotIndex: 2, knownFacts: ['早上七点来的'], secretAgenda: '写了便利贴', truthfulAlibi: '第一个到' },
      { slotIndex: 3, knownFacts: ['下午才上来'], secretAgenda: '倒进保温杯', truthfulAlibi: '在机房' },
    ],
    redHerrings: [],
    deductionChain: [],
    allClues: [
      { clueId: 'c1', text: '监控显示下午3:15有人进入茶水间。', revealedInAct: 2, implies: [] },
      { clueId: 'c2', text: '垃圾桶里有撕掉的便利贴草稿。', revealedInAct: 2, implies: [] },
      { clueId: 'c3', text: '燕麦奶盒上有模糊指纹。', revealedInAct: 3, implies: [] },
    ],
  };
}

function makeTestSession(): SocialSessionState {
  return {
    socialSessionId: 'social-gameplay-1',
    icebreakerSessionId: 'ice-gp-1',
    currentPhase: 'mini_script',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'],
    joinedParticipants: [
      { userId: 'host-user', displayName: 'Host', joinedAt: new Date('2026-01-01T00:00:00Z').toISOString(), lastSeenAt: new Date('2026-01-01T00:00:00Z').toISOString(), isActive: true },
      { userId: 'p1', displayName: 'Player1', joinedAt: new Date('2026-01-01T00:01:00Z').toISOString(), lastSeenAt: new Date('2026-01-01T00:01:00Z').toISOString(), isActive: true },
      { userId: 'p2', displayName: 'Player2', joinedAt: new Date('2026-01-01T00:02:00Z').toISOString(), lastSeenAt: new Date('2026-01-01T00:02:00Z').toISOString(), isActive: true },
      { userId: 'p3', displayName: 'Player3', joinedAt: new Date('2026-01-01T00:03:00Z').toISOString(), lastSeenAt: new Date('2026-01-01T00:03:00Z').toISOString(), isActive: true },
    ],
    miniScriptFramework: makeTestFramework(),
    miniScriptFrameworkGeneratedAt: Date.now(),
    miniScriptFrameworkGeneratedByUserId: 'host-user',
  };
}

describe('POST /api/miniscript/assign-roles', () => {
  it('returns 401 when not logged in', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ socialSessionId: 's1' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('assigns roles round-robin and stores secrets', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      const res = await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        roleAssignments: Record<string, number>;
        playerRuntimeViews: Record<string, unknown>;
        readyMap: Record<string, boolean>;
        currentAct: number;
      };
      expect(body.currentAct).toBe(0);
      expect(Object.keys(body.roleAssignments)).toHaveLength(4);

      // Round-robin: host=0, p1=1, p2=2, p3=3
      expect(body.roleAssignments['host-user']).toBe(0);
      expect(body.roleAssignments['p1']).toBe(1);
      expect(body.roleAssignments['p2']).toBe(2);
      expect(body.roleAssignments['p3']).toBe(3);
      expect(Object.keys(body.playerRuntimeViews)).toEqual(['host-user']);
      expect(body.readyMap).toEqual({ 'host-user': true });

      const after = testSessions.get(session.socialSessionId);
      expect(after?.miniScriptRoleAssignments).toEqual(body.roleAssignments);
      expect(after?.miniScriptCurrentAct).toBe(0);
      expect(after?.miniScriptSolutionRevealed).toBe(false);
      expect(after?.miniScriptPlayerReady).toEqual({ 'host-user': true });
    });
  });

  it('is idempotent on repeat calls', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      const res1 = await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });
      expect(res1.status).toBe(200);
      const first = (await res1.json()) as { roleAssignments: Record<string, number> };

      const res2 = await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });
      expect(res2.status).toBe(200);
      const second = (await res2.json()) as { roleAssignments: Record<string, number> };

      expect(second.roleAssignments).toEqual(first.roleAssignments);
    });
  });
});

describe('POST /api/miniscript/reveal-act', () => {
  it('reveals clues sequentially', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      // Assign roles first
      await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      // Reveal act 1
      const res1 = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 1 }),
      });
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as { currentAct: number; revealedClueIds: string[] };
      expect(body1.currentAct).toBe(1);
      expect(body1.revealedClueIds).toEqual([]); // act 1 has no clues

      // Reveal act 2
      const res2 = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 2 }),
      });
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { currentAct: number; revealedClueIds: string[] };
      expect(body2.currentAct).toBe(2);
      expect(body2.revealedClueIds).toContain('c1');
      expect(body2.revealedClueIds).toContain('c2');

      // Skip act 3 → should fail
      const resSkip = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 4 }),
      });
      expect(resSkip.status).toBe(400);
    });
  });

  it('rejects non-host', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/p1`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);

      const res = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 1 }),
      });
      expect(res.status).toBe(403);
    });
  });
});

describe('POST /api/miniscript/vote', () => {
  it('allows players to vote and overwrite', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const hostLogin = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const hostCookie = cookieHeader(hostLogin);
      const p1Login = await fetch(`${baseUrl}/__test__/login/p1`, { method: 'POST' });
      const p1Cookie = cookieHeader(p1Login);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      // Assign roles
      await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      // p1 votes
      const res1 = await fetch(`${baseUrl}/api/miniscript/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: p1Cookie },
        body: JSON.stringify({
          socialSessionId: session.socialSessionId,
          vote: { who: '运维', what: '喝了奶', why: '太渴' },
        }),
      });
      expect(res1.status).toBe(200);

      // p1 votes again (overwrite)
      const res2 = await fetch(`${baseUrl}/api/miniscript/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: p1Cookie },
        body: JSON.stringify({
          socialSessionId: session.socialSessionId,
          vote: { who: '产品经理', what: '写了纸条', why: '提醒' },
        }),
      });
      expect(res2.status).toBe(200);

      const after = testSessions.get(session.socialSessionId);
      expect(after?.miniScriptVotes).toHaveLength(1);
      expect(after?.miniScriptVotes?.[0].who).toBe('产品经理');
    });
  });

  it('rejects vote from player without role', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const p1Login = await fetch(`${baseUrl}/__test__/login/p1`, { method: 'POST' });
      const p1Cookie = cookieHeader(p1Login);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);

      const res = await fetch(`${baseUrl}/api/miniscript/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: p1Cookie },
        body: JSON.stringify({
          socialSessionId: session.socialSessionId,
          vote: { who: 'X', what: 'Y', why: 'Z' },
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});

describe('POST /api/miniscript/reveal-solution', () => {
  it('rejects reveal until roles, every act, and every assigned-player vote are complete', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      const reveal = () => fetch(`${baseUrl}/api/miniscript/reveal-solution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      expect((await reveal()).status).toBe(400);

      session.miniScriptRoleAssignments = { 'host-user': 0, p1: 1, p2: 2, p3: 3 };
      session.miniScriptCurrentAct = session.miniScriptFramework!.act_flow.length - 1;
      expect((await reveal()).status).toBe(400);

      session.miniScriptCurrentAct = session.miniScriptFramework!.act_flow.length;
      session.miniScriptVotes = [{ userId: 'host-user', who: 'A', what: 'B', why: 'C', votedAt: Date.now() }];
      expect((await reveal()).status).toBe(400);
    });
  });

  it('reveals solution to host only', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      session.miniScriptRoleAssignments = { 'host-user': 0, p1: 1, p2: 2, p3: 3 };
      session.miniScriptCurrentAct = session.miniScriptFramework!.act_flow.length;
      session.miniScriptVotes = Object.keys(session.miniScriptRoleAssignments).map((userId) => ({
        userId, who: 'A', what: 'B', why: 'C', votedAt: Date.now(),
      }));
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      const res = await fetch(`${baseUrl}/api/miniscript/reveal-solution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { solution: { who: string }; revealed: boolean };
      expect(body.solution.who).toBe('运维小哥');
      expect(body.revealed).toBe(true);

      const after = testSessions.get(session.socialSessionId);
      expect(after?.miniScriptSolutionRevealed).toBe(true);
      expect(after?.miniScriptRevealedSolution).toEqual(makeTestSecrets().solution);
    });
  });

  it('is idempotent', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      session.miniScriptRoleAssignments = { 'host-user': 0, p1: 1, p2: 2, p3: 3 };
      session.miniScriptCurrentAct = session.miniScriptFramework!.act_flow.length;
      session.miniScriptVotes = Object.keys(session.miniScriptRoleAssignments).map((userId) => ({
        userId, who: 'A', what: 'B', why: 'C', votedAt: Date.now(),
      }));
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      await fetch(`${baseUrl}/api/miniscript/reveal-solution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      const res2 = await fetch(`${baseUrl}/api/miniscript/reveal-solution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      expect(res2.status).toBe(200);
      const body = (await res2.json()) as { solution: { who: string } };
      expect(body.solution.who).toBe('运维小哥');
    });
  });
});

describe('POST /api/miniscript/ready', () => {
  it('toggles player ready status', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/p1`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      // Assign roles first
      const hostLogin = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const hostCookie = cookieHeader(hostLogin);
      await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      // Toggle ready
      const res = await fetch(`${baseUrl}/api/miniscript/ready`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, ready: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; readyMap: Record<string, boolean> };
      expect(body.ok).toBe(true);
      expect(body.readyMap['p1']).toBe(true);

      // Toggle off
      const res2 = await fetch(`${baseUrl}/api/miniscript/ready`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, ready: false }),
      });
      const body2 = (await res2.json()) as { ok: boolean; readyMap: Record<string, boolean> };
      expect(body2.readyMap['p1']).toBe(false);
    });
  });

  it('rejects ready without role assignment', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/p1`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);

      const res = await fetch(`${baseUrl}/api/miniscript/ready`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, ready: true }),
      });

      expect(res.status).toBe(400);
    });
  });
});

describe('five-client Mini Script journey', () => {
  it('runs host + four players through assignment, acts, editable voting, reveal, and privacy views', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();

    await withServer(async (baseUrl) => {
      const userIds = ['host-user', 'p1', 'p2', 'p3', 'p4'];
      const cookies = new Map<string, string>();
      for (const userId of userIds) {
        const login = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
        cookies.set(userId, cookieHeader(login));
      }

      const state = makeTestSession();
      state.playerCount = 5;
      state.joinedParticipants!.push({
        userId: 'p4', displayName: 'Player4',
        joinedAt: new Date('2026-01-01T00:04:00Z').toISOString(),
        lastSeenAt: new Date('2026-01-01T00:04:00Z').toISOString(),
        isActive: true,
      });
      state.miniScriptFramework!.characters.push({
        slotIndex: 4, roleLabel: '访客', sinHook: '好奇', alibi: '在前台登记',
      });
      const secrets = makeTestSecrets();
      secrets.playerKnowledge.push({
        slotIndex: 4, knownFacts: ['听见了杯子声'], secretAgenda: '找回遗失的笔', truthfulAlibi: '在前台',
      });
      testSessions.set(state.socialSessionId, state);
      testMiniScriptSecrets.set(state.socialSessionId, secrets);

      const post = (userId: string, path: string, body: Record<string, unknown>) => fetch(
        `${baseUrl}/api/miniscript/${path}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: cookies.get(userId)! },
          body: JSON.stringify({ socialSessionId: state.socialSessionId, ...body }),
        },
      );

      const assignmentResponse = await post('host-user', 'assign-roles', {});
      expect(assignmentResponse.status).toBe(200);
      const assignmentBody = await assignmentResponse.json() as {
        playerRuntimeViews: Record<string, unknown>;
        readyMap: Record<string, boolean>;
      };
      expect(Object.keys(assignmentBody.playerRuntimeViews)).toEqual(['host-user']);
      expect(assignmentBody.readyMap).toEqual({ 'host-user': true });

      for (const userId of userIds) {
        const clientState = sanitizeStateForClient(testSessions.get(state.socialSessionId)!, userId);
        expect(Object.keys(clientState.miniScriptPlayerRuntimeViews ?? {})).toEqual([userId]);
        expect(clientState.miniScriptRevealedSolution).toBeUndefined();
      }

      for (const userId of userIds.slice(1)) {
        expect((await post(userId, 'ready', { ready: true })).status).toBe(200);
      }
      expect(Object.values(testSessions.get(state.socialSessionId)!.miniScriptPlayerReady ?? {}).filter(Boolean)).toHaveLength(5);

      for (let targetAct = 1; targetAct <= state.miniScriptFramework!.act_flow.length; targetAct += 1) {
        expect((await post('host-user', 'reveal-act', { targetAct })).status).toBe(200);
      }

      for (const [index, userId] of userIds.slice(0, 4).entries()) {
        expect((await post(userId, 'vote', {
          vote: { who: `角色${index}`, what: `行为${index}`, why: `理由${index}` },
        })).status).toBe(200);
      }
      expect((await post('host-user', 'reveal-solution', {})).status).toBe(400);

      expect((await post('p1', 'vote', {
        vote: { who: '改票角色', what: '改票行为', why: '改票理由' },
      })).status).toBe(200);
      expect(testSessions.get(state.socialSessionId)!.miniScriptVotes).toHaveLength(4);

      expect((await post('p4', 'vote', {
        vote: { who: '角色4', what: '行为4', why: '理由4' },
      })).status).toBe(200);
      const revealResponse = await post('host-user', 'reveal-solution', {});
      expect(revealResponse.status).toBe(200);

      for (const userId of userIds) {
        const clientState = sanitizeStateForClient(testSessions.get(state.socialSessionId)!, userId);
        expect(clientState.miniScriptRevealedSolution).toEqual(secrets.solution);
        expect(Object.keys(clientState.miniScriptPlayerRuntimeViews ?? {})).toEqual([userId]);
      }
    });
  });
});

describe('POST /api/miniscript/reveal-act deduction hints', () => {
  it('returns deduction hints when all prerequisite clues are revealed', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, {
        ...makeTestSecrets(),
        deductionChain: [
          { stepNumber: 1, fromClues: ['c1', 'c2'], conclusion: '有人撕掉了便利贴' },
          { stepNumber: 2, fromClues: ['c1', 'c2', 'c3'], conclusion: '运维小哥最可疑' },
        ],
      });

      // Reveal act 1 (no clues)
      await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 1 }),
      });

      // Reveal act 2 (c1, c2)
      const res1 = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 2 }),
      });
      const body1 = (await res1.json()) as { deductionHints: Array<{ stepNumber: number; conclusion: string }> };
      expect(body1.deductionHints).toHaveLength(1);
      expect(body1.deductionHints[0].stepNumber).toBe(1);

      // Reveal act 3 (c3)
      const res2 = await fetch(`${baseUrl}/api/miniscript/reveal-act`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId, targetAct: 3 }),
      });
      const body2 = (await res2.json()) as { deductionHints: Array<{ stepNumber: number; conclusion: string }> };
      expect(body2.deductionHints).toHaveLength(2);
    });
  });
});

describe('Secrecy invariant', () => {
  it('framework in session state has no clues, solution, playerKnowledge, or character secrets', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const session = makeTestSession();
      testSessions.set(session.socialSessionId, session);
      testMiniScriptSecrets.set(session.socialSessionId, makeTestSecrets());

      await fetch(`${baseUrl}/api/miniscript/assign-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId: session.socialSessionId }),
      });

      const after = testSessions.get(session.socialSessionId);
      const framework = after?.miniScriptFramework;

      // Framework must not have secret fields as keys
      expect(framework).not.toHaveProperty('clues');
      expect(framework).not.toHaveProperty('solution');
      expect(framework).not.toHaveProperty('playerKnowledge');
      expect(framework).not.toHaveProperty('redHerrings');
      expect(framework).not.toHaveProperty('deductionChain');

      // Characters should not have 'secret' field
      expect(framework?.characters[0]).not.toHaveProperty('secret');
    });
  });
});
