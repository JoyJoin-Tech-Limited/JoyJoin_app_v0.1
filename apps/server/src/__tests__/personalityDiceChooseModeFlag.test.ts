/**
 * Personality Dice Choose-Your-Prompt DB-flag migration
 * (sprint wave1-3-personalityDiceChooseMode):
 *  - AC-01: flag registration contract (FLAG_ENV_MAP + DEFAULT_FLAG_VALUES=true)
 *  - AC-02: resolution order (snapshot → DB flag → env fallback → default true)
 *           plus real-import sync-site coverage for
 *           `buildPersonalityDiceRecapLines` and `simulatePersonalityDiceBots`
 *           (verifier M3 — the previous recap gate exercised an inlined replica)
 *  - AC-03: /start snapshot resolve-once + mid-session-flip immutability
 *  - AC-04: behavior preservation across the DB/env/default tiers
 *  - AC-05: buildAuthUserResponse features.personalityDiceChooseMode exposure
 *  - AC-06: admin PUT→GET round-trip + FEATURE_FLAG_UPDATED audit
 *  - AC-07: rollback (flag ON snapshot → flag OFF → NEXT session single-dare)
 *  - AC-10: pre-generation payload threading (queue payload + worker payload-first)
 *
 * The featureFlags module is partially mocked: the real FLAG_ENV_MAP /
 * DEFAULT_FLAG_VALUES registries stay live (AC-01 asserts against them), while
 * the resolution functions are backed by a stateful in-memory "DB row" map
 * replicating the documented DB → env → default chain.
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SocialSessionState,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const {
  flagDbRows,
  mockAudit,
  mockGetUser,
  mockGetAssessmentSessionByUser,
  mockGetRoleResult,
  mockEnqueuePreGenerationJob,
} = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  mockAudit: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetAssessmentSessionByUser: vi.fn(),
  mockGetRoleResult: vi.fn(),
  mockEnqueuePreGenerationJob: vi.fn(async (..._args: unknown[]): Promise<string> => 'job-test'),
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
  getSessionWithExpiry: async () => ({ state: null, expired: false }),
  updateSession: async () => {},
  listParticipants: async () => [],
  loadSessionLieTruths: async () => [],
  savePhaseMetric: async () => {},
  getPreGenerationResult: async () => null,
  getInFlightJobForPhase: async () => null,
  setLieTruths: async () => {},
  getLieTruths: async () => null,
  getMiniScriptSecrets: async () => null,
  dequeuePendingJob: async () => null,
  completePreGenerationJob: async () => true,
  failPreGenerationJob: async () => {},
  storePreGenerationResult: async () => 'result-test',
  isPreGenerationJobRunning: async () => true,
  deletePreGenerationResultById: async () => {},
  enqueuePreGenerationJob: (...args: unknown[]) => mockEnqueuePreGenerationJob(...args),
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
const {
  resolvePersonalityDiceChooseModeSnapshot,
  buildPersonalityDiceRecapLines,
} = await import('../routes/socialIcebreakerHelpers');
const { simulatePersonalityDiceBots } = await import('../services/socialIcebreakerBotService');
const { buildAuthUserResponse } = await import('../lib/buildAuthUserResponse');
const { registerAdminRoutes } = await import('../routes/domains/admin');
const { enqueueRunPlanPreGeneration } = await import('../jobs/preGenerationQueue');
const {
  resolvePersonalityDiceChooseModeFromPayload,
  getFallbackForPhase,
} = await import('../jobs/preGenerationWorker');

const FLAG_KEY = 'personalityDiceChooseModeEnabled';
const ENV_KEY = 'PERSONALITY_DICE_CHOOSE_MODE_ENABLED';
const SNAPSHOT_LOG = '[SocialIcebreaker] personality dice choose-mode snapshot';

function clearEnv() {
  delete process.env[ENV_KEY];
}

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'ice-test',
    currentPhase: 'personality_dice',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'personality_dice', 'recap'],
    ...overrides,
  } as SocialSessionState;
}

function makeChallenge(title: string) {
  return {
    userId: 'u1',
    displayName: 'A',
    archetype: 'corgi',
    dominantTrait: 'A' as const,
    challengeTitle: title,
    challengeBody: 'body',
    challengeEmoji: 'X',
    difficulty: 'medium' as const,
    passLine: 'pass',
    passConsequence: 'consequence',
  };
}

/** State carrying BOTH shapes so every sync site can branch either way. */
function makeDualShapeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  const groups: PersonalityDiceChallengeGroup[] = [
    {
      userId: 'u1',
      displayName: 'A',
      archetype: 'corgi',
      dominantTrait: 'A' as const,
      options: [makeChallenge('三选一标题')],
    },
  ];
  return makeState({
    personalityDiceChallengeGroups: groups,
    diceSelectedOption: { u1: 0 },
    personalityDiceChallenges: [makeChallenge('单题标题')],
    ...overrides,
  });
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

