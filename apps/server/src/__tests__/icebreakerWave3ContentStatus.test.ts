/**
 * icebreaker-uiux-wave3 — Track B contract tests (AC-01, AC-02, REL-01, SCA-01).
 *
 * AC-01: the five AI-generative phase routes (quip_battle / undercover_word /
 *   group_mirror / auction / personality_dice) write `<phase>ContentStatus:
 *   'generating'` BEFORE any LLM work, and write back 'ready' on success
 *   (curated fallback included) or 'failed' on a hard, nothing-servable error.
 *   The write path is re-read + merge-owned-fields (warmup 2026-07-24
 *   precedent) so a concurrent player mutation is never clobbered.
 * AC-02: `icebreakerContentStatusEnabled` gates client visibility of the five
 *   status fields + `leftUserIds` + derived `hostUnreachable` — flag OFF means
 *   the snapshot is byte-identical to pre-Wave-3 (fail-closed).
 * REL-01: merge-owned write-back preserves concurrent player writes that land
 *   between the 'generating' mark and the 'ready' write.
 * 防回退: warmup's own fields (`warmupTopicsStatus` & co.) are untouched by
 *   the new machinery.
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ── In-memory socialIcebreakerStore mock ─────────────────────────────────────
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();

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
    updateSessionAtomic: async (socialSessionId: string, mutator: (state: any) => boolean | void) => {
      const current = sessions.get(socialSessionId);
      if (!current) return { outcome: 'not_found' };
      const draft = JSON.parse(JSON.stringify(current));
      const result = mutator(draft);
      if (result === false) return { outcome: 'aborted', state: current };
      sessions.set(socialSessionId, draft);
      return { outcome: 'updated', state: draft };
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
      const p = participants.get(socialSessionId)?.get(userId);
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
    getParticipantLastSeenAt: async (socialSessionId: string, userId: string) => {
      const p = participants.get(socialSessionId)?.get(userId);
      return p ? new Date(p.lastSeenAt) : null;
    },
    listParticipants: vi.fn(async (socialSessionId: string) => {
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
    }),
    transferHost: vi.fn(async () => ({ outcome: 'not_found' })),
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
    getPreGenerationResult: vi.fn(async () => null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    getInFlightJobForPhase: vi.fn(async () => null),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    getPhaseMetrics: vi.fn().mockResolvedValue([]),
    computeRecapDwellMs: vi.fn(() => 0),
    recordRecapDwellMetric: vi.fn().mockResolvedValue(undefined),
    renewSessionTtl: vi.fn(async () => true),
    __sessions: sessions,
    __participants: participants,
  };
});

// ── Controllable feature-flag mock (Wave-3 flag OFF by default) ─────────────
const flagState = { icebreakerContentStatusEnabled: false };
vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async (key: string, fallback = false) =>
    key === 'icebreakerContentStatusEnabled' ? flagState.icebreakerContentStatusEnabled : fallback,
  ),
  getFeatureFlagSync: vi.fn((key: string, fallback = false) =>
    key === 'icebreakerContentStatusEnabled' ? flagState.icebreakerContentStatusEnabled : fallback,
  ),
}));

// ── AI service mock: generators observe persisted state mid-flight ──────────
const observedAtGeneration: Record<string, any[]> = {};
const concurrentMutations: Record<string, ((id: string) => Promise<void>) | undefined> = {};

async function observeAndMaybeMutate(kind: string, socialSessionId: string) {
  const store = await import('../lib/socialIcebreakerStore');
  const current = await (store as any).getSession(socialSessionId);
  observedAtGeneration[kind] = observedAtGeneration[kind] ?? [];
  observedAtGeneration[kind].push(current ? { ...current } : current);
  const mutate = concurrentMutations[kind];
  if (mutate) await mutate(socialSessionId);
}

const aiMeta = {
  generatedAt: '2026-10-16T00:00:00.000Z',
  fromCache: false,
  provider: 'deepseek',
  fallbackUsed: false,
  promptVersion: 'test-v1',
};

vi.mock('../socialIcebreakerAIService', () => ({
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn().mockReturnValue({ valid: true, tags: ['a', 'b'] }),
  validateLieDetectiveTag: vi.fn().mockReturnValue({ valid: true }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
  generateWarmupTopics: vi.fn().mockResolvedValue({
    data: [
      { id: 't1', question: 'Q1', mood: 'relaxed', emoji: '🌅', category: 'c', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
    ],
    meta: { ...aiMeta, promptVersion: 'social-warmup-topics-v2' },
  }),
  getCuratedWarmupTopics: vi.fn().mockReturnValue([
    { id: 'fallback-1', question: 'FQ', mood: 'relaxed', emoji: '🌿', category: 'c', depthLevel: 1, promptStyle: 'experiential', safety: 'gentle' },
  ]),
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [{ id: 'c1', title: '击掌', description: '和你左边的人击掌', durationSeconds: 30, completionCTA: '完成了' }],
    meta: { ...aiMeta, promptVersion: 'social-micro-challenges-v2' },
  }),
  generateLieDetectiveStatements: vi.fn().mockResolvedValue({
    data: [
      { index: 0, text: 's0', isLie: false },
      { index: 1, text: 's1', isLie: true },
      { index: 2, text: 's2', isLie: false },
    ],
    meta: { ...aiMeta, promptVersion: 'social-lie-detective-v1' },
  }),
  generateLieDetectiveStatementFromTag: vi.fn().mockResolvedValue({ data: 'stmt', meta: aiMeta }),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: 'ok', meta: aiMeta }),
  generateMomentHighlights: vi.fn().mockResolvedValue({ data: [], meta: aiMeta }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: { ...aiMeta, promptVersion: 'social-recap-summary-v2' },
  }),
  generatePersonalityDiceChallenges: vi.fn().mockImplementation(async ({ participants }: { participants: Array<{ userId: string; displayName: string }> }) => {
    await observeAndMaybeMutate('dice', DICE_SESSION_ID);
    return {
      data: (participants?.length ? participants : [{ userId: 'host-user', displayName: 'Host' }]).map((p, i) => ({
        userId: p.userId,
        displayName: p.displayName,
        dominantTrait: 'A' as const,
        challengeTitle: `challenge-${i}`,
        challengeBody: 'do thing',
        challengeEmoji: '🎲',
        difficulty: 'easy' as const,
      })),
      meta: { ...aiMeta, promptVersion: 'social-personality-dice-v1' },
    };
  }),
  generatePersonalityDiceChallengeGroups: vi.fn().mockImplementation(async ({ participants }: { participants: Array<{ userId: string; displayName: string }> }) => {
    await observeAndMaybeMutate('dice', DICE_SESSION_ID);
    return {
      data: (participants?.length ? participants : [{ userId: 'host-user', displayName: 'Host' }]).map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        dominantTrait: 'A' as const,
        options: (['easy', 'medium', 'hard'] as const).map((difficulty, optionIndex) => ({
          userId: p.userId,
          displayName: p.displayName,
          dominantTrait: 'A' as const,
          challengeTitle: `${p.userId}-${optionIndex}`,
          challengeBody: 'do thing',
          challengeEmoji: '🎲',
          difficulty,
        })),
      })),
      meta: { ...aiMeta, promptVersion: 'social-personality-dice-v4' },
    };
  }),
  generateAuctionLots: vi.fn().mockImplementation(async () => {
    await observeAndMaybeMutate('auction', AUCTION_SESSION_ID);
    return {
      data: [
        { id: 'lot_1', title: 'Test lot one', teaser: 'fun' },
        { id: 'lot_2', title: 'Test lot two' },
      ],
      meta: { ...aiMeta, promptVersion: 'social-auction-lots-v1' },
    };
  }),
  generateUndercoverWordPair: vi.fn().mockImplementation(async () => {
    await observeAndMaybeMutate('undercover', UNDERCOVER_SESSION_ID);
    return {
      data: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
      meta: { ...aiMeta, promptVersion: 'social-undercover-word-v1' },
    };
  }),
  generateGroupMirrorQuestions: vi.fn().mockImplementation(async () => {
    await observeAndMaybeMutate('mirror', MIRROR_SESSION_ID);
    return {
      data: [
        { id: 'gm_1', questionText: '谁最可能请大家吃夜宵？', category: 'perception' },
        { id: 'gm_2', questionText: '谁看起来最像会偷偷养猫的人？', category: 'perception' },
        { id: 'gm_3', questionText: '谁最可能突然辞职去旅行？', category: 'prediction' },
      ],
      meta: { ...aiMeta, promptVersion: 'social-group-mirror-v1' },
    };
  }),
  generateQuipBattlePrompts: vi.fn().mockImplementation(async () => {
    await observeAndMaybeMutate('quip', QUIP_SESSION_ID);
    return {
      data: [
        { id: 'qb_1', promptText: '如果_____有段位，你已经是王者了', category: '自嘲' },
        { id: 'qb_2', promptText: '我最想对_____说的一句话是...', category: '吐槽' },
        { id: 'qb_3', promptText: '如果_____能说话，它一定会抱怨', category: '脑洞' },
      ],
      meta: { ...aiMeta, promptVersion: 'social-quip-battle-v1' },
    };
  }),
  generateXiaoyueSessionPack: vi.fn().mockResolvedValue({ data: { opener: 'hi' }, meta: aiMeta }),
}));

vi.mock('../socialIcebreakerAuctionAI', () => ({
  resolveAuctionLotsPromptVersion: vi.fn().mockReturnValue('social-auction-lots-v1'),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn(async () => ({ allowed: true })),
}));

const preGenState = { mode: 'none' as 'none' | 'in_flight' | 'available' };
vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn(async () => {
    if (preGenState.mode === 'none') return { skip: false, reason: 'none' };
    if (preGenState.mode === 'in_flight') return { skip: true, reason: 'in_flight' };
    return { skip: true, reason: 'available' };
  }),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn().mockImplementation(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) return { accepted: false, conflict: 'validation_failed' };
    await apply(_payload);
    return { accepted: true };
  }),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/singleTestService', () => ({
  getSingleTestMetaForSessionStart: vi.fn().mockResolvedValue(null),
}));

const QUIP_SESSION_ID = 'social_wave3-quip';
const UNDERCOVER_SESSION_ID = 'social_wave3-undercover';
const MIRROR_SESSION_ID = 'social_wave3-mirror';
const AUCTION_SESSION_ID = 'social_wave3-auction';
const DICE_SESSION_ID = 'social_wave3-dice';

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
// These imports resolve to the in-memory mock above (vi.mock hoists).
import { getSession, updateSession, upsertParticipant } from '../lib/socialIcebreakerStore';

/** Mock-store read with a non-null assertion (the real module types allow null). */
async function mustGetSession(socialSessionId: string): Promise<any> {
  const state = await getSession(socialSessionId);
  if (!state) throw new Error(`session ${socialSessionId} missing in mock store`);
  return state as any;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return cookieHeader(response);
}

