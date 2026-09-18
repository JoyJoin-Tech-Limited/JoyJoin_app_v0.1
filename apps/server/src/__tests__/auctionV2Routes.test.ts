/**
 * Auction V2 route-level suite (sprint wave2-auctionV2, locked contract):
 *  - AC-04: isAllIn marking on record + highBid, honest mechanism
 *           (richer bidder outbids an all-in), arbitrary-integer compat ON/OFF
 *  - AC-05: outbid/all-in beat emission wiring + snapshot-off suppression
 *  - AC-06: auctionLotResults shape (sold/流拍/wasAllIn/bot-mixed history),
 *           concurrent close-lot idempotency (verifier M6), award recap
 *           lines + ≤8 budget, softened unsold copy (flag-gated)
 *  - AC-07: generate-lots clamp target (host excluded from bidderCount) and
 *           flag-OFF argument preservation; cached-meta version resolver
 *  - AC-08: concurrent-bid race + coin-conservation invariant
 *  - AC-09: flag-OFF absence assertions (no new fields, legacy copy)
 *
 * Flag/unit coverage (registration, snapshot, beats rate limit, bank,
 * padding, copy scan, admin round-trip) lives in auctionV2Flag.test.ts.
 * Harness cloned from auctionPhase.test.ts; that suite stays zero-edit.
 */
import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { AUCTION_STARTING_COINS } from '@shared/socialIcebreaker';
import { GLOW_RUN_PLAN } from '@shared/socialIcebreakerRunPlans';
import { generateAuctionLots } from '../socialIcebreakerAIService';
import { emitSocialGroupBeat, emitAuctionOutbidBeatRateLimited } from '../lib/socialGroupBeats';

const storeCtx = vi.hoisted(() => {
  const sessions = new Map<string, SocialSessionState>();
  const participants = new Map<
    string,
    Map<string, { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }>
  >();
  return { sessions, participants };
});

vi.mock('../lib/socialIcebreakerStore', () => {
  const { sessions, participants } = storeCtx;
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
    setLieTruths: async () => {},
    getLieTruths: async () => null,
    loadSessionLieTruths: async () => new Map(),
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

// Beat spies wrap the REAL implementations: routes' emission calls are
// captured, while the real icebreakerGroupBeatsEnabled gate (default false)
// means no WS broadcast happens.
vi.mock('../lib/socialGroupBeats', async (importActual) => {
  const actual = await importActual<typeof import('../lib/socialGroupBeats')>();
  return {
    ...actual,
    emitSocialGroupBeat: vi.fn(actual.emitSocialGroupBeat),
    emitAuctionOutbidBeatRateLimited: vi.fn(actual.emitAuctionOutbidBeatRateLimited),
  };
});

vi.mock('../lib/featureFlags', async (importActual) => {
  const actual = await importActual<typeof import('../lib/featureFlags')>();
  return {
    ...actual,
    getFeatureFlag: vi.fn(async (key: string, fallback = false) => {
      const envKey = actual.FLAG_ENV_MAP[key];
      const envVal = envKey ? process.env[envKey] : undefined;
      if (envVal !== undefined) return envVal.toLowerCase() === 'true';
      return actual.DEFAULT_FLAG_VALUES[key] ?? fallback;
    }),
  };
});

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

const V2_LOTS = [
  { id: 'lot-1', title: '最佳段子手奖杯', teaser: '一个神秘的奖杯', emoji: '🏆' },
  { id: 'lot-2', title: '神秘零食大礼包', teaser: '不知道里面有什么', emoji: '🎁' },
];

function baseAuctionSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: overrides.socialSessionId ?? 'social_auction-v2-test',
    icebreakerSessionId: 'auction-v2-test',
    currentPhase: 'auction',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    eventType: '测试',
    eventTier: 'blaze',
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'recap'],
    commonGroundCount: 3,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: false,
    runPlan: GLOW_RUN_PLAN,
    ...overrides,
  };
}

function seedParticipants(socialSessionId: string, guestCount = 3): void {
  const pmap = new Map<
    string,
    { userId: string; displayName: string; joinedAt: number; lastSeenAt: number }
  >();
  pmap.set('host-user', { userId: 'host-user', displayName: 'Host', joinedAt: Date.now() - 10000, lastSeenAt: Date.now() });
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank'];
  for (let i = 1; i <= guestCount; i += 1) {
    pmap.set(`guest-${i}`, { userId: `guest-${i}`, displayName: names[i - 1] ?? `G${i}`, joinedAt: Date.now() - 8000, lastSeenAt: Date.now() });
  }
  storeCtx.participants.set(socialSessionId, pmap);
}

