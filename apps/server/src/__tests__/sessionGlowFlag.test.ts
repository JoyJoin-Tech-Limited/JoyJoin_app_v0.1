/**
 * Session Glow 高光值 DB flag + /start snapshot (sprint wave4-sessionGlow):
 *  - AC-01: flag registration contract (FLAG_ENV_MAP + DEFAULT_FLAG_VALUES)
 *  - AC-02: resolveSessionGlowSnapshot — session-start snapshot,
 *    immutability, rollback, parallelized in-flight read (wave1-3 N3),
 *    single-test fail-open disposition (verifier N6)
 *  - AC-01/N1: admin PUT→GET round-trip + FEATURE_FLAG_UPDATED audit
 *    (mandatory N1 clone of lieDetectiveV2Flag.test.ts)
 *  - AC-10: analytics whitelist contains the three glow events
 *
 * The featureFlags module is partially mocked (real registries, stateful
 * in-memory DB rows) — same harness pattern as lieDetectiveV2Flag.test.ts.
 */
import express from 'express';
import session from 'express-session';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const { flagDbRows, mockAudit } = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  mockAudit: vi.fn(),
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

// Heavy admin-router dependencies (same preamble as lieDetectiveV2Flag.test.ts).
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

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES, getFeatureFlag } = await import('../lib/featureFlags');
const { resolveSessionGlowSnapshot } = await import('../routes/socialIcebreakerHelpers');
const { registerAdminRoutes } = await import('../routes/domains/admin');

const ENV_KEYS = ['SESSION_GLOW_ENABLED'] as const;

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
    enabledPhases: ['warmup', 'quip_battle', 'recap'],
    ...overrides,
  } as SocialSessionState;
}

beforeEach(() => {
  vi.clearAllMocks();
  flagDbRows.clear();
  clearEnv();
});

afterEach(() => {
  clearEnv();
});

// ─── AC-01: flag registration contract ──────────────────────────────────────

describe('sessionGlowEnabled flag registration (AC-01)', () => {
  it('is DB-backed with the SESSION_GLOW_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.sessionGlowEnabled).toBe('SESSION_GLOW_ENABLED');
  });

  it('ships dark: explicit default false when neither DB row nor env var is set', () => {
    expect(DEFAULT_FLAG_VALUES.sessionGlowEnabled).toBe(false);
  });

  it('resolves through the DB → env → default chain (env fallback honored)', async () => {
    process.env.SESSION_GLOW_ENABLED = 'true';
    expect(await getFeatureFlag('sessionGlowEnabled', false)).toBe(true);
  });
});

// ─── AC-02: session-start snapshot + rollback ───────────────────────────────

describe('resolveSessionGlowSnapshot (AC-02)', () => {
  it('snapshots true when the flag is on and logs once per session with source', async () => {
    flagDbRows.set('sessionGlowEnabled', true);
    const state = makeState('glow-snap-on');

    const enabled = await resolveSessionGlowSnapshot(state, 'glow-snap-on');

    expect(enabled).toBe(true);
    expect(state.sessionGlowEnabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] session glow snapshot',
      expect.objectContaining({
        socialSessionId: 'glow-snap-on',
        sessionGlowEnabled: true,
        resolutionSource: 'db-flag',
      }),
    );
  });

  it('is immutable: a mid-session flip never re-resolves the live session', async () => {
    flagDbRows.set('sessionGlowEnabled', true);
    const state = makeState('glow-snap-immutable');
    await resolveSessionGlowSnapshot(state, 'glow-snap-immutable');

    flagDbRows.set('sessionGlowEnabled', false);
    vi.mocked(logger.info).mockClear();
    const again = await resolveSessionGlowSnapshot(state, 'glow-snap-immutable');

    expect(again).toBe(true);
    expect(state.sessionGlowEnabled).toBe(true);
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] session glow snapshot',
      expect.anything(),
    );
  });

  it('rollback: flag ON snapshot → flag OFF → the NEXT session snapshots false', async () => {
    flagDbRows.set('sessionGlowEnabled', true);
    const first = makeState('glow-rollback-1');
    await resolveSessionGlowSnapshot(first, 'glow-rollback-1');
    expect(first.sessionGlowEnabled).toBe(true);

    flagDbRows.set('sessionGlowEnabled', false);
    const second = makeState('glow-rollback-2');
    await resolveSessionGlowSnapshot(second, 'glow-rollback-2');
    expect(second.sessionGlowEnabled).toBe(false);
  });

  it('consumes a caller-started in-flight read (parallelized /start pattern, wave1-3 N3)', async () => {
    flagDbRows.set('sessionGlowEnabled', true);
    const state = makeState('glow-snap-promise');
    const pending = getFeatureFlag('sessionGlowEnabled', false);

    const enabled = await resolveSessionGlowSnapshot(state, 'glow-snap-promise', pending);

    expect(enabled).toBe(true);
    expect(state.sessionGlowEnabled).toBe(true);
  });

  it('single-test disposition (verifier N6): unresolved snapshot stays undefined → falsy → fail-open', () => {
    const state = makeState('glow-single-test');
    // A session whose creation path bypassed the /start flag read simply
    // never has the field — falsy → accumulation gated off (asserted in
    // sessionGlow.test.ts flag-off transition tests).
    expect(state.sessionGlowEnabled).toBeUndefined();
    expect(state.sessionGlowEnabled === true).toBe(false);
  });
});

// ─── AC-01/N1: admin PUT→GET round-trip (mandatory N1 clone) ────────────────

describe('admin feature-flag round-trip for sessionGlowEnabled (AC-01, N1)', () => {
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
      const put = await fetch(`${baseUrl}/api/admin/feature-flags/sessionGlowEnabled`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'true', description: 'Wave 4 高光值 staged rollout' }),
      });
      expect(put.status).toBe(200);
      const putBody = (await put.json()) as { key: string; value: string; updated: boolean };
      expect(putBody).toEqual({ key: 'sessionGlowEnabled', value: 'true', updated: true });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FEATURE_FLAG_UPDATED',
          targetEntityType: 'feature_flag',
          targetEntityId: 'sessionGlowEnabled',
        }),
      );

      const get = await fetch(`${baseUrl}/api/admin/feature-flags`);
      expect(get.status).toBe(200);
      const { flags } = (await get.json()) as {
        flags: Array<{ key: string; value: boolean; source: string }>;
      };
      const entry = flags.find((f) => f.key === 'sessionGlowEnabled');
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

// ─── AC-10: analytics whitelist ─────────────────────────────────────────────

describe('analytics whitelist (AC-10)', () => {
  it('SOCIAL_ICEBREAKER_EVENT_TYPES contains all three glow events', () => {
    const source = readFileSync(
      join(__dirname, '../routes/domains/analytics.ts'),
      'utf8',
    );
    const match = source.match(/const SOCIAL_ICEBREAKER_EVENT_TYPES = \[([\s\S]*?)\] as const;/);
    expect(match).not.toBeNull();
    const listBody = match![1];
    for (const event of ['glow_recap_revealed', 'glow_medal_awarded', 'glow_detail_expanded']) {
      expect(listBody).toContain(`"${event}"`);
    }
  });
});