describe('personalityDiceChooseModeEnabled flag registration (AC-01)', () => {
  it('is DB-backed with the PERSONALITY_DICE_CHOOSE_MODE_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.personalityDiceChooseModeEnabled).toBe('PERSONALITY_DICE_CHOOSE_MODE_ENABLED');
  });

  it('is live-by-default: explicit default true when neither DB row nor env var is set', () => {
    expect(DEFAULT_FLAG_VALUES.personalityDiceChooseModeEnabled).toBe(true);
  });

  it('keeps the neighboring lieDetectiveV2Enabled flag untouched', () => {
    expect(FLAG_ENV_MAP.lieDetectiveV2Enabled).toBe('LIE_DETECTIVE_V2_ENABLED');
    expect(DEFAULT_FLAG_VALUES.lieDetectiveV2Enabled).toBe(false);
  });
});

// ─── AC-02 / AC-04: resolution order + behavior preservation ────────────────

describe('resolvePersonalityDiceChooseModeSnapshot resolution order (AC-02, AC-04)', () => {
  it('DB true beats env false (DB tier wins)', async () => {
    flagDbRows.set(FLAG_KEY, true);
    process.env[ENV_KEY] = 'false';
    const state = makeState();

    const enabled = await resolvePersonalityDiceChooseModeSnapshot(state, 'ac02-db-on');

    expect(enabled).toBe(true);
    expect(state.personalityDiceChooseModeEnabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      SNAPSHOT_LOG,
      expect.objectContaining({
        socialSessionId: 'ac02-db-on',
        personalityDiceChooseModeEnabled: true,
        resolutionSource: 'db-flag',
      }),
    );
  });

  it('DB false beats env true (DB tier wins)', async () => {
    flagDbRows.set(FLAG_KEY, false);
    process.env[ENV_KEY] = 'true';
    const state = makeState();

    const enabled = await resolvePersonalityDiceChooseModeSnapshot(state, 'ac02-db-off');

    expect(enabled).toBe(false);
    expect(state.personalityDiceChooseModeEnabled).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      SNAPSHOT_LOG,
      expect.objectContaining({ personalityDiceChooseModeEnabled: false, resolutionSource: 'db-flag' }),
    );
  });

  it('no DB row + env false yields false (env fallback honored)', async () => {
    process.env[ENV_KEY] = 'false';
    const state = makeState();

    const enabled = await resolvePersonalityDiceChooseModeSnapshot(state, 'ac02-env-off');

    expect(enabled).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      SNAPSHOT_LOG,
      expect.objectContaining({ personalityDiceChooseModeEnabled: false, resolutionSource: 'env-fallback' }),
    );
  });

  it('no DB row + env true yields true (env fallback honored)', async () => {
    process.env[ENV_KEY] = 'true';
    const state = makeState();

    const enabled = await resolvePersonalityDiceChooseModeSnapshot(state, 'ac02-env-on');

    expect(enabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      SNAPSHOT_LOG,
      expect.objectContaining({ personalityDiceChooseModeEnabled: true, resolutionSource: 'env-fallback' }),
    );
  });

  it('no DB row + env unset yields true (default preserved — live-by-default)', async () => {
    const state = makeState();

    const enabled = await resolvePersonalityDiceChooseModeSnapshot(state, 'ac02-default');

    expect(enabled).toBe(true);
    expect(state.personalityDiceChooseModeEnabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      SNAPSHOT_LOG,
      expect.objectContaining({ personalityDiceChooseModeEnabled: true, resolutionSource: 'default' }),
    );
  });
});

// ─── AC-02 (verifier M3): sync sites consume the real functions ─────────────

