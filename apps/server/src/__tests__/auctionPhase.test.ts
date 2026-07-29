/**
 * Auction Phase Tests
 *
 * Routes under test:
 *   POST /api/social-icebreaker/:socialSessionId/auction/generate-lots
 *   POST /api/social-icebreaker/:socialSessionId/auction/bid
 *   POST /api/social-icebreaker/:socialSessionId/auction/close-lot
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { AUCTION_STARTING_COINS } from '@shared/socialIcebreaker';
import { GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { generateAuctionLots } from '../socialIcebreakerAIService';

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

vi.mock('../rateLimiter', () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
  momentCardLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../contentFilter', () => ({
  filterContent: (text: string) => text,
}));

const { default: socialIcebreakerRouter } = await import('../routes/socialIcebreaker');

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

function baseAuctionSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: overrides.socialSessionId ?? 'social_auction-test',
    icebreakerSessionId: 'auction-test',
    currentPhase: 'auction',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'glow',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: GLOW_RUN_PLAN,
    ...overrides,
  };
}

function seedAuctionParticipants(socialSessionId: string): void {
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

function seedAuctionSession(
  socialSessionId: string,
  overrides?: { phase?: string; lots?: boolean; allClosed?: boolean; highBid?: { userId: string; amount: number } | null },
): void {
  const state = baseAuctionSession({
    socialSessionId,
    currentPhase: (overrides?.phase as SocialSessionState['currentPhase']) ?? 'auction',
  });
  if (overrides?.lots) {
    state.auctionLots = [
      { id: 'lot-1', title: '最佳段子手奖杯', teaser: '一个神秘的奖杯', emoji: '🏆' },
      { id: 'lot-2', title: '神秘零食大礼包', teaser: '不知道里面有什么', emoji: '🎁' },
    ];
    state.auctionLotsMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
      promptVersion: 'social-auction-lots-v2',
    };
    state.auctionCurrentLotIndex = 0;
    const balances: Record<string, number> = {};
    balances['host-user'] = AUCTION_STARTING_COINS;
    balances['guest-1'] = AUCTION_STARTING_COINS;
    balances['guest-2'] = AUCTION_STARTING_COINS;
    balances['guest-3'] = AUCTION_STARTING_COINS;
    state.auctionBalances = balances;
    state.auctionHighBid = overrides?.highBid ?? null;
    state.auctionAllLotsClosed = overrides?.allClosed ?? false;
    state.auctionRecapLines = [];
    state.auctionBidHistory = [];
  }
  storeCtx.sessions.set(socialSessionId, state);
  seedAuctionParticipants(socialSessionId);
}

// --- POST /auction/generate-lots ---

describe('POST /api/social-icebreaker/:id/auction/generate-lots', () => {
  beforeEach(() => {
    vi.mocked(generateAuctionLots).mockReset();
    vi.mocked(generateAuctionLots).mockResolvedValue({
      data: [
        { id: 'lot-1', title: '最佳段子手奖杯', teaser: '一个神秘的奖杯', emoji: '🏆' },
        { id: 'lot-2', title: '神秘零食大礼包', teaser: '不知道里面有什么', emoji: '🎁' },
      ],
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-auction-lots-v2',
      },
    });
  });

  it('returns 401 without session cookie', async () => {
    const id = 'social_auc-gen-401';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_auc-gen-403';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in auction phase', async () => {
    const id = 'social_auc-gen-phase';
    seedAuctionSession(id, { phase: 'warmup' });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Not in auction phase');
    });
  });

  it('generates lots, sets balances, and returns full state', async () => {
    const id = 'social_auc-gen-200';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.lots).toHaveLength(2);
      expect(body.lots[0].id).toBe('lot-1');
      expect(body.currentLotIndex).toBe(0);
      expect(body.balances['host-user']).toBe(AUCTION_STARTING_COINS);
      expect(body.balances['guest-1']).toBe(AUCTION_STARTING_COINS);
      expect(body.balances['guest-2']).toBe(AUCTION_STARTING_COINS);
      expect(body.balances['guest-3']).toBe(AUCTION_STARTING_COINS);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.auctionLots).toHaveLength(2);
      expect(stored?.auctionAllLotsClosed).toBe(false);
      expect(stored?.auctionCurrentLotIndex).toBe(0);
      expect(stored?.auctionHighBid).toBeNull();
      expect(stored?.auctionBidHistory).toEqual([]);
    });
  });

  it('returns cached lots without regenerating', async () => {
    const id = 'social_auc-gen-cached';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      expect(generateAuctionLots).not.toHaveBeenCalled();
      const body = await res.json() as any;
      expect(body.lots).toHaveLength(2);
      expect(body.currentLotIndex).toBe(0);
    });
  });
});

// --- POST /auction/bid ---

describe('POST /api/social-icebreaker/:id/auction/bid', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_auc-bid-401';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50 }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for invalid bid (non-integer)', async () => {
    const id = 'social_auc-bid-invalid';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 'fifty' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('returns 400 for zero or negative bid', async () => {
    const id = 'social_auc-bid-zero';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 0 }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('returns 400 when not in auction phase', async () => {
    const id = 'social_auc-bid-phase';
    seedAuctionSession(id, { phase: 'warmup', lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 10 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Not in auction phase');
    });
  });

  it('returns 400 when lots have not been generated', async () => {
    const id = 'social_auc-bid-nolots';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 10 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Auction lots have not been generated yet');
    });
  });

  it('returns 400 when auction is complete', async () => {
    const id = 'social_auc-bid-complete';
    seedAuctionSession(id, { lots: true, allClosed: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 10 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Auction is complete');
    });
  });

  it('places first bid successfully', async () => {
    const id = 'social_auc-bid-first';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 50 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.highBid).toEqual({ userId: 'guest-1', amount: 50 });
      expect(body.balances['guest-1']).toBe(AUCTION_STARTING_COINS - 50);
      expect(body.previousHighBidder).toBeNull();

      const stored = storeCtx.sessions.get(id);
      expect(stored?.auctionHighBid).toEqual({ userId: 'guest-1', amount: 50 });
      expect(stored?.auctionBidHistory).toHaveLength(1);
      expect(stored?.auctionBidHistory![0].amount).toBe(50);
    });
  });

  it('requires bid to be higher than current high bid', async () => {
    const id = 'social_auc-bid-toolow';
    seedAuctionSession(id, { lots: true, highBid: { userId: 'guest-1', amount: 80 } });
    await withServer(async (baseUrl) => {
      const guest2Cookie = await login(baseUrl, 'guest-2');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ amount: 50 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Bid must be higher than the current high bid');
    });
  });

  it('returns 400 for insufficient balance', async () => {
    const id = 'social_auc-bid-nofunds';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: AUCTION_STARTING_COINS + 1 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('Insufficient virtual coins for this bid');
    });
  });

  it('lets the current high bidder raise their own bid using escrowed coins', async () => {
    const id = 'social_auc-bid-self-raise';
    seedAuctionSession(id, { lots: true, highBid: { userId: 'guest-1', amount: 50 } });
    const state = storeCtx.sessions.get(id)!;
    state.auctionBalances!['guest-1'] = AUCTION_STARTING_COINS - 50;
    storeCtx.sessions.set(id, state);

    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guestCookie },
        body: JSON.stringify({ amount: 60 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.highBid).toEqual({ userId: 'guest-1', amount: 60 });
      expect(body.balances['guest-1']).toBe(AUCTION_STARTING_COINS - 60);
      expect(body.previousHighBidder).toBe('guest-1');
    });
  });

  it('outbids previous bidder and refunds their coins', async () => {
    const id = 'social_auc-bid-outbid';
    seedAuctionSession(id, { lots: true, highBid: { userId: 'guest-1', amount: 50 } });
    // Adjust balances to reflect first bid
    const s = storeCtx.sessions.get(id)!;
    s.auctionBalances!['guest-1'] = AUCTION_STARTING_COINS - 50;
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const guest2Cookie = await login(baseUrl, 'guest-2');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ amount: 70 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.highBid).toEqual({ userId: 'guest-2', amount: 70 });
      // guest-1 should have been refunded their 50 coins
      expect(body.balances['guest-1']).toBe(AUCTION_STARTING_COINS);
      expect(body.balances['guest-2']).toBe(AUCTION_STARTING_COINS - 70);
      expect(body.previousHighBidder).toBe('guest-1');
    });
  });

  it('records bid history across multiple bids', async () => {
    const id = 'social_auc-bid-history';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');

      await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ amount: 30 }),
      });
      await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ amount: 50 }),
      });

      const stored = storeCtx.sessions.get(id);
      expect(stored?.auctionBidHistory).toHaveLength(2);
      expect(stored?.auctionBidHistory![0].userId).toBe('guest-1');
      expect(stored?.auctionBidHistory![0].amount).toBe(30);
      expect(stored?.auctionBidHistory![1].userId).toBe('guest-2');
      expect(stored?.auctionBidHistory![1].amount).toBe(50);
    });
  });
});

// --- POST /auction/close-lot ---

describe('POST /api/social-icebreaker/:id/auction/close-lot', () => {
  it('returns 401 without session cookie', async () => {
    const id = 'social_auc-close-401';
    seedAuctionSession(id, { lots: true, highBid: { userId: 'guest-1', amount: 50 } });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('returns 403 for non-host user', async () => {
    const id = 'social_auc-close-403';
    seedAuctionSession(id, { lots: true });
    await withServer(async (baseUrl) => {
      const guestCookie = await login(baseUrl, 'guest-1');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: guestCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it('returns 400 when not in auction phase', async () => {
    const id = 'social_auc-close-phase';
    seedAuctionSession(id, { phase: 'warmup', lots: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it('returns 400 when no active lot exists', async () => {
    const id = 'social_auc-close-nolot';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it('returns 400 when all lots are already closed', async () => {
    const id = 'social_auc-close-allclosed';
    seedAuctionSession(id, { lots: true, allClosed: true });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe('All auction lots are already closed');
    });
  });

  it('closes lot and awards to highest bidder', async () => {
    const id = 'social_auc-close-award';
    seedAuctionSession(id, { lots: true, highBid: { userId: 'guest-2', amount: 80 } });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.currentLotIndex).toBe(1);
      expect(body.allLotsClosed).toBe(false);
      expect(body.recapLines).toHaveLength(1);
      expect(body.recapLines[0]).toContain('Bob');
      expect(body.recapLines[0]).toContain('80');

      const stored = storeCtx.sessions.get(id);
      expect(stored?.auctionHighBid).toBeNull();
      expect(stored?.auctionCurrentLotIndex).toBe(1);
    });
  });

  it('records 流拍 when no bids were placed', async () => {
    const id = 'social_auc-close-nobids';
    seedAuctionSession(id, { lots: true, highBid: null });
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.recapLines[0]).toContain('流拍');
    });
  });

  it('closes last lot and sets allLotsClosed to true', async () => {
    const id = 'social_auc-close-last';
    seedAuctionSession(id, {
      lots: true,
      highBid: { userId: 'guest-1', amount: 50 },
    });
    // Set current to last lot
    const s = storeCtx.sessions.get(id)!;
    s.auctionCurrentLotIndex = 1;
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.allLotsClosed).toBe(true);

      const stored = storeCtx.sessions.get(id);
      expect(stored?.auctionAllLotsClosed).toBe(true);
      expect(stored?.autoAdvanceScheduledAt).toBeUndefined();
    });
  });

  it('closes multiple lots accumulating recap lines', async () => {
    const id = 'social_auc-close-multi';
    seedAuctionSession(id, {
      lots: true,
      highBid: { userId: 'guest-1', amount: 30 },
    });
    // Pre-populate one recap line
    const s = storeCtx.sessions.get(id)!;
    s.auctionRecapLines = ['lotA由Alice以20虚拟币拍下'];
    storeCtx.sessions.set(id, s);

    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.recapLines).toHaveLength(2);
    });
  });
});

// --- Cross-scenario ---

describe('Auction flow integration', () => {
  it('full auction flow: generate → bid → outbid → close → complete', async () => {
    const id = 'social_auc-flow';
    seedAuctionSession(id);
    await withServer(async (baseUrl) => {
      const hostCookie = await login(baseUrl, 'host-user');
      const guest1Cookie = await login(baseUrl, 'guest-1');
      const guest2Cookie = await login(baseUrl, 'guest-2');

      // 1. Generate lots
      const genRes = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(genRes.status).toBe(200);
      const genBody = await genRes.json() as any;
      expect(genBody.lots).toHaveLength(2);

      // 2. Guest 1 bids 30
      const bid1Res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest1Cookie },
        body: JSON.stringify({ amount: 30 }),
      });
      expect(bid1Res.status).toBe(200);

      // 3. Guest 2 outbids with 50
      const bid2Res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: guest2Cookie },
        body: JSON.stringify({ amount: 50 }),
      });
      expect(bid2Res.status).toBe(200);
      const bid2Body = await bid2Res.json() as any;
      expect(bid2Body.balances['guest-1']).toBe(AUCTION_STARTING_COINS); // refunded

      // 4. Host closes lot
      const closeRes = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(closeRes.status).toBe(200);

      // 5. Close last lot
      const close2Res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
        method: 'POST',
        headers: { cookie: hostCookie },
      });
      expect(close2Res.status).toBe(200);
      const close2Body = await close2Res.json() as any;
      expect(close2Body.allLotsClosed).toBe(true);
    });
  });
});
