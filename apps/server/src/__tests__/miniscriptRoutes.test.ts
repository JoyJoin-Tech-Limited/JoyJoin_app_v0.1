import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi } from 'vitest';
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

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

describe('POST /api/miniscript/generate', () => {
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
      const body = (await res.json()) as { premise: string; schemaVersion: number };
      expect(body.schemaVersion).toBe(2);
      expect(typeof body.premise).toBe('string');

      const after = testSessions.get(socialSessionId);
      expect(after?.miniScriptFramework?.premise).toBe(body.premise);
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
      const generatedAtAfterFirst = testSessions.get(socialSessionId)?.miniScriptFrameworkGeneratedAt;

      const res2 = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          ...body1,
          style: 'medieval',
          genres: ['romance'],
        }),
      });
      expect(res2.status).toBe(200);
      const second = (await res2.json()) as { premise: string; style: string };
      expect(second.premise).toBe(first.premise);
      // Idempotent: same cached framework returned regardless of new request params
      expect(testSessions.get(socialSessionId)?.miniScriptFrameworkGeneratedAt).toBe(generatedAtAfterFirst);
    });
  });
});