describe('sync site buildPersonalityDiceRecapLines consumes the real helper (AC-02 site 5)', () => {
  it('snapshot false beats env true → single-dare lines', () => {
    process.env[ENV_KEY] = 'true';
    const state = makeDualShapeState({ personalityDiceChooseModeEnabled: false });

    const lines = buildPersonalityDiceRecapLines(state);

    expect(lines[0]).toContain('单题标题');
    expect(lines[0]).not.toContain('选择了');
  });

  it('snapshot undefined + env false → single-dare lines (env fallback for legacy sessions)', () => {
    process.env[ENV_KEY] = 'false';
    const state = makeDualShapeState();

    const lines = buildPersonalityDiceRecapLines(state);

    expect(lines[0]).toContain('单题标题');
    expect(lines[0]).not.toContain('选择了');
  });

  it('snapshot undefined + env unset → choose-mode lines (default true preserved)', () => {
    const state = makeDualShapeState();

    const lines = buildPersonalityDiceRecapLines(state);

    expect(lines[0]).toContain('选择了');
    expect(lines[0]).toContain('三选一标题');
  });
});

describe('sync site simulatePersonalityDiceBots consumes the real helper (AC-02 site 6)', () => {
  const bots = [{ botId: 'bot-1', userId: 'b1', displayName: 'Bot', archetype: 'corgi' }];

  it('snapshot false beats env true → legacy completion branch', () => {
    process.env[ENV_KEY] = 'true';
    const state = makeDualShapeState({ personalityDiceChooseModeEnabled: false });

    simulatePersonalityDiceBots(state, bots, () => 0.5);

    expect(state.diceCompletedBy).toContain('b1');
  });

  it('snapshot undefined + env false → legacy completion branch', () => {
    process.env[ENV_KEY] = 'false';
    const state = makeDualShapeState();

    simulatePersonalityDiceBots(state, bots, () => 0.5);

    expect(state.diceCompletedBy).toContain('b1');
  });

  it('snapshot undefined + env unset → choose-mode branch (no legacy completion)', () => {
    const state = makeDualShapeState();

    simulatePersonalityDiceBots(state, bots, () => 0.5);

    // Choose-mode seeds only single-test bots (none here) and never runs the
    // legacy "mark every bot completed" branch.
    expect(state.diceCompletedBy ?? []).not.toContain('b1');
  });
});

// ─── AC-03 / AC-07: resolve-once immutability + rollback ────────────────────

describe('session-start snapshot immutability (AC-03) and rollback (AC-07)', () => {
  it('resolves once; a mid-session flag flip does not mutate a live session', async () => {
    flagDbRows.set(FLAG_KEY, true);
    const state = makeState();

    await resolvePersonalityDiceChooseModeSnapshot(state, 'snap-1');
    expect(state.personalityDiceChooseModeEnabled).toBe(true);

    // Ops flips the flag off mid-session — the snapshot is immutable.
    flagDbRows.set(FLAG_KEY, false);
    vi.mocked(logger.info).mockClear();

    const second = await resolvePersonalityDiceChooseModeSnapshot(state, 'snap-1');

    expect(second).toBe(true);
    expect(state.personalityDiceChooseModeEnabled).toBe(true);
    expect(logger.info).not.toHaveBeenCalledWith(SNAPSHOT_LOG, expect.anything());
  });

  it('a later DB flip does not downgrade a session that snapshotted the default (true)', async () => {
    const state = makeState();

    await resolvePersonalityDiceChooseModeSnapshot(state, 'snap-2');
    expect(state.personalityDiceChooseModeEnabled).toBe(true); // default true
    flagDbRows.set(FLAG_KEY, false);
    await resolvePersonalityDiceChooseModeSnapshot(state, 'snap-2');
    expect(state.personalityDiceChooseModeEnabled).toBe(true);
  });

  it('AC-07 rollback: flag ON snapshot → flag OFF → the NEXT session resolves single-dare', async () => {
    flagDbRows.set(FLAG_KEY, true);
    const sessionA = makeState({ socialSessionId: 'rollback-a' });
    await resolvePersonalityDiceChooseModeSnapshot(sessionA, 'rollback-a');
    expect(sessionA.personalityDiceChooseModeEnabled).toBe(true);

    flagDbRows.set(FLAG_KEY, false);
    const sessionB = makeState({ socialSessionId: 'rollback-b' });
    await resolvePersonalityDiceChooseModeSnapshot(sessionB, 'rollback-b');
    expect(sessionB.personalityDiceChooseModeEnabled).toBe(false);
  });
});