interface SeedOptions {
  v2?: boolean;
  guestCount?: number;
  balances?: Record<string, number>;
  highBid?: { userId: string; amount: number } | null;
  recapLines?: string[];
  bidHistory?: SocialSessionState['auctionBidHistory'];
  lotResults?: SocialSessionState['auctionLotResults'];
  currentLotIndex?: number;
  lots?: typeof V2_LOTS;
}

function seedSession(socialSessionId: string, options: SeedOptions = {}): SocialSessionState {
  const guestCount = options.guestCount ?? 3;
  const state = baseAuctionSession({ socialSessionId });
  state.auctionLots = options.lots ?? V2_LOTS;
  state.auctionCurrentLotIndex = options.currentLotIndex ?? 0;
  const balances: Record<string, number> = {};
  balances['host-user'] = AUCTION_STARTING_COINS;
  for (let i = 1; i <= guestCount; i += 1) balances[`guest-${i}`] = AUCTION_STARTING_COINS;
  state.auctionBalances = options.balances ?? balances;
  state.auctionHighBid = options.highBid ?? null;
  state.auctionAllLotsClosed = false;
  state.auctionRecapLines = options.recapLines ?? [];
  state.auctionBidHistory = options.bidHistory ?? [];
  if (options.lotResults) state.auctionLotResults = options.lotResults;
  if (options.v2) state.auctionV2Enabled = true;
  storeCtx.sessions.set(socialSessionId, state);
  seedParticipants(socialSessionId, guestCount);
  return state;
}

async function postBid(baseUrl: string, id: string, cookie: string, amount: number) {
  return fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/bid`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ amount }),
  });
}

async function postCloseLot(baseUrl: string, id: string, cookie: string) {
  return fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/close-lot`, {
    method: 'POST',
    headers: { cookie },
  });
}

beforeEach(() => {
  storeCtx.sessions.clear();
  storeCtx.participants.clear();
  vi.clearAllMocks();
  vi.mocked(generateAuctionLots).mockReset();
  vi.mocked(generateAuctionLots).mockResolvedValue({
    data: V2_LOTS,
    meta: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: 'deepseek',
      fallbackUsed: false,
      promptVersion: 'social-auction-lots-v2',
    },
  });
});

// ─── AC-04: isAllIn marking + honest mechanism + int compat ─────────────────

describe('POST /auction/bid — isAllIn (AC-04)', () => {
  it('marks all-in bids on the high bid AND the history record (flag ON)', async () => {
    const id = 'social_auc-v2-allin';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'guest-1');
      const res = await postBid(baseUrl, id, cookie, 100);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        highBid: { userId: string; amount: number; isAllIn?: boolean };
      };
      expect(body.highBid.isAllIn).toBe(true);

      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionHighBid?.isAllIn).toBe(true);
      expect(state.auctionBidHistory?.[0]?.isAllIn).toBe(true);
    });
  });

  it('partial bids carry no isAllIn key (flag ON)', async () => {
    const id = 'social_auc-v2-partial';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'guest-1');
      const res = await postBid(baseUrl, id, cookie, 40);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionHighBid).toEqual({ userId: 'guest-1', amount: 40 });
      expect(state.auctionBidHistory?.[0]?.isAllIn).toBeUndefined();
    });
  });

  it('honest mechanism: a richer bidder can outbid an all-in (全押不锁标)', async () => {
    const id = 'social_auc-v2-honest';
    // guest-1 has 60 left after winning lot 0; their all-in is only 60.
    seedSession(id, {
      v2: true,
      currentLotIndex: 1,
      balances: { 'host-user': 100, 'guest-1': 60, 'guest-2': 100, 'guest-3': 100 },
    });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');
      const allIn = await postBid(baseUrl, id, c1, 60);
      expect(allIn.status).toBe(200);
      expect(((await allIn.json()) as any).highBid.isAllIn).toBe(true);

      const outbid = await postBid(baseUrl, id, c2, 70);
      expect(outbid.status).toBe(200);
      const body = (await outbid.json()) as {
        highBid: { userId: string; amount: number; isAllIn?: boolean };
        balances: Record<string, number>;
      };
      expect(body.highBid).toEqual({ userId: 'guest-2', amount: 70 });
      // All-in bidder's escrow refunded exactly once.
      expect(body.balances['guest-1']).toBe(60);
      expect(body.balances['guest-2']).toBe(30);
    });
  });

  it('server still accepts arbitrary integer bids (bot/legacy-client compat, ON and OFF)', async () => {
    for (const v2 of [true, false] as const) {
      const id = `social_auc-v2-int-${v2}`;
      seedSession(id, { v2 });
      await withServer(async (baseUrl) => {
        const cookie = await login(baseUrl, 'guest-1');
        const res = await postBid(baseUrl, id, cookie, 37); // off-ladder amount
        expect(res.status).toBe(200);
        expect(((await res.json()) as any).highBid.amount).toBe(37);
      });
    }
  });

  it('flag OFF writes byte-legacy records (no isAllIn anywhere)', async () => {
    const id = 'social_auc-v2-off-bid';
    seedSession(id, { v2: false });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'guest-1');
      const res = await postBid(baseUrl, id, cookie, 100); // full balance, but flag off
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionHighBid).toEqual({ userId: 'guest-1', amount: 100 });
      expect(state.auctionBidHistory?.[0]).toEqual({
        userId: 'guest-1',
        amount: 100,
        at: expect.any(Number),
        lotIndex: 0,
      });
    });
  });
});

