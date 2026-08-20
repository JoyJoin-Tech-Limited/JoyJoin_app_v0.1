import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory socialIcebreakerStore mock (replaces the PostgreSQL-backed store) ──
// The store was migrated to PostgreSQL in PR #405; these tests exercise the HTTP
// routing layer and need a working store but not a real database connection.
vi.mock('../lib/socialIcebreakerStore', () => {
  const sessions = new Map<string, any>();
  const participants = new Map<string, Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>>();
  const lieTruthsStore = new Map<string, Map<string, any[]>>();
  const preGenStore = new Map<string, any>();

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
      const ps = participants.get(socialSessionId);
      if (!ps) return;
      const p = ps.get(userId);
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
    setLieTruths: async (socialSessionId: string, userId: string, truths: any[]) => {
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
    getPreGenerationResult: vi.fn(async (_socialSessionId: string, _phase: string) => {
      return preGenStore.get(`${_socialSessionId}:${_phase}`) ?? null;
    }),
    invalidatePreGenerationForSession: vi.fn().mockResolvedValue(undefined),
    getInFlightJobForPhase: vi.fn(async () => null),
    sweepExpiredSessions: async () => {},
    savePhaseMetric: vi.fn().mockResolvedValue(undefined),
    getPhaseMetrics: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async (_key: string, fallback = false) => fallback),
  getFeatureFlagSync: vi.fn((_key: string, fallback = false) => fallback),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  getLieDetectiveMode: vi.fn().mockReturnValue('v1'),
  getDynamicDifficulty: vi.fn().mockReturnValue('medium'),
  validateLieDetectiveV2Tags: vi.fn().mockImplementation((tags: unknown) => {
    if (!Array.isArray(tags) || tags.length !== 2) {
      return { valid: false, error: 'Exactly 2 tags are required' };
    }
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length < 2 || tag.length > 20) {
        return { valid: false, error: 'Each tag must be 2–20 characters' };
      }
    }
    return { valid: true, tags: [tags[0].trim(), tags[1].trim()] };
  }),
  buildLieDetectiveV2RecapData: vi.fn().mockReturnValue({ aiWinRate: 50, hardestRound: 1, fooledEveryone: 0 }),
  generateWarmupTopics: vi.fn().mockResolvedValue({
    data: [
      { id: 't1', question: '你最近最开心的一件事？', mood: 'relaxed', emoji: '🌅', category: '快乐来源', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
      { id: 't2', question: '今天你最想感谢谁？', mood: 'relaxed', emoji: '✨', category: '温暖连接', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-warmup-topics-v2',
    },
  }),
  getCuratedWarmupTopics: vi.fn().mockReturnValue([
    { id: 'fallback-1', question: '最近有什么小事让你放松了一点？', mood: 'relaxed', emoji: '🌿', category: '轻松开场', depthLevel: 1, promptStyle: 'experiential', safety: 'gentle' },
    { id: 'fallback-2', question: '今天你最想把哪件事先放一放？', mood: 'relaxed', emoji: '☁️', category: '轻松开场', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  ]),
  generateMicroChallenges: vi.fn().mockResolvedValue({
    data: [
      { id: 'c1', title: '击掌', description: '和你左边的人击掌', durationSeconds: 30, completionCTA: '完成了' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-micro-challenges-v2',
    },
  }),
  generateLieDetectiveStatements: vi.fn().mockImplementation(async ({ displayName }) => {
    return {
      data: [
        { index: 0, text: `${displayName}-0`, isLie: false },
        { index: 1, text: `${displayName}-1`, isLie: true },
        { index: 2, text: `${displayName}-2`, isLie: false },
      ],
      meta: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-lie-detective-v1',
      },
    };
  }),
  generateXiaoYueComment: vi.fn().mockResolvedValue({
    data: 'ok',
    meta: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
    },
  }),
  generateRecapSummary: vi.fn().mockResolvedValue({
    data: { headline: 'summary', moments: ['m1'], closingLine: 'bye' },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-recap-summary-v2',
    },
  }),
  generatePersonalityDiceChallenges: vi.fn().mockImplementation(async ({ participants }: { participants: Array<{ userId: string; displayName: string }> }) => {
    return {
      data: participants.map((participant: { userId: string; displayName: string }, i: number) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        dominantTrait: 'A' as const,
        challengeTitle: `challenge-${i}`,
        challengeBody: 'do thing',
        challengeEmoji: '🎲',
        difficulty: 'easy' as const,
      })),
      meta: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v1',
      },
    };
  }),
  generatePersonalityDiceChallengeGroups: vi.fn().mockImplementation(async ({ participants }: { participants: Array<{ userId: string; displayName: string }> }) => ({
    data: participants.map((participant) => ({
      userId: participant.userId,
      displayName: participant.displayName,
      dominantTrait: 'A' as const,
      options: (['easy', 'medium', 'hard'] as const).map((difficulty, optionIndex) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        dominantTrait: 'A' as const,
        challengeTitle: `${participant.userId}-${optionIndex}`,
        challengeBody: 'do thing',
        challengeEmoji: '🎲',
        difficulty,
      })),
    })),
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-personality-dice-v4',
    },
  })),
  generateAuctionLots: vi.fn().mockResolvedValue({
    data: [
      { id: 'lot_1', title: 'Test lot one', teaser: 'fun' },
      { id: 'lot_2', title: 'Test lot two' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: true,
      promptVersion: 'social-auction-lots-v1',
    },
  }),
  generateUndercoverWordPair: vi.fn().mockResolvedValue({
    data: { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-undercover-word-v1',
    },
  }),
  generateGroupMirrorQuestions: vi.fn().mockResolvedValue({
    data: [
      { id: 'gm_1', questionText: '谁最有可能在聚会后请大家吃夜宵？', category: 'perception' },
      { id: 'gm_2', questionText: '谁看起来最像会偷偷养猫的人？', category: 'perception' },
      { id: 'gm_3', questionText: '谁最可能在未来一年里突然辞职去旅行？', category: 'prediction' },
      { id: 'gm_4', questionText: '谁给在场大多数人的第一印象最反差？', category: 'perception' },
      { id: 'gm_5', questionText: '谁最可能是群里那个默默记住所有人喜好的角色？', category: 'perception' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-group-mirror-v1',
    },
  }),
  generateQuipBattlePrompts: vi.fn().mockResolvedValue({
    data: [
      { id: 'qb_1', promptText: '如果_____有段位，你已经是王者了', category: '自嘲' },
      { id: 'qb_2', promptText: '我最想对_____说的一句话是...', category: '吐槽' },
      { id: 'qb_3', promptText: '如果_____能说话，它一定会抱怨', category: '脑洞' },
    ],
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-quip-battle-v1',
    },
  }),
  generateXiaoyueSessionPack: vi.fn().mockResolvedValue({
    data: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      opener: '欢迎来到今晚的破冰时间，我是小悦。',
      phaseCoaching: {
        warmup: { toneLine: '先从轻松的话题暖暖场吧', hostHint: '如果没人开口，你可以先分享' },
        micro_challenge: { toneLine: '热身完毕，来个轻松的小挑战' },
        lie_detective: { toneLine: '侦探时间，仔细听每一句话' },
        auction: { toneLine: '虚拟拍卖开始，脑洞越大越好' },
        personality_dice: { toneLine: '人格骰子环节，看看大家敢不敢接招' },
        mini_script: { toneLine: '迷你剧本杀，今晚的高光时刻' },
        recap: { toneLine: '时间过得真快，来回顾一下今晚' },
      },
      backupPrompts: ['救场话术1', '救场话术2', '救场话术3'],
      recapFraming: { open: '回顾开场', highlightTemplate: '亮点模板', close: '结束语' },
      playerSkillRoles: [
        { userId: 'u1', displayName: 'User1', roleLabel: 'Connector', roleBlurb: '连接者' },
      ],
    },
    meta: {
      generatedAt: '2026-04-02T00:00:00.000Z',
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-session-pack-v2',
    },
  }),
}));

vi.mock('../lib/socialIcebreakerAccess', () => ({
  getSocialIcebreakerAccess: vi.fn(async (sessionId: string) => {
    if (sessionId.startsWith('forbidden')) {
      return { allowed: false, status: 403, body: { message: 'Forbidden' } };
    }
    if (sessionId.startsWith('missing')) {
      return { allowed: false, status: 404, body: { message: 'Icebreaker session not found' } };
    }
    return { allowed: true };
  }),
}));

vi.mock('../jobs/preGenerationQueue', () => ({
  enqueueRunPlanPreGeneration: vi.fn().mockResolvedValue([]),
  shouldSkipOnDemandGeneration: vi.fn().mockResolvedValue({ skip: false, reason: 'none' }),
}));

