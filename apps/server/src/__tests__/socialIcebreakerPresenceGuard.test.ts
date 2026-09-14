/**
 * W3 — Active-presence phase guards + honest opt-out.
 *
 * Covers:
 *   AC-W3.1  red repro: a silent roster member blocks micro_challenge /
 *            lie_detective (fails against the pre-W3 playerCount guards).
 *   AC-W3.2  guard is snapshot-scoped; silent member auto-completed only after
 *            SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS (default 180000).
 *   AC-W3.3  honest opt-out marks the caller complete server-side (self-scoped)
 *            so the guard passes with no host force.
 *   AC-W3.4  a late join mid-phase is excluded from the entry snapshot and can
 *            never deadlock the phase.
 *   AC-W3.5  host never needs `force` when a member is silent.
 */
import express from 'express';
import session from 'express-session';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ── In-memory store mock (keeps the HTTP layer testable without Postgres) ──
const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  // Per-session mutex that models `SELECT … FOR UPDATE` row locking, so the
  // atomic opt-out test can prove two simultaneous taps serialize.
  const locks = new Map<string, Promise<void>>();
  return { sessions, participants, locks };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants, locks } = storeCtx;

  const withSessionLock = <T>(socialSessionId: string, fn: () => Promise<T>): Promise<T> => {
    const previous = locks.get(socialSessionId) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    locks.set(socialSessionId, result.then(() => undefined, () => undefined));
    return result;
  };

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
    // Mirrors the real row-locked read-modify-write in socialIcebreakerStore.
    updateSessionAtomic: async (
      socialSessionId: string,
      mutator: (state: SocialSessionState) => boolean | void,
    ) =>
      withSessionLock(socialSessionId, async () => {
        const fresh = sessions.get(socialSessionId);
        if (!fresh) return { outcome: 'not_found' as const };
        if (mutator(fresh) === false) return { outcome: 'aborted' as const, state: fresh };
        sessions.set(socialSessionId, fresh);
        return { outcome: 'updated' as const, state: fresh };
      }),
    upsertParticipant: async () => {},
    heartbeat: async () => {},
    getRosterCount: async (socialSessionId: string) => participants.get(socialSessionId)?.size ?? 0,
    getActiveParticipantCount: async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return 0;
      const cutoff = Date.now() - 30_000;
      return [...ps.values()].filter((p) => p.lastSeenAt > cutoff).length;
    },
    getParticipant: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? { displayName: p.displayName } : null;
    },
    getParticipantLastSeenAt: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? new Date(p.lastSeenAt) : null;
    },
    listParticipants: vi.fn(async (socialSessionId: string) => {
      const ps = participants.get(socialSessionId);
      if (!ps) return [];
      const cutoff = Date.now() - 30_000;
      return [...ps.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          joinedAt: new Date(p.joinedAt).toISOString(),
          lastSeenAt: new Date(p.lastSeenAt).toISOString(),
          isActive: p.lastSeenAt > cutoff,
        }));
    }),
    transferHost: vi.fn(),
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    setMiniScriptSecrets: vi.fn(),
    getMiniScriptSecrets: vi.fn(),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    getPhaseMetrics: vi.fn().mockResolvedValue([]),
    getPreGenerationResult: vi.fn(async () => null),
    getPreGenerationJobStatus: vi.fn(async () => null),
    enqueuePreGenerationJob: vi.fn(),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [
      { id: 'mc-1', title: '互相问3个问题', description: '轮流问', durationSeconds: 180, completionCTA: '完成' },
    ],
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  }),
  generateLieDetectiveStatements: vi.fn(),
  generateLieDetectiveStatementFromTag: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: '今晚到这儿，刚刚好', closingLine: '', moments: [] },
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  }),
  generatePersonalityDiceChallenges: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
  getCuratedWarmupTopics: vi.fn(() => []),
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn(() => ({ valid: true, tags: [] })),
  validateLieDetectiveTag: vi.fn(() => ({ valid: true, tag: 'x' })),
  buildLieDetectiveV2RecapData: vi.fn(() => ({ aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 })),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async (_key: string, fallback = false) => fallback),
  getFeatureFlagSync: vi.fn((_key: string, fallback = false) => fallback),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  getBots: vi.fn(() => []),
  simulateBotsForSession: vi.fn().mockResolvedValue(undefined),
  runBotSimulationSafely: vi.fn().mockResolvedValue(undefined),
  seedSingleTestBotsWarmupReady: vi.fn(),
}));