// ─── AC-05: beat emission wiring ────────────────────────────────────────────

describe('POST /auction/bid — group beats (AC-05)', () => {
  it('outbid fires the rate-limited outbid beat (flag ON)', async () => {
    const id = 'social_auc-v2-beat-outbid';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');
      await postBid(baseUrl, id, c1, 30);
      await postBid(baseUrl, id, c2, 40);
      expect(vi.mocked(emitAuctionOutbidBeatRateLimited)).toHaveBeenCalledWith('auction-v2-test');
    });
  });

  it('first bid (no previous high) fires no outbid beat', async () => {
    const id = 'social_auc-v2-beat-first';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      await postBid(baseUrl, id, c1, 30);
      expect(vi.mocked(emitAuctionOutbidBeatRateLimited)).not.toHaveBeenCalled();
      expect(vi.mocked(emitSocialGroupBeat)).not.toHaveBeenCalledWith('auction-v2-test', 'auction_all_in');
    });
  });

  it('all-in fires the all-in beat once (flag ON)', async () => {
    const id = 'social_auc-v2-beat-allin';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      await postBid(baseUrl, id, c1, 100);
      expect(vi.mocked(emitSocialGroupBeat)).toHaveBeenCalledWith('auction-v2-test', 'auction_all_in');
      expect(
        vi.mocked(emitSocialGroupBeat).mock.calls.filter(([, kind]) => kind === 'auction_all_in'),
      ).toHaveLength(1);
    });
  });

  it('flag OFF emits no auction beats at all (even with outbids and full-balance bids)', async () => {
    const id = 'social_auc-v2-beat-off';
    seedSession(id, { v2: false });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');
      await postBid(baseUrl, id, c1, 100);
      await postBid(baseUrl, id, c2, 100);
      expect(vi.mocked(emitAuctionOutbidBeatRateLimited)).not.toHaveBeenCalled();
      expect(
        vi.mocked(emitSocialGroupBeat).mock.calls.filter(
          ([, kind]) => kind === 'auction_all_in' || kind === 'auction_outbid',
        ),
      ).toHaveLength(0);
    });
  });
});

// ─── AC-06: close-lot — lotResults, idempotency, recap v2 ───────────────────

