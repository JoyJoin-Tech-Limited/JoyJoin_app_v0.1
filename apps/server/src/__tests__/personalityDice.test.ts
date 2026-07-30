/**
 * Personality Dice Phase Tests
 *
 * Routes under test:
 *   POST /api/social-icebreaker/:socialSessionId/personality-dice/generate
 *   POST /api/social-icebreaker/:socialSessionId/personality-dice/complete
 */
import express from 'express';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWithServer } from '../test-utils/withServer';
import type { SocialSessionState, PersonalityDiceChallengeGroup } from '@shared/socialIcebreaker';
import { GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';

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
    createSession: async (st: SocialSessionState) => {
      sessions.set(st.socialSessionId, st);
    },
    updateSession: async (socialSessionId: string, st: SocialSessionState) => {
      sessions.set(socialSessionId, st);
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
    heartbeat: async (_sid: string, _uid: string) => {},
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
    getPreGenerationResult: vi.fn().mockResolvedValue(null),
    getInFlightJobForPhase: vi.fn().mockResolvedValue(null),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  generateXiaoYueComment: vi.fn().mockResolvedValue({ data: '', meta: {} }),
  generateRecapSummary: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generatePersonalityDiceChallengeGroups: vi.fn(),
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

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

vi.mock('@shared/archetypeColors', () => ({
  getArchetypeHSL: vi.fn((archetype?: string) => ({ h: 200, s: 80, l: 60 })),
}));

const seenOps = vi.hoisted(() => new Set<string>());

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn(async (payload: any, validate: () => Promise<boolean>, apply: () => Promise<void>) => {
    const seen = seenOps;
    if (seen.has(payload.operationId)) {
      return { accepted: true };
    }
    const valid = await validate();
    if (!valid) {
      return { accepted: false, conflict: 'validation_failed' };
    }
    await apply();
    seen.add(payload.operationId);
    return { accepted: true };
  }),
}));