import {
  evaluatePhasePresenceGuard,
  getPhaseRequiredRosterIds,
  getSilentPlayerTimeoutMs,
  reconcilePhasePresence,
  buildPhaseRosterSnapshot,
  SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS_DEFAULT,
} from '../routes/socialIcebreakerHelpers';

const { registerExtendedRoutes } = await import('../routes/socialIcebreakerExtended');

// ---------------------------------------------------------------------------
// Pure guard unit tests (AC-W3.1 / AC-W3.2)
// ---------------------------------------------------------------------------

const SNAPSHOT = ['u1', 'u2', 'u3', 'u4'];

describe('getSilentPlayerTimeoutMs', () => {
  it('defaults to 180000 when unset or invalid', () => {
    expect(getSilentPlayerTimeoutMs({} as NodeJS.ProcessEnv)).toBe(
      SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS_DEFAULT,
    );
    expect(
      getSilentPlayerTimeoutMs({ SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS: 'nope' } as NodeJS.ProcessEnv),
    ).toBe(180_000);
    expect(
      getSilentPlayerTimeoutMs({ SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS: '-5' } as NodeJS.ProcessEnv),
    ).toBe(180_000);
  });

  it('honours a positive integer override', () => {
    expect(
      getSilentPlayerTimeoutMs({ SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS: '5000' } as NodeJS.ProcessEnv),
    ).toBe(5_000);
  });
});

describe('evaluatePhasePresenceGuard (AC-W3.1 / AC-W3.2)', () => {
  const phaseStartedAt = 1_000_000;
  const timeoutMs = 180_000;
  const base = { rosterSnapshot: SNAPSHOT, phaseStartedAt, timeoutMs, fallbackPlayerCount: 4 };

  it('red repro: 4-person snapshot with 1 silent member is blocked at 179s', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      completedUserIds: ['u1', 'u2', 'u3'],
      activeUserIds: new Set(['u1', 'u2', 'u3']),
      now: phaseStartedAt + 179_000,
    });
    expect(result.complete).toBe(false);
    expect(result.silentUserIds).toEqual([]);
    expect(result.requiredUserIds).toEqual(SNAPSHOT);
  });

  it('auto-completes the silent member at 181s and passes', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      completedUserIds: ['u1', 'u2', 'u3'],
      activeUserIds: new Set(['u1', 'u2', 'u3']),
      now: phaseStartedAt + 181_000,
    });
    expect(result.complete).toBe(true);
    expect(result.silentUserIds).toEqual(['u4']);
  });

  it('never auto-completes a member who is still active', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      completedUserIds: ['u1', 'u2', 'u3'],
      activeUserIds: new Set(['u1', 'u2', 'u3', 'u4']),
      now: phaseStartedAt + 300_000,
    });
    expect(result.complete).toBe(false);
    expect(result.silentUserIds).toEqual([]);
  });

  it('excludes departed (opted-out) members from the required set', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      departedUserIds: ['u4'],
      completedUserIds: ['u1', 'u2', 'u3'],
      now: phaseStartedAt + 1_000,
    });
    expect(result.complete).toBe(true);
    expect(result.requiredUserIds).toEqual(['u1', 'u2', 'u3']);
  });

  it('keeps the legacy playerCount semantics when no snapshot exists', () => {
    expect(
      evaluatePhasePresenceGuard({
        completedUserIds: ['u1', 'u2', 'u3'],
        phaseStartedAt,
        now: phaseStartedAt,
        timeoutMs,
        fallbackPlayerCount: 4,
      }).complete,
    ).toBe(false);
    expect(
      evaluatePhasePresenceGuard({
        completedUserIds: ['u1', 'u2', 'u3', 'u4'],
        phaseStartedAt,
        now: phaseStartedAt,
        timeoutMs,
        fallbackPlayerCount: 4,
      }).complete,
    ).toBe(true);
  });

  it('getPhaseRequiredRosterIds removes opted-out and silent members', () => {
    const state = {
      phaseRosterSnapshot: SNAPSHOT,
      phaseOptOutUserIds: ['u4'],
      phaseSilentCompletedUserIds: ['u3'],
    } as SocialSessionState;
    expect(getPhaseRequiredRosterIds(state)).toEqual(['u1', 'u2']);
  });

  it('quorum floor: below 2 required members the phase is complete (documented end condition)', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      departedUserIds: ['u2', 'u3', 'u4'],
      completedUserIds: [],
      now: phaseStartedAt + 1_000,
    });
    expect(result.complete).toBe(true);
    expect(result.requiredUserIds).toEqual(['u1']);
  });

  it('quorum floor: an emptied roster (all departed) is complete, not blocked', () => {
    const result = evaluatePhasePresenceGuard({
      ...base,
      departedUserIds: SNAPSHOT,
      completedUserIds: [],
      now: phaseStartedAt + 1_000,
    });
    expect(result.complete).toBe(true);
    expect(result.requiredUserIds).toEqual([]);
  });
});