// ─── AC-05: client exposure via /api/auth/user ──────────────────────────────

describe('buildAuthUserResponse personalityDiceChooseMode exposure (AC-05)', () => {
  const mockUser = {
    id: 'dice-flag-auth-user',
    displayName: 'Dice Flag Tester',
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
    'exposes personalityDiceChooseMode=%s in the auth features payload',
    async (flagOn) => {
      flagDbRows.set(FLAG_KEY, flagOn);

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.features?.personalityDiceChooseMode).toBe(flagOn);
    },
  );

  it('defaults personalityDiceChooseMode to true when neither DB row nor env var is set', async () => {
    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.personalityDiceChooseMode).toBe(true);
  });
});

// ─── AC-06: admin PUT→GET round-trip ────────────────────────────────────────

describe('admin feature-flag round-trip for personalityDiceChooseModeEnabled (AC-06)', () => {
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
      const put = await fetch(`${baseUrl}/api/admin/feature-flags/personalityDiceChooseModeEnabled`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'true', description: 'Dice choose-mode kill switch' }),
      });
      expect(put.status).toBe(200);
      const putBody = (await put.json()) as { key: string; value: string; updated: boolean };
      expect(putBody).toEqual({
        key: 'personalityDiceChooseModeEnabled',
        value: 'true',
        updated: true,
      });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FEATURE_FLAG_UPDATED',
          targetEntityType: 'feature_flag',
          targetEntityId: 'personalityDiceChooseModeEnabled',
        }),
      );

      const get = await fetch(`${baseUrl}/api/admin/feature-flags`);
      expect(get.status).toBe(200);
      const { flags } = (await get.json()) as {
        flags: Array<{ key: string; value: boolean; source: string }>;
      };
      const entry = flags.find((f) => f.key === 'personalityDiceChooseModeEnabled');
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

// ─── AC-10: pre-generation payload threading ────────────────────────────────

describe('pre-generation payload threading (AC-10)', () => {
  it('enqueueRunPlanPreGeneration copies the session snapshot into the personality_dice payload', async () => {
    mockEnqueuePreGenerationJob.mockClear();

    await enqueueRunPlanPreGeneration(
      'social-preg',
      { segments: [{ phase: 'personality_dice', durationMinutes: 10 }] },
      {
        participantCount: 2,
        eventType: '测试',
        personalityDiceChooseMode: false,
        participants: [{ userId: 'u1', displayName: 'A' }],
      },
    );

    const call = mockEnqueuePreGenerationJob.mock.calls.find((c) => c[1] === 'personality_dice');
    expect(call).toBeDefined();
    const payload = call![3] as { personalityDiceChooseMode?: boolean };
    expect(payload.personalityDiceChooseMode).toBe(false);
  });

  it('resolvePersonalityDiceChooseModeFromPayload is payload-first with env fallback', () => {
    expect(resolvePersonalityDiceChooseModeFromPayload({ personalityDiceChooseMode: false })).toBe(false);
    expect(resolvePersonalityDiceChooseModeFromPayload({ personalityDiceChooseMode: true })).toBe(true);

    process.env[ENV_KEY] = 'false';
    expect(resolvePersonalityDiceChooseModeFromPayload({})).toBe(false);

    delete process.env[ENV_KEY];
    expect(resolvePersonalityDiceChooseModeFromPayload({})).toBe(true);
  });

  it('getFallbackForPhase produces single-dare output for a kill-switched payload even when env is ON', () => {
    const participants = [{ userId: 'u1', displayName: 'A', archetype: 'corgi' }];
    process.env[ENV_KEY] = 'true';

    const off = getFallbackForPhase('personality_dice', {
      participants,
      personalityDiceChooseMode: false,
    });
    expect(Array.isArray(off.data)).toBe(true);
    expect((off.data as Array<{ options?: unknown }>)[0].options).toBeUndefined();

    const on = getFallbackForPhase('personality_dice', {
      participants,
      personalityDiceChooseMode: true,
    });
    expect((on.data as Array<{ options?: unknown }>)[0].options).toBeDefined();
  });
});
