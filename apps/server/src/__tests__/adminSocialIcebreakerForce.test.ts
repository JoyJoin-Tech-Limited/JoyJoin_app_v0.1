/**
 * Sprint Contract gm-debrief-w1 — Admin host recovery controls + host-delete.
 *
 * AC-W1.3: admin force-end / transfer-host ignore hostUserId, require
 *          operator/super_admin RBAC, and emit an audit row.
 * AC-W1.4: deleting/banning a host no longer hard-deletes live sessions —
 *          the store-assisted reassign/tombstone path is exercised here.
 */
import express from 'express';
import { withServerForApp as withServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const h = vi.hoisted(() => ({
  getSessionWithExpiry: null as any,
  getParticipant: null as any,
  listParticipants: null as any,
  transferHost: null as any,
  audit: null as any,
  transitionPhase: null as any,
}));

vi.mock('../db', () => ({
  db: { transaction: vi.fn() },
}));

// Mounting adminUsers for the ban fail-closed test pulls these modules; stub
// them so the test does not open real DB/network dependencies.
vi.mock('../storage', () => ({
  storage: { getUser: vi.fn(), updateUser: vi.fn() },
}));
vi.mock('../matchingMetrics', () => ({ getMatchingMetricsSnapshot: vi.fn(() => ({})) }));
vi.mock('../lib/wecomNotifications', () => ({ notifyAdminAction: vi.fn() }));
vi.mock('../lib/fkCascadeDelete', () => ({ cascadeDeleteByIds: vi.fn() }));


vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('../lib/adminAuditLogger', () => ({
  logAdminAudit: (...args: unknown[]) => h.audit(...args),
}));

vi.mock('../adminAuth', () => ({
  requireAdmin: (req: any, _res: any, next: () => void) => {
    req.adminAccount = { id: 'admin-1' };
    next();
  },
  // Viewer role is rejected at the operator boundary (fail-closed).
  requireOperatorOrAbove: (req: any, res: any, next: () => void) => {
    if (req.headers?.['x-test-role'] === 'viewer') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.adminRole = 'operator';
    next();
  },
}));

vi.mock('../routes/socialIcebreakerHelpers', () => ({
  transitionPhase: (...args: unknown[]) => h.transitionPhase(...args),
}));

vi.mock('../lib/socialIcebreakerStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/socialIcebreakerStore')>();
  return {
    ...actual,
    getSessionWithExpiry: (...args: unknown[]) => h.getSessionWithExpiry(...args),
    getParticipant: (...args: unknown[]) => h.getParticipant(...args),
    listParticipants: (...args: unknown[]) => h.listParticipants(...args),
    transferHost: (...args: unknown[]) => h.transferHost(...args),
  };
});

const { registerAdminSocialIcebreakerRoutes } = await import('../routes/domains/adminSocialIcebreaker');
const { reassignOrTombstoneHostedSessions } = await import('../lib/socialIcebreakerStore');
const { registerAdminUserRoutes } = await import('../routes/domains/adminUsers');
const { db: mockedDb } = await import('../db');
const { storage: mockedStorage } = await import('../storage');

function baseSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_w1-admin',
    icebreakerSessionId: 'host-resilience-admin',
    currentPhase: 'auction',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 2,
    phaseStartedAt: Date.now() - 120_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: ['warmup'],
    eventTier: 'glow',
    autoAdvanceEnabled: false,
    ...overrides,
  } as SocialSessionState;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerAdminSocialIcebreakerRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.audit = vi.fn();
  h.getParticipant = vi.fn(async () => ({ displayName: 'P2' }));
  h.listParticipants = vi.fn(async () => [
    { userId: 'host-user', displayName: 'Host', joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), isActive: true },
    { userId: 'p2', displayName: 'P2', joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), isActive: true },
  ]);
  h.transferHost = vi.fn(async (socialSessionId: string, newHostUserId: string) => ({
    outcome: 'transferred',
    state: baseSession({ socialSessionId, hostUserId: newHostUserId, hostDisplayName: 'P2' }),
  }));
  h.transitionPhase = vi.fn(async ({ state }: { state: SocialSessionState }) => {
    state.currentPhase = 'recap';
    return { transitioned: true, nextPhase: 'recap', pausedAtBonusGate: false };
  });
});