describe('buildPhaseRosterSnapshot (W3 finding 3)', () => {
  const participant = (userId: string, isActive: boolean) => ({
    userId,
    displayName: userId,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    isActive,
  });

  it('keeps recently-active members and drops long-departed ones', () => {
    expect(
      buildPhaseRosterSnapshot([
        participant('u1', true),
        participant('u2', false),
        participant('u3', true),
      ]),
    ).toEqual(['u1', 'u3']);
  });

  it('falls back to the full roster when nobody is currently active', () => {
    expect(
      buildPhaseRosterSnapshot([participant('u1', false), participant('u2', false)]),
    ).toEqual(['u1', 'u2']);
  });
});

// ---------------------------------------------------------------------------
// Route integration (opt-out + silent auto-complete + late join)
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'presence-guard-test',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.post('/__test__/login/:userId', (req, res) => {
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  const router = express.Router();
  registerExtendedRoutes(router);
  app.use('/api/social-icebreaker', router);
  return app;
}

/**
 * Boot with a local helper that mirrors test-utils/withServer but is bound to
 * `createApp`. Imported dynamically in each test below.
 */
import { createWithServer } from '../test-utils/withServer';

const withServer = createWithServer(createApp);

function cookieHeader(response: Response): string {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

interface SeedParticipant {
  userId: string;
  /** Milliseconds relative to now; negative = stale heartbeat. */
  lastSeenOffsetMs?: number;
}

function seedSession(
  socialSessionId: string,
  overrides: Partial<SocialSessionState> = {},
  participants: SeedParticipant[] = [],
): void {
  const now = Date.now();
  const state = {
    socialSessionId,
    icebreakerSessionId: 'presence-guard-test',
    currentPhase: 'micro_challenge',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: participants.length || 4,
    phaseStartedAt: now - 60_000,
    sessionStartedAt: now - 600_000,
    completedPhases: ['warmup'],
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'recap'],
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
  storeCtx.sessions.set(socialSessionId, state);

  const roster = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  for (const p of participants) {
    roster.set(p.userId, {
      userId: p.userId,
      displayName: p.userId,
      joinedAt: now - 300_000,
      lastSeenAt: now + (p.lastSeenOffsetMs ?? 0),
    });
  }
  storeCtx.participants.set(socialSessionId, roster);
}

async function advance(
  baseUrl: string,
  cookie: string,
  socialSessionId: string,
  currentPhase: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ currentPhase }),
  });
}

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
  storeCtx.locks.clear();
});