vi.mock('../rateLimiter', () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
  momentCardLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../contentFilter', () => ({
  filterContent: (text: string) => text,
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');
const { generatePersonalityDiceChallenges, generatePersonalityDiceChallengeGroups } = await import('../socialIcebreakerAIService');
const { shouldSkipOnDemandGeneration } = await import('../jobs/preGenerationQueue');
const { getPreGenerationResult } = await import('../lib/socialIcebreakerStore');

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
  app.use('/api/social-icebreaker', socialIcebreakerRouter);
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

const mockChallenges = [
  {
    userId: 'host-user',
    displayName: 'Host',
    archetype: 'corgi',
    dominantTrait: 'A' as const,
    challengeTitle: '来段即兴Rap',
    challengeBody: '敢不敢用rap介绍一下今天的心情？',
    challengeEmoji: '🎤',
    difficulty: 'medium' as const,
    passLine: '我选择认怂',
    passConsequence: '请用三种语气说"我真棒"',
  },
  {
    userId: 'guest-1',
    displayName: 'Alice',
    archetype: 'rooster',
    dominantTrait: 'E' as const,
    challengeTitle: '30秒夸夸接力',
    challengeBody: '给你左边的人来一段30秒不重复的夸赞！',
    challengeEmoji: '☀️',
    difficulty: 'easy' as const,
    passLine: '这题我不会',
    passConsequence: '模仿一种动物叫三声',
  },
  {
    userId: 'guest-2',
    displayName: 'Bob',
    archetype: 'owl',
    dominantTrait: 'O' as const,
    challengeTitle: '灵魂三连问',
    challengeBody: '向在场每个人提一个你最好奇的问题',
    challengeEmoji: '🦉',
    difficulty: 'hard' as const,
    passLine: '我不玩了',
    passConsequence: '用方言说一段绕口令',
  },
  {
    userId: 'guest-3',
    displayName: 'Carol',
    archetype: 'fox',
    dominantTrait: 'X' as const,
    challengeTitle: '侦探观察力',
    challengeBody: '说出在场每个人今天身上的一处细节',
    challengeEmoji: '🦊',
    difficulty: 'medium' as const,
    passLine: '放过我吧',
    passConsequence: '给每人写一句夸夸小卡片',
  },
];

const mockChallengeGroups: PersonalityDiceChallengeGroup[] = [
  {
    userId: 'host-user',
    displayName: 'Host',
    archetype: 'corgi',
    dominantTrait: 'A' as const,
    options: [
      { ...mockChallenges[0], difficulty: 'easy' as const, challengeTitle: 'Host Easy Dare' },
      { ...mockChallenges[0], difficulty: 'medium' as const, challengeTitle: 'Host Medium Dare' },
      { ...mockChallenges[0], difficulty: 'hard' as const, challengeTitle: 'Host Hard Dare' },
    ],
  },
  {
    userId: 'guest-1',
    displayName: 'Alice',
    archetype: 'rooster',
    dominantTrait: 'E' as const,
    options: [
      { ...mockChallenges[1], difficulty: 'easy' as const, challengeTitle: 'Alice Easy Dare' },
      { ...mockChallenges[1], difficulty: 'medium' as const, challengeTitle: 'Alice Medium Dare' },
      { ...mockChallenges[1], difficulty: 'hard' as const, challengeTitle: 'Alice Hard Dare' },
    ],
  },
  {
    userId: 'guest-2',
    displayName: 'Bob',
    archetype: 'owl',
    dominantTrait: 'O' as const,
    options: [
      { ...mockChallenges[2], difficulty: 'easy' as const, challengeTitle: 'Bob Easy Dare' },
      { ...mockChallenges[2], difficulty: 'medium' as const, challengeTitle: 'Bob Medium Dare' },
      { ...mockChallenges[2], difficulty: 'hard' as const, challengeTitle: 'Bob Hard Dare' },
    ],
  },
  {
    userId: 'guest-3',
    displayName: 'Carol',
    archetype: 'fox',
    dominantTrait: 'X' as const,
    options: [
      { ...mockChallenges[3], difficulty: 'easy' as const, challengeTitle: 'Carol Easy Dare' },
      { ...mockChallenges[3], difficulty: 'medium' as const, challengeTitle: 'Carol Medium Dare' },
      { ...mockChallenges[3], difficulty: 'hard' as const, challengeTitle: 'Carol Hard Dare' },
    ],
  },
];

function basePersonalityDiceSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: overrides.socialSessionId ?? 'social_pd-test',
    icebreakerSessionId: 'pd-test',
    currentPhase: 'personality_dice',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'glow',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: GLOW_RUN_PLAN,
    ...overrides,
  };
}

function seedPersonalityDiceParticipants(socialSessionId: string): void {
  const pmap = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  pmap.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now() - 10000, lastSeenAt: Date.now() });
  pmap.set('guest-1', { userId: 'guest-1', displayName: 'Alice', joinedAt: Date.now() - 8000, lastSeenAt: Date.now() });
  pmap.set('guest-2', { userId: 'guest-2', displayName: 'Bob', joinedAt: Date.now() - 6000, lastSeenAt: Date.now() });
  pmap.set('guest-3', { userId: 'guest-3', displayName: 'Carol', joinedAt: Date.now() - 4000, lastSeenAt: Date.now() });
  storeCtx.participants.set(socialSessionId, pmap);
}

function seedPersonalityDiceSession(
  socialSessionId: string,
  opts?: { phase?: string; withChallenges?: boolean; completeSome?: string[]; passSome?: string[] },
): void {
  const state = basePersonalityDiceSession({
    socialSessionId,
    currentPhase: (opts?.phase as SocialSessionState['currentPhase']) ?? 'personality_dice',
  });

  if (opts?.withChallenges) {
    state.personalityDiceChallenges = mockChallenges;
    state.personalityDiceChallengesMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
      promptVersion: 'social-personality-dice-v3',
    };
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = opts.completeSome ?? [];
    state.dicePassedBy = opts.passSome ?? [];
  }

  storeCtx.sessions.set(socialSessionId, state);
  seedPersonalityDiceParticipants(socialSessionId);
}