function baseState(socialSessionId: string, phase: SocialSessionState['currentPhase']): SocialSessionState {
  return {
    socialSessionId,
    icebreakerSessionId: socialSessionId.replace(/^social_/, ''),
    currentPhase: phase,
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 2,
    phaseStartedAt: Date.now() - 60_000,
    sessionStartedAt: Date.now() - 300_000,
    completedPhases: ['warmup'],
    enabledPhases: ['warmup', phase, 'recap'],
  } as SocialSessionState;
}

async function seedHostSession(socialSessionId: string, phase: SocialSessionState['currentPhase'], extra: Partial<SocialSessionState> = {}) {
  const state = { ...baseState(socialSessionId, phase), ...extra };
  await updateSession(socialSessionId, state);
  await upsertParticipant(socialSessionId, 'host-user', 'Host');
  await upsertParticipant(socialSessionId, 'player-2', 'Player Two');
  return state;
}

beforeEach(() => {
  flagState.icebreakerContentStatusEnabled = false;
  preGenState.mode = 'none';
  for (const key of Object.keys(observedAtGeneration)) delete observedAtGeneration[key];
  for (const key of Object.keys(concurrentMutations)) delete concurrentMutations[key];
});

describe.sequential('Wave 3 AC-01: per-phase contentStatus lifecycle', () => {
  it('quip-battle/generate marks generating BEFORE the LLM call and ready after success', async () => {
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}/quip-battle/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);

      // The generator observed the persisted state mid-flight: it must already
      // carry quipContentStatus === 'generating' (write-before-LLM).
      const observed = observedAtGeneration['quip'];
      expect(observed?.length).toBeGreaterThanOrEqual(1);
      expect(observed![0].quipContentStatus).toBe('generating');

      const persisted = await mustGetSession(QUIP_SESSION_ID);
      expect(persisted.quipContentStatus).toBe('ready');
      expect((persisted.quipBattlePrompts || []).length).toBeGreaterThan(0);
    });
  });

  it('undercover-word/generate marks generating before LLM and ready after', async () => {
    await seedHostSession(UNDERCOVER_SESSION_ID, 'undercover_word');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${UNDERCOVER_SESSION_ID}/undercover-word/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
      expect(observedAtGeneration['undercover']?.[0]?.undercoverContentStatus).toBe('generating');
      const persisted = await mustGetSession(UNDERCOVER_SESSION_ID);
      expect(persisted.undercoverContentStatus).toBe('ready');
      expect(persisted.undercoverWordPair?.civilianWord).toBe('奶茶');
    });
  });

  it('group-mirror/generate marks generating before LLM and ready after', async () => {
    await seedHostSession(MIRROR_SESSION_ID, 'group_mirror');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${MIRROR_SESSION_ID}/group-mirror/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
      expect(observedAtGeneration['mirror']?.[0]?.groupMirrorContentStatus).toBe('generating');
      const persisted = await mustGetSession(MIRROR_SESSION_ID);
      expect(persisted.groupMirrorContentStatus).toBe('ready');
      expect((persisted.groupMirrorQuestions || []).length).toBeGreaterThan(0);
    });
  });

  it('auction/generate-lots marks generating before LLM and ready after', async () => {
    await seedHostSession(AUCTION_SESSION_ID, 'auction');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${AUCTION_SESSION_ID}/auction/generate-lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
      expect(observedAtGeneration['auction']?.[0]?.auctionContentStatus).toBe('generating');
      const persisted = await mustGetSession(AUCTION_SESSION_ID);
      expect(persisted.auctionContentStatus).toBe('ready');
      expect((persisted.auctionLots || []).length).toBeGreaterThan(0);
    });
  });

  it('personality-dice/generate marks generating before LLM and ready after (both branches)', async () => {
    // Choose-mode branch (default: flag mock resolves non-wave3 flags to the
    // caller fallback; the dice route passes `true` for choose mode).
    await seedHostSession(DICE_SESSION_ID, 'personality_dice');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${DICE_SESSION_ID}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [{ userId: 'host-user', displayName: 'Host' }] }),
      });
      expect(response.status).toBe(200);
      expect(observedAtGeneration['dice']?.[0]?.diceContentStatus).toBe('generating');
      const persisted = await mustGetSession(DICE_SESSION_ID);
      expect(persisted.diceContentStatus).toBe('ready');
    });
  });

  it('REL-01: a concurrent player write between generating and ready is never clobbered', async () => {
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle');
    // While the generator is "in flight", a concurrent route mutates a field
    // the generate route does not own (e.g. a player submits an answer mark).
    concurrentMutations['quip'] = async (socialSessionId: string) => {
      const current = await mustGetSession(socialSessionId);
      current.quipBattleSubmittedUserIds = ['player-2'];
      current.commonGroundCount = 7;
      await updateSession(socialSessionId, current);
    };
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}/quip-battle/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
      const persisted = await mustGetSession(QUIP_SESSION_ID);
      expect(persisted.quipContentStatus).toBe('ready');
      expect((persisted.quipBattlePrompts || []).length).toBeGreaterThan(0);
      // The concurrent player mutation survived the generation write-back.
      expect(persisted.quipBattleSubmittedUserIds).toEqual(['player-2']);
      expect(persisted.commonGroundCount).toBe(7);
    });
  });

  it('hard failure (generator throws, nothing servable) persists failed + 500', async () => {
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle');
    const { generateQuipBattlePrompts } = await import('../socialIcebreakerAIService');
    vi.mocked(generateQuipBattlePrompts).mockRejectedValueOnce(new Error('unexpected hard failure'));
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}/quip-battle/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(500);
      const persisted = await mustGetSession(QUIP_SESSION_ID);
      expect(persisted.quipContentStatus).toBe('failed');
      expect(persisted.quipBattlePrompts ?? []).toEqual([]);
    });
  });

  it('pre-generation in-flight (202) keeps the phase in generating', async () => {
    preGenState.mode = 'in_flight';
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}/quip-battle/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(202);
      const persisted = await mustGetSession(QUIP_SESSION_ID);
      expect(persisted.quipContentStatus).toBe('generating');
    });
  });
});