describe('POST /api/social-icebreaker/:id/opt-out (AC-W3.3)', () => {
  it('marks the caller complete server-side so the guard passes without force', async () => {
    await withServer(async (baseUrl) => {
      const active = [
        { userId: 'host-user' },
        { userId: 'p2' },
        { userId: 'p3' },
        { userId: 'p4' },
      ];
      seedSession(
        'opt-out-1',
        {
          phaseRosterSnapshot: ['host-user', 'p2', 'p3', 'p4'],
          challengeCompletedBy: ['host-user', 'p2', 'p3'],
        },
        active,
      );

      const p4Cookie = await login(baseUrl, 'p4');
      const optOut = await fetch(`${baseUrl}/api/social-icebreaker/opt-out-1/opt-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: p4Cookie },
        body: JSON.stringify({ phase: 'micro_challenge', userId: 'p2' }),
      });
      const optOutBody = (await optOut.json()) as any;

      expect(optOut.status).toBe(200);
      expect(optOutBody.ok).toBe(true);
      expect(optOutBody.optedOutUserId).toBe('p4');
      expect(optOutBody.state.phaseOptOutUserIds).toEqual(['p4']);
      // Self-scoped: the spoofed body userId was ignored.
      expect(optOutBody.state.phaseOptOutUserIds).not.toContain('p2');
      expect(optOutBody.state.challengeCompletedBy).toContain('p4');

      const hostCookie = await login(baseUrl, 'host-user');
      const advanceResponse = await advance(baseUrl, hostCookie, 'opt-out-1', 'micro_challenge');
      expect(advanceResponse.status).toBe(200);
    });
  });

  it('rejects opt-out in pass_ok phases', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'opt-out-2',
        { currentPhase: 'personality_dice', phaseRosterSnapshot: ['host-user', 'p2'] },
        [{ userId: 'host-user' }, { userId: 'p2' }],
      );
      const cookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/opt-out-2/opt-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as any;
      expect(body.code).toBe('OPT_OUT_NOT_APPLICABLE');
    });
  });

  it('is idempotent on repeat opt-out', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'opt-out-3',
        {
          phaseRosterSnapshot: ['host-user', 'p2'],
          challengeCompletedBy: ['host-user'],
        },
        [{ userId: 'host-user' }, { userId: 'p2' }],
      );
      const cookie = await login(baseUrl, 'p2');
      for (let i = 0; i < 2; i += 1) {
        const response = await fetch(`${baseUrl}/api/social-icebreaker/opt-out-3/opt-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({}),
        });
        expect(response.status).toBe(200);
      }
      const state = storeCtx.sessions.get('opt-out-3')!;
      expect(state.phaseOptOutUserIds).toEqual(['p2']);
      expect(state.challengeCompletedBy!.filter((id) => id === 'p2')).toHaveLength(1);
    });
  });
});

