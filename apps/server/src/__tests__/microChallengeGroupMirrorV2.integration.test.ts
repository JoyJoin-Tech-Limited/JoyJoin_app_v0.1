import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'net';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';

vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();
  const preGenStore = new Map<string, any>();

  return {
    SESSION_TTL_MS: 6 * 60 * 60 * 1000,
    PRESENCE_THRESHOLD_MS: 30_000,
    getSocialSessionId: (id: string) => `social_${id}`,
    getSession: async (socialSessionId: string) => sessions.get(socialSessionId) ?? null,
    getSessionWithExpiry: async (socialSessionId: string) => {
      const state = sessions.get(socialSessionId) ?? null;
      return { state, expired: false };
    },
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
      const ps = participants.get(socialSessionId);
      if (!ps) return;
      const p = ps.get(userId);
      if (p) p.lastSeenAt = Date.now();
    },
    getRosterCount: async (socialSessionId: string) => participants.get(socialSessionId)?.size ?? 0,
    getActiveParticipantCount: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return 0;
      const cutoff = Date.now() - 30_000;
      return [...ps.values()].filter((p) => p.lastSeenAt > cutoff).length;
    },
    getParticipant: async (socialSessionId: string, userId: string) =>
      participants.get(socialSessionId)?.get(userId) ?? null,
    listParticipants: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return [];
      const cutoff = Date.now() - 30_000;
      return [...ps.values()]
        .sort((left, right) => left.joinedAt - right.joinedAt)
        .map((participant) => ({
          userId: participant.userId,
          displayName: participant.displayName,
          joinedAt: new Date(participant.joinedAt).toISOString(),
          lastSeenAt: new Date(participant.lastSeenAt).toISOString(),
          isActive: participant.lastSeenAt > cutoff,
        }));
    },
    setLieTruths: vi.fn().mockResolvedValue(undefined),
    getLieTruths: vi.fn().mockResolvedValue(null),
    loadSessionLieTruths: vi.fn().mockResolvedValue(new Map()),
    getPreGenerationResult: vi.fn().mockResolvedValue(null),
    getInFlightJobForPhase: vi.fn().mockResolvedValue(null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [{ id: 'c1', title: '击掌', description: '和你左边的人击掌', durationSeconds: 30, completionCTA: '完成了' }],
    meta: { generatedAt: '2026-04-02T00:00:00.000Z', fromCache: false, provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-micro-challenges-v2' },
  }),
  generateGroupMirrorQuestions: vi.fn().mockResolvedValue({
    data: [
      { id: 'gm_1', questionText: '谁最有可能在聚会后请大家吃夜宵？', category: 'perception' },
      { id: 'gm_2', questionText: '谁看起来最像会偷偷养猫的人？', category: 'perception' },
    ],
    meta: { generatedAt: '2026-04-02T00:00:00.000Z', fromCache: false, provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-group-mirror-v1' },
  }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: { generatedAt: '2026-04-02T00:00:00.000Z', fromCache: false, provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-recap-summary-v2' },
  }),
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn().mockImplementation(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) return { accepted: false, conflict: 'validation_failed' };
    await apply(_payload);
    return { accepted: true };
  }),
  isOperationIdProcessed: vi.fn().mockResolvedValue(false),
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
const { getSession, updateSession } = await import('../lib/socialIcebreakerStore');
const { generateGroupMirrorQuestions } = await import('../socialIcebreakerAIService');

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

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