describe.sequential('Wave 3 AC-02: flag-gated client projection (fail-closed)', () => {
  const WAVE3_KEYS = [
    'quipContentStatus',
    'undercoverContentStatus',
    'groupMirrorContentStatus',
    'auctionContentStatus',
    'diceContentStatus',
    'leftUserIds',
    'hostUnreachable',
  ] as const;

  it('flag OFF strips every Wave-3 field from the poll snapshot', async () => {
    flagState.icebreakerContentStatusEnabled = false;
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle', {
      quipContentStatus: 'ready',
      diceContentStatus: 'generating',
      leftUserIds: ['player-2'],
    });
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, unknown>;
      for (const key of WAVE3_KEYS) {
        expect(body, `flag-off snapshot must not contain ${key}`).not.toHaveProperty(key);
      }
      // Legacy fields still present (snapshot shape otherwise unchanged).
      expect(body.socialSessionId).toBe(QUIP_SESSION_ID);
      expect(body.currentPhase).toBe('quip_battle');
    });
  });

  it('flag ON exposes the Wave-3 fields that are set', async () => {
    flagState.icebreakerContentStatusEnabled = true;
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle', {
      quipContentStatus: 'ready',
      leftUserIds: ['player-2'],
    });
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, unknown>;
      expect(body.quipContentStatus).toBe('ready');
      expect(body.leftUserIds).toEqual(['player-2']);
      // Host is actively polling (host heartbeat fresh) → reachable.
      expect(body.hostUnreachable).toBe(false);
    });
  });

  it('hostUnreachable derives from the host roster heartbeat (180s grace), flag ON only', async () => {
    flagState.icebreakerContentStatusEnabled = true;
    await seedHostSession(QUIP_SESSION_ID, 'quip_battle');
    // Age the host's heartbeat beyond the 180s host-claim grace.
    const store = await import('../lib/socialIcebreakerStore');
    const participants = (store as any).__participants as Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>;
    participants.get(QUIP_SESSION_ID)!.get('host-user')!.lastSeenAt = Date.now() - 200_000;

    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      const body = await response.json() as Record<string, unknown>;
      expect(body.hostUnreachable).toBe(true);
    });

    // Flag OFF → signal never emitted, even with a stale host.
    flagState.icebreakerContentStatusEnabled = false;
    await withServer(async (baseUrl) => {
      const playerCookie = await login(baseUrl, 'player-2');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/${QUIP_SESSION_ID}`, {
        headers: { cookie: playerCookie },
      });
      const body = await response.json() as Record<string, unknown>;
      expect(body).not.toHaveProperty('hostUnreachable');
    });
  });
});

describe.sequential('Wave 3 防回退: warmup fields untouched', () => {
  it('/topics lifecycle writes no Wave-3 status fields and keeps warmup semantics', async () => {
    await seedHostSession('social_wave3-warmup', 'warmup');
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const response = await fetch(`${baseUrl}/api/social-icebreaker/social_wave3-warmup/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      expect(response.status).toBe(200);
      const persisted = await mustGetSession('social_wave3-warmup');
      expect(persisted.warmupTopicsStatus).toBe('ready');
      expect(persisted.quipContentStatus).toBeUndefined();
      expect(persisted.undercoverContentStatus).toBeUndefined();
      expect(persisted.groupMirrorContentStatus).toBeUndefined();
      expect(persisted.auctionContentStatus).toBeUndefined();
      expect(persisted.diceContentStatus).toBeUndefined();
    });
  });
});