describe('POST /auction/close-lot — settlement records + recap v2 (AC-06)', () => {
  it('writes a sold AuctionLotResult with wasAllIn from the winning record', async () => {
    const id = 'social_auc-v2-close-sold';
    seedSession(id, {
      v2: true,
      lots: [V2_LOTS[0]],
      highBid: { userId: 'guest-1', amount: 100 },
      bidHistory: [{ userId: 'guest-1', amount: 100, at: Date.now(), lotIndex: 0, isAllIn: true }],
      balances: { 'host-user': 100, 'guest-1': 0, 'guest-2': 100, 'guest-3': 100 },
    });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionLotResults).toEqual([
        {
          lotIndex: 0,
          lotId: 'lot-1',
          title: '最佳段子手奖杯',
          winnerUserId: 'guest-1',
          winningAmount: 100,
          bidCount: 1,
          wasAllIn: true,
        },
      ]);
      expect(state.auctionAllLotsClosed).toBe(true);
      // Final lot → award lines appended (≤3) alongside the per-lot line.
      const lines = state.auctionRecapLines ?? [];
      expect(lines.some((l) => l.startsWith('今晚最敢花：'))).toBe(true);
      expect(lines.some((l) => l.startsWith('捡漏王：'))).toBe(true);
      expect(lines.some((l) => l.startsWith('全场最热：'))).toBe(true);
      expect(lines.length).toBeLessThanOrEqual(8);
    });
  });

  it('writes a 流拍 result (null fields) with the softened unsold copy', async () => {
    const id = 'social_auc-v2-close-unsold';
    seedSession(id, { v2: true, lots: [V2_LOTS[0]] });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionLotResults?.[0]).toEqual({
        lotIndex: 0,
        lotId: 'lot-1',
        title: '最佳段子手奖杯',
        winnerUserId: null,
        winningAmount: null,
        bidCount: 0,
        wasAllIn: false,
      });
      expect(state.auctionRecapLines?.[0]).toBe('最佳段子手奖杯这条先跳过');
      // All-unsold → no award lines.
      expect(state.auctionRecapLines).toHaveLength(1);
    });
  });

  it('bot-mixed bid history settles correctly (verifier M3): bidCount includes bot records, wasAllIn false', async () => {
    const id = 'social_auc-v2-close-bots';
    seedSession(id, {
      v2: true,
      lots: [V2_LOTS[0]],
      highBid: { userId: 'bot-9', amount: 40 },
      bidHistory: [
        // Bot records: written directly by simulateAuctionBots — no isAllIn key.
        { userId: 'bot-9', amount: 10, at: Date.now() - 3000, lotIndex: 0 },
        { userId: 'bot-9', amount: 20, at: Date.now() - 2000, lotIndex: 0 },
        { userId: 'guest-1', amount: 30, at: Date.now() - 1000, lotIndex: 0 },
        { userId: 'bot-9', amount: 40, at: Date.now(), lotIndex: 0 },
      ],
      balances: { 'host-user': 100, 'guest-1': 70, 'guest-2': 100, 'guest-3': 100 },
    });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionLotResults?.[0]).toMatchObject({
        winnerUserId: 'bot-9',
        winningAmount: 40,
        bidCount: 4,
        wasAllIn: false,
      });
    });
  });

  it('concurrent double close-lot settles exactly once (verifier M6)', async () => {
    const id = 'social_auc-v2-close-race';
    seedSession(id, {
      v2: true,
      lots: [V2_LOTS[0]],
      highBid: { userId: 'guest-1', amount: 50 },
      bidHistory: [{ userId: 'guest-1', amount: 50, at: Date.now(), lotIndex: 0 }],
      balances: { 'host-user': 100, 'guest-1': 50, 'guest-2': 100, 'guest-3': 100 },
    });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const [r1, r2] = await Promise.all([
        postCloseLot(baseUrl, id, host),
        postCloseLot(baseUrl, id, host),
      ]);
      // Either both race into the (identical) single-append path, or the
      // loser observes the committed state and no-ops via the duplicate
      // guard / the pre-existing allClosed 400 — all are idempotent.
      expect([r1.status, r2.status]).toContain(200);
      const state = storeCtx.sessions.get(id)!;
      const results = state.auctionLotResults ?? [];
      expect(results.filter((r) => r.lotIndex === 0)).toHaveLength(1);
      const perLotLines = (state.auctionRecapLines ?? []).filter((l) => l.includes('最佳段子手奖杯由'));
      expect(perLotLines).toHaveLength(1);
    });
  });

  it('duplicate guard: a close-lot replay against a settled lotIndex no-ops (M6 guard path)', async () => {
    const id = 'social_auc-v2-close-dupe';
    seedSession(id, {
      v2: true,
      lots: V2_LOTS,
      currentLotIndex: 0,
      highBid: { userId: 'guest-1', amount: 50 },
      recapLines: ['最佳段子手奖杯由Alice以50虚拟币拍下'],
      lotResults: [
        {
          lotIndex: 0,
          lotId: 'lot-1',
          title: '最佳段子手奖杯',
          winnerUserId: 'guest-1',
          winningAmount: 50,
          bidCount: 1,
          wasAllIn: false,
        },
      ],
    });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { duplicate?: boolean };
      expect(body.duplicate).toBe(true);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionLotResults).toHaveLength(1);
      expect(state.auctionRecapLines).toEqual(['最佳段子手奖杯由Alice以50虚拟币拍下']);
    });
  });

  it('award lines REPLACE the earliest per-lot lines when over the ≤8 budget', async () => {
    const id = 'social_auc-v2-close-budget';
    seedSession(id, {
      v2: true,
      lots: [V2_LOTS[0]],
      highBid: { userId: 'guest-2', amount: 90 },
      bidHistory: [{ userId: 'guest-2', amount: 90, at: Date.now(), lotIndex: 0 }],
      balances: { 'host-user': 100, 'guest-1': 100, 'guest-2': 10, 'guest-3': 100 },
      recapLines: ['旧行一', '旧行二', '旧行三', '旧行四', '旧行五', '旧行六', '旧行七'],
    });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      const lines = state.auctionRecapLines ?? [];
      expect(lines.length).toBeLessThanOrEqual(8);
      // Award lines always survive; earliest per-lot lines are dropped first.
      expect(lines.some((l) => l.startsWith('今晚最敢花：'))).toBe(true);
      expect(lines[0]).not.toBe('旧行一');
    });
  });

  it('flag OFF keeps the legacy recap copy and writes no lotResults', async () => {
    const id = 'social_auc-v2-close-off';
    seedSession(id, { v2: false, lots: [V2_LOTS[0]] });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await postCloseLot(baseUrl, id, host);
      expect(res.status).toBe(200);
      const state = storeCtx.sessions.get(id)!;
      expect(state.auctionRecapLines).toEqual(['最佳段子手奖杯流拍（无人出价）']);
      expect(state.auctionLotResults).toBeUndefined();
    });
  });
});