async function createSession(baseUrl: string, hostCookie: string, sessionId: string, opts?: { autoAdvance?: boolean; phase?: string }) {
  await fetch(`${baseUrl}/api/social-icebreaker/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: hostCookie },
    body: JSON.stringify({ sessionId, displayName: 'Host' }),
  });
  const storeState = await getSession(`social_${sessionId}`);
  if (storeState) {
    if (opts?.phase) storeState.currentPhase = opts.phase as SocialIcebreakerPhase;
    if (opts?.autoAdvance !== undefined) storeState.autoAdvanceEnabled = opts.autoAdvance;
    await updateSession(`social_${sessionId}`, storeState);
  }
  return `social_${sessionId}`;
}

describe('Micro Challenge V2 — integration gaps', () => {
  it('BUG: unauthenticated user calling /micro-challenge/generate gets 401', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'mc-auth-host');
      const socialSessionId = await createSession(baseUrl, hostCookie, 'mc-auth-test', { phase: 'micro_challenge' });

      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });
  });

  it('backward compatibility: complete WITHOUT operationId works', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'mc-bc-host');
      const guestCookie = await login(baseUrl, 'mc-bc-guest');
      const socialSessionId = await createSession(baseUrl, hostCookie, 'mc-bc-test', { phase: 'micro_challenge' });

      // Guest joins
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'mc-bc-test', displayName: 'Guest' }),
      });

      // Generate challenge
      const genRes = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      expect(genRes.status).toBe(200);

      // Complete WITHOUT operationId
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({}),
      });
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.completedBy).toContain('mc-bc-guest');
      expect(body.operationId).toBeNull();
    });
  });
});

describe('Group Mirror V2 — integration gaps', () => {
  it('BUG: unauthenticated user calling /group-mirror/reveal with autoAdvance=true gets 401', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'gm-reveal-host');
      const socialSessionId = await createSession(baseUrl, hostCookie, 'gm-reveal-test', { phase: 'group_mirror', autoAdvance: true });

      // Pre-populate questions so reveal can proceed
      const state = await getSession(socialSessionId);
      if (state) {
        state.groupMirrorQuestions = [{ id: 'q1', questionText: 'Test?', category: 'perception' }];
        await updateSession(socialSessionId, state);
      }

      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NO cookie = unauthenticated
      });
      // EXPECTED: 401
      // ACTUAL BUG: Because isHostAuthorized returns true when autoAdvanceEnabled=true and userId is undefined,
      // this returns 200 instead of 401.
      expect(res.status).toBe(401);
    });
  });

  it('BUG: /group-mirror/submit lacks phase guard — accepts submissions in wrong phase', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'gm-phase-host');
      const guestCookie = await login(baseUrl, 'gm-phase-guest');
      // Session is in warmup, NOT group_mirror
      const socialSessionId = await createSession(baseUrl, hostCookie, 'gm-phase-test', { phase: 'warmup' });

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'gm-phase-test', displayName: 'Guest' }),
      });

      const res = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ answers: [{ questionId: 'q1', targetUserId: 'gm-phase-host' }] }),
      });
      // EXPECTED: 400 because not in group_mirror phase
      // ACTUAL BUG: returns 200 because there is no phase check
      expect(res.status).toBe(400);
    });
  });

  it('full flow: generate → submit → reveal', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'gm-full-host');
      const guestCookie = await login(baseUrl, 'gm-full-guest');
      const socialSessionId = await createSession(baseUrl, hostCookie, 'gm-full-test', { phase: 'group_mirror' });

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'gm-full-test', displayName: 'Guest' }),
      });

      // Generate
      const genRes = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      expect(genRes.status).toBe(200);
      const genBody = await genRes.json() as any;
      expect(genBody.questions).toHaveLength(2);

      // Submit
      const submitRes = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ answers: [{ questionId: 'gm_1', targetUserId: 'gm-full-host' }] }),
      });
      expect(submitRes.status).toBe(200);
      const submitBody = await submitRes.json() as any;
      expect(submitBody.submitted).toBe(true);

      // Reveal
      const revealRes = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      expect(revealRes.status).toBe(200);
      const revealBody = await revealRes.json() as any;
      expect(revealBody.revealed).toBe(true);
      expect(revealBody.results).toHaveLength(2);
    });
  });

  it('context injection: generateGroupMirrorQuestions receives roster with archetype context', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'gm-ctx-host');
      const guestCookie = await login(baseUrl, 'gm-ctx-guest');
      const socialSessionId = await createSession(baseUrl, hostCookie, 'gm-ctx-test', { phase: 'group_mirror' });

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'gm-ctx-test', displayName: 'Guest' }),
      });

      vi.mocked(generateGroupMirrorQuestions).mockClear();

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });

      expect(generateGroupMirrorQuestions).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(generateGroupMirrorQuestions).mock.calls[0][0];
      // The roster should be passed so that buildArchetypeContext can inject 【本组画像】
      expect(callArg.roster).toBeDefined();
      expect(Array.isArray(callArg.roster)).toBe(true);
      expect(callArg.roster!.length).toBeGreaterThanOrEqual(1);
    });
  });
});