describe('advance guards use the phase-entry roster snapshot (AC-W3.2 / AC-W3.5)', () => {
  it('micro_challenge is blocked at 179s of silence and auto-completes at 181s', async () => {
    await withServer(async (baseUrl) => {
      const active: SeedParticipant[] = [
        { userId: 'host-user' },
        { userId: 'p2' },
        { userId: 'p3' },
        { userId: 'p4', lastSeenOffsetMs: -200_000 },
      ];
      const baseOverrides: Partial<SocialSessionState> = {
        phaseRosterSnapshot: ['host-user', 'p2', 'p3', 'p4'],
        challengeCompletedBy: ['host-user', 'p2', 'p3'],
      };
      seedSession('presence-1', { ...baseOverrides, phaseStartedAt: Date.now() - 179_000 }, active);

      const hostCookie = await login(baseUrl, 'host-user');
      const blocked = await advance(baseUrl, hostCookie, 'presence-1', 'micro_challenge');
      expect(blocked.status).toBe(400);

      // No host `force`: 181s later the server auto-completes the silent member.
      storeCtx.sessions.get('presence-1')!.phaseStartedAt = Date.now() - 181_000;
      const advanced = await advance(baseUrl, hostCookie, 'presence-1', 'micro_challenge');
      expect(advanced.status).toBe(200);

      const state = storeCtx.sessions.get('presence-1')!;
      expect(state.currentPhase).not.toBe('micro_challenge');
    });
  });

  it('reconcilePhasePresence persists the silent member as complete (unit)', async () => {
    const state = {
      socialSessionId: 'reconcile-unit',
      currentPhase: 'micro_challenge',
      phaseRosterSnapshot: ['u1', 'u2', 'u3', 'u4'],
      challengeCompletedBy: ['u1', 'u2', 'u3'],
      phaseStartedAt: Date.now() - 181_000,
      playerCount: 4,
    } as SocialSessionState;

    const result = await reconcilePhasePresence(state, 'reconcile-unit', {
      activeUserIds: new Set(['u1', 'u2', 'u3']),
      persist: false,
    });

    expect(result.complete).toBe(true);
    expect(result.autoCompletedUserIds).toEqual(['u4']);
    expect(state.phaseSilentCompletedUserIds).toEqual(['u4']);
    expect(state.challengeCompletedBy).toContain('u4');

    // Idempotent: a second pass adds nothing new.
    const second = await reconcilePhasePresence(state, 'reconcile-unit', {
      activeUserIds: new Set(['u1', 'u2', 'u3']),
      persist: false,
    });
    expect(second.autoCompletedUserIds).toEqual([]);
    expect(state.phaseSilentCompletedUserIds).toEqual(['u4']);
  });

  it('lie_detective auto-completes a silent non-generator so the host can advance', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'presence-2',
        {
          currentPhase: 'lie_detective',
          completedPhases: ['warmup', 'micro_challenge'],
          phaseRosterSnapshot: ['host-user', 'p2', 'p3', 'p4'],
          lieDetectivePlayers: [
            { userId: 'host-user', displayName: 'Host', statements: [] },
            { userId: 'p2', displayName: 'p2', statements: [] },
            { userId: 'p3', displayName: 'p3', statements: [] },
          ],
          lieDetectiveCompletedUserIds: ['host-user', 'p2', 'p3'],
          currentLieDetectivePlayerIndex: 2,
          currentLieDetectiveReveal: {
            targetUserId: 'p3',
            lieIndex: 1,
            voteCount: 3,
            correctVoteCount: 1,
            revealedAt: Date.now(),
          },
          phaseStartedAt: Date.now() - 181_000,
        },
        [
          { userId: 'host-user' },
          { userId: 'p2' },
          { userId: 'p3' },
          { userId: 'p4', lastSeenOffsetMs: -200_000 },
        ],
      );

      const hostCookie = await login(baseUrl, 'host-user');
      const response = await advance(baseUrl, hostCookie, 'presence-2', 'lie_detective');
      expect(response.status).toBe(200);
    });
  });
});

describe('late join mid-phase is excluded from the entry snapshot (AC-W3.4)', () => {
  it('host can advance lie_detective while a late joiner is on the roster', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'late-join-1',
        {
          currentPhase: 'lie_detective',
          completedPhases: ['warmup', 'micro_challenge'],
          phaseRosterSnapshot: ['host-user', 'p2', 'p3'],
          lieDetectivePlayers: [
            { userId: 'host-user', displayName: 'Host', statements: [] },
            { userId: 'p2', displayName: 'p2', statements: [] },
            { userId: 'p3', displayName: 'p3', statements: [] },
          ],
          lieDetectiveCompletedUserIds: ['host-user', 'p2', 'p3'],
          currentLieDetectivePlayerIndex: 2,
          currentLieDetectiveReveal: {
            targetUserId: 'p3',
            lieIndex: 1,
            voteCount: 2,
            correctVoteCount: 1,
            revealedAt: Date.now(),
          },
        },
        [{ userId: 'host-user' }, { userId: 'p2' }, { userId: 'p3' }, { userId: 'p4' }],
      );

      // A late joiner cannot append a turn after the snapshot's last member.
      const p4Cookie = await login(baseUrl, 'p4');
      const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/late-join-1/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: p4Cookie },
        body: JSON.stringify({ displayName: 'p4' }),
      });
      expect(generateResponse.status).toBe(409);
      expect(((await generateResponse.json()) as any).code).toBe('PHASE_ROSTER_LOCKED');

      const hostCookie = await login(baseUrl, 'host-user');
      const response = await advance(baseUrl, hostCookie, 'late-join-1', 'lie_detective');
      expect(response.status).toBe(200);
    });
  });
});