// ─── AC-07: generate-lots clamp + flag-OFF argument preservation ────────────

describe('POST /auction/generate-lots — V2 economy (AC-07)', () => {
  it('passes vibe + clamp(bidderCount,3,5) target with the host excluded (flag ON)', async () => {
    const id = 'social_auc-v2-gen-clamp';
    const state = baseAuctionSession({ socialSessionId: id, auctionV2Enabled: true, vibe: 'game' });
    storeCtx.sessions.set(id, state);
    seedParticipants(id, 3); // host + 3 guests → bidderCount 3 → target 3
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: host },
      });
      expect(res.status).toBe(200);
      expect(vi.mocked(generateAuctionLots)).toHaveBeenCalledWith(
        expect.objectContaining({
          auctionV2: true,
          vibe: 'game',
          targetLotCount: 3,
          sessionId: id,
        }),
      );
    });
  });

  it('clamps a 6-bidder table to 5 and a 1-bidder table to 3', async () => {
    const id5 = 'social_auc-v2-gen-max';
    storeCtx.sessions.set(id5, baseAuctionSession({ socialSessionId: id5, auctionV2Enabled: true }));
    seedParticipants(id5, 6); // 6 bidders → clamp 5
    const id1 = 'social_auc-v2-gen-min';
    storeCtx.sessions.set(id1, baseAuctionSession({ socialSessionId: id1, auctionV2Enabled: true }));
    seedParticipants(id1, 1); // 1 bidder → clamp 3
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      await fetch(`${baseUrl}/api/social-icebreaker/${id5}/auction/generate-lots`, { method: 'POST', headers: { cookie: host } });
      await fetch(`${baseUrl}/api/social-icebreaker/${id1}/auction/generate-lots`, { method: 'POST', headers: { cookie: host } });
      const calls = vi.mocked(generateAuctionLots).mock.calls.map(([args]) => args as any);
      expect(calls[0].targetLotCount).toBe(5);
      expect(calls[1].targetLotCount).toBe(3);
    });
  });

  it('flag OFF passes byte-legacy args (no vibe/target/session seed)', async () => {
    const id = 'social_auc-v2-gen-off';
    storeCtx.sessions.set(id, baseAuctionSession({ socialSessionId: id }));
    seedParticipants(id, 3);
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: host },
      });
      expect(res.status).toBe(200);
      const args = vi.mocked(generateAuctionLots).mock.calls[0][0] as Record<string, unknown>;
      expect(args).not.toHaveProperty('auctionV2');
      expect(args).not.toHaveProperty('vibe');
      expect(args).not.toHaveProperty('targetLotCount');
      expect(args).not.toHaveProperty('sessionId');
      expect(args.participantCount).toBe(4);
      expect(args.eventType).toBe('测试');
    });
  });

  it('cached path stamps the per-snapshot version (legacy → v2, never v1/v3)', async () => {
    const id = 'social_auc-v2-gen-cached';
    const state = baseAuctionSession({ socialSessionId: id });
    state.auctionLots = V2_LOTS;
    // No auctionLotsMeta → the cached-meta fallback path runs.
    storeCtx.sessions.set(id, state);
    seedParticipants(id, 3);
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const res = await fetch(`${baseUrl}/api/social-icebreaker/${id}/auction/generate-lots`, {
        method: 'POST',
        headers: { cookie: host },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { meta: { promptVersion?: string; fromCache: boolean } };
      expect(body.meta.fromCache).toBe(true);
      expect(body.meta.promptVersion).toBe('social-auction-lots-v2');
    });
  });
});