function seedPersonalityDiceGroupsSession(
  socialSessionId: string,
  opts?: { withGroups?: boolean; chosenSome?: Record<string, number>; completedSome?: string[]; passedSome?: string[] },
): void {
  const state = basePersonalityDiceSession({ socialSessionId });

  if (opts?.withGroups) {
    state.personalityDiceChallengeGroups = mockChallengeGroups;
    state.personalityDiceChallengesMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
      promptVersion: 'social-personality-dice-v4',
    };
    state.diceSelectedOption = opts.chosenSome ?? {};
    state.diceCompletedBy = opts.completedSome ?? [];
    state.dicePassedBy = opts.passedSome ?? [];
  }

  storeCtx.sessions.set(socialSessionId, state);
  seedPersonalityDiceParticipants(socialSessionId);
}

// --- POST /personality-dice/generate ---

describe('POST /api/social-icebreaker/:id/personality-dice/generate', () => {
  beforeEach(() => {
    process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'false';
    vi.mocked(generatePersonalityDiceChallenges).mockReset();
    vi.mocked(generatePersonalityDiceChallenges).mockResolvedValue({
      data: mockChallenges,
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v3',
      },
    });
    vi.mocked(shouldSkipOnDemandGeneration).mockReset();
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
    vi.mocked(getPreGenerationResult).mockReset();
    vi.mocked(getPreGenerationResult).mockResolvedValue(null);
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_pd-gen-401';
    seedPersonalityDiceSession(id);
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_pd-gen-403';
    seedPersonalityDiceSession(id);
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in personality_dice phase', async () => {
    const id = 'social_pd-gen-phase';
    seedPersonalityDiceSession(id, { phase: 'warmup' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Not in personality_dice phase');
    });
  });

  it('generates challenges and returns roster-sized result', async () => {
    const id = 'social_pd-gen-200';
    seedPersonalityDiceSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const participants = [
        { userId: 'host-user', displayName: 'Host', archetype: 'corgi' },
        { userId: 'guest-1', displayName: 'Alice', archetype: 'rooster' },
      ];
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.challenges).toHaveLength(4);
      // Each challenge should have archetypeColor enriched
      expect(body.challenges[0].archetypeColor).toBeDefined();

      const stored = storeCtx.sessions.get(id);
      expect(stored?.personalityDiceChallenges).toHaveLength(4);
      expect(stored?.currentDicePlayerIndex).toBe(0);
      expect(stored?.diceCompletedBy).toEqual([]);
      expect(stored?.dicePassedBy).toEqual([]);
    });
  });

  it('returns cached challenges without regenerating', async () => {
    const id = 'social_pd-gen-cached';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(200);
      expect(generatePersonalityDiceChallenges).not.toHaveBeenCalled();
      const body = await res.json() as any;
      expect(body.challenges).toHaveLength(4);
      expect(body.challenges[0].archetypeColor).toBeDefined();
    });
  });

  it('returns 200 with pre-generated challenges when available', async () => {
    const id = 'social_pd-gen-pregen';
    seedPersonalityDiceSession(id);
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
    vi.mocked(getPreGenerationResult).mockResolvedValue({
      contentJson: mockChallenges as any,
      aiMeta: {
        generatedAt: new Date().toISOString(),
        fromCache: true,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v3',
      },
    });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.challenges).toHaveLength(4);
      expect(generatePersonalityDiceChallenges).not.toHaveBeenCalled();
    });
  });

  it('returns 202 when pre-generation is in-flight', async () => {
    const id = 'social_pd-gen-inflight';
    seedPersonalityDiceSession(id);
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(202);
      const body = await res.json() as any;
      expect(body.status).toBe('generating');
    });
  });
});

// --- POST /personality-dice/complete ---