describe('lie-detective vote gate is presence-aware (AC-W3.5)', () => {
  it('a silent non-generator does not deadlock voting', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'vote-gate-1',
        {
          currentPhase: 'lie_detective',
          completedPhases: ['warmup', 'micro_challenge'],
          phaseRosterSnapshot: ['host-user', 'p2', 'p3', 'p4'],
          lieDetectivePlayers: [
            { userId: 'host-user', displayName: 'Host', statements: [{ index: 0, text: 'a' }] },
            { userId: 'p2', displayName: 'p2', statements: [{ index: 0, text: 'b' }] },
            { userId: 'p3', displayName: 'p3', statements: [{ index: 0, text: 'c' }] },
          ],
          lieDetectiveCompletedUserIds: ['host-user', 'p2', 'p3'],
          currentLieDetectivePlayerIndex: 0,
          phaseStartedAt: Date.now() - 181_000,
        },
        [
          { userId: 'host-user' },
          { userId: 'p2' },
          { userId: 'p3' },
          { userId: 'p4', lastSeenOffsetMs: -200_000 },
        ],
      );

      const p2Cookie = await login(baseUrl, 'p2');
      const vote = await fetch(`${baseUrl}/api/social-icebreaker/vote-gate-1/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: p2Cookie },
        body: JSON.stringify({ targetUserId: 'host-user', guessedStatementIndex: 0 }),
      });

      // Pre-fix this returned 400: lieDetectivePlayers.length (3) < required (4).
      expect(vote.status).toBe(200);
      // The silent member is reconciled into the departed set, not left blocking.
      expect(storeCtx.sessions.get('vote-gate-1')!.phaseSilentCompletedUserIds).toContain('p4');
    });
  });
});

// ---------------------------------------------------------------------------
// W3 review BLOCKER: quip_battle opt-out during submit must unblock reveal
// ---------------------------------------------------------------------------

function seedQuipBattleSession(
  socialSessionId: string,
  overrides: Partial<SocialSessionState> = {},
): void {
  seedSession(
    socialSessionId,
    {
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      phaseRosterSnapshot: ['host-user', 'p2', 'p3', 'p4'],
      quipBattlePrompts: [{ id: 'p1', promptText: '填空：_____', category: 'fun' }],
      quipBattleAnswers: [
        { userId: 'host-user', displayName: 'Host', answerText: '火锅', promptId: 'p1' },
        { userId: 'p2', displayName: 'p2', answerText: '露营', promptId: 'p1' },
        { userId: 'p3', displayName: 'p3', answerText: '周杰伦', promptId: 'p1' },
      ],
      quipBattleSubmittedUserIds: ['host-user', 'p2', 'p3'],
      quipBattleVotes: [
        { voterId: 'host-user', answerId: 'p2::p1', promptId: 'p1' },
        { voterId: 'p2', answerId: 'host-user::p1', promptId: 'p1' },
        { voterId: 'p3', answerId: 'host-user::p1', promptId: 'p1' },
      ],
      quipBattleVotedUserIds: ['host-user', 'p2', 'p3'],
      quipBattleRevealed: false,
      ...overrides,
    },
    [
      { userId: 'host-user' },
      { userId: 'p2' },
      { userId: 'p3' },
      { userId: 'p4' },
    ],
  );
}

describe('quip_battle reveal is presence-aware (W3 BLOCKER)', () => {
  it('opt-out during submit unblocks the reveal (end-to-end through the route)', async () => {
    await withServer(async (baseUrl) => {
      seedQuipBattleSession('quip-optout-1');

      const p4Cookie = await login(baseUrl, 'p4');
      const optOut = await fetch(`${baseUrl}/api/social-icebreaker/quip-optout-1/opt-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: p4Cookie },
        body: JSON.stringify({ phase: 'quip_battle' }),
      });
      expect(optOut.status).toBe(200);
      const optedOutState = storeCtx.sessions.get('quip-optout-1')!;
      // The marker satisfies BOTH quip stages (centralized completion mapping).
      expect(optedOutState.phaseOptOutUserIds).toContain('p4');
      expect(optedOutState.quipBattleSubmittedUserIds).toContain('p4');
      expect(optedOutState.quipBattleVotedUserIds).toContain('p4');

      const hostCookie = await login(baseUrl, 'host-user');
      const reveal = await fetch(
        `${baseUrl}/api/social-icebreaker/quip-optout-1/quip-battle/results`,
        { headers: { cookie: hostCookie } },
      );
      expect(reveal.status).toBe(200);
      expect(storeCtx.sessions.get('quip-optout-1')!.quipBattleRevealed).toBe(true);
    });
  });

  it('reveal succeeds when an opted-out player is absent from the submit array (gate regression)', async () => {
    await withServer(async (baseUrl) => {
      // Reproduces the pre-fix drift exactly: the player is opted out but never
      // landed in `quipBattleSubmittedUserIds`. The old count-vs-playerCount
      // gate returned 400 forever.
      seedQuipBattleSession('quip-optout-2', {
        phaseOptOutUserIds: ['p4'],
      });

      const hostCookie = await login(baseUrl, 'host-user');
      const reveal = await fetch(
        `${baseUrl}/api/social-icebreaker/quip-optout-2/quip-battle/results`,
        { headers: { cookie: hostCookie } },
      );
      expect(reveal.status).toBe(200);
      expect((storeCtx.sessions.get('quip-optout-2') as any).quipBattleRevealed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// W3 review CONCERN: concurrent opt-out lost-update protection
// ---------------------------------------------------------------------------

describe('concurrent opt-out (W3 finding 2)', () => {
  it('two simultaneous opt-outs both persist', async () => {
    await withServer(async (baseUrl) => {
      seedSession(
        'opt-out-race',
        {
          currentPhase: 'micro_challenge',
          phaseRosterSnapshot: ['host-user', 'p2', 'p3'],
          challengeCompletedBy: ['host-user'],
        },
        [{ userId: 'host-user' }, { userId: 'p2' }, { userId: 'p3' }],
      );

      const p2Cookie = await login(baseUrl, 'p2');
      const p3Cookie = await login(baseUrl, 'p3');
      const [p2Response, p3Response] = await Promise.all([
        fetch(`${baseUrl}/api/social-icebreaker/opt-out-race/opt-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: p2Cookie },
          body: JSON.stringify({}),
        }),
        fetch(`${baseUrl}/api/social-icebreaker/opt-out-race/opt-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: p3Cookie },
          body: JSON.stringify({}),
        }),
      ]);

      expect(p2Response.status).toBe(200);
      expect(p3Response.status).toBe(200);

      const state = storeCtx.sessions.get('opt-out-race')!;
      expect(new Set(state.phaseOptOutUserIds)).toEqual(new Set(['p2', 'p3']));
      expect(new Set(state.challengeCompletedBy)).toEqual(
        new Set(['host-user', 'p2', 'p3']),
      );
    });
  });

  it('store updateSessionAtomic is row-locked (structural regression)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../lib/socialIcebreakerStore.ts', import.meta.url)),
      'utf8',
    );
    const start = source.indexOf('export async function updateSessionAtomic');
    const end = source.indexOf('export async function transferHost');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, end);
    expect(body).toContain('db.transaction');
    expect(body).toContain(".for('update')");
  });
});