describe('AC-W1.3 admin force-end', () => {
  it('operator force-ends a session and writes an audit row', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({ state: baseSession(), expired: false }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/force-end`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect(h.transitionPhase).toHaveBeenCalledTimes(1);
      expect(h.audit).toHaveBeenCalledTimes(1);
      const record = h.audit.mock.calls[0][0];
      expect(record.targetEntityId).toBe('social_w1-admin');
      expect(record.action).toBe('SOCIAL_ICEBREAKER_FORCE_END');
      expect(record.context.originalAction).toBeUndefined();
    });
  });

  it('viewer is rejected with 403 and no audit row', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({ state: baseSession(), expired: false }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/force-end`, {
        method: 'POST',
        headers: { 'x-test-role': 'viewer' },
      });
      expect(res.status).toBe(403);
      expect(h.transitionPhase).not.toHaveBeenCalled();
      expect(h.audit).not.toHaveBeenCalled();
    });
  });

  it('is idempotent when already in recap', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({
      state: baseSession({ currentPhase: 'recap' }),
      expired: false,
    }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/force-end`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { alreadyEnded: boolean };
      expect(body.alreadyEnded).toBe(true);
      expect(h.transitionPhase).not.toHaveBeenCalled();
      expect(h.audit).toHaveBeenCalledTimes(1);
    });
  });

  it('clears a pending bonus gate before jumping to recap', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({
      state: baseSession({
        bonusGateOffered: true,
        bonusGateAccepted: false,
        bonusGateDeclined: false,
        bonusGatePlayerSentiment: { p2: 'want' },
      }),
      expired: false,
    }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/force-end`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect(h.transitionPhase).toHaveBeenCalledTimes(1);
      const passedState = h.transitionPhase.mock.calls[0][0].state;
      expect(passedState.bonusGateDeclined).toBe(true);
      expect(passedState.bonusGatePlayerSentiment).toBeUndefined();
    });
  });
});

