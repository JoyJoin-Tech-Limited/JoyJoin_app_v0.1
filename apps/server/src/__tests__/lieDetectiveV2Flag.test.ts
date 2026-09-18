/**
 * Lie Detective V2 DB-flag migration (sprint wave1-2-lieDetectiveV2Enabled):
 *  - AC-01: flag registration contract (FLAG_ENV_MAP + DEFAULT_FLAG_VALUES)
 *  - AC-02: resolveLieDetectiveModeSnapshot resolution order
 *           (session override > DB flag > legacy env LIE_DETECTIVE_MODE > 'v1')
 *  - AC-03/AC-07: transitionPhase snapshot at lie_detective phase entry,
 *    mid-session-flip immutability, and rollback-to-V1 semantics
 *  - AC-05: buildAuthUserResponse features.lieDetectiveV2Enabled exposure
 *  - AC-06 (verifier N1): admin PUT→GET round-trip + FEATURE_FLAG_UPDATED audit
 *
 * The featureFlags module is partially mocked: the real FLAG_ENV_MAP /
 * DEFAULT_FLAG_VALUES registries stay live (AC-01 asserts against them),
 * while the resolution functions are backed by a stateful in-memory "DB row"
 * map replicating the documented DB → env → default chain.
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const {
  flagDbRows,
  testSessions,
  mockAudit,
  mockGetUser,
  mockGetAssessmentSessionByUser,
  mockGetRoleResult,
} = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  testSessions: new Map<string, SocialSessionState>(),
  mockAudit: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetAssessmentSessionByUser: vi.fn(),
  mockGetRoleResult: vi.fn(),
}));

vi.mock('../lib/featureFlags', async (importActual) => {
  const actual = await importActual<typeof import('../lib/featureFlags')>();
  const resolve = (key: string, fallback = false): boolean => {
    if (flagDbRows.has(key)) return flagDbRows.get(key)!;
    const envKey = actual.FLAG_ENV_MAP[key];
    const envVal = envKey ? process.env[envKey] : undefined;
    if (envVal !== undefined) return envVal.toLowerCase() === 'true';
    return actual.DEFAULT_FLAG_VALUES[key] ?? fallback;
  };
  return {
    ...actual,
    getFeatureFlag: vi.fn(async (key: string, fallback = false) => resolve(key, fallback)),
    refreshFeatureFlag: vi.fn(async (key: string) => resolve(key)),
    listFeatureFlags: vi.fn(async () =>
      Object.keys(actual.FLAG_ENV_MAP).map((key) => ({
        key,
        value: resolve(key),
        source: flagDbRows.has(key)
          ? ('db' as const)
          : process.env[actual.FLAG_ENV_MAP[key]!] !== undefined
            ? ('env' as const)
            : ('fallback' as const),
        updatedAt: null,
        updatedBy: null,
      }))),
  };
});

vi.mock('../db', () => ({
  db: {
    insert: () => ({
      values: (row: { key: string; value: string }) => ({
        onConflictDoUpdate: async () => {
          flagDbRows.set(row.key, row.value === 'true');
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  },
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: false,
  }),
  updateSession: async (socialSessionId: string, state: SocialSessionState) => {
    testSessions.set(socialSessionId, state);
  },
  listParticipants: async (socialSessionId: string) => {
    const state = testSessions.get(socialSessionId);
    return (
      state?.joinedParticipants?.map((p) => ({
        ...p,
        joinedAt: p.joinedAt ?? new Date().toISOString(),
        lastSeenAt: p.lastSeenAt ?? new Date().toISOString(),
        isActive: true,
      })) ?? []
    );
  },
  loadSessionLieTruths: async () => [],
  savePhaseMetric: async () => {},
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('../lib/adminAuditLogger', () => ({
  logAdminAudit: (...args: unknown[]) => mockAudit(...args),
}));

vi.mock('../adminAuth', async () => {
  const actual = await vi.importActual<typeof import('../adminAuth')>('../adminAuth');
  return {
    ...actual,
    requireAdmin: (req: any, _res: any, next: () => void) => {
      req.adminAccount = { id: 'admin-test' };
      req.adminRole = 'super_admin';
      next();
    },
    requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  };
});

// Heavy admin-router dependencies (same preamble as adminBenchmarks.test.ts).
vi.mock('../benchmarks/socialAIBenchmark', () => ({
  runSocialAIBenchmark: vi.fn(),
  formatBenchmarkReport: vi.fn(),
  getDefaultModelConfigs: vi.fn(() => []),
}));
vi.mock('../repositories/adminOutcomeAnalyticsRepo', () => ({
  adminOutcomeAnalyticsRepo: { getDashboard: vi.fn() },
}));
vi.mock('../repositories/socialIcebreakerAiFeedbackRepo', () => ({
  socialIcebreakerAiFeedbackRepo: { getSummary: vi.fn() },
}));
vi.mock('../repositories/adminAuditLogsRepo', () => ({
  queryAdminAuditLogs: vi.fn(),
}));
vi.mock('../archetypeChemistryCalibration', () => ({
  CHEMISTRY_CALIBRATION_MIN_SAMPLES: 10,
  CHEMISTRY_CALIBRATION_MAX_DELTA: 0.2,
  listArchetypePairCalibrationDetails: vi.fn(),
}));
vi.mock('../inference/runtimeLLMFallback', () => ({
  getRuntimeLLMFallbackConfig: vi.fn(),
  getRuntimeLLMFallbackStats: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
    getRoleResult: mockGetRoleResult,
  },
}));

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import('../lib/featureFlags');
const { transitionPhase, resolveLieDetectiveModeSnapshot } = await import('../routes/socialIcebreakerHelpers');
const { buildAuthUserResponse } = await import('../lib/buildAuthUserResponse');
const { registerAdminRoutes } = await import('../routes/domains/admin');

const ENV_KEYS = ['LIE_DETECTIVE_V2_ENABLED', 'LIE_DETECTIVE_MODE'] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function makeState(id: string, overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: id,
    icebreakerSessionId: `ice-${id}`,
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'lie_detective', 'recap'],
    joinedParticipants: ['host-user', 'p1', 'p2', 'p3'].map((userId) => ({
      userId,
      displayName: userId,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isActive: true,
    })),
    ...overrides,
  } as SocialSessionState;
}

beforeEach(() => {
  vi.clearAllMocks();
  flagDbRows.clear();
  testSessions.clear();
  clearEnv();
});

afterEach(() => {
  clearEnv();
});

// ─── AC-01: flag registration contract ──────────────────────────────────────

describe('lieDetectiveV2Enabled flag registration (AC-01)', () => {
  it('is DB-backed with the LIE_DETECTIVE_V2_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.lieDetectiveV2Enabled).toBe('LIE_DETECTIVE_V2_ENABLED');
  });

  it('ships dark: explicit default false when neither DB row nor env var is set', () => {
    expect(DEFAULT_FLAG_VALUES.lieDetectiveV2Enabled).toBe(false);
  });

  it('keeps the neighboring miniscript V2 flag untouched', () => {
    expect(FLAG_ENV_MAP.miniscriptEvidenceVoteV2Enabled).toBe('MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED');
    expect(DEFAULT_FLAG_VALUES.miniscriptEvidenceVoteV2Enabled).toBe(false);
  });
});

// ─── AC-02: resolution order ────────────────────────────────────────────────

describe('resolveLieDetectiveModeSnapshot resolution order (AC-02)', () => {
  it('session override beats the DB flag and is never re-snapshotted', async () => {
    flagDbRows.set('lieDetectiveV2Enabled', true);
    const state = makeState('ac02-override', { lieDetectiveMode: 'v1' });

    const mode = await resolveLieDetectiveModeSnapshot(state, 'ac02-override');

    expect(mode).toBe('v1');
    expect(state.lieDetectiveMode).toBe('v1');
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.anything(),
    );
  });

  it('DB flag ON beats legacy env LIE_DETECTIVE_MODE=v1', async () => {
    flagDbRows.set('lieDetectiveV2Enabled', true);
    process.env.LIE_DETECTIVE_MODE = 'v1';
    const state = makeState('ac02-flag-on');

    const mode = await resolveLieDetectiveModeSnapshot(state, 'ac02-flag-on');

    expect(mode).toBe('v2');
    expect(state.lieDetectiveMode).toBe('v2');
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.objectContaining({
        socialSessionId: 'ac02-flag-on',
        lieDetectiveMode: 'v2',
        resolutionSource: 'db-flag',
      }),
    );
  });

  it('DB flag OFF falls through to legacy env LIE_DETECTIVE_MODE=v2', async () => {
    flagDbRows.set('lieDetectiveV2Enabled', false);
    process.env.LIE_DETECTIVE_MODE = 'v2';
    const state = makeState('ac02-env-v2');

    const mode = await resolveLieDetectiveModeSnapshot(state, 'ac02-env-v2');

    expect(mode).toBe('v2');
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.objectContaining({ lieDetectiveMode: 'v2', resolutionSource: 'env-fallback' }),
    );
  });

  it('DB flag OFF with envs unset yields v1 (flag-off === legacy default)', async () => {
    const state = makeState('ac02-default');

    const mode = await resolveLieDetectiveModeSnapshot(state, 'ac02-default');

    expect(mode).toBe('v1');
    expect(state.lieDetectiveMode).toBe('v1');
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.objectContaining({ lieDetectiveMode: 'v1', resolutionSource: 'env-fallback' }),
    );
  });

  it('env fallback of the new flag (LIE_DETECTIVE_V2_ENABLED=true) resolves v2 with no DB row', async () => {
    process.env.LIE_DETECTIVE_V2_ENABLED = 'true';
    const state = makeState('ac02-flag-env');

    const mode = await resolveLieDetectiveModeSnapshot(state, 'ac02-flag-env');

    expect(mode).toBe('v2');
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.objectContaining({ lieDetectiveMode: 'v2', resolutionSource: 'db-flag' }),
    );
  });
});

// ─── AC-03/AC-07: phase-entry snapshot + immutability + rollback ────────────

describe('lie_detective phase-entry snapshot (AC-03, AC-07)', () => {
  async function transition(state: SocialSessionState, targetPhase: SocialIcebreakerPhase) {
    testSessions.set(state.socialSessionId, state);
    return transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'host_tap',
      targetPhase,
      skipBonusGate: true,
    });
  }

  it('snapshots once at phase entry; a mid-session flag flip does not mutate the live session', async () => {
    flagDbRows.set('lieDetectiveV2Enabled', true);
    const state = makeState('snap-on');
    await transition(state, 'lie_detective');
    expect(state.currentPhase).toBe('lie_detective');
    expect(state.lieDetectiveMode).toBe('v2');
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.objectContaining({ socialSessionId: 'snap-on', lieDetectiveMode: 'v2', resolutionSource: 'db-flag' }),
    );

    // Ops flips the flag off mid-session — the snapshot is immutable.
    flagDbRows.set('lieDetectiveV2Enabled', false);
    vi.mocked(logger.info).mockClear();
    await transition(state, 'warmup');
    await transition(state, 'lie_detective'); // re-entry: guard skips re-snapshot
    expect(state.lieDetectiveMode).toBe('v2');
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] lie detective mode snapshot',
      expect.anything(),
    );
  });

  it('snapshots v1 when the flag is off; a later flip-on does not upgrade the live session', async () => {
    const state = makeState('snap-off');
    await transition(state, 'lie_detective');
    expect(state.lieDetectiveMode).toBe('v1');

    flagDbRows.set('lieDetectiveV2Enabled', true);
    await transition(state, 'warmup');
    await transition(state, 'lie_detective');
    expect(state.lieDetectiveMode).toBe('v1');
  });

  it('AC-07 rollback: flag ON snapshot → flag OFF → the NEXT session resolves v1', async () => {
    flagDbRows.set('lieDetectiveV2Enabled', true);
    const sessionA = makeState('rollback-a');
    await transition(sessionA, 'lie_detective');
    expect(sessionA.lieDetectiveMode).toBe('v2');

    flagDbRows.set('lieDetectiveV2Enabled', false);
    const sessionB = makeState('rollback-b');
    await transition(sessionB, 'lie_detective');
    expect(sessionB.lieDetectiveMode).toBe('v1');
  });

  it('single-test in-phase overwrite survives phase re-entry (overwrite-then-guard)', async () => {
    const state = makeState('snap-guard');
    await transition(state, 'lie_detective');
    expect(state.lieDetectiveMode).toBe('v1'); // snapshot writes first

    // The single-test mode route can only run in-phase and overwrites post-entry.
    state.lieDetectiveMode = 'v2';
    flagDbRows.set('lieDetectiveV2Enabled', false);
    await transition(state, 'warmup');
    await transition(state, 'lie_detective');
    expect(state.lieDetectiveMode).toBe('v2'); // guard preserved the override
  });
});

// ─── AC-05: client exposure via /api/auth/user ──────────────────────────────

describe('buildAuthUserResponse lieDetectiveV2Enabled exposure (AC-05)', () => {
  const mockUser = {
    id: 'lie-v2-auth-user',
    displayName: 'Lie Flag Tester',
    gender: 'female',
    currentCity: 'Shenzhen',
    educationLevel: 'bachelor',
    industryNicheLabel: 'design',
    industryCategoryLabel: null,
    hometownRegionCity: 'Guangzhou',
    hasCompletedPersonalityTest: true,
    hasCompletedRegistration: true,
    hasCompletedInterestsCarousel: true,
    hasSeenProfileReview: true,
    onboardingCheckpoint: 'profile-review',
    primaryArchetype: 'corgi',
    secondaryArchetype: null,
    onboardingRestartCount: 0,
  };

  beforeEach(() => {
    mockGetUser.mockResolvedValue(mockUser);
    mockGetAssessmentSessionByUser.mockResolvedValue(null);
    mockGetRoleResult.mockResolvedValue(null);
  });

  it.each([true, false])(
    'exposes lieDetectiveV2Enabled=%s in the auth features payload',
    async (flagOn) => {
      flagDbRows.set('lieDetectiveV2Enabled', flagOn);

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.features?.lieDetectiveV2Enabled).toBe(flagOn);
    },
  );

  it('defaults lieDetectiveV2Enabled to false when neither DB row nor env var is set', async () => {
    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.lieDetectiveV2Enabled).toBe(false);
  });
});

// ─── AC-06 (verifier N1): admin PUT→GET round-trip ─────────────────────────

describe('admin feature-flag round-trip for lieDetectiveV2Enabled (AC-06)', () => {
  function createApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    registerAdminRoutes(app);
    return app;
  }
  const withServer = createWithServer(createApp);

  it('PUT then GET round-trips the new key with source=db and an audit record', async () => {
    await withServer(async (baseUrl) => {
      const put = await fetch(`${baseUrl}/api/admin/feature-flags/lieDetectiveV2Enabled`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'true', description: 'Lie V2 staged rollout' }),
      });
      expect(put.status).toBe(200);
      const putBody = (await put.json()) as { key: string; value: string; updated: boolean };
      expect(putBody).toEqual({ key: 'lieDetectiveV2Enabled', value: 'true', updated: true });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FEATURE_FLAG_UPDATED',
          targetEntityType: 'feature_flag',
          targetEntityId: 'lieDetectiveV2Enabled',
        }),
      );

      const get = await fetch(`${baseUrl}/api/admin/feature-flags`);
      expect(get.status).toBe(200);
      const { flags } = (await get.json()) as {
        flags: Array<{ key: string; value: boolean; source: string }>;
      };
      const entry = flags.find((f) => f.key === 'lieDetectiveV2Enabled');
      expect(entry).toBeDefined();
      expect(entry?.value).toBe(true);
      expect(entry?.source).toBe('db');
    });
  });

  it('PUT rejects an unknown flag key', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/feature-flags/notARealFlag`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'true' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