// ─── AC-08: concurrent bid race + coin conservation ─────────────────────────

describe('POST /auction/bid — race + conservation (AC-08)', () => {
  it('sequential race: same amount 400s; higher bid refunds the previous high exactly once', async () => {
    const id = 'social_auc-v2-race-seq';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');

      const b1 = await postBid(baseUrl, id, c1, 30);
      expect(b1.status).toBe(200);

      const b2same = await postBid(baseUrl, id, c2, 30);
      expect(b2same.status).toBe(400);

      const b2 = await postBid(baseUrl, id, c2, 40);
      expect(b2.status).toBe(200);
      const body = (await b2.json()) as { balances: Record<string, number> };
      expect(body.balances['guest-1']).toBe(100); // refunded
      expect(body.balances['guest-2']).toBe(60);

      // Conservation mid-auction: Σ balances + escrowed high bid = Σ starting.
      const state = storeCtx.sessions.get(id)!;
      const sum = Object.values(state.auctionBalances ?? {}).reduce((a, b) => a + b, 0);
      expect(sum + (state.auctionHighBid?.amount ?? 0)).toBe(4 * AUCTION_STARTING_COINS);
    });
  });

  it('concurrent equal bids: at most one wins at that price and conservation holds', async () => {
    const id = 'social_auc-v2-race-concurrent';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');

      const [r1, r2] = await Promise.all([
        postBid(baseUrl, id, c1, 50),
        postBid(baseUrl, id, c2, 50),
      ]);
      const statuses = [r1.status, r2.status].sort();
      // First-come-first-served semantics: at least one succeeds; equal
      // amounts can never BOTH win the same high bid.
      expect(statuses[0]).toBe(200);

      const state = storeCtx.sessions.get(id)!;
      const sum = Object.values(state.auctionBalances ?? {}).reduce((a, b) => a + b, 0);
      const escrow = state.auctionHighBid?.amount ?? 0;
      expect(sum + escrow).toBe(4 * AUCTION_STARTING_COINS);
      expect((state.auctionBidHistory ?? []).filter((b) => b.lotIndex === 0).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('conservation across a full interleaved bid/outbid/close sequence', async () => {
    const id = 'social_auc-v2-race-full';
    seedSession(id, { v2: true });
    await withServer(async (baseUrl) => {
      const host = await login(baseUrl, 'host-user');
      const c1 = await login(baseUrl, 'guest-1');
      const c2 = await login(baseUrl, 'guest-2');
      const c3 = await login(baseUrl, 'guest-3');

      await postBid(baseUrl, id, c1, 25);
      await postBid(baseUrl, id, c2, 55);
      await postBid(baseUrl, id, c1, 70);
      await postBid(baseUrl, id, c3, 90);
      const close = await postCloseLot(baseUrl, id, host);
      expect(close.status).toBe(200);

      const state = storeCtx.sessions.get(id)!;
      const sumBalances = Object.values(state.auctionBalances ?? {}).reduce((a, b) => a + b, 0);
      const settled = (state.auctionLotResults ?? [])
        .map((r) => r.winningAmount ?? 0)
        .reduce((a, b) => a + b, 0);
      // After close: Σ balances + Σ settled winning amounts = Σ starting coins.
      expect(sumBalances + settled).toBe(4 * AUCTION_STARTING_COINS);
      expect(state.auctionLotResults?.[0]).toMatchObject({
        winnerUserId: 'guest-3',
        winningAmount: 90,
        bidCount: 4,
      });
    });
  });
});
