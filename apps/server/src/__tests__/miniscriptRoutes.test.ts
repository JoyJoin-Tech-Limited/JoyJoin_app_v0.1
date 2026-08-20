import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

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
    if (!state) return [];
    return [
      { userId: state.hostUserId, displayName: state.hostDisplayName, joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), isActive: true },
    ];
  },
}));

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

describe('POST /api/miniscript/generate', () => {
  beforeEach(() => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  });

  it('returns 401 when not logged in', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          socialSessionId: 's1',
          playerCount: 4,
          style: 'modern_urban',
          genres: ['absurd_comedy'],
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('persists framework for host in mini_script phase', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const socialSessionId = 'social-test-1';
      const seed: SocialSessionState = {
        socialSessionId,
        icebreakerSessionId: 'ice-1',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'],
      };
      testSessions.set(socialSessionId, seed);

      const res = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId,
          playerCount: 4,
          style: 'modern_urban',
          genres: ['absurd_comedy'],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        premise: string;
        schemaVersion: number;
        ending: { resolutionSummary: string };
      };
      expect(body.schemaVersion).toBe(2);
      expect(typeof body.premise).toBe('string');
      expect(body.ending.resolutionSummary).toBe('真相将在最终揭晓时公开。');

      const after = testSessions.get(socialSessionId);
      expect(after?.miniScriptFramework).toBeUndefined();
      expect(after?.miniScriptCandidateFramework?.premise).toBe(body.premise);

      const statusRes = await fetch(
        `${baseUrl}/api/miniscript/generation-status?socialSessionId=${socialSessionId}`,
        { headers: { cookie } },
      );
      expect(statusRes.status).toBe(200);
      expect(await statusRes.json()).toMatchObject({ stage: 'complete', progress: 100 });
    });
  });

  it('returns existing framework on repeat POST (idempotent, no overwrite)', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);

      const socialSessionId = 'social-test-idem';
      const seed: SocialSessionState = {
        socialSessionId,
        icebreakerSessionId: 'ice-idem',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'],
      };
      testSessions.set(socialSessionId, seed);

      const body1 = {
        socialSessionId,
        playerCount: 4,
        style: 'modern_urban',
        genres: ['absurd_comedy'],
      };
      const res1 = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(body1),
      });
      expect(res1.status).toBe(200);
      const first = (await res1.json()) as { premise: string };
      const generatedAtAfterFirst = testSessions.get(socialSessionId)?.miniScriptCandidateGeneratedAt;

      const res2 = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(body1),
      });
      expect(res2.status).toBe(200);
      const second = (await res2.json()) as { premise: string; style: string };
      expect(second.premise).toBe(first.premise);
      // Idempotent: the same selection returns the cached candidate.
      expect(testSessions.get(socialSessionId)?.miniScriptCandidateGeneratedAt).toBe(generatedAtAfterFirst);
    });
  });

  it('collapses concurrent double-click generation into one framework', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'social-test-concurrent';
      testSessions.set(socialSessionId, {
        socialSessionId,
        icebreakerSessionId: 'ice-concurrent',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['mini_script', 'recap'],
      });

      const generate = () => fetch(
        `${baseUrl}/api/miniscript/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            socialSessionId,
            playerCount: 4,
            style: 'modern_urban',
            genres: ['light_reasoning'],
          }),
        },
      );

      const [firstResponse, secondResponse] = await Promise.all([
        generate(),
        generate(),
      ]);
      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      const first = await firstResponse.json() as { style: string; premise: string };
      const second = await secondResponse.json() as { style: string; premise: string };
      expect(second).toMatchObject({ style: first.style, premise: first.premise });
      expect(testSessions.get(socialSessionId)?.miniScriptCandidateFramework?.style).toBe(first.style);
    });
  });
});

describe('mini-script host library', () => {
  beforeEach(() => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  });

  it('lists compatible curated scripts for the selected style', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'social-library-list';
      testSessions.set(socialSessionId, {
        socialSessionId,
        icebreakerSessionId: 'ice-library-list',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['mini_script', 'recap'],
      });

      const res = await fetch(
        `${baseUrl}/api/miniscript/library?socialSessionId=${socialSessionId}&style=modern_urban`,
        { headers: { cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { scripts: Array<{ id: string; source: string; premise: string }>; generationStatus: unknown };
      expect(body.scripts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'modern-urban-light-reasoning-001', source: 'catalog' }),
      ]));
      expect(body.scripts[0]?.premise).not.toContain('secret');
      expect(body.generationStatus).toBeNull();
    });
  });

  it('lets only the host select a catalog script and persists public framework plus secrets', async () => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    await withServer(async (baseUrl) => {
      const hostLogin = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const hostCookie = cookieHeader(hostLogin);
      const playerLogin = await fetch(`${baseUrl}/__test__/login/player-user`, { method: 'POST' });
      const playerCookie = cookieHeader(playerLogin);
      const socialSessionId = 'social-library-select';
      testSessions.set(socialSessionId, {
        socialSessionId,
        icebreakerSessionId: 'ice-library-select',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 5,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['mini_script', 'recap'],
      });

      const select = (cookie: string) => fetch(`${baseUrl}/api/miniscript/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId, scriptId: 'modern-urban-light-reasoning-001' }),
      });
      expect((await select(playerCookie)).status).toBe(403);
      const hostRes = await select(hostCookie);
      expect(hostRes.status).toBe(200);
      expect(testSessions.get(socialSessionId)?.miniScriptFramework?.characters).toHaveLength(5);
      expect(testMiniScriptSecrets.has(socialSessionId)).toBe(true);
      expect((await hostRes.json()) as object).not.toHaveProperty('solution');
    });
  });

  it('promotes a generated candidate only after the host selects it', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'social-candidate-select';
      testSessions.set(socialSessionId, {
        socialSessionId,
        icebreakerSessionId: 'ice-candidate-select',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['mini_script', 'recap'],
      });

      const generateRes = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId, playerCount: 4, style: 'modern_urban', genres: ['light_reasoning'], selectedLabel: '现代都市' }),
      });
      expect(generateRes.status).toBe(200);
      expect(testSessions.get(socialSessionId)?.miniScriptFramework).toBeUndefined();
      expect(testSessions.get(socialSessionId)?.miniScriptCandidateFramework).toBeDefined();

      const selectRes = await fetch(`${baseUrl}/api/miniscript/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId, scriptId: 'current-generation' }),
      });
      expect(selectRes.status).toBe(200);
      expect(testSessions.get(socialSessionId)?.miniScriptFramework?.style).toBe('modern_urban');
      expect(testSessions.get(socialSessionId)?.miniScriptCandidateFramework).toBeUndefined();
    });
  });

  it('derives clause titles for untitled catalog entries and prefers framework.title for candidates', async () => {
    testSessions.clear();
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'social-library-titles';
      testSessions.set(socialSessionId, {
        socialSessionId,
        icebreakerSessionId: 'ice-library-titles',
        currentPhase: 'mini_script',
        hostUserId: 'host-user',
        hostDisplayName: 'Host',
        playerCount: 4,
        phaseStartedAt: Date.now(),
        sessionStartedAt: Date.now(),
        completedPhases: [],
        enabledPhases: ['mini_script', 'recap'],
      });

      // Untitled catalog entry → first-clause derivation, no mid-sentence cut.
      const listRes = await fetch(
        `${baseUrl}/api/miniscript/library?socialSessionId=${socialSessionId}&style=modern_urban`,
        { headers: { cookie } },
      );
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json() as { scripts: Array<{ id: string; title: string }> };
      const catalogScript = listBody.scripts.find((s) => s.id === 'modern-urban-light-reasoning-001');
      expect(catalogScript?.title).toBe('周五晚的写字楼茶水间');

      // Generated candidate carrying a framework.title → used verbatim.
      const genRes = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId,
          playerCount: 4,
          style: 'western_court',
          genres: ['light_reasoning'],
        }),
      });
      expect(genRes.status).toBe(200);
      expect(testSessions.get(socialSessionId)?.miniScriptCandidateFramework?.title).toBe('凡尔赛的胸针');

      const listRes2 = await fetch(
        `${baseUrl}/api/miniscript/library?socialSessionId=${socialSessionId}&style=western_court`,
        { headers: { cookie } },
      );
      const listBody2 = await listRes2.json() as { scripts: Array<{ id: string; title: string }> };
      expect(listBody2.scripts[0]).toMatchObject({ id: 'current-generation', title: '凡尔赛的胸针' });
    });
  });
});