describe('POST /api/social-icebreaker/:id/personality-dice/complete', () => {
  beforeEach(() => {
    seenOps.clear();
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_pd-comp-401';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 when not in personality_dice phase', async () => {
    const id = 'social_pd-comp-phase';
    seedPersonalityDiceSession(id, { phase: 'warmup', withChallenges: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  it('marks challenge as completed for a player', async () => {
    const id = 'social_pd-comp-ok';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.diceCompletedBy).toContain('host-user');
      expect(body.dicePassedBy).toHaveLength(0);
      expect(body.allCompleted).toBe(false);
    });
  });

  it('marks challenge as passed for a player', async () => {
    const id = 'social_pd-comp-pass';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ pass: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.dicePassedBy).toContain('guest-1');
      expect(body.diceCompletedBy).toHaveLength(0);
    });
  });

  it('advances player index when current challenge player completes', async () => {
    const id = 'social_pd-comp-advance';
    seedPersonalityDiceSession(id, { withChallenges: true });
    // First challenge is for host-user, index 0
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.currentDicePlayerIndex).toBe(1);
    });
  });

  it('allCompleted is true when all players have responded', async () => {
    const id = 'social_pd-comp-all';
    seedPersonalityDiceSession(id, {
      withChallenges: true,
      completeSome: ['host-user', 'guest-2'],
      passSome: ['guest-3'],
    });
    // Only guest-1 hasn't responded
    await withServer(async (baseUrl) => {
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ pass: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.allCompleted).toBe(true);
    });
  });

  it('allCompleted is false when some players have not responded', async () => {
    const id = 'social_pd-comp-partial';
    seedPersonalityDiceSession(id, {
      withChallenges: true,
      completeSome: ['host-user'],
    });
    await withServer(async (baseUrl) => {
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.allCompleted).toBe(false);
    });
  });

  it('cannot complete twice (optimistic sync rejects duplicate)', async () => {
    const id = 'social_pd-comp-twice';
    seedPersonalityDiceSession(id, {
      withChallenges: true,
      completeSome: ['host-user'],
    });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      // Already completed in seed, trying again should be rejected
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ operationId: 'op-comp-twice' }),
      });
      // The optimistic sync's validate will see host-user already in diceCompletedBy and reject
      expect(res.status).toBe(409);
    });
  });

  it('multiple players completing via non-optimistic path works', async () => {
    const id = 'social_pd-comp-multi';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');
      const guest3Cookie = await login(baseUrl, 'guest-3');

      await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ pass: true }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({}),
      });
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest3Cookie },
        body: JSON.stringify({ pass: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.allCompleted).toBe(true);
    });
  });

  it('same operationId twice is idempotent', async () => {
    const id = 'social_pd-comp-idem';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const opId = 'op-comp-idem-1';

      const res1 = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ operationId: opId }),
      });
      expect(res1.status).toBe(200);
      const body1 = await res1.json() as any;
      expect(body1.operationId).toBe(opId);

      const res2 = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ operationId: opId }),
      });
      expect(res2.status).toBe(200);
      const body2 = await res2.json() as any;
      expect(body2.operationId).toBe(opId);
    });
  });
});

// --- Edge Cases ---

