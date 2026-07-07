/**
 * Bonus Gate Routes — auth + host/player vote flow tests
 *
 * Routes under test:
 *   POST /api/miniscript/bonus/respond  — host accept/decline
 *   POST /api/miniscript/bonus/sentiment — player want/pass
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  const lieTruthsStore = new Map<string, Map<string, unknown[]>>();
  return { sessions, participants, lieTruthsStore };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants, lieTruthsStore } = storeCtx;
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
    createSession: async (state: SocialSessionState) => {
      sessions.set(state.socialSessionId, state);
    },
    updateSession: async (socialSessionId: string, state: SocialSessionState) => {
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
    heartbeat: async () => {},
    getRosterCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
      return participants.get(socialSessionId)?.size ?? 0;
    },
    getActiveParticipantCount: async (socialSessionId: string) => {
      const st = sessions.get(socialSessionId);
      if (typeof st?.playerCount === 'number') return st.playerCount;
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
      return [...ps.values()].map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        joinedAt: new Date(participant.joinedAt).toISOString(),
        lastSeenAt: new Date(participant.lastSeenAt).toISOString(),
        isActive: true,
      }));
    },
    setLieTruths: async (socialSessionId: string, userId: string, truths: unknown[]) => {
      if (!lieTruthsStore.has(socialSessionId)) lieTruthsStore.set(socialSessionId, new Map());
      lieTruthsStore.get(socialSessionId)!.set(userId, truths);
    },
    getLieTruths: async (socialSessionId: string, userId: string) =>
      lieTruthsStore.get(socialSessionId)?.get(userId) ?? null,
    loadSessionLieTruths: async (socialSessionId: string) => {
      const m = lieTruthsStore.get(socialSessionId);
      if (!m) return new Map();
      return new Map(m.entries());
    },
    setMiniScriptSecrets: vi.fn(),
    getMiniScriptSecrets: vi.fn(),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/miniscriptAgent', () => ({
  generateMiniScriptFrameworkWithMeta: vi.fn(),
}));

vi.mock('../contentFilter', () => ({
  filterContent: vi.fn((text: string) => text),
}));

vi.mock('../rateLimiter', () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
}));

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
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn(),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
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
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
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

function seedBonusGateSession(
  socialSessionId: string,
  overrides?: {
    bonusGateOffered?: boolean;
    bonusGateAccepted?: boolean;
    bonusGateDeclined?: boolean;
    bonusGatePlayerSentiment?: Record<string, 'want' | 'pass'>;
    currentPhase?: SocialSessionState['currentPhase'];
    hostUserId?: string;
  },
): void {
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: 'bonus-gate-test',
    currentPhase: overrides?.currentPhase ?? 'personality_dice',
    hostUserId: overrides?.hostUserId ?? 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'glow',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: {
      version: 2,
      segments: [
        { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2 },
        { phase: 'lie_detective', allocatedMinutes: 12, energyWeight: 3 },
        { phase: 'personality_dice', allocatedMinutes: 12, energyWeight: 3 },
        { phase: 'mini_script', allocatedMinutes: 25, energyWeight: 3 },
        { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
      ],
      totalMinutes: 70,
      compilerId: 'test',
      compiledAt: new Date().toISOString(),
    },
    bonusGateOffered: overrides?.bonusGateOffered ?? true,
    bonusGateAccepted: overrides?.bonusGateAccepted ?? false,
    bonusGateDeclined: overrides?.bonusGateDeclined ?? false,
    bonusGatePlayerSentiment: overrides?.bonusGatePlayerSentiment,
  };
  storeCtx.sessions.set(socialSessionId, state);

  const pmap = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  pmap.set('host-user', {
    userId: 'host-user',
    displayName: 'Host',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  pmap.set('guest-1', {
    userId: 'guest-1',
    displayName: 'Guest 1',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  pmap.set('guest-2', {
    userId: 'guest-2',
    displayName: 'Guest 2',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  pmap.set('guest-3', {
    userId: 'guest-3',
    displayName: 'Guest 3',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  storeCtx.participants.set(socialSessionId, pmap);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /bonus/respond
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/miniscript/bonus/respond', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_bonus_respond_401';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for invalid body (missing socialSessionId)', async () => {
    const id = 'social_bonus_respond_invalid';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ accept: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('INVALID_BODY');
    });
  });

  it('returns 400 for invalid body (missing accept field)', async () => {
    const id = 'social_bonus_respond_noaccept';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('returns 403 for non-host when bonus gate is offered', async () => {
    const id = 'social_bonus_respond_403';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.error).toBe('HOST_ONLY');
    });
  });

  it('returns 404 when social session does not exist', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: 'social_nonexistent', accept: true }),
      });
      expect(res.status).toBe(404);
    });
  });

  it('returns 400 when bonus gate has not been offered', async () => {
    const id = 'social_bonus_respond_notoffered';
    seedBonusGateSession(id, { bonusGateOffered: false });

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('BONUS_GATE_NOT_OFFERED');
    });
  });

  it('returns 409 when bonus gate has already been accepted', async () => {
    const id = 'social_bonus_respond_dupe';
    seedBonusGateSession(id, { bonusGateAccepted: true });

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });
      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error).toBe('BONUS_GATE_ALREADY_RESPONDED');
    });
  });

  it('returns 409 when bonus gate has already been declined', async () => {
    const id = 'social_bonus_respond_declined';
    seedBonusGateSession(id, { bonusGateDeclined: true });

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: false }),
      });
      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error).toBe('BONUS_GATE_ALREADY_RESPONDED');
    });
  });

  it('accepts the bonus gate and transitions to mini_script phase', async () => {
    const id = 'social_bonus_accept';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });

      expect(res.status).toBe(200);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGateAccepted).toBe(true);
      expect(stored?.currentPhase).toBe('mini_script');
      expect(stored?.phaseStartedAt).toBeGreaterThan(0);
    });
  });

  it('declines the bonus gate and skips to recap phase', async () => {
    const id = 'social_bonus_decline';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: false }),
      });

      expect(res.status).toBe(200);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGateDeclined).toBe(true);
      expect(stored?.currentPhase).toBe('recap');
      expect(stored?.phaseStartedAt).toBeGreaterThan(0);
    });
  });

  it('clears pulseChecks on respond', async () => {
    const id = 'social_bonus_pulse_clear';
    seedBonusGateSession(id);
    const s = storeCtx.sessions.get(id)!;
    s.pulseChecks = [{ userId: 'u1', vibe: 2 as const }];

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ socialSessionId: id, accept: true }),
      });
      expect(res.status).toBe(200);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.pulseChecks).toEqual([]);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /bonus/sentiment
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/miniscript/bonus/sentiment', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_bonus_sent_401';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for invalid body (missing sentiment)', async () => {
    const id = 'social_bonus_sent_invalid';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('INVALID_BODY');
    });
  });

  it('returns 400 for invalid sentiment value', async () => {
    const id = 'social_bonus_sent_badval';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'maybe' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('INVALID_BODY');
    });
  });

  it('returns 400 when bonus gate is not active', async () => {
    const id = 'social_bonus_sent_notactive';
    seedBonusGateSession(id, { bonusGateOffered: false });

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('BONUS_GATE_NOT_ACTIVE');
    });
  });

  it('returns 400 when bonus gate has already been accepted', async () => {
    const id = 'social_bonus_sent_accepted';
    seedBonusGateSession(id, { bonusGateAccepted: true });

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('BONUS_GATE_NOT_ACTIVE');
    });
  });

  it('player can submit "want" sentiment', async () => {
    const id = 'social_bonus_sent_want';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.sentimentMap['guest-1']).toBe('want');

      const stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGatePlayerSentiment?.['guest-1']).toBe('want');
    });
  });

  it('player can submit "pass" sentiment', async () => {
    const id = 'social_bonus_sent_pass';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-2');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'pass' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.sentimentMap['guest-2']).toBe('pass');

      const stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGatePlayerSentiment?.['guest-2']).toBe('pass');
    });
  });

  it('multiple players can submit sentiments and they accumulate', async () => {
    const id = 'social_bonus_sent_multi';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const cookie1 = await login(baseUrl, 'guest-1');
      const cookie2 = await login(baseUrl, 'guest-2');
      const cookie3 = await login(baseUrl, 'guest-3');

      const res1 = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookie1 },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res1.status).toBe(200);

      const res2 = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookie2 },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res2.status).toBe(200);

      const res3 = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookie3 },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'pass' }),
      });
      expect(res3.status).toBe(200);
      const body3 = await res3.json() as any;
      expect(body3.sentimentMap['guest-1']).toBe('want');
      expect(body3.sentimentMap['guest-2']).toBe('want');
      expect(body3.sentimentMap['guest-3']).toBe('pass');

      const stored = storeCtx.sessions.get(id);
      expect(Object.keys(stored?.bonusGatePlayerSentiment ?? {}).length).toBe(3);
    });
  });

  it('player can change their sentiment (idempotency — last write wins)', async () => {
    const id = 'social_bonus_sent_change';
    seedBonusGateSession(id);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');

      // First submit 'want'
      const res1 = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'want' }),
      });
      expect(res1.status).toBe(200);
      let stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGatePlayerSentiment?.['guest-1']).toBe('want');

      // Then change to 'pass'
      const res2 = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: id, sentiment: 'pass' }),
      });
      expect(res2.status).toBe(200);
      stored = storeCtx.sessions.get(id);
      expect(stored?.bonusGatePlayerSentiment?.['guest-1']).toBe('pass');
    });
  });

  it('returns 404 when social session does not exist', async () => {
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/miniscript/bonus/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ socialSessionId: 'social_nonexistent', sentiment: 'want' }),
      });
      expect(res.status).toBe(404);
    });
  });
});