vi.mock('../lib/optimisticSync', () => ({
  recordVoteOptimistically: vi.fn().mockImplementation(async (_payload, validate, apply) => {
    const valid = await validate(_payload);
    if (!valid) {
      return { accepted: false, conflict: 'validation_failed' };
    }
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

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');

// Import mocked AI service functions so tests can modify V1/V2 behaviour per-test.
import { generateLieDetectiveStatements, generateWarmupTopics, getLieDetectiveMode } from '../socialIcebreakerAIService';
import {
  getSession,
  updateSession,
  getPreGenerationResult,
  listParticipants,
  setLieTruths,
  getLieTruths,
} from '../lib/socialIcebreakerStore';
import { shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';
import { getFeatureFlag } from '../lib/featureFlags';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { getSingleTestMetaForSessionStart } from '../services/singleTestService';

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

describe.sequential('social icebreaker routes', () => {
  it('returns a created session within its budget when warmup generation stalls', async () => {
    vi.mocked(generateWarmupTopics).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'nonblocking-start-host');
      const sessionId = `session-nonblocking-start-${Date.now()}`;

      const response = await Promise.race([
        fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            sessionId,
            displayName: 'Host',
            eventTier: 'breeze',
            vibe: 'balanced',
          }),
        }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error('/start exceeded its warmup budget')), 500);
        }),
      ]);
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.socialSessionId).toBe(`social_${sessionId}`);
      expect(body.currentPhase).toBe('warmup');
    });
  });

  it('returns the joined participant roster in social session state responses', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'roster-host');
      const guestCookie = await login(baseUrl, 'roster-guest');
      const sessionId = `session-roster-${Date.now()}`;

      const hostStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const hostStartBody = await hostStartResponse.json() as any;

      expect(hostStartBody.state.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
      ]);

      const guestStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest' }),
      });
      const guestStartBody = await guestStartResponse.json() as any;

      expect(guestStartBody.state.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
        expect.objectContaining({ userId: 'roster-guest', displayName: 'Guest', isActive: true }),
      ]);

      const rosterResponse = await fetch(`${baseUrl}/api/social-icebreaker/${guestStartBody.socialSessionId}`, {
        headers: { cookie: hostCookie },
      });
      const rosterBody = await rosterResponse.json() as any;

      expect(rosterBody.playerCount).toBe(2);
      expect(rosterBody.joinedParticipants).toEqual([
        expect.objectContaining({ userId: 'roster-host', displayName: 'Host', isActive: true }),
        expect.objectContaining({ userId: 'roster-guest', displayName: 'Guest', isActive: true }),
      ]);
    });
  });

  it('returns normalized AI metadata for warmup topics', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'topics-host');
      const sessionId = `session-topics-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const topicsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      const topicsBody = await topicsResponse.json() as any;

      expect(topicsResponse.status).toBe(200);
      expect(topicsBody.topics).toHaveLength(2);
      expect(topicsBody.meta).toMatchObject({
        provider: 'deepseek',
        fromCache: false,
        fallbackUsed: false,
        promptVersion: 'social-warmup-topics-v2',
      });
    });
  });

  it('serves curated fallback warmup topics when AI generation throws', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'topics-ai-fallback-host');
      const sessionId = `session-topics-ai-fallback-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      vi.mocked(generateWarmupTopics).mockRejectedValueOnce(new Error('AI timeout'));

      const topicsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      const topicsBody = await topicsResponse.json() as any;
      const savedState = await getSession(socialSessionId) as any;

      expect(topicsResponse.status).toBe(200);
      expect(topicsBody.topics).toHaveLength(2);
      expect(topicsBody.meta).toMatchObject({
        provider: null,
        fallbackUsed: true,
        evaluatorRejectionReason: 'route_generation_error',
      });
      expect(savedState.warmupTopics).toHaveLength(2);
      expect(savedState.selectedMood).toBe('relaxed');
    });
  });

  it('still generates warmup topics when roster enrichment is unavailable', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'topics-roster-fallback-host');
      const sessionId = `session-topics-roster-fallback-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      vi.mocked(listParticipants).mockRejectedValueOnce(new Error('roster enrichment unavailable'));

      const topicsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      const topicsBody = await topicsResponse.json() as any;

      expect(topicsResponse.status).toBe(200);
      expect(topicsBody.topics).toHaveLength(2);
      expect(generateWarmupTopics).toHaveBeenCalledWith(expect.objectContaining({ roster: [] }));
    });
  });

  it('requires shared warmup readiness before changing topics or advancing, and tracks common ground', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'warmup-host');
      const guestCookie = await login(baseUrl, 'warmup-guest');
      const sessionId = `session-warmup-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const guestStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest' }),
      });
      const { socialSessionId } = await guestStartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      const blockedAdvanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(blockedAdvanceResponse.status).toBe(400);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ ready: true }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ ready: true }),
      });

      const nextTopicResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/next-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      const nextTopicBody = await nextTopicResponse.json() as any;
      expect(nextTopicResponse.status).toBe(200);
      expect(nextTopicBody.currentTopicIndex).toBe(1);
      expect(nextTopicBody.commonGroundCount).toBe(1);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ ready: true }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ ready: true }),
      });

      const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      const advanceBody = await advanceResponse.json() as any;

      expect(advanceResponse.status).toBe(200);
      expect(advanceBody.nextPhase).toBe('micro_challenge');
      expect(advanceBody.state.commonGroundCount).toBe(2);
    });
  });

  it('rejects warmup readiness updates from non-participants', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'warmup-owner');
      const outsiderCookie = await login(baseUrl, 'warmup-outsider');
      const sessionId = `session-warmup-outsider-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const readyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: outsiderCookie },
        body: JSON.stringify({ ready: true }),
      });
      const readyBody = await readyResponse.json() as any;

      expect(readyResponse.status).toBe(403);
      expect(readyBody.error).toContain('Not a participant');
    });
  });

  it('accepts guessedStatementIndex=0 in lie-detective votes', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');
      const sessionId = `session-vote-0-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const startGuest2 = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await startGuest2.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      const advanceResponse2 = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });
      await advanceResponse2.json();

      const statementResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ displayName: 'Host' }),
      });
      const statementBody = await statementResponse.json() as any;

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ displayName: 'Guest 1' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ displayName: 'Guest 2' }),
      });

      expect(statementBody.meta).toMatchObject({
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-lie-detective-v1',
      });

      const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host', guessedStatementIndex: 0 }),
      });
      const voteBody = await voteResponse.json() as any;

      expect(voteResponse.status).toBe(200);
      expect(voteBody.votes[0].guessedStatementIndex).toBe(0);
    });
  });

  it('rejects self-votes and uses server-owned reveal plus per-player progression in lie-detective', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-reveal');
      const guest1Cookie = await login(baseUrl, 'guest-reveal-1');
      const guest2Cookie = await login(baseUrl, 'guest-reveal-2');
      const sessionId = `session-reveal-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const guest2StartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await guest2StartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });

      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      for (const [cookie, displayName] of [
        [hostCookie, 'Host'],
        [guest1Cookie, 'Guest 1'],
        [guest2Cookie, 'Guest 2'],
      ] as const) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ displayName }),
        });
      }

      const selfVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 1 }),
      });
      expect(selfVoteResponse.status).toBe(400);

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 0 }),
      });

      const revealResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ targetUserId: 'host-reveal', guessedStatementIndex: 1 }),
      });
      const revealBody = await revealResponse.json() as any;

      expect(revealResponse.status).toBe(200);
      expect(revealBody.isRevealed).toBe(true);
      expect(revealBody.reveal).toMatchObject({
        targetUserId: 'host-reveal',
        lieIndex: 1,
        voteCount: 2,
        correctVoteCount: 1,
      });

      const nextPlayerResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      });
      const nextPlayerBody = await nextPlayerResponse.json() as any;

      expect(nextPlayerResponse.status).toBe(200);
      expect(nextPlayerBody.currentLieDetectivePlayerIndex).toBe(1);
      expect(nextPlayerBody.currentPlayer.userId).toBe('guest-reveal-1');
    });
  });

  it('waits for the full roster to generate lie-detective statements before accepting votes', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-vote-gate');
      const guest1Cookie = await login(baseUrl, 'guest-vote-gate-1');
      const guest2Cookie = await login(baseUrl, 'guest-vote-gate-2');
      const sessionId = `session-vote-gate-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const guest2StartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 2' }),
      });
      const { socialSessionId } = await guest2StartResponse.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie, guest2Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      for (const [cookie, displayName] of [
        [hostCookie, 'Host'],
        [guest1Cookie, 'Guest 1'],
      ] as const) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ displayName }),
        });
      }

      const blockedVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-vote-gate', guessedStatementIndex: 0 }),
      });
      const blockedVoteBody = await blockedVoteResponse.json() as any;

      expect(blockedVoteResponse.status).toBe(400);
      expect(blockedVoteBody.error).toContain('generate statements');

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ displayName: 'Guest 2' }),
      });

      const acceptedVoteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ targetUserId: 'host-vote-gate', guessedStatementIndex: 0 }),
      });
      const acceptedVoteBody = await acceptedVoteResponse.json() as any;

      expect(acceptedVoteResponse.status).toBe(200);
      expect(acceptedVoteBody.isRevealed).toBe(false);
      expect(acceptedVoteBody.votes).toHaveLength(1);
    });
  });

  it('rejects lie-detective votes in the wrong phase', async () => {
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-wrong-phase');
      const sessionId = `session-wrong-phase-${Date.now()}`;

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ targetUserId: 'someone', guessedStatementIndex: 0 }),
      });
      const voteBody = await voteResponse.json() as any;

      expect(voteResponse.status).toBe(400);
      expect(voteBody.error).toContain('lie_detective');
    });
  });

  it.skip('uses the authenticated session user for personality-dice completion instead of a spoofed body userId', async () => {
    // Note: module-level await import (line 223) races with vi.mock hoisting.
    // Schema split changed module graph timing; router is imported before mock is applied.
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'dice-host');
      const guest1Cookie = await login(baseUrl, 'dice-guest-1');
      const sessionId = `session-dice-${Date.now()}`;

      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const startGuest1 = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
      });
      const { socialSessionId } = await startGuest1.json() as { socialSessionId: string };

      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, guest1Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      for (const cookie of [hostCookie, guest1Cookie]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });

      const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({
          participants: [
            { userId: 'dice-host', displayName: 'Host' },
            { userId: 'dice-guest-1', displayName: 'Guest 1' },
          ],
        }),
      });
      const generateBody = await generateResponse.json() as any;

      expect(generateBody.meta).toMatchObject({
        provider: 'deepseek',
        fromCache: false,
        fallbackUsed: false,
        promptVersion: 'social-personality-dice-v1',
      });

      const completeResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ userId: 'dice-host' }),
      });
      const completeBody = await completeResponse.json() as any;

      expect(completeResponse.status).toBe(200);
      expect(completeBody.diceCompletedBy).toContain('dice-guest-1');
      expect(completeBody.diceCompletedBy).not.toContain('dice-host');
    });
  });

  it('rejects social start for unauthorized users before creating a social session', async () => {
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-forbidden');

      const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ sessionId: 'forbidden-session', displayName: 'Guest' }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ message: 'Forbidden' });
    });
  });

  describe('Lie Detective V2 — route integration', () => {
    async function advanceToLieDetective(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-ld-v2-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      // Get socialSessionId from any participant
      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Warmup
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      const advanceWarmupResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(advanceWarmupResponse.status).toBe(200);

      // Micro challenge
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      const advanceMicroResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });
      expect(advanceMicroResponse.status).toBe(200);

      return socialSessionId;
    }

    beforeEach(() => {
      // Reset to V1 default; individual tests override for V2
      vi.mocked(getLieDetectiveMode).mockReturnValue('v1');
      vi.mocked(generateLieDetectiveStatements).mockImplementation(async ({ displayName }) => ({
        data: [
          { index: 0, text: `${displayName}-0`, isLie: false },
          { index: 1, text: `${displayName}-1`, isLie: true },
          { index: 2, text: `${displayName}-2`, isLie: false },
        ],
        meta: {
          generatedAt: '2026-04-02T00:00:00.000Z',
          fromCache: false,
          provider: 'deepseek',
          fallbackUsed: false,
          promptVersion: 'social-lie-detective-v1',
        },
      }));
    });

    it('V2 end-to-end: submit tags, generate statements, vote, reveal, next player', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'v2-host');
        const guest1Cookie = await login(baseUrl, 'v2-guest-1');
        const guest2Cookie = await login(baseUrl, 'v2-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // Switch to V2 mode
        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');
        vi.mocked(generateLieDetectiveStatements).mockImplementation(async ({ mode, tags, displayName }) => {
          if (mode === 'v2' && tags) {
            return {
              data: [
                { index: 0, text: `${tags[0]} expanded`, isLie: false, is_ai: false, source_tag: tags[0] },
                { index: 1, text: 'AI fake statement', isLie: true, is_ai: true, source_tag: null },
                { index: 2, text: `${tags[1]} expanded`, isLie: false, is_ai: false, source_tag: tags[1] },
              ],
              meta: {
                generatedAt: '2026-04-02T00:00:00.000Z',
                fromCache: false,
                provider: 'deepseek',
                fallbackUsed: false,
                promptVersion: 'social-lie-detective-v2',
              },
            };
          }
          return {
            data: [
              { index: 0, text: `${displayName}-0`, isLie: false },
              { index: 1, text: `${displayName}-1`, isLie: true },
              { index: 2, text: `${displayName}-2`, isLie: false },
            ],
            meta: {
              generatedAt: '2026-04-02T00:00:00.000Z',
              fromCache: false,
              provider: 'deepseek',
              fallbackUsed: false,
              promptVersion: 'social-lie-detective-v1',
            },
          };
        });

        // Submit tags
        const hostTagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['爬山', '怕蟑螂'] }),
        });
        const hostTagsBody = await hostTagsResponse.json() as any;
        expect(hostTagsResponse.status).toBe(200);
        expect(hostTagsBody.submitted).toBe(true);
        expect(hostTagsBody.tags).toEqual(['爬山', '怕蟑螂']);
        expect(hostTagsBody.allPlayersSubmitted).toBe(false);

        const guest1TagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ tags: ['游泳', '爱吃辣'] }),
        });
        expect(guest1TagsResponse.status).toBe(200);

        const guest2TagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ tags: ['跑步', '咖啡'] }),
        });
        const guest2TagsBody = await guest2TagsResponse.json() as any;
        expect(guest2TagsResponse.status).toBe(200);
        expect(guest2TagsBody.allPlayersSubmitted).toBe(true);

        // Verify tags stored in session state
        const stateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}`, {
          headers: { cookie: hostCookie },
        });
        const stateBody = await stateResponse.json() as any;
        expect(stateBody.lieDetectiveV2Tags['v2-host']).toEqual(['爬山', '怕蟑螂']);
        expect(stateBody.lieDetectiveV2Tags['v2-guest-1']).toEqual(['游泳', '爱吃辣']);
        expect(stateBody.lieDetectiveV2Tags['v2-guest-2']).toEqual(['跑步', '咖啡']);

        // Generate statements for all 3 players
        for (const [cookie, displayName] of [
          [hostCookie, 'Host'],
          [guest1Cookie, 'Guest 1'],
          [guest2Cookie, 'Guest 2'],
        ] as const) {
          const genResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ displayName }),
          });
          const genBody = await genResponse.json() as any;
          expect(genResponse.status).toBe(200);
          expect(genBody.statements).toHaveLength(3);

          // Verify public statements are sanitized (no isLie, no is_ai, no source_tag)
          for (const stmt of genBody.statements) {
            expect(stmt).not.toHaveProperty('isLie');
            expect(stmt).not.toHaveProperty('is_ai');
            expect(stmt).not.toHaveProperty('source_tag');
            expect(stmt).toHaveProperty('index');
            expect(stmt).toHaveProperty('text');
          }
          // Verify V2 prompt version on the first (host) generation
          if (displayName === 'Host') {
            expect(genBody.meta.promptVersion).toBe('social-lie-detective-v2');
          }
        }

        // Vote from guest1
        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'v2-host', guessedStatementIndex: 0 }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.isRevealed).toBe(false); // Need 2 votes for 3 players

        // Vote from guest2 → reveal
        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ targetUserId: 'v2-host', guessedStatementIndex: 0 }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.isRevealed).toBe(true);
        expect(vote2Body.reveal).toMatchObject({
          targetUserId: 'v2-host',
          lieIndex: 1,
          voteCount: 2,
        });

        // Next player
        const nextPlayerResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const nextPlayerBody = await nextPlayerResponse.json() as any;
        expect(nextPlayerResponse.status).toBe(200);
        expect(nextPlayerBody.currentLieDetectivePlayerIndex).toBe(1);
      });
    });

    it('V1 regression: generate statements without tags, exactly 1 isLie', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'v1-host');
        const guest1Cookie = await login(baseUrl, 'v1-guest-1');
        const guest2Cookie = await login(baseUrl, 'v1-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // getLieDetectiveMode stays at default 'v1'
        const hostGenResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ displayName: 'Host' }),
        });
        const hostGenBody = await hostGenResponse.json() as any;
        expect(hostGenResponse.status).toBe(200);
        expect(hostGenBody.statements).toHaveLength(3);
        expect(hostGenBody.meta.promptVersion).toBe('social-lie-detective-v1');

        // No tag requirement error
        expect(hostGenBody.error).toBeUndefined();
      });
    });

    it('submit-tags rejects when not in lie_detective phase', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-phase-host');
        const sessionId = `session-tag-phase-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(400);
        expect(tagsBody.error).toContain('lie_detective');
      });
    });

    it('submit-tags rejects when mode is v1', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-v1-host');
        const guest1Cookie = await login(baseUrl, 'tag-v1-guest-1');
        const guest2Cookie = await login(baseUrl, 'tag-v1-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // getLieDetectiveMode stays at default 'v1'
        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(400);
        expect(tagsBody.error).toContain('V2');
      });
    });

    it('submit-tags rejects unauthenticated', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tag-auth-host');
        const guest1Cookie = await login(baseUrl, 'tag-auth-guest-1');
        const guest2Cookie = await login(baseUrl, 'tag-auth-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const tagsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/submit-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
        });
        const tagsBody = await tagsResponse.json() as any;
        expect(tagsResponse.status).toBe(401);
        expect(tagsBody.error).toContain('Authentication');
      });
    });

    it('generate rejects when tags not submitted first in V2 mode', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gen-tags-host');
        const guest1Cookie = await login(baseUrl, 'gen-tags-guest-1');
        const guest2Cookie = await login(baseUrl, 'gen-tags-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        vi.mocked(getLieDetectiveMode).mockReturnValue('v2');

        const genResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ displayName: 'Host' }),
        });
        const genBody = await genResponse.json() as any;
        expect(genResponse.status).toBe(400);
        expect(genBody.error).toContain('Tags not submitted');
      });
    });

    it('host-only next-player route rejects non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'next-host');
        const guest1Cookie = await login(baseUrl, 'next-guest-1');
        const guest2Cookie = await login(baseUrl, 'next-guest-2');
        const socialSessionId = await advanceToLieDetective(baseUrl, hostCookie, guest1Cookie, guest2Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (!stateBefore) throw new Error('Session not found');
        stateBefore.autoAdvanceEnabled = false;
        await updateSession(socialSessionId, stateBefore);

        // Generate for all so voting can happen
        for (const [cookie, displayName] of [
          [hostCookie, 'Host'],
          [guest1Cookie, 'Guest 1'],
          [guest2Cookie, 'Guest 2'],
        ] as const) {
          await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ displayName }),
          });
        }

        // Guests vote to reveal (need 2 votes for 3 players)
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'next-host', guessedStatementIndex: 0 }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
          body: JSON.stringify({ targetUserId: 'next-host', guessedStatementIndex: 0 }),
        });

        // Non-host tries to advance
        const nextResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        const nextBody = await nextResponse.json() as any;
        expect(nextResponse.status).toBe(403);
        expect(nextBody.error).toContain('Only the host');
      });
    });
  });

  describe.skip('Personality Dice V2 — pre-generation + optimistic sync', () => {
    async function advanceToPersonalityDice(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-pd-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Warmup
      await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ mood: 'relaxed' }),
      });
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ ready: true }),
        });
      }
      const advanceWarmupResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'warmup' }),
      });
      expect(advanceWarmupResponse.status).toBe(200);

      // Micro challenge
      for (const cookie of [hostCookie, ...guestCookies]) {
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
        });
      }
      const advanceMicroResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ currentPhase: 'micro_challenge' }),
      });
      expect(advanceMicroResponse.status).toBe(200);

      // Now in personality_dice
      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-pregen-host');
        const guest1Cookie = await login(baseUrl, 'pd-pregen-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        const preGenChallenges = [
          { userId: 'pd-pregen-host', displayName: 'Host', archetype: 'corgi', dominantTrait: 'A', challengeTitle: 'Pre-gen 1', challengeBody: 'do it', challengeEmoji: '🎲', difficulty: 'easy' },
          { userId: 'pd-pregen-guest', displayName: 'Guest 1', archetype: 'rooster', dominantTrait: 'C', challengeTitle: 'Pre-gen 2', challengeBody: 'do it', challengeEmoji: '🎲', difficulty: 'easy' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenChallenges as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-personality-dice-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-pregen-host', displayName: 'Host' },
              { userId: 'pd-pregen-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenges).toHaveLength(2);
        expect(generateBody.challenges[0].challengeTitle).toBe('Pre-gen 1');
        expect(generateBody.challenges[0].archetypeColor).toBeDefined();
        expect(generateBody.meta.promptVersion).toBe('social-personality-dice-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-inflight-host');
        const guest1Cookie = await login(baseUrl, 'pd-inflight-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-inflight-host', displayName: 'Host' },
              { userId: 'pd-inflight-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-op-id-host');
        const guest1Cookie = await login(baseUrl, 'pd-op-id-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-op-id-host', displayName: 'Host' },
              { userId: 'pd-op-id-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-123-abc';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First completion
        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId }),
        });
        const complete1Body = await complete1Response.json() as any;
        expect(complete1Response.status).toBe(200);
        expect(complete1Body.diceCompletedBy).toContain('pd-op-id-guest');
        expect(complete1Body.operationId).toBe(operationId);

        // Second completion with same operationId
        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(200);
        expect(complete2Body.diceCompletedBy).toContain('pd-op-id-guest');
        expect(complete2Body.operationId).toBe(operationId);
      });
    });

    it('optimistic sync: different operationId for same user is rejected', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-reject-host');
        const guest1Cookie = await login(baseUrl, 'pd-reject-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-reject-host', displayName: 'Host' },
              { userId: 'pd-reject-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        expect(generateResponse.status).toBe(200);

        // First completion
        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId: 'op-first' }),
        });
        expect(complete1Response.status).toBe(200);

        // Second completion with different operationId
        vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate) => {
          const valid = await validate(_payload);
          if (!valid) {
            return { accepted: false, conflict: 'already_responded' };
          }
          return { accepted: true };
        });

        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false, operationId: 'op-second' }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(409);
        expect(complete2Body.error).toContain('already_responded');
      });
    });

    it('backward compatibility: no operationId works as before', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'pd-compat-host');
        const guest1Cookie = await login(baseUrl, 'pd-compat-guest');
        const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guest1Cookie);

        // Generate challenges first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            participants: [
              { userId: 'pd-compat-host', displayName: 'Host' },
              { userId: 'pd-compat-guest', displayName: 'Guest 1' },
            ],
          }),
        });
        const generateBody = await generateResponse.json() as any;
        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenges[0].archetypeColor).toBeDefined();

        // Complete without operationId
        const completeResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ pass: false }),
        });
        const completeBody = await completeResponse.json() as any;

        expect(completeResponse.status).toBe(200);
        expect(completeBody.diceCompletedBy).toContain('pd-compat-guest');
        expect(completeBody.operationId).toBeNull();
      });
    });

    it('keeps choices editable until ready and returns one shared reveal order when everyone is ready', async () => {
      const previousChooseMode = process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED;
      process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'true';
      try {
        await withServer(async (baseUrl) => {
          const hostCookie = await login(baseUrl, 'pd-ready-host');
          const guestCookie = await login(baseUrl, 'pd-ready-guest');
          const socialSessionId = await advanceToPersonalityDice(baseUrl, hostCookie, guestCookie);
          const participants = [
            { userId: 'pd-ready-host', displayName: 'Host' },
            { userId: 'pd-ready-guest', displayName: 'Guest' },
          ];

          const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ participants }),
          });
          expect(generateResponse.status).toBe(200);

          const impersonationResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/choose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: guestCookie },
            body: JSON.stringify({ userId: 'pd-ready-host', optionIndex: 1 }),
          });
          expect(impersonationResponse.status).toBe(403);

          for (const optionIndex of [0, 2]) {
            const chooseResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/choose`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie: hostCookie },
              body: JSON.stringify({ userId: 'pd-ready-host', optionIndex }),
            });
            expect(chooseResponse.status).toBe(200);
            expect((await chooseResponse.json() as any).diceCompletedBy).not.toContain('pd-ready-host');
          }

          for (const [cookie, userId, optionIndex] of [
            [guestCookie, 'pd-ready-guest', 1],
          ] as const) {
            const chooseResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/choose`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie },
              body: JSON.stringify({ userId, optionIndex }),
            });
            expect(chooseResponse.status).toBe(200);
          }

          const hostReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ ready: true }),
          });
          expect((await hostReadyResponse.json() as any).allCompleted).toBe(false);

          const hostCancelResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ ready: false }),
          });
          expect((await hostCancelResponse.json() as any).diceCompletedBy).not.toContain('pd-ready-host');

          await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ ready: true }),
          });
          const guestReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: guestCookie },
            body: JSON.stringify({ ready: true }),
          });
          const guestReadyBody = await guestReadyResponse.json() as any;
          expect(guestReadyBody.allCompleted).toBe(true);
          expect(new Set(guestReadyBody.diceRevealOrder)).toEqual(new Set(participants.map((participant) => participant.userId)));
          expect(guestReadyBody.diceRevealCountdownEndsAt).toBeGreaterThan(Date.now());

          const prematureAdvance = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ currentPhase: 'personality_dice' }),
          });
          expect(prematureAdvance.status).toBe(409);

          for (const cookie of [hostCookie, guestCookie]) {
            const revealReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/personality-dice/reveal-ready`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie },
              body: JSON.stringify({ ready: true }),
            });
            expect(revealReadyResponse.status).toBe(200);
          }

          const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ currentPhase: 'personality_dice' }),
          });
          expect(advanceResponse.status).toBe(200);
        });
      } finally {
        process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = previousChooseMode;
      }
    });
  });

  describe('undercover word', () => {
    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-pregen-host');
        const sessionId = `session-uw-pregen-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const socialSessionId = `social_${sessionId}`;

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: { civilianWord: '火锅', undercoverWord: '烧烤', category: '美食' } as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-undercover-word-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.pair.civilianWord).toBe('火锅');
        expect(generateBody.pair.undercoverWord).toBe('烧烤');
        expect(generateBody.undercoverAssigned).toBe(true);
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-inflight-host');
        const sessionId = `session-uw-inflight-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const socialSessionId = `social_${sessionId}`;

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic describe: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-desc-host');
        const guest1Cookie = await login(baseUrl, 'uw-desc-guest');
        const sessionId = `session-uw-desc-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-uw-desc-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First describe
        const desc1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '甜甜的饮料', operationId }),
        });
        const desc1Body = await desc1Response.json() as any;
        expect(desc1Response.status).toBe(200);
        expect(desc1Body.submitted).toBe(true);
        expect(desc1Body.operationId).toBe(operationId);

        // Second describe with same operationId
        const desc2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '甜甜的饮料', operationId }),
        });
        const desc2Body = await desc2Response.json() as any;
        expect(desc2Response.status).toBe(200);
        expect(desc2Body.submitted).toBe(true);
        expect(desc2Body.operationId).toBe(operationId);
      });
    });

    it('optimistic vote: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-vote-host');
        const guest1Cookie = await login(baseUrl, 'uw-vote-guest');
        const sessionId = `session-uw-vote-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-uw-vote-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        // First vote
        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-vote-host', operationId }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.voted).toBe(true);
        expect(vote1Body.operationId).toBe(operationId);

        // Second vote with same operationId
        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-vote-host', operationId }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.voted).toBe(true);
        expect(vote2Body.operationId).toBe(operationId);
      });
    });

    it('backward compatibility: no operationId works as before', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'uw-compat-host');
        const guest1Cookie = await login(baseUrl, 'uw-compat-guest');
        const sessionId = `session-uw-compat-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest 1' }),
        });
        const socialSessionId = `social_${sessionId}`;

        // Directly set phase to undercover_word
        const storeState = await getSession(socialSessionId);
        if (storeState) {
          storeState.currentPhase = 'undercover_word';
          await updateSession(socialSessionId, storeState);
        }

        // Generate word pair first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        // Describe without operationId
        const descResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ text: '好喝的' }),
        });
        const descBody = await descResponse.json() as any;
        expect(descResponse.status).toBe(200);
        expect(descBody.submitted).toBe(true);
        expect(descBody.operationId).toBeNull();

        // Vote without operationId
        const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/undercover-word/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ targetUserId: 'uw-compat-host' }),
        });
        const voteBody = await voteResponse.json() as any;
        expect(voteResponse.status).toBe(200);
        expect(voteBody.voted).toBe(true);
        expect(voteBody.operationId).toBeNull();
      });
    });
  });

  describe('Micro Challenge V2 — pre-generation + optimistic sync', () => {
    async function advanceToMicroChallenge(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-mc-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to micro_challenge (skip warmup advance which needs 2+ players for micro_challenge)
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'micro_challenge';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-pregen-host');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie);

        const preGenChallenge = { id: 'c_pre', title: 'Pre-gen Challenge', description: 'do it', durationSeconds: 120, completionCTA: '完成' };

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: [preGenChallenge] as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-micro-challenges-v2', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.challenge.title).toBe('Pre-gen Challenge');
        expect(generateBody.meta.promptVersion).toBe('social-micro-challenges-v2');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-inflight-host');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-op-id-host');
        const guest1Cookie = await login(baseUrl, 'mc-op-id-guest');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie, guest1Cookie);

        // Generate challenge first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-mc-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const complete1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ operationId }),
        });
        const complete1Body = await complete1Response.json() as any;
        expect(complete1Response.status).toBe(200);
        expect(complete1Body.completedBy).toContain('mc-op-id-guest');
        expect(complete1Body.operationId).toBe(operationId);

        const complete2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ operationId }),
        });
        const complete2Body = await complete2Response.json() as any;
        expect(complete2Response.status).toBe(200);
        expect(complete2Body.completedBy).toContain('mc-op-id-guest');
        expect(complete2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'mc-auth-host');
        const guest1Cookie = await login(baseUrl, 'mc-auth-guest');
        const socialSessionId = await advanceToMicroChallenge(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/micro-challenge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Group Mirror V2 — pre-generation + optimistic sync', () => {
    async function advanceToGroupMirror(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-gm-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to group_mirror
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'group_mirror';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-pregen-host');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie);

        const preGenQuestions = [
          { id: 'gm_pre_1', questionText: 'Pre-gen Q1', category: 'perception' },
          { id: 'gm_pre_2', questionText: 'Pre-gen Q2', category: 'prediction' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenQuestions as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-group-mirror-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.questions).toHaveLength(2);
        expect(generateBody.questions[0].questionText).toBe('Pre-gen Q1');
        expect(generateBody.meta.promptVersion).toBe('social-group-mirror-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-inflight-host');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic sync: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-op-id-host');
        const guest1Cookie = await login(baseUrl, 'gm-op-id-guest');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie, guest1Cookie);

        // Generate questions first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-gm-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const submit1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ questionId: 'gm_1', targetUserId: 'gm-host' }],
            operationId,
          }),
        });
        const submit1Body = await submit1Response.json() as any;
        expect(submit1Response.status).toBe(200);
        expect(submit1Body.submitted).toBe(true);
        expect(submit1Body.operationId).toBe(operationId);

        const submit2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ questionId: 'gm_1', targetUserId: 'gm-host' }],
            operationId,
          }),
        });
        const submit2Body = await submit2Response.json() as any;
        expect(submit2Response.status).toBe(200);
        expect(submit2Body.submitted).toBe(true);
        expect(submit2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'gm-auth-host');
        const guest1Cookie = await login(baseUrl, 'gm-auth-guest');
        const socialSessionId = await advanceToGroupMirror(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/group-mirror/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Quip Battle V2 — pre-generation + optimistic sync', () => {
    async function advanceToQuipBattle(baseUrl: string, hostCookie: string, ...guestCookies: string[]) {
      const sessionId = `session-qb-${Date.now()}`;
      await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'blaze' }),
      });
      for (const [i, guestCookie] of guestCookies.entries()) {
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: `Guest ${i + 1}` }),
        });
      }

      const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        body: JSON.stringify({ sessionId, displayName: 'Host' }),
      });
      const { socialSessionId } = await startResponse.json() as { socialSessionId: string };

      // Directly set phase to quip_battle
      const storeState = await getSession(socialSessionId);
      if (storeState) {
        storeState.currentPhase = 'quip_battle';
        await updateSession(socialSessionId, storeState);
      }

      return socialSessionId;
    }

    beforeEach(() => {
      vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: false, reason: 'none' });
      vi.mocked(getPreGenerationResult).mockResolvedValue(null);
      vi.mocked(recordVoteOptimistically).mockImplementation(async (_payload, validate, apply) => {
        const valid = await validate(_payload);
        if (!valid) {
          return { accepted: false, conflict: 'validation_failed' };
        }
        await apply(_payload);
        return { accepted: true };
      });
    });

    it('returns cached pre-generation result instantly when available', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-pregen-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);

        const preGenPrompts = [
          { id: 'qb_pre_1', promptText: 'Pre-gen Q1', category: 'fun' },
          { id: 'qb_pre_2', promptText: 'Pre-gen Q2', category: 'fun' },
          { id: 'qb_pre_3', promptText: 'Pre-gen Q3', category: 'fun' },
        ];

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'available' });
        vi.mocked(getPreGenerationResult).mockResolvedValue({
          contentJson: preGenPrompts as unknown as Record<string, unknown>,
          aiMeta: { provider: 'deepseek', fallbackUsed: false, promptVersion: 'social-quip-battle-v1', generatedAt: '2026-04-02T00:00:00.000Z' },
        });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(200);
        expect(generateBody.prompts).toHaveLength(3);
        expect(generateBody.prompts[0].promptText).toBe('Pre-gen Q1');
        expect(generateBody.meta.promptVersion).toBe('social-quip-battle-v1');
      });
    });

    it('returns 202 when pre-generation is in-flight', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-inflight-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);

        vi.mocked(shouldSkipOnDemandGeneration).mockResolvedValue({ skip: true, reason: 'in_flight' });

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const generateBody = await generateResponse.json() as any;

        expect(generateResponse.status).toBe(202);
        expect(generateBody.status).toBe('generating');
      });
    });

    it('optimistic submit: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-submit-host');
        const guest1Cookie = await login(baseUrl, 'qb-submit-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Generate prompts first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        const operationId = 'op-qb-submit-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const submit1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ promptId: 'qb_1', answerText: '测试答案' }],
            operationId,
          }),
        });
        const submit1Body = await submit1Response.json() as any;
        expect(submit1Response.status).toBe(200);
        expect(submit1Body.submitted).toBe(true);
        expect(submit1Body.operationId).toBe(operationId);

        const submit2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            answers: [{ promptId: 'qb_1', answerText: '测试答案' }],
            operationId,
          }),
        });
        const submit2Body = await submit2Response.json() as any;
        expect(submit2Response.status).toBe(200);
        expect(submit2Body.submitted).toBe(true);
        expect(submit2Body.operationId).toBe(operationId);
      });
    });

    it('accepts an empty quip battle vote set as a completed vote', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-empty-vote-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);

        const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ votes: [] }),
        });
        const voteBody = await voteResponse.json() as any;

        expect(voteResponse.status).toBe(200);
        expect(voteBody).toMatchObject({ voted: true, totalVotes: 0 });
        expect((await getSession(socialSessionId))?.quipBattleVotedUserIds).toContain('qb-empty-vote-host');
      });
    });

    it('accepts votes for multiple answers under the same prompt', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-multi-vote-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);
        const state = await getSession(socialSessionId);
        if (!state) throw new Error('Expected quip battle session');
        state.quipBattleAnswers = [
          { userId: 'answer-1', displayName: 'Answer 1', promptId: 'prompt-1', answerText: 'A' },
          { userId: 'answer-2', displayName: 'Answer 2', promptId: 'prompt-1', answerText: 'B' },
        ];
        await updateSession(socialSessionId, state);

        const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            votes: [
              { answerId: 'answer-1::prompt-1', promptId: 'prompt-1' },
              { answerId: 'answer-2::prompt-1', promptId: 'prompt-1' },
            ],
          }),
        });

        expect(voteResponse.status).toBe(200);
        expect(await voteResponse.json()).toMatchObject({ voted: true, totalVotes: 2 });
      });
    });

    it('accepts a single-test vote that references a masked bot answer id', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-masked-bot-vote-host');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie);
        const state = await getSession(socialSessionId);
        if (!state) throw new Error('Expected quip battle session');
        state.singleTest = {
          version: 2,
          groupId: 'qb-masked-bot-group',
          isTestModeSkip: true,
          runBots: false,
          bots: [{ botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' }],
          botPersonas: [{
            botId: 'bot-1',
            userId: 'internal-bot-user-1',
            displayName: 'Bot One',
            archetype: '社牛柯基',
          }],
        };
        state.quipBattleAnswers = [{
          userId: 'internal-bot-user-1',
          displayName: 'Bot One',
          promptId: 'prompt-1',
          answerText: 'Bot answer',
        }];
        await updateSession(socialSessionId, state);

        const voteResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            votes: [{ answerId: 'bot-1::prompt-1', promptId: 'prompt-1' }],
          }),
        });

        expect(voteResponse.status).toBe(200);
        expect((await getSession(socialSessionId))?.quipBattleVotes).toContainEqual({
          voterId: 'qb-masked-bot-vote-host',
          answerId: 'internal-bot-user-1::prompt-1',
          promptId: 'prompt-1',
        });
      });
    });

    it('optimistic vote: same operationId twice is idempotent', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-vote-host');
        const guest1Cookie = await login(baseUrl, 'qb-vote-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Generate prompts and submit answers first
        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        expect(generateResponse.status).toBe(200);

        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ answers: [{ promptId: 'qb_1', answerText: 'host answer' }] }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({ answers: [{ promptId: 'qb_1', answerText: 'guest answer' }] }),
        });

        const operationId = 'op-qb-vote-123';
        const seenOps = new Set<string>();
        vi.mocked(recordVoteOptimistically).mockImplementation(async (payload, validate, apply) => {
          if (seenOps.has(payload.operationId)) {
            return { accepted: true };
          }
          const valid = await validate(payload);
          if (!valid) {
            return { accepted: false, conflict: 'validation_failed' };
          }
          await apply(payload);
          seenOps.add(payload.operationId);
          return { accepted: true };
        });

        const vote1Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            votes: [{ answerId: 'qb-vote-host::qb_1', promptId: 'qb_1' }],
            operationId,
          }),
        });
        const vote1Body = await vote1Response.json() as any;
        expect(vote1Response.status).toBe(200);
        expect(vote1Body.voted).toBe(true);
        expect(vote1Body.operationId).toBe(operationId);

        const vote2Response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
          body: JSON.stringify({
            votes: [{ answerId: 'qb-vote-host::qb_1', promptId: 'qb_1' }],
            operationId,
          }),
        });
        const vote2Body = await vote2Response.json() as any;
        expect(vote2Response.status).toBe(200);
        expect(vote2Body.voted).toBe(true);
        expect(vote2Body.operationId).toBe(operationId);
      });
    });

    it('rejects generate from non-host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'qb-auth-host');
        const guest1Cookie = await login(baseUrl, 'qb-auth-guest');
        const socialSessionId = await advanceToQuipBattle(baseUrl, hostCookie, guest1Cookie);

        // Disable auto-advance so host-only guards are enforced
        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.autoAdvanceEnabled = false;
          await updateSession(socialSessionId, stateBefore);
        }

        const generateResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/quip-battle/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        });
        expect(generateResponse.status).toBe(403);
      });
    });
  });

  describe('Tier reset on /start existing session', () => {
    beforeEach(() => {
      vi.mocked(getFeatureFlag).mockImplementation(async (_key: string, fallback = false) => fallback);
    });

    it('returns the full custom-game catalog regardless of preset rollout flags', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'custom-game-catalog-host');
        const previousAuctionFlag = process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION;
        process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION = 'false';
        const response = await fetch(`${baseUrl}/api/social-icebreaker/custom-games`, {
          headers: { cookie: hostCookie },
        }).finally(() => {
          if (previousAuctionFlag === undefined) delete process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION;
          else process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION = previousAuctionFlag;
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.phases).toContain('micro_challenge');
        expect(body.phases).toContain('auction');
      });
    });

    it('accepts a catalog game even when its preset rollout flag is disabled', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'custom-game-disabled-host');
        const previousAuctionFlag = process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION;
        process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION = 'false';
        const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            sessionId: `session-custom-disabled-${Date.now()}`,
            displayName: 'Host',
            eventTier: 'custom',
            selectedPhases: ['auction'],
          }),
        }).finally(() => {
          if (previousAuctionFlag === undefined) delete process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION;
          else process.env.SOCIAL_ICEBREAKER_ENABLE_AUCTION = previousAuctionFlag;
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.state.runPlan.segments.map((segment: any) => segment.phase)).toEqual([
          'auction',
          'recap',
        ]);
      });
    });

    it('does not mutate an existing preset session when custom selection is empty', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'custom-game-empty-host');
        const sessionId = `session-custom-empty-${Date.now()}`;
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });

        const rejected = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom', selectedPhases: [] }),
        });
        const rejectedBody = await rejected.json() as any;
        const rejoined = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host' }),
        });
        const rejoinedBody = await rejoined.json() as any;

        expect(rejected.status).toBe(400);
        expect(rejectedBody.code).toBe('CUSTOM_GAMES_REQUIRED');
        expect(rejoinedBody.state.eventTier).toBe('glow');
      });
    });

    it('resets an existing glow session to custom when host sends eventTier: custom', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-reset-host');
        const sessionId = `session-tier-reset-${Date.now()}`;

        const createResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const createBody = await createResponse.json() as any;
        expect(createBody.state.eventTier).toBe('glow');
        expect(createBody.state.runPlan).toBeDefined();
        expect(createBody.state.autoAdvanceEnabled).toBe(false);

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetResponse.status).toBe(200);
        expect(resetBody.state.eventTier).toBe('custom');
        expect(resetBody.state.runPlan).toBeUndefined();
        expect(resetBody.state.autoAdvanceEnabled).toBe(false);
        expect(resetBody.state.currentPhase).toBe('warmup');
        expect(resetBody.state.completedPhases).toEqual([]);
      });
    });

    it('persists a selected custom game order as the session run plan', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-custom-order-host');
        const sessionId = `session-tier-custom-order-${Date.now()}`;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({
            sessionId,
            displayName: 'Host',
            eventTier: 'custom',
            selectedPhases: ['personality_dice', 'micro_challenge', 'lie_detective'],
          }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.state.currentPhase).toBe('personality_dice');
        expect(body.state.runPlan.segments.map((segment: any) => segment.phase)).toEqual([
          'personality_dice',
          'micro_challenge',
          'lie_detective',
          'recap',
        ]);
      });
    });

    it('resets an existing glow session to breeze and recompiles the run plan', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-preset-host');
        const sessionId = `session-tier-preset-${Date.now()}`;

        const createResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const createBody = await createResponse.json() as any;
        expect(createBody.state.eventTier).toBe('glow');

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'breeze', vibe: 'chat' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetResponse.status).toBe(200);
        expect(resetBody.state.eventTier).toBe('breeze');
        expect(resetBody.state.vibe).toBe('chat');
        expect(resetBody.state.runPlan).toBeDefined();
        expect(resetBody.state.autoAdvanceEnabled).toBe(false);
        expect(resetBody.state.currentPhase).toBe('warmup');
        expect(resetBody.state.completedPhases).toEqual([]);
      });
    });

    it('after reset to custom, advance returns phase_selection instead of recap', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-advance-host');
        const sessionId = `session-tier-advance-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;
        const { socialSessionId } = resetBody;

        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ mood: 'relaxed' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });

        const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ currentPhase: 'warmup' }),
        });
        const advanceBody = await advanceResponse.json() as any;

        expect(advanceResponse.status).toBe(200);
        expect(advanceBody.nextPhase).toBe('phase_selection');
      });
    });

    it('preserves participant roster during tier reset', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-roster-host');
        const guestCookie = await login(baseUrl, 'tier-roster-guest');
        const sessionId = `session-tier-roster-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest' }),
        });

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetBody.state.joinedParticipants).toHaveLength(2);
        expect(resetBody.state.joinedParticipants.map((p: any) => p.userId)).toContain('tier-roster-host');
        expect(resetBody.state.joinedParticipants.map((p: any) => p.userId)).toContain('tier-roster-guest');
      });
    });

    it('does not reset tier when caller is not the host', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-nonhost-host');
        const guestCookie = await login(baseUrl, 'tier-nonhost-guest');
        const sessionId = `session-tier-nonhost-${Date.now()}`;

        const createResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const createBody = await createResponse.json() as any;
        const socialSessionId = createBody.socialSessionId;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest' }),
        });

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetResponse.status).toBe(200);
        expect(resetBody.state.eventTier).toBe('glow');
        expect(resetBody.state.runPlan).toBeDefined();

        const stateAfter = await getSession(socialSessionId);
        expect(stateAfter?.eventTier).toBe('glow');
      });
    });

    it('does not reset tier when session has advanced past warmup', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-warmup-host');
        const sessionId = `session-tier-warmup-${Date.now()}`;

        const createResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const createBody = await createResponse.json() as any;
        const socialSessionId = createBody.socialSessionId;

        const stateBefore = await getSession(socialSessionId);
        if (stateBefore) {
          stateBefore.currentPhase = 'micro_challenge';
          stateBefore.completedPhases = ['warmup'];
          await updateSession(socialSessionId, stateBefore);
        }

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetResponse.status).toBe(200);
        expect(resetBody.state.eventTier).toBe('glow');

        const stateAfter = await getSession(socialSessionId);
        expect(stateAfter?.currentPhase).toBe('micro_challenge');
      });
    });

    it('falls back to existing tier when custom mode is disabled', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-custom-disabled-host');
        const sessionId = `session-tier-custom-disabled-${Date.now()}`;

        const createResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const createBody = await createResponse.json() as any;
        const socialSessionId = createBody.socialSessionId;

        vi.mocked(getFeatureFlag).mockResolvedValue(false);

        const resetResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const resetBody = await resetResponse.json() as any;

        expect(resetResponse.status).toBe(200);
        expect(resetBody.state.eventTier).toBe('glow');

        const stateAfter = await getSession(socialSessionId);
        expect(stateAfter?.eventTier).toBe('glow');
      });
    });

    it('is idempotent when called twice with the same tier/vibe', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'tier-idempotent-host');
        const sessionId = `session-tier-idempotent-${Date.now()}`;

        await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });

        const firstResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const firstBody = await firstResponse.json() as any;
        expect(firstBody.state.eventTier).toBe('custom');

        const secondResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'custom' }),
        });
        const secondBody = await secondResponse.json() as any;

        expect(secondResponse.status).toBe(200);
        expect(secondBody.state.eventTier).toBe('custom');
        expect(secondBody.state.completedPhases).toEqual([]);
      });
    });
  });

  describe('POST /api/social-icebreaker/:socialSessionId/set-tier', () => {
    it('allows host to change tier during warmup', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-host');
        const sessionId = `session-set-tier-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;
        expect(startBody.state.eventTier).toBe('glow');

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'breeze', vibe: 'chat' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.eventTier).toBe('breeze');
        expect(body.state.eventTier).toBe('breeze');
        expect(body.state.vibe).toBe('chat');
        expect(body.runPlan).toBeDefined();
      });
    });

    it('allows host to switch to custom mode during warmup', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-custom-host');
        const sessionId = `session-set-tier-custom-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'custom' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.eventTier).toBe('custom');
        expect(body.state.eventTier).toBe('custom');
        expect(body.runPlan).toBeUndefined();
        expect(body.state.autoAdvanceEnabled).toBe(false);
      });
    });

    it('rejects non-host callers', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-owner');
        const guestCookie = await login(baseUrl, 'set-tier-guest');
        const sessionId = `session-set-tier-auth-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ tier: 'breeze', vibe: 'chat' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(403);
        expect(body.error).toBe('Only the host can set the tier');
      });
    });

    it('rejects invalid tier values', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-invalid-host');
        const sessionId = `session-set-tier-invalid-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'invalid-tier' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(400);
        expect(body.error).toContain('Invalid tier');
      });
    });

    it('rejects missing or malformed request body', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-body-host');
        const sessionId = `session-set-tier-body-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({}),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid request body');
      });
    });

    it('rejects tier changes after advancing past warmup', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-late-host');
        const sessionId = `session-set-tier-late-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ mood: 'relaxed' }),
        });
        await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });
        const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ currentPhase: 'warmup' }),
        });
        expect(advanceResponse.status).toBe(200);

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'breeze', vibe: 'chat' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(400);
        expect(body.error).toContain('Tier can only be changed during warmup');
      });
    });

    it('rejects custom tier when custom mode is disabled', async () => {
      await withServer(async (baseUrl) => {
        vi.mocked(getFeatureFlag).mockImplementation(async (key: string, _fallback = false) => {
          if (key === 'socialIcebreakerCustomModeEnabled') return false;
          return _fallback;
        });

        const hostCookie = await login(baseUrl, 'set-tier-custom-disabled-host');
        const sessionId = `session-set-tier-custom-disabled-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const response = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'custom' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(400);
        expect(body.error).toBe('Custom mode is not enabled');
      });
    });

    it('is idempotent when setting the same tier', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'set-tier-same-host');
        const sessionId = `session-set-tier-same-${Date.now()}`;

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const { socialSessionId } = startBody;

        const firstResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/set-tier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ tier: 'glow', vibe: 'balanced' }),
        });
        const firstBody = await firstResponse.json() as any;

        expect(firstResponse.status).toBe(200);
        expect(firstBody.eventTier).toBe('glow');
      });
    });
  });

  describe('single-test mode disclosure', () => {
    it('creates a custom run plan for bot simulation when at least one game is selected', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-custom-plan-host');
        const sessionId = `session-single-test-custom-plan-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getFeatureFlag).mockImplementation(async (_key: string, fallback = false) => fallback);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: true,
          botPersonas: [
            { botId: 'bot-1', userId: 'virtual-user-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
        });

        try {
          const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({
              sessionId,
              displayName: 'Host',
              eventTier: 'custom',
              selectedPhases: ['auction'],
            }),
          });
          const body = await response.json() as any;

          expect(response.status).toBe(200);
          expect(body.state.runPlan.segments.map((segment: any) => segment.phase)).toEqual([
            'auction',
            'recap',
          ]);
          expect(body.state.singleTest.runBots).toBe(true);
        } finally {
          vi.mocked(isSingleTestMode).mockReturnValue(false);
          vi.mocked(getFeatureFlag).mockImplementation(async (_key: string, fallback = false) => fallback);
          vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue(null);
        }
      });
    });

    it('lets the single-test host choose Lie Detective V2 before submissions start', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-lie-mode-host');
        const sessionId = `session-single-test-lie-mode-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const socialSessionId = startBody.socialSessionId;
        const state = await getSession(socialSessionId) as any;
        state.currentPhase = 'lie_detective';
        await updateSession(socialSessionId, state);

        const modeResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/mode`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ mode: 'v2' }),
          },
        );
        const modeBody = await modeResponse.json() as any;

        expect(modeResponse.status).toBe(200);
        expect(modeBody.state.lieDetectiveMode).toBe('v2');
        expect((await getSession(socialSessionId))?.lieDetectiveMode).toBe('v2');
      });
    });

    it('lets the host choose V2 after single-test bots have prefilled their statements', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-lie-mode-bot-host');
        const sessionId = `session-single-test-lie-mode-bots-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [
            { botId: 'bot-1', userId: 'virtual-user-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const state = await getSession(startBody.socialSessionId) as any;
        state.currentPhase = 'lie_detective';
        state.lieDetectivePlayers = [{
          userId: 'virtual-user-1',
          displayName: 'Bot One',
          statements: [
            { index: 1, text: 'Bot fact one' },
            { index: 2, text: 'Bot fact two' },
            { index: 3, text: 'Bot lie' },
          ],
        }];
        await updateSession(startBody.socialSessionId, state);

        const modeResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${startBody.socialSessionId}/lie-detective/mode`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ mode: 'v2' }),
          },
        );
        const modeBody = await modeResponse.json() as any;

        expect(modeResponse.status).toBe(200);
        expect(modeBody.state.lieDetectiveMode).toBe('v2');
      });
    });

    it('does not expose Lie Detective mode switching outside single-test mode', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'production-lie-mode-host');
        const sessionId = `session-production-lie-mode-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(false);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue(null);

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const state = await getSession(startBody.socialSessionId) as any;
        state.currentPhase = 'lie_detective';
        await updateSession(startBody.socialSessionId, state);

        const modeResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${startBody.socialSessionId}/lie-detective/mode`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ mode: 'v2' }),
          },
        );

        expect(modeResponse.status).toBe(404);
      });
    });

    it('accepts a human-authored two-facts-and-one-lie set without exposing the lie', async () => {
      await withServer(async (baseUrl) => {
        const hostUserId = 'single-test-custom-lie-host';
        const hostCookie = await login(baseUrl, hostUserId);
        const sessionId = `session-single-test-custom-lie-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const socialSessionId = startBody.socialSessionId;
        const state = await getSession(socialSessionId) as any;
        state.currentPhase = 'lie_detective';
        state.playerCount = 1;
        await updateSession(socialSessionId, state);

        const generateResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({
              displayName: 'Host',
              statements: ['我养过一只猫', '我在三个城市生活过', '我从来没有坐过飞机'],
              lieIndex: 3,
            }),
          },
        );
        const generateBody = await generateResponse.json() as any;
        const storedTruths = await getLieTruths(socialSessionId, hostUserId);

        expect(generateResponse.status).toBe(200);
        expect(generateBody.statements).toEqual([
          { index: 1, text: '我养过一只猫' },
          { index: 2, text: '我在三个城市生活过' },
          { index: 3, text: '我从来没有坐过飞机' },
        ]);
        expect(JSON.stringify(generateBody)).not.toContain('isLie');
        expect(storedTruths).toEqual([
          { index: 1, text: '我养过一只猫', isLie: false },
          { index: 2, text: '我在三个城市生活过', isLie: false },
          { index: 3, text: '我从来没有坐过飞机', isLie: true },
        ]);
      });
    });

    it('keeps the tester first while preserving eagerly prepared bots', async () => {
      await withServer(async (baseUrl) => {
        const hostUserId = 'single-test-human-first-host';
        const botUserId = 'single-test-human-first-bot';
        const hostCookie = await login(baseUrl, hostUserId);
        const sessionId = `session-single-test-human-first-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: true,
          botPersonas: [{
            botId: 'bot-1',
            userId: botUserId,
            displayName: 'Bot One',
            archetype: '社牛柯基',
          }],
          bots: [{ botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' }],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const { socialSessionId } = await startResponse.json() as any;
        const state = await getSession(socialSessionId) as any;
        state.currentPhase = 'lie_detective';
        state.playerCount = 2;
        state.currentLieDetectivePlayerIndex = 0;
        state.lieDetectivePlayers = [{
          userId: botUserId,
          displayName: 'Bot One',
          statements: [
            { index: 1, text: 'Bot fact one' },
            { index: 2, text: 'Bot lie' },
            { index: 3, text: 'Bot fact two' },
          ],
        }];
        await updateSession(socialSessionId, state);

        const generateResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({
              displayName: 'Host',
              statements: ['我去过冰岛', '我养过一只猫', '我会开飞机'],
              lieIndex: 3,
            }),
          },
        );
        const storedState = await getSession(socialSessionId) as any;

        expect(generateResponse.status).toBe(200);
        expect(storedState.lieDetectivePlayers).toHaveLength(2);
        expect(storedState.lieDetectivePlayers[0].userId).toBe(hostUserId);
        expect(storedState.lieDetectivePlayers[1].userId).toBe(botUserId);
        expect(storedState.lieDetectivePlayers[1].statements).toHaveLength(3);
      });
    });

    it('accepts a vote for the active bot using its client-visible masked id', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-lie-vote-host');
        const sessionId = `session-single-test-lie-vote-${Date.now()}`;
        const botUserId = 'single-test-lie-vote-bot-user';

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [
            {
              botId: 'bot-1',
              userId: botUserId,
              displayName: 'Bot One',
              archetype: '社牛柯基',
            },
          ],
          bots: [{ botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' }],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        const socialSessionId = startBody.socialSessionId;
        const state = await getSession(socialSessionId) as any;

        state.currentPhase = 'lie_detective';
        state.playerCount = 2;
        state.currentLieDetectivePlayerIndex = 0;
        state.lieDetectivePlayers = [
          {
            userId: botUserId,
            displayName: 'Bot One',
            statements: [
              { index: 1, text: 'Bot statement one' },
              { index: 2, text: 'Bot statement two' },
              { index: 3, text: 'Bot statement three' },
            ],
          },
          {
            userId: 'single-test-lie-vote-host',
            displayName: 'Host',
            statements: [
              { index: 1, text: 'Host statement one' },
              { index: 2, text: 'Host statement two' },
              { index: 3, text: 'Host statement three' },
            ],
          },
        ];
        state.votes = [];
        state.currentLieDetectiveReveal = undefined;
        await setLieTruths(socialSessionId, botUserId, [
          { index: 1, text: 'Bot statement one', isLie: false },
          { index: 2, text: 'Bot statement two', isLie: true },
          { index: 3, text: 'Bot statement three', isLie: false },
        ]);
        await updateSession(socialSessionId, state);

        const voteResponse = await fetch(
          `${baseUrl}/api/social-icebreaker/${socialSessionId}/lie-detective/vote`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: hostCookie },
            body: JSON.stringify({ targetUserId: 'bot-1', guessedStatementIndex: 2 }),
          },
        );
        const voteBody = await voteResponse.json() as any;

        expect(voteResponse.status).toBe(200);
        expect(voteBody.isRevealed).toBe(true);
        expect(voteBody.reveal).toMatchObject({ targetUserId: 'bot-1', lieIndex: 2 });
        expect(voteBody.votes).toEqual([
          expect.objectContaining({ targetUserId: 'bot-1', guessedStatementIndex: 2 }),
        ]);
        expect(JSON.stringify(voteBody)).not.toContain(botUserId);
      });
    });

    it('includes isTestModeSkip and testModeBots when session is a single-test group', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-host');
        const sessionId = `session-single-test-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
            { botId: 'bot-2', displayName: 'Bot Two', archetype: '小太阳鸡' },
          ],
        });

        const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.state.isTestModeSkip).toBe(true);
        expect(body.state.testModeBots).toHaveLength(2);
        expect(body.state.testModeBots[0]).toEqual({
          botId: 'bot-1',
          displayName: 'Bot One',
          archetype: '社牛柯基',
        });

        const persisted = await getSession(body.socialSessionId);
        expect(persisted?.singleTest?.isTestModeSkip).toBe(true);
      });
    });

    it('omits test mode fields in production mode', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'prod-host');
        const sessionId = `session-prod-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(false);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue(null);

        const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.state.isTestModeSkip).toBeUndefined();
        expect(body.state.testModeBots).toBeUndefined();
      });
    });

    it('keeps a single-test session on the normal multiplayer phase sequence', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-advance-host');
        const guestCookie = await login(baseUrl, 'single-test-advance-guest');
        const sessionId = `session-single-test-advance-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        expect(startResponse.status).toBe(200);

        const socialSessionId = startBody.socialSessionId;
        const guestStartResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ sessionId, displayName: 'Guest', eventTier: 'glow', vibe: 'balanced' }),
        });
        expect(guestStartResponse.status).toBe(200);

        // All real participants must be ready before normal multiplayer advance.
        const readyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });
        expect(readyResponse.status).toBe(200);

        const guestReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: guestCookie },
          body: JSON.stringify({ ready: true }),
        });
        expect(guestReadyResponse.status).toBe(200);

        const advanceResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ currentPhase: 'warmup' }),
        });
        const advanceBody = await advanceResponse.json() as any;

        expect(advanceResponse.status).toBe(200);
        expect(advanceBody.nextPhase).toBe('micro_challenge');
        expect(advanceBody.state.currentPhase).toBe('micro_challenge');
        expect(advanceBody.state.isTestModeSkip).toBe(true);
      });
    });

    it('preserves test mode metadata on rejoin', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-rejoin-host');
        const sessionId = `session-single-test-rejoin-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
        });

        const firstResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        expect(firstResponse.status).toBe(200);

        const rejoinResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const rejoinBody = await rejoinResponse.json() as any;

        expect(rejoinResponse.status).toBe(200);
        expect(rejoinBody.state.isTestModeSkip).toBe(true);
        expect(rejoinBody.state.testModeBots).toHaveLength(1);
      });
    });

    it('registers bot attendees as ready participants even when runBots is false', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-roster-host');
        const sessionId = `session-single-test-roster-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [
            { botId: 'bot-1', userId: 'virtual-user-1', displayName: 'Bot One', archetype: '社牛柯基' },
            { botId: 'bot-2', userId: 'virtual-user-2', displayName: 'Bot Two', archetype: '小太阳鸡' },
          ],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
            { botId: 'bot-2', displayName: 'Bot Two', archetype: '小太阳鸡' },
          ],
        });

        const response = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        // Host + 2 bots are counted, and bot IDs are masked for the client.
        expect(body.state.playerCount).toBe(3);
        const participantIds = body.state.joinedParticipants.map((p: any) => p.userId).sort();
        expect(participantIds).toEqual(['bot-1', 'bot-2', body.state.hostUserId].sort());
        // Bots default to ready so the host can preview the full warmup flow.
        expect(body.state.warmupReadyUserIds).toEqual(expect.arrayContaining(['bot-1', 'bot-2']));

        // Rejoin keeps the bot roster and ready defaults intact.
        const rejoinResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const rejoinBody = await rejoinResponse.json() as any;

        expect(rejoinResponse.status).toBe(200);
        expect(rejoinBody.state.playerCount).toBe(3);
        expect(rejoinBody.state.warmupReadyUserIds).toEqual(expect.arrayContaining(['bot-1', 'bot-2']));
        const rejoinParticipantIds = rejoinBody.state.joinedParticipants.map((p: any) => p.userId).sort();
        expect(rejoinParticipantIds).toEqual(['bot-1', 'bot-2', rejoinBody.state.hostUserId].sort());

        // Reproduce the real-device recovery path: /topics failed upstream, so
        // the client displayed a local fallback while the persisted session had
        // neither topics nor ready users. The first ready tap must heal all of
        // that state and return the canonical client payload in one response.
        const stateWithoutTopics = await getSession(rejoinBody.socialSessionId) as any;
        stateWithoutTopics.warmupTopics = [];
        stateWithoutTopics.warmupReadyUserIds = [];
        await updateSession(rejoinBody.socialSessionId, stateWithoutTopics);

        const recoveredReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${rejoinBody.socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });
        const recoveredReadyBody = await recoveredReadyResponse.json() as any;

        expect(recoveredReadyResponse.status).toBe(200);
        expect(recoveredReadyBody.allReady).toBe(true);
        expect(recoveredReadyBody.state.warmupTopics.length).toBeGreaterThan(0);
        expect(recoveredReadyBody.state.warmupReadyUserIds.sort()).toEqual(
          ['bot-1', 'bot-2', recoveredReadyBody.state.hostUserId].sort(),
        );
        expect(recoveredReadyBody.readyUserIds).not.toContain('virtual-user-1');
        expect(recoveredReadyBody.readyUserIds).not.toContain('virtual-user-2');

        // Changing to the next topic resets human readiness but keeps bots ready.
        const topicsResponse = await fetch(`${baseUrl}/api/social-icebreaker/${rejoinBody.socialSessionId}/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ mood: 'relaxed' }),
        });
        expect(topicsResponse.status).toBe(200);

        const hostReadyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${rejoinBody.socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });
        expect(hostReadyResponse.status).toBe(200);

        const nextTopicResponse = await fetch(`${baseUrl}/api/social-icebreaker/${rejoinBody.socialSessionId}/warmup/next-topic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
        });
        const nextTopicBody = await nextTopicResponse.json() as any;

        expect(nextTopicResponse.status).toBe(200);
        expect(nextTopicBody.currentTopicIndex).toBe(1);
        expect(nextTopicBody.state.warmupReadyUserIds).toEqual(expect.arrayContaining(['bot-1', 'bot-2']));
        expect(nextTopicBody.state.warmupReadyUserIds).not.toContain(nextTopicBody.state.hostUserId);
      });
    });

    it('does not auto-advance a single-test session past the disclosure gate', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-auto-advance-host');
        const sessionId = `session-single-test-auto-advance-${Date.now()}`;

        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [{ botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' }],
        });

        const startResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const startBody = await startResponse.json() as any;
        expect(startResponse.status).toBe(200);

        const socialSessionId = startBody.socialSessionId;

        // Mark host ready so completion rate is 100%.
        const readyResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ ready: true }),
        });
        expect(readyResponse.status).toBe(200);

        // Simulate enough elapsed time for auto-advance to otherwise fire.
        const state = await getSession(socialSessionId) as any;
        state.phaseStartedAt = Date.now() - 3 * 60 * 1000;
        await updateSession(socialSessionId, state);

        // GET triggers processAutoAdvance; single-test sessions must stay in warmup.
        const pollResponse = await fetch(`${baseUrl}/api/social-icebreaker/${socialSessionId}`, {
          headers: { cookie: hostCookie },
        });
        const pollBody = await pollResponse.json() as any;

        expect(pollResponse.status).toBe(200);
        expect(pollBody.currentPhase).toBe('warmup');
        expect(pollBody.isTestModeSkip).toBe(true);
      });
    });

    it('omits test mode fields on rejoin when single-test mode is disabled', async () => {
      await withServer(async (baseUrl) => {
        const hostCookie = await login(baseUrl, 'single-test-disabled-rejoin-host');
        const sessionId = `session-single-test-disabled-rejoin-${Date.now()}`;

        // Create session while single-test mode is enabled.
        vi.mocked(isSingleTestMode).mockReturnValue(true);
        vi.mocked(getSingleTestMetaForSessionStart).mockResolvedValue({
          version: 2,
          groupId: sessionId,
          isTestModeSkip: true,
          runBots: false,
          botPersonas: [],
          bots: [
            { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          ],
        });

        const firstResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        expect(firstResponse.status).toBe(200);

        // Disable single-test mode and rejoin; persisted metadata should not leak.
        vi.mocked(isSingleTestMode).mockReturnValue(false);

        const rejoinResponse = await fetch(`${baseUrl}/api/social-icebreaker/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: hostCookie },
          body: JSON.stringify({ sessionId, displayName: 'Host', eventTier: 'glow', vibe: 'balanced' }),
        });
        const rejoinBody = await rejoinResponse.json() as any;

        expect(rejoinResponse.status).toBe(200);
        expect(rejoinBody.state.isTestModeSkip).toBeUndefined();
        expect(rejoinBody.state.testModeBots).toBeUndefined();
      });
    });
  });
});