describe('Personality dice edge cases', () => {
  it('complete returns operationId: null when no operationId provided', async () => {
    const id = 'social_pd-edge-nullid';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.operationId).toBeNull();
    });
  });

  it('generate with choose mode ON returns groups shape (3 options per player)', async () => {
    process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'true';
    const id = 'social_pd-gen-groups-200';
    seedPersonalityDiceSession(id);
    vi.mocked(shouldSkipOnDemandGeneration).mockReset();
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
    vi.mocked(getPreGenerationResult).mockReset();
    vi.mocked(getPreGenerationResult).mockResolvedValue(null);
    vi.mocked(generatePersonalityDiceChallengeGroups).mockResolvedValue({
      data: mockChallengeGroups,
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v4',
      },
    });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const participants = [
        { userId: 'host-user', displayName: 'Host', archetype: 'corgi' },
        { userId: 'guest-1', displayName: 'Alice', archetype: 'rooster' },
      ];
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.groups).toHaveLength(4);
      expect(body.groups[0].options).toHaveLength(3);
      expect(body.groups[0].options[0].difficulty).toBe('easy');
      expect(body.groups[0].options[1].difficulty).toBe('medium');
      expect(body.groups[0].options[2].difficulty).toBe('hard');

      const stored = storeCtx.sessions.get(id);
      expect(stored?.personalityDiceChallengeGroups).toHaveLength(4);
      expect(stored?.diceSelectedOption).toEqual({});
    });
  });

  it('prime caches choose-mode groups without regenerating', async () => {
    process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'true';
    const id = 'social_pd-gen-groups-cached';
    seedPersonalityDiceGroupsSession(id, { withGroups: true });
    vi.mocked(shouldSkipOnDemandGeneration).mockReset();
    vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
    vi.mocked(getPreGenerationResult).mockReset();
    vi.mocked(getPreGenerationResult).mockResolvedValue(null);
    vi.mocked(generatePersonalityDiceChallengeGroups).mockReset();
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.groups).toHaveLength(4);
      expect(body.groups[0].options).toHaveLength(3);
    });
  });

  // --- POST /personality-dice/choose ---

  describe('POST /api/social-icebreaker/:id/personality-dice/choose', () => {
    beforeEach(() => {
      process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'true';
      seenOps.clear();
    });

    it('returns 401 without session cookie', async () => {
      const id = 'social_pd-choose-401';
      seedPersonalityDiceGroupsSession(id, { withGroups: true });
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 0 }),
        });
        expect(res.status).toBe(401);
      });
    });

    it('returns 400 when not in personality_dice phase', async () => {
      const id = 'social_pd-choose-phase';
      const state = basePersonalityDiceSession({ socialSessionId: id, currentPhase: 'warmup' });
      state.personalityDiceChallengeGroups = mockChallengeGroups;
      state.diceSelectedOption = {};
      storeCtx.sessions.set(id, state);
      seedPersonalityDiceParticipants(id);
      await withServer(async (baseUrl) => {
        const cookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 0 }),
        });
        expect(res.status).toBe(400);
      });
    });

    it('writes selected option without marking the user ready', async () => {
      const id = 'social_pd-choose-200';
      seedPersonalityDiceGroupsSession(id, { withGroups: true });
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 1 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.selectedOption).toBeDefined();
        expect(body.diceCompletedBy).not.toContain('host-user');

        const stored = storeCtx.sessions.get(id);
        expect(stored?.diceSelectedOption).toEqual({ 'host-user': 1 });
        expect(stored?.diceCompletedBy).not.toContain('host-user');
      });
    });

    it('rejects changing the choice while ready', async () => {
      const id = 'social_pd-choose-dupe';
      seedPersonalityDiceGroupsSession(id, {
        withGroups: true,
        chosenSome: { 'host-user': 0 },
        completedSome: ['host-user'],
      });
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 2, operationId: 'op-choose-dupe' }),
        });
        expect(res.status).toBe(409);
      });
    });

    it('rejects invalid optionIndex (out of 0-2 range)', async () => {
      const id = 'social_pd-choose-range';
      seedPersonalityDiceGroupsSession(id, { withGroups: true });
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 5 }),
        });
        expect(res.status).toBe(400);
      });
    });

    it('rejects choose when groups not generated', async () => {
      const id = 'social_pd-choose-nogroups';
      seedPersonalityDiceSession(id);
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/choose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ userId: 'host-user', optionIndex: 0 }),
        });
        expect(res.status).toBe(400);
      });
    });
  });

  // --- POST /personality-dice/complete (choose-mode) ---

  describe('POST /api/social-icebreaker/:id/personality-dice/complete (choose-mode)', () => {
    beforeEach(() => {
      process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'true';
      seenOps.clear();
    });

    it('rejects ready before the player chooses a challenge', async () => {
      const id = 'social_pd-comp-choose-first';
      seedPersonalityDiceGroupsSession(id, { withGroups: true });
      await withServer(async (baseUrl) => {
        const guestCookie = await login(baseUrl, 'guest-1');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ ready: true }),
        });
        expect(res.status).toBe(400);
      });
    });

    it('toggles ready off after a player has chosen', async () => {
      const id = 'social_pd-comp-after-choose';
      seedPersonalityDiceGroupsSession(id, {
        withGroups: true,
        chosenSome: { 'host-user': 0 },
        completedSome: ['host-user'],
      });
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'host-user');
        const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: false }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ready).toBe(false);
        expect(body.diceCompletedBy).not.toContain('host-user');
      });
    });
  });

  it('generate enriches cached challenges with archetypeColor', async () => {
    process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'false';
    const id = 'social_pd-edge-color';
    seedPersonalityDiceSession(id, { withChallenges: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ participants: [] }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      for (const c of body.challenges) {
        expect(c.archetypeColor).toBeDefined();
      }
    });
  });
});