describe('AC-W1.3 admin transfer-host', () => {
  it('transfers to an explicit participant, ignoring the current host', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({ state: baseSession(), expired: false }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/transfer-host`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newHostUserId: 'p2' }),
      });
      expect(res.status).toBe(200);
      // No expected-host CAS arg: admin override ignores the current host.
      expect(h.transferHost).toHaveBeenCalledWith('social_w1-admin', 'p2', 'P2');
      expect(h.audit).toHaveBeenCalledTimes(1);
      const record = h.audit.mock.calls[0][0];
      expect(record.action).toBe('SOCIAL_ICEBREAKER_HOST_TRANSFERRED');
      expect(record.context.newHostUserId).toBe('p2');
      expect(record.context.originalAction).toBeUndefined();
    });
  });

  it('auto-selects the most recent non-host participant', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({ state: baseSession(), expired: false }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/transfer-host`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect(h.transferHost).toHaveBeenCalledWith('social_w1-admin', 'p2', 'P2');
    });
  });

  it('viewer is rejected with 403', async () => {
    h.getSessionWithExpiry = vi.fn(async () => ({ state: baseSession(), expired: false }));
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/social-icebreaker/social_w1-admin/transfer-host`, {
        method: 'POST',
        headers: { 'x-test-role': 'viewer', 'content-type': 'application/json' },
        body: JSON.stringify({ newHostUserId: 'p2' }),
      });
      expect(res.status).toBe(403);
      expect(h.transferHost).not.toHaveBeenCalled();
    });
  });
});

/**
 * Minimal fake Drizzle transaction supporting the exact builder chain used by
 * reassignOrTombstoneHostedSessions. `from()` call #1 is the hosted-sessions
 * select; subsequent calls are the per-session participant select.
 */
function makeFakeTx(sessionRows: any[], participantRows: any[]) {
  let fromCalls = 0;
  const updates: any[] = [];
  const tx = {
    select: () => ({
      from: () => {
        const rows = fromCalls === 0 ? sessionRows : participantRows;
        fromCalls += 1;
        const chain: any = {
          where: () => chain,
          for: () => chain,
          then: (resolve: (value: unknown) => void) => resolve(rows),
        };
        return chain;
      },
    }),
    update: () => ({
      set: (values: any) => ({
        where: () => {
          updates.push(values);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { tx, updates };
}

describe('AC-W1.4 host removal recovery', () => {
  it('reassigns the host to the most recently seen remaining participant', async () => {
    const sessionRows = [
      {
        id: 'social_s1',
        stateJson: { socialSessionId: 'social_s1', hostUserId: 'host-del', currentPhase: 'auction' },
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    const participantRows = [
      { userId: 'p-old', displayName: 'Old', lastSeenAt: new Date(Date.now() - 60_000) },
      { userId: 'p-new', displayName: 'New', lastSeenAt: new Date(Date.now() - 5_000) },
    ];
    const { tx, updates } = makeFakeTx(sessionRows, participantRows);
    const result = await reassignOrTombstoneHostedSessions(tx as any, 'host-del');

    expect(result.reassigned).toEqual([{ sessionId: 'social_s1', newHostUserId: 'p-new' }]);
    expect(result.tombstoned).toEqual([]);
    expect(updates[0].hostUserId).toBe('p-new');
    expect((updates[0].stateJson as any).hostUserId).toBe('p-new');
  });

  it('tombstones (never deletes) a session when the host was alone', async () => {
    const sessionRows = [
      {
        id: 'social_s2',
        stateJson: { socialSessionId: 'social_s2', hostUserId: 'host-del', currentPhase: 'micro_challenge' },
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    const { tx, updates } = makeFakeTx(sessionRows, []);
    const result = await reassignOrTombstoneHostedSessions(tx as any, 'host-del');

    expect(result.reassigned).toEqual([]);
    expect(result.tombstoned).toEqual(['social_s2']);
    expect(updates[0].currentPhase).toBe('recap');
    expect((updates[0].stateJson as any).interruptedAtPhase).toBe('micro_challenge');
  });

  it('never reassigns the host to a test bot', async () => {
    const sessionRows = [
      {
        id: 'social_s3',
        stateJson: {
          socialSessionId: 'social_s3',
          hostUserId: 'host-del',
          currentPhase: 'auction',
          singleTest: { isTestModeSkip: false },
        },
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    // The bot is the most recently seen, but must never be chosen.
    const participantRows = [
      { userId: 'bot-1', displayName: 'Bot', lastSeenAt: new Date(Date.now() - 1_000), isTestBot: true },
      { userId: 'tester', displayName: 'Tester', lastSeenAt: new Date(Date.now() - 30_000), isTestBot: false },
    ];
    const { tx, updates } = makeFakeTx(sessionRows, participantRows);
    const result = await reassignOrTombstoneHostedSessions(tx as any, 'host-del');

    expect(result.reassigned).toEqual([{ sessionId: 'social_s3', newHostUserId: 'tester' }]);
    expect(updates[0].hostUserId).toBe('tester');
  });

  it('tombstones a tester+bots session when only bots remain', async () => {
    const sessionRows = [
      {
        id: 'social_s4',
        stateJson: {
          socialSessionId: 'social_s4',
          hostUserId: 'host-del',
          currentPhase: 'micro_challenge',
          singleTest: { isTestModeSkip: true },
        },
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    const participantRows = [
      { userId: 'bot-1', displayName: 'Bot 1', lastSeenAt: new Date(), isTestBot: true },
      { userId: 'bot-2', displayName: 'Bot 2', lastSeenAt: new Date(), isTestBot: true },
    ];
    const { tx, updates } = makeFakeTx(sessionRows, participantRows);
    const result = await reassignOrTombstoneHostedSessions(tx as any, 'host-del');

    expect(result.reassigned).toEqual([]);
    expect(result.tombstoned).toEqual(['social_s4']);
    expect(updates[0].currentPhase).toBe('recap');
  });

  it('adminUsers delete route no longer hard-deletes hosted sessions', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.join(here, '../routes/domains/adminUsers.ts'), 'utf8');
    expect(source).not.toContain('DELETE FROM social_icebreaker_sessions');
    expect(source).toContain('reassignOrTombstoneHostedSessions');
  });
});

describe('AC-W1.4b ban host-recovery fails closed', () => {
  function buildAdminUsersApp() {
    const app = express();
    app.use(express.json());
    registerAdminUserRoutes(app);
    return app;
  }

  it('aborts the ban (500, no isBanned write) when host recovery throws', async () => {
    (mockedStorage.getUser as any).mockResolvedValue({
      id: 'host-del',
      displayName: 'Del',
      isBanned: false,
    });
    (mockedStorage.updateUser as any).mockResolvedValue({ id: 'host-del', isBanned: true });
    (mockedDb.transaction as any).mockImplementation(async () => {
      throw new Error('recovery boom');
    });

    await withServer(buildAdminUsersApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/users/host-del/ban`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'repeated violations' }),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('HOST_RECOVERY_FAILED');
      // Fail closed: the user must NOT be banned when their hosted rooms could
      // not be recovered.
      expect(mockedStorage.updateUser).not.toHaveBeenCalled();
    });
  });

  it('applies the ban only after host recovery succeeds', async () => {
    (mockedStorage.getUser as any).mockResolvedValue({
      id: 'host-del',
      displayName: 'Del',
      isBanned: false,
    });
    (mockedStorage.updateUser as any).mockResolvedValue({ id: 'host-del', isBanned: true });
    const { tx } = makeFakeTx([], []);
    (mockedDb.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    await withServer(buildAdminUsersApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/users/host-del/ban`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'repeated violations' }),
      });
      expect(res.status).toBe(200);
      expect(mockedStorage.updateUser).toHaveBeenCalledWith('host-del', { isBanned: true });
    });
  });
});
