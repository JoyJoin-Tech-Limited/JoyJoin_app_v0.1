/**
 * Highlights Injector DB flag + transitionPhase integration (sprint
 * wave3-highlightsInjector):
 *  - AC-01: flag registration contract (FLAG_ENV_MAP + DEFAULT_FLAG_VALUES)
 *  - AC-02/AC-13: resolveHighlightsInjectorSnapshot — session-start snapshot,
 *    immutability, rollback (flag ON snapshot → flag OFF → next session off)
 *  - AC-06: transitionPhase extraction — quip pre-cleanup, flag-gating,
 *    extractor-throw fail-open, M2 dual-write into preCleanupState on BOTH
 *    recap defer paths, M3 bonus-gate double-fire losslessness
 *  - AC-10: sanitizeStateForClient strips highlights + the flag snapshot
 *  - AC-11/RN2/RN3: extraction AITrace — success: true, counts/keys-only
 *    extras, one trace per CALL (bonus-gate pause pass included)
 *
 * The featureFlags module is partially mocked (real registries, stateful
 * in-memory DB rows) — same harness pattern as lieDetectiveV2Flag.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const { flagDbRows, testSessions, mockLogAITrace, mockGenerateRecapSummary } = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  testSessions: new Map<string, SocialSessionState>(),
  mockLogAITrace: vi.fn(),
  mockGenerateRecapSummary: vi.fn(async (_params: Record<string, unknown>) => ({
    data: { headline: 'h', moments: ['m'], closingLine: 'c' },
    meta: { promptVersion: 'test-recap', fallbackUsed: false, fromCache: false, provider: null, generatedAt: new Date().toISOString() },
  })),
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
  };
});

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

vi.mock('../lib/aiTraceLogger', () => ({
  createAiCorrelationId: () => 'test-trace-id',
  logAITrace: (...args: unknown[]) => mockLogAITrace(...args),
}));

vi.mock('../socialIcebreakerAIService', async (importActual) => {
  const actual = await importActual<typeof import('../socialIcebreakerAIService')>();
  return {
    ...actual,
    generateRecapSummary: mockGenerateRecapSummary,
    generateMicroChallenges: vi.fn(async () => ({
      data: [],
      meta: { promptVersion: 'test-micro', fallbackUsed: true, fromCache: false, provider: null, generatedAt: new Date().toISOString() },
    })),
  };
});

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import('../lib/featureFlags');
const {
  transitionPhase,
  resolveHighlightsInjectorSnapshot,
  sanitizeStateForClient,
  waitForDeferredRecapSnapshot,
} = await import('../routes/socialIcebreakerHelpers');

const ENV_KEYS = ['HIGHLIGHTS_INJECTOR_ENABLED'] as const;

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
    enabledPhases: ['warmup', 'quip_battle', 'lie_detective', 'mini_script', 'recap'],
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

function makeQuipState(id: string, overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return makeState(id, {
    currentPhase: 'quip_battle',
    completedPhases: ['warmup'],
    quipBattleResults: [
      {
        promptId: 'p1',
        promptText: '最离谱的一次经历',
        answers: [
          { userId: 'p1', displayName: 'SENTINEL_NAME_7f3', promptId: 'p1', answerText: '把老板的咖啡换成了酱油' },
        ],
        winnerUserId: 'p1',
        winnerDisplayName: 'SENTINEL_NAME_7f3',
        voteCount: 3,
      },
    ],
    ...overrides,
  });
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

describe('highlightsInjectorEnabled flag registration (AC-01)', () => {
  it('is DB-backed with the HIGHLIGHTS_INJECTOR_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.highlightsInjectorEnabled).toBe('HIGHLIGHTS_INJECTOR_ENABLED');
  });

  it('ships dark: explicit default false when neither DB row nor env var is set', () => {
    expect(DEFAULT_FLAG_VALUES.highlightsInjectorEnabled).toBe(false);
  });
});

// ─── AC-02/AC-13: session-start snapshot + rollback ─────────────────────────

describe('resolveHighlightsInjectorSnapshot (AC-02, AC-13)', () => {
  it('snapshots true when the flag is on and logs once per session', async () => {
    flagDbRows.set('highlightsInjectorEnabled', true);
    const state = makeState('snap-on');

    const enabled = await resolveHighlightsInjectorSnapshot(state, 'snap-on');

    expect(enabled).toBe(true);
    expect(state.highlightsInjectorEnabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      '[SocialIcebreaker] highlights injector snapshot',
      expect.objectContaining({ socialSessionId: 'snap-on', highlightsInjectorEnabled: true }),
    );
  });

  it('is immutable: a mid-session flip never re-resolves the live session (AC-02)', async () => {
    flagDbRows.set('highlightsInjectorEnabled', true);
    const state = makeState('snap-immutable');
    await resolveHighlightsInjectorSnapshot(state, 'snap-immutable');

    flagDbRows.set('highlightsInjectorEnabled', false);
    vi.mocked(logger.info).mockClear();
    const again = await resolveHighlightsInjectorSnapshot(state, 'snap-immutable');

    expect(again).toBe(true);
    expect(state.highlightsInjectorEnabled).toBe(true);
    expect(logger.info).not.toHaveBeenCalledWith(
      '[SocialIcebreaker] highlights injector snapshot',
      expect.anything(),
    );
  });

  it('rollback: flag ON snapshot → flag OFF → the NEXT session snapshots false (AC-13)', async () => {
    flagDbRows.set('highlightsInjectorEnabled', true);
    const first = makeState('rollback-1');
    await resolveHighlightsInjectorSnapshot(first, 'rollback-1');
    expect(first.highlightsInjectorEnabled).toBe(true);

    flagDbRows.set('highlightsInjectorEnabled', false);
    const second = makeState('rollback-2');
    await resolveHighlightsInjectorSnapshot(second, 'rollback-2');
    expect(second.highlightsInjectorEnabled).toBe(false);
  });

  it('consumes a caller-started in-flight read (parallelized /start pattern)', async () => {
    flagDbRows.set('highlightsInjectorEnabled', true);
    const state = makeState('snap-promise');
    const { getFeatureFlag } = await import('../lib/featureFlags');
    const pending = getFeatureFlag('highlightsInjectorEnabled', false);

    const enabled = await resolveHighlightsInjectorSnapshot(state, 'snap-promise', pending);

    expect(enabled).toBe(true);
    expect(state.highlightsInjectorEnabled).toBe(true);
  });
});

// ─── AC-06: transitionPhase extraction ──────────────────────────────────────

describe('transitionPhase highlights extraction (AC-06, AC-11)', () => {
  async function transition(
    state: SocialSessionState,
    targetPhase: SocialIcebreakerPhase,
    opts: { skipBonusGate?: boolean; deferRecapSnapshot?: boolean } = {},
  ) {
    testSessions.set(state.socialSessionId, state);
    return transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'host_tap',
      targetPhase,
      skipBonusGate: opts.skipBonusGate ?? true,
      deferRecapSnapshot: opts.deferRecapSnapshot,
    });
  }

  it('flag on: leaving quip_battle extracts the most-upvoted quip pre-cleanup + traces (RN2)', async () => {
    const state = makeQuipState('extract-quip', { highlightsInjectorEnabled: true });

    await transition(state, 'warmup');

    expect(state.highlights).toBe('金句「把老板的咖啡换成了酱油」获3票');
    // Privacy: the winner sentinel name never enters the body.
    expect(state.highlights).not.toContain('SENTINEL_NAME_7f3');
    // Cleanup wiped the source data but the section persists.
    expect(state.quipBattleResults).toBeUndefined();
    // AC-11/RN2: one extraction trace with success: true and counts/keys-only extras.
    expect(mockLogAITrace).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'highlightsExtractor',
        provider: null,
        latencyMs: 0,
        success: true,
        fallbackUsed: false,
        promptVersion: 'highlights-extractor-v1',
        extra: { sections: ['quip'], totalChars: state.highlights!.length },
      }),
    );
  });

  it('flag off (undefined): no extraction, no state write, no trace — byte-identical behavior', async () => {
    const state = makeQuipState('extract-off');

    await transition(state, 'warmup');

    expect(state.highlights).toBeUndefined();
    expect(mockLogAITrace).not.toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'highlightsExtractor' }),
    );
  });

  it('extractor throw fails open: transition proceeds, highlights untouched, warn logged', async () => {
    const state = makeQuipState('extract-throw', {
      highlightsInjectorEnabled: true,
      // Malformed: answers is a non-array truthy value → .find throws inside the extractor.
      quipBattleResults: [
        {
          promptId: 'p1',
          promptText: 't',
          answers: {} as unknown as Array<{ userId: string; displayName: string; promptId: string; answerText: string }>,
          winnerUserId: 'p1',
          winnerDisplayName: 'A',
          voteCount: 3,
        },
      ],
    });

    const result = await transition(state, 'warmup');

    expect(result.transitioned).toBe(true);
    expect(state.currentPhase).toBe('warmup');
    expect(state.highlights).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      '[SocialIcebreaker] highlights extraction failed; continuing without highlights',
      expect.objectContaining({ socialSessionId: 'extract-throw' }),
    );
  });

  it('M3/RN3: bonus-gate double-fire is lossless — pause-pass extraction survives gate resolution', async () => {
    const state = makeQuipState('extract-gate', {
      highlightsInjectorEnabled: true,
      enabledPhases: ['warmup', 'quip_battle', 'mini_script', 'recap'],
    });

    // Pass 1: quip_battle → mini_script pauses at the bonus gate. Extraction
    // already fired (pre-cleanup) even though the phase was not left.
    const paused = await transition(state, 'mini_script', { skipBonusGate: false });
    expect(paused.pausedAtBonusGate).toBe(true);
    expect(state.highlights).toBe('金句「把老板的咖啡换成了酱油」获3票');
    const tracesAfterPause = mockLogAITrace.mock.calls.filter(
      (c) => (c[0] as { feature?: string }).feature === 'highlightsExtractor',
    ).length;
    expect(tracesAfterPause).toBe(1);

    // Gate resolves: re-entry fires extraction again, but cleanup already
    // wiped the quip data — the replace-only-when-non-empty merge (M3) must
    // preserve the section and emit no second extraction write.
    state.bonusGateAccepted = true;
    const resumed = await transition(state, 'mini_script', { skipBonusGate: false });
    expect(resumed.transitioned).toBe(true);
    expect(state.highlights).toBe('金句「把老板的咖啡换成了酱油」获3票');
  });

  it('M2 dual-write: direct lie_detective→recap (inline path) feeds the section to the recap prompt', async () => {
    const state = makeState('dual-inline', {
      currentPhase: 'lie_detective',
      completedPhases: ['warmup', 'quip_battle'],
      highlightsInjectorEnabled: true,
      lieDetectiveRevealHistory: [{ round: 1, correctRate: 0.5 }],
    });

    await transition(state, 'recap'); // deferRecapSnapshot defaults to false → inline

    expect(state.highlights).toBe('测谎第1轮最胶着（正确率50%）');
    expect(mockGenerateRecapSummary).toHaveBeenCalledWith(
      expect.objectContaining({ highlights: '测谎第1轮最胶着（正确率50%）' }),
    );
  });

  it('M2 dual-write: direct lie_detective→recap (deferred path) feeds the section to the recap prompt', async () => {
    const state = makeState('dual-deferred', {
      currentPhase: 'lie_detective',
      completedPhases: ['warmup', 'quip_battle'],
      highlightsInjectorEnabled: true,
      lieDetectiveRevealHistory: [{ round: 1, correctRate: 0.5 }],
    });

    await transition(state, 'recap', { deferRecapSnapshot: true });
    await waitForDeferredRecapSnapshot('dual-deferred');

    expect(state.highlights).toBe('测谎第1轮最胶着（正确率50%）');
    expect(mockGenerateRecapSummary).toHaveBeenCalledWith(
      expect.objectContaining({ highlights: '测谎第1轮最胶着（正确率50%）' }),
    );
  });

  it('micro/dice phases contribute nothing — absence is normal, no trace', async () => {
    const state = makeState('extract-none', {
      currentPhase: 'micro_challenge',
      highlightsInjectorEnabled: true,
    });

    await transition(state, 'warmup');

    expect(state.highlights).toBeUndefined();
    expect(mockLogAITrace).not.toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'highlightsExtractor' }),
    );
  });
});

// ─── AC-10: client invisibility ─────────────────────────────────────────────

describe('sanitizeStateForClient strips highlights (AC-10)', () => {
  it('removes highlights + the flag snapshot for host and non-host alike', () => {
    const state = makeState('sanitize', {
      highlights: '金句「句」获3票',
      highlightsInjectorEnabled: true,
    });

    for (const requester of ['host-user', 'p1', undefined]) {
      const sanitized = sanitizeStateForClient(state, requester);
      expect('highlights' in sanitized).toBe(false);
      expect('highlightsInjectorEnabled' in sanitized).toBe(false);
    }
  });
});
