/**
 * Auction V2 flag + unit suite (sprint wave2-auctionV2, locked contract):
 *  - AC-01: flag registration contract + admin PUT→GET round-trip (N1 clone)
 *  - AC-02: resolveAuctionV2Snapshot + transitionPhase auction snapshot,
 *           mid-session-flip immutability, rollback semantics
 *  - AC-05: beat kind→pattern mapping, state-free payload, 5s rate limit
 *  - AC-07: per-snapshot prompt version (verifier M1), canonical fallback
 *           bank selection/rotation/padding (verifier M2/M4), prompt v3
 *  - AC-14: analytics whitelist source scan
 *  - AC-16: gambling-vocab copy scan
 *
 * Route-level coverage (bid/close-lot/race/idempotency) lives in
 * auctionV2Routes.test.ts; both files run under `--run auctionV2`.
 *
 * The featureFlags module is partially mocked: real FLAG_ENV_MAP /
 * DEFAULT_FLAG_VALUES stay live (AC-01 asserts against them) while
 * getFeatureFlag is backed by a stateful in-memory "DB row" map replicating
 * the documented DB → env → default chain (wave1-2 preamble clone).
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState, SocialIcebreakerPhase, AuctionLotResult } from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const {
  flagDbRows,
  testSessions,
  mockAudit,
  mockGetUser,
  mockGetAssessmentSessionByUser,
  mockGetRoleResult,
  getClientForFunctionMock,
  moderateMock,
} = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  testSessions: new Map<string, SocialSessionState>(),
  mockAudit: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetAssessmentSessionByUser: vi.fn(),
  mockGetRoleResult: vi.fn(),
  getClientForFunctionMock: vi.fn(),
  moderateMock: vi.fn(() => ({ safe: true })),
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

vi.mock('../storage', () => ({
  storage: {
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
    getRoleResult: mockGetRoleResult,
  },
}));

// Live-path seams for the generateAuctionLots padding test (verifier M2).
// importActual spreads keep every other export intact so the helpers →
// AIService module chain keeps loading.
vi.mock('../ai/socialModelRouter', async (importActual) => ({
  ...(await importActual<typeof import('../ai/socialModelRouter')>()),
  getClientForFunction: getClientForFunctionMock,
}));
vi.mock('../socialIcebreakerAICore', async (importActual) => ({
  ...(await importActual<typeof import('../socialIcebreakerAICore')>()),
  raceWithTimeout: (p: Promise<unknown>) => p,
  fireAndForgetQualityGate: vi.fn(),
}));
vi.mock('../lib/aiContentModeration', async (importActual) => ({
  ...(await importActual<typeof import('../lib/aiContentModeration')>()),
  moderateGeneratedContent: moderateMock,
}));

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import('../lib/featureFlags');
const {
  transitionPhase,
  resolveAuctionV2Snapshot,
  buildAuctionAwardRecapLines,
} = await import('../routes/socialIcebreakerHelpers');
const { registerAdminRoutes } = await import('../routes/domains/admin');
const {
  generateAuctionLots,
  resolveAuctionLotsPromptVersion,
} = await import('../socialIcebreakerAuctionAI');
const { buildAuctionLotsPrompt, AUCTION_LOTS_PROMPT_VERSION, AUCTION_LOTS_PROMPT_VERSION_V3 } =
  await import('../ai/socialIcebreakerPrompts');
const {
  GROUP_BEAT_KIND_PATTERN,
  buildSocialGroupBeatMessage,
  emitAuctionOutbidBeatRateLimited,
  AUCTION_OUTBID_BEAT_MIN_INTERVAL_MS,
  __resetAuctionBeatRateLimitForTests,
} = await import('../lib/socialGroupBeats');
const {
  AUCTION_FALLBACK_BANK,
  selectAuctionFallbackLots,
  padAuctionLotsToTarget,
} = await import('@shared/socialIcebreakerAuctionFallback');
const { getFallbackForPhase } = await import('../jobs/preGenerationWorker');
const copyModule = await import('@shared/copy/auctionV2');

const ENV_KEYS = ['AUCTION_V2_ENABLED', 'SOCIAL_AUCTION_LLM_ENABLED', 'ICEBREAKER_GROUP_BEATS_ENABLED'] as const;

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
    enabledPhases: ['warmup', 'auction', 'recap'],
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
  __resetAuctionBeatRateLimitForTests();
  moderateMock.mockReturnValue({ safe: true });
});

afterEach(() => {
  clearEnv();
});

// ─── AC-01: flag registration contract ──────────────────────────────────────

describe('auctionV2Enabled flag registration (AC-01)', () => {
  it('is DB-backed with the AUCTION_V2_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.auctionV2Enabled).toBe('AUCTION_V2_ENABLED');
  });

  it('ships dark: explicit default false when neither DB row nor env var is set', () => {
    expect(DEFAULT_FLAG_VALUES.auctionV2Enabled).toBe(false);
  });

  it('keeps the neighboring wave1 flags untouched', () => {
    expect(FLAG_ENV_MAP.lieDetectiveV2Enabled).toBe('LIE_DETECTIVE_V2_ENABLED');
    expect(DEFAULT_FLAG_VALUES.lieDetectiveV2Enabled).toBe(false);
    expect(DEFAULT_FLAG_VALUES.personalityDiceChooseModeEnabled).toBe(true);
  });
});

// ─── AC-02: snapshot resolution + phase-entry snapshot + immutability ───────

describe('resolveAuctionV2Snapshot (AC-02)', () => {
  it('resolves the DB flag once and logs the snapshot with resolution source', async () => {
    flagDbRows.set('auctionV2Enabled', true);
    const state = makeState('ac02-flag-on');

    const enabled = await resolveAuctionV2Snapshot(state, 'ac02-flag-on');

    expect(enabled).toBe(true);
    expect(state.auctionV2Enabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] auction v2 flag snapshot',
      expect.objectContaining({
        socialSessionId: 'ac02-flag-on',
        auctionV2Enabled: true,
        resolutionSource: 'db-flag',
      }),
    );
  });

  it('defaults to false with no DB row and env unset (flag-off === V1)', async () => {
    const state = makeState('ac02-default');

    const enabled = await resolveAuctionV2Snapshot(state, 'ac02-default');

    expect(enabled).toBe(false);
    expect(state.auctionV2Enabled).toBe(false);
  });

  it('honors the env fallback tier (AUCTION_V2_ENABLED=true, no DB row)', async () => {
    process.env.AUCTION_V2_ENABLED = 'true';
    const state = makeState('ac02-env');

    const enabled = await resolveAuctionV2Snapshot(state, 'ac02-env');

    expect(enabled).toBe(true);
  });

  it('existing snapshot is never re-resolved (undefined guard)', async () => {
    flagDbRows.set('auctionV2Enabled', false);
    const state = makeState('ac02-guard', { auctionV2Enabled: true });

    const enabled = await resolveAuctionV2Snapshot(state, 'ac02-guard');

    expect(enabled).toBe(true);
    expect(state.auctionV2Enabled).toBe(true);
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] auction v2 flag snapshot',
      expect.anything(),
    );
  });
});

describe('auction phase-entry snapshot in transitionPhase (AC-02, AC-07 rollback)', () => {
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

  it('snapshots once at auction entry; a mid-session flag flip does not mutate the live session', async () => {
    flagDbRows.set('auctionV2Enabled', true);
    const state = makeState('auction-snap-on');
    await transition(state, 'auction');
    expect(state.currentPhase).toBe('auction');
    expect(state.auctionV2Enabled).toBe(true);

    // Ops flips the flag off mid-session — the snapshot is immutable.
    flagDbRows.set('auctionV2Enabled', false);
    vi.mocked(logger.info).mockClear();
    await transition(state, 'warmup');
    await transition(state, 'auction'); // re-entry: guard skips re-snapshot
    expect(state.auctionV2Enabled).toBe(true);
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] auction v2 flag snapshot',
      expect.anything(),
    );
  });

  it('snapshots false when the flag is off; a later flip-on does not upgrade the live session', async () => {
    const state = makeState('auction-snap-off');
    await transition(state, 'auction');
    expect(state.auctionV2Enabled).toBe(false);

    flagDbRows.set('auctionV2Enabled', true);
    await transition(state, 'warmup');
    await transition(state, 'auction');
    expect(state.auctionV2Enabled).toBe(false);
  });

  it('rollback: flag ON snapshot → flag OFF → the NEXT session resolves V1', async () => {
    flagDbRows.set('auctionV2Enabled', true);
    const sessionA = makeState('auction-rollback-a');
    await transition(sessionA, 'auction');
    expect(sessionA.auctionV2Enabled).toBe(true);

    flagDbRows.set('auctionV2Enabled', false);
    const sessionB = makeState('auction-rollback-b');
    await transition(sessionB, 'auction');
    expect(sessionB.auctionV2Enabled).toBe(false);
  });

  it('does not touch the snapshot on non-auction transitions', async () => {
    flagDbRows.set('auctionV2Enabled', true);
    const state = makeState('auction-snap-na');
    await transition(state, 'warmup');
    expect(state.auctionV2Enabled).toBeUndefined();
  });
});

// ─── AC-05: beats — kind mapping, state-free payload, rate limit ────────────

describe('auction group beats (AC-05)', () => {
  it('maps the new kinds onto the existing pattern vocabulary (wsEvents untouched)', () => {
    expect(GROUP_BEAT_KIND_PATTERN.auction_outbid).toBe('nudge');
    expect(GROUP_BEAT_KIND_PATTERN.auction_all_in).toBe('reveal');
  });

  it('beat payload stays state-free: pattern + nonce + sentAt only', () => {
    const message = buildSocialGroupBeatMessage('ice-1', 'auction_outbid', 1234);
    expect(message.type).toBe('SOCIAL_GROUP_BEAT');
    const data = message.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['nonce', 'pattern', 'sentAt', 'sessionId']);
    expect(data.pattern).toBe('nudge');
    expect(data).not.toHaveProperty('targetUserId');
    expect(data).not.toHaveProperty('amount');
  });

  it('rate-limits outbid beats to one per session per 5s window', async () => {
    flagDbRows.set('icebreakerGroupBeatsEnabled', true);

    const first = await emitAuctionOutbidBeatRateLimited('ice-rl', 10_000);
    const second = await emitAuctionOutbidBeatRateLimited('ice-rl', 10_000 + AUCTION_OUTBID_BEAT_MIN_INTERVAL_MS - 1);
    const third = await emitAuctionOutbidBeatRateLimited('ice-rl', 10_000 + AUCTION_OUTBID_BEAT_MIN_INTERVAL_MS);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(true);
  });

  it('rate-limit windows are per-session', async () => {
    flagDbRows.set('icebreakerGroupBeatsEnabled', true);

    const a = await emitAuctionOutbidBeatRateLimited('ice-a', 50_000);
    const b = await emitAuctionOutbidBeatRateLimited('ice-b', 50_000);

    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('beats flag off → no emission even inside the rate-limit window', async () => {
    // icebreakerGroupBeatsEnabled defaults false (no DB row, env unset).
    const emitted = await emitAuctionOutbidBeatRateLimited('ice-dark', 70_000);
    expect(emitted).toBe(false);
  });
});

// ─── AC-07: per-snapshot prompt version (verifier M1) ───────────────────────

describe('per-snapshot prompt version resolution (AC-07, verifier M1)', () => {
  it('snapshot ON → v3; OFF/undefined → legacy v2', () => {
    expect(resolveAuctionLotsPromptVersion(true)).toBe('social-auction-lots-v3');
    expect(resolveAuctionLotsPromptVersion(false)).toBe('social-auction-lots-v2');
    expect(resolveAuctionLotsPromptVersion(undefined)).toBe('social-auction-lots-v2');
    expect(AUCTION_LOTS_PROMPT_VERSION).toBe('social-auction-lots-v2');
    expect(AUCTION_LOTS_PROMPT_VERSION_V3).toBe('social-auction-lots-v3');
  });

  it('v2 prompt is byte-shaped (legacy markers, no v3 markers) without new args', () => {
    const prompt = buildAuctionLotsPrompt({ participantCount: 4 });
    expect(prompt).toContain('生成 3 到 5 条竞拍品');
    expect(prompt).not.toContain('必须生成且只生成');
    expect(prompt).not.toContain('深聊');
  });

  it('v3 prompt carries the exact target count and vibe guidance', () => {
    const chat = buildAuctionLotsPrompt({ participantCount: 4, targetLotCount: 3, vibe: 'chat' });
    expect(chat).toContain('必须生成且只生成 3 条竞拍品');
    expect(chat).toContain('深聊');
    expect(chat).not.toContain('生成 3 到 5 条竞拍品');

    const game = buildAuctionLotsPrompt({ participantCount: 6, targetLotCount: 5, vibe: 'game' });
    expect(game).toContain('必须生成且只生成 5 条竞拍品');
    expect(game).toContain('暢玩');
  });
});

// ─── AC-07: canonical fallback bank (verifier M4) ───────────────────────────

describe('canonical auction fallback bank (AC-07, verifier M4)', () => {
  it('holds 12 items in the spec category split (分享×5 / 表演×4 / 共创×3)', () => {
    expect(AUCTION_FALLBACK_BANK).toHaveLength(12);
    const byCategory = (c: string) => AUCTION_FALLBACK_BANK.filter((l) => l.category === c).length;
    expect(byCategory('share')).toBe(5);
    expect(byCategory('perform')).toBe(4);
    expect(byCategory('co-create')).toBe(3);
  });

  it('selection is deterministic per sessionId (re-entry stability)', () => {
    const a1 = selectAuctionFallbackLots({ count: 3, sessionId: 'sess-alpha' });
    const a2 = selectAuctionFallbackLots({ count: 3, sessionId: 'sess-alpha' });
    expect(a1.map((l) => l.id)).toEqual(a2.map((l) => l.id));
  });

  it('rotation varies across sessions (not all sessions see the same subset)', () => {
    const subsets = new Set(
      Array.from({ length: 20 }, (_, i) =>
        selectAuctionFallbackLots({ count: 3, sessionId: `sess-${i}` })
          .map((l) => l.id)
          .join(','),
      ),
    );
    expect(subsets.size).toBeGreaterThan(1);
  });

  it('vibe filter narrows to vibe-tagged lots and always satisfies the count', () => {
    const chatLots = selectAuctionFallbackLots({ count: 3, vibe: 'chat', sessionId: 'vibe-1' });
    expect(chatLots).toHaveLength(3);
    for (const lot of chatLots) expect(lot.vibes).toContain('chat');

    const gameLots = selectAuctionFallbackLots({ count: 4, vibe: 'game', sessionId: 'vibe-2' });
    expect(gameLots).toHaveLength(4); // 5 game-tagged lots ≥ count 4
    for (const lot of gameLots) expect(lot.vibes).toContain('game');
  });

  it('padAuctionLotsToTarget pads from the rotated subset without duplicates (verifier M2)', () => {
    const live = [
      { id: 'ai_1', title: 'AI 生成的条目一' },
      { id: 'ai_2', title: 'AI 生成的条目二' },
    ];
    const padded = padAuctionLotsToTarget(live, 4, { vibe: 'balanced', sessionId: 'pad-1' });
    expect(padded.paddedCount).toBe(2);
    expect(padded.lots).toHaveLength(4);
    const ids = padded.lots.map((l) => l.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.slice(0, 2)).toEqual(['ai_1', 'ai_2']);

    const alreadyFull = padAuctionLotsToTarget(live, 2, {});
    expect(alreadyFull.paddedCount).toBe(0);
    expect(alreadyFull.lots).toBe(live);
  });

  it('pregen worker fallback delegates to the canonical bank (verifier M4)', () => {
    const result = getFallbackForPhase('auction', {}) as { data: Array<{ id: string }> };
    const bankIds = new Set(AUCTION_FALLBACK_BANK.map((l) => l.id));
    expect(result.data.length).toBeGreaterThan(0);
    for (const lot of result.data) expect(bankIds.has(lot.id)).toBe(true);
  });
});

// ─── AC-07: generateAuctionLots service — disabled path version + bank ──────

describe('generateAuctionLots disabled path (AC-07, verifier M1)', () => {
  beforeEach(() => {
    process.env.SOCIAL_AUCTION_LLM_ENABLED = 'false';
  });

  it('flag OFF → legacy 3-item bank + v2 promptVersion (byte-preserved)', async () => {
    const result = await generateAuctionLots({ participantCount: 4 });
    expect(result.meta.promptVersion).toBe('social-auction-lots-v2');
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.data.map((l) => l.id)).toEqual(['lot_fb_1', 'lot_fb_2', 'lot_fb_3']);
    expect(result.data[0].title).toBe('分享一个无伤大雅的社死瞬间');
    expect(result.meta.aigc?.aiGenerated).toBe(false);
  });

  it('flag ON → canonical bank at the clamp target + v3 promptVersion', async () => {
    const result = await generateAuctionLots({
      participantCount: 5,
      auctionV2: true,
      targetLotCount: 4,
      vibe: 'chat',
      sessionId: 'svc-disabled-v2',
    });
    expect(result.meta.promptVersion).toBe('social-auction-lots-v3');
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.data).toHaveLength(4);
    expect(result.meta.aigc?.aiGenerated).toBe(false);
    // Deterministic rotation: same session seed → same subset.
    const again = await generateAuctionLots({
      participantCount: 5,
      auctionV2: true,
      targetLotCount: 4,
      vibe: 'chat',
      sessionId: 'svc-disabled-v2',
    });
    expect(again.data.map((l) => l.id)).toEqual(result.data.map((l) => l.id));
  });
});

// ─── AC-07: generateAuctionLots live path — M2 shortfall padding ────────────

describe('generateAuctionLots live path padding (AC-07, verifier M2)', () => {
  function mockLiveClient(titles: string[]) {
    getClientForFunctionMock.mockReturnValue({
      client: {
        chat: {
          completions: {
            create: vi.fn(async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      lots: titles.map((title, i) => ({ id: `ai_${i + 1}`, title, teaser: 't' })),
                    }),
                  },
                },
              ],
            })),
          },
        },
      },
      model: 'test-model',
      provider: 'deepseek',
    });
  }

  it('2-lot LLM response at a 4-lot target pads 2 from the bank (fallbackUsed + paddedCount)', async () => {
    mockLiveClient(['AI 条目甲', 'AI 条目乙']);
    const result = await generateAuctionLots({
      participantCount: 5,
      auctionV2: true,
      targetLotCount: 4,
      vibe: 'balanced',
      sessionId: 'pad-live-1',
    });

    expect(result.data).toHaveLength(4);
    expect(result.data.slice(0, 2).map((l) => l.title)).toEqual(['AI 条目甲', 'AI 条目乙']);
    expect(result.data.slice(2).every((l) => AUCTION_FALLBACK_BANK.some((b) => b.id === l.id))).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.paddedCount).toBe(2);
    expect(result.meta.promptVersion).toBe('social-auction-lots-v3');
    // Mixed live+curated content → AIGC badge fails closed.
    expect(result.meta.aigc?.aiGenerated).toBe(false);
  });

  it('full-count LLM response is not marked as fallback and carries no paddedCount', async () => {
    mockLiveClient(['AI 一', 'AI 二', 'AI 三']);
    const result = await generateAuctionLots({
      participantCount: 4,
      auctionV2: true,
      targetLotCount: 3,
      vibe: 'game',
      sessionId: 'pad-live-2',
    });

    expect(result.data).toHaveLength(3);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.paddedCount).toBeUndefined();
    expect(result.meta.aigc?.aiGenerated).toBe(true);
  });

  it('flag OFF live path never pads (legacy semantics)', async () => {
    mockLiveClient(['AI 一', 'AI 二']);
    const result = await generateAuctionLots({ participantCount: 4 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.paddedCount).toBeUndefined();
    expect(result.meta.promptVersion).toBe('social-auction-lots-v2');
  });
});

// ─── AC-06: award recap lines builder ───────────────────────────────────────

describe('buildAuctionAwardRecapLines (AC-06)', () => {
  const nameOf = (uid: string) => `名字-${uid}`;
  const lot = (over: Partial<AuctionLotResult>): AuctionLotResult => ({
    lotIndex: 0,
    lotId: 'lot-1',
    title: '条目标题',
    winnerUserId: null,
    winningAmount: null,
    bidCount: 0,
    wasAllIn: false,
    ...over,
  });

  it('all-unsold auction yields no award lines', () => {
    expect(buildAuctionAwardRecapLines([lot({ lotIndex: 0 }), lot({ lotIndex: 1, lotId: 'lot-2' })], nameOf)).toEqual([]);
  });

  it('single sold lot awards 最敢花 + 捡漏王 (praise variant) + 全场最热', () => {
    const lines = buildAuctionAwardRecapLines(
      [
        lot({ lotIndex: 0, winnerUserId: 'u1', winningAmount: 40, bidCount: 3, title: '热卖条目' }),
        lot({ lotIndex: 1, lotId: 'lot-2', title: '冷门条目' }),
      ],
      nameOf,
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('今晚最敢花：名字-u1，40 币拿下《热卖条目》');
    expect(lines[1]).toBe('捡漏王：名字-u1 眼光独到，40 币拿下《热卖条目》');
    expect(lines[2]).toBe('全场最热：《热卖条目》共 3 次出价');
  });

  it('multi-winner auction picks max/min成交价 and earliest tie on 最热', () => {
    const lines = buildAuctionAwardRecapLines(
      [
        lot({ lotIndex: 0, winnerUserId: 'u1', winningAmount: 25, bidCount: 4, title: 'A' }),
        lot({ lotIndex: 1, lotId: 'lot-2', winnerUserId: 'u2', winningAmount: 80, bidCount: 4, title: 'B' }),
        lot({ lotIndex: 2, lotId: 'lot-3', winnerUserId: 'u3', winningAmount: 15, bidCount: 1, title: 'C' }),
      ],
      nameOf,
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('今晚最敢花：名字-u2，80 币拿下《B》');
    expect(lines[1]).toContain('捡漏王：名字-u3 仅用 15 币拿下《C》');
    // Tie 4=4 → earliest lot (A) wins.
    expect(lines[2]).toBe('全场最热：《A》共 4 次出价');
  });

  it('skips 全场最热 when every lot had zero bids but some still sold (defensive)', () => {
    const lines = buildAuctionAwardRecapLines(
      [lot({ lotIndex: 0, winnerUserId: 'u1', winningAmount: 30, bidCount: 0, title: 'A' })],
      nameOf,
    );
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => !l.startsWith('全场最热'))).toBe(true);
  });

  it('caps at 3 lines × ≤120 chars', () => {
    const longTitle = '长'.repeat(100);
    const lines = buildAuctionAwardRecapLines(
      [lot({ lotIndex: 0, winnerUserId: 'u1', winningAmount: 50, bidCount: 9, title: longTitle })],
      (uid) => 'x'.repeat(40) + uid,
    );
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(120);
  });
});

// ─── AC-14: analytics whitelist source scan ─────────────────────────────────

describe('auction analytics whitelist (AC-14)', () => {
  it('whitelists all five auction events', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../routes/domains/analytics.ts'),
      'utf8',
    );
    for (const event of [
      'auction_bid_placed',
      'auction_outbid_notified',
      'auction_all_in_fired',
      'auction_finale_viewed',
      'auction_award_revealed',
    ]) {
      expect(source).toContain(`"${event}"`);
    }
  });
});

// ─── AC-16: copy compliance scan ────────────────────────────────────────────

describe('auction V2 copy compliance (AC-16, spec D7)', () => {
  const BLACKLIST = copyModule.AUCTION_GAMBLING_VOCAB_BLACKLIST;

  function allCopyStrings(): string[] {
    return [
      copyModule.getAuctionOutbidToast('小明', 35),
      copyModule.AUCTION_ALL_IN_BADGE,
      copyModule.AUCTION_ALL_IN_FALLBACK_LABEL,
      copyModule.getAuctionHostAllInHint('小明'),
      copyModule.AUCTION_LOW_BALANCE_HINT,
      copyModule.getAuctionCollectionHint(2),
      copyModule.getAuctionUnsoldLotLine('某条目'),
      ...Object.values(copyModule.AUCTION_AWARD_NAMES),
      copyModule.getAuctionBiggestSpenderLine('小明', 80, '某条目'),
      copyModule.getAuctionBargainHunterLine('小明', 15, '某条目', false),
      copyModule.getAuctionBargainHunterLine('小明', 15, '某条目', true),
      copyModule.getAuctionHottestLotLine('某条目', 5),
      ...AUCTION_FALLBACK_BANK.flatMap((l) => [l.title, l.teaser ?? '']),
    ];
  }

  it('no string contains a gambling-vocab blacklist word', () => {
    for (const text of allCopyStrings()) {
      for (const banned of BLACKLIST) {
        expect(text.includes(banned)).toBe(false);
      }
    }
  });

  it('「全押」never co-appears with 赌/赢 in any copy string', () => {
    for (const text of allCopyStrings()) {
      if (text.includes('全押')) {
        expect(text).not.toContain('赌');
        expect(text).not.toContain('赢');
      }
    }
  });

  it('documents the 「全力一击」 fallback label (spec R-D hot-swap)', () => {
    expect(copyModule.AUCTION_ALL_IN_FALLBACK_LABEL).toBe('全力一击');
  });

  it('never analogizes coins to real-world value', () => {
    for (const text of allCopyStrings()) {
      for (const banned of ['充值', '购买', '兑换', '提现', '奖金', '现金', '人民币', '奶茶']) {
        expect(text.includes(banned)).toBe(false);
      }
    }
  });
});

// ─── AC-01 (N1): admin PUT→GET round-trip ───────────────────────────────────

describe('admin feature-flag round-trip for auctionV2Enabled (AC-01, N1)', () => {
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
      const put = await fetch(`${baseUrl}/api/admin/feature-flags/auctionV2Enabled`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'true', description: 'Auction V2 staged rollout' }),
      });
      expect(put.status).toBe(200);
      const putBody = (await put.json()) as { key: string; value: string; updated: boolean };
      expect(putBody).toEqual({ key: 'auctionV2Enabled', value: 'true', updated: true });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FEATURE_FLAG_UPDATED',
          targetEntityType: 'feature_flag',
          targetEntityId: 'auctionV2Enabled',
        }),
      );

      const get = await fetch(`${baseUrl}/api/admin/feature-flags`);
      expect(get.status).toBe(200);
      const { flags } = (await get.json()) as {
        flags: Array<{ key: string; value: boolean; source: string }>;
      };
      const entry = flags.find((f) => f.key === 'auctionV2Enabled');
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
