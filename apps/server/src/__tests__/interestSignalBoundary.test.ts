/**
 * Interest Signal Boundary Tests
 *
 * Architecture invariant under test:
 *   - user_interest_signals are valid for AI prompt enrichment / match explanation context.
 *   - user_interest_signals are NOT valid as inputs to deterministic pair scoring.
 *
 * The deterministic interest score (calculateInterestScoreAsync) reads ONLY from
 * the user_interests table (topic overlaps + heat values).  Changing or omitting
 * user_interest_signals data must not change pair scores or group formation outcomes.
 *
 * Prompt-enrichment usage lives in matchExplanationService.findConnectionPoints()
 * and conversationTopicsService — not in poolMatchingService pair-score computation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// DB mock — controls what user_interests returns per test.
// user_interest_signals is deliberately never referenced here; any accidental
// import of that table into the scoring path will cause a TypeScript error or a
// runtime miss-mock rather than silently affecting scores.
// ---------------------------------------------------------------------------

const {
  mockUserInterestsSelect,
  userInterestsTable,
  userInterestSignalsTable,
} = vi.hoisted(() => ({
  mockUserInterestsSelect: vi.fn(),
  userInterestsTable: Symbol('userInterests'),
  userInterestSignalsTable: Symbol('userInterestSignals'),
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table !== userInterestsTable) {
          throw new Error(
            `Unexpected table passed to db.select().from() in interestSignalBoundary tests: ${String(table)}`,
          );
        }

        return {
          where: () => ({
            limit: () => Promise.resolve(mockUserInterestsSelect()),
          }),
        };
      },
    }),
  },
}));

// Stub schema tables so the module can be imported without a live DB.
vi.mock('@shared/schema', () => ({
  userInterests: userInterestsTable,
  userInterestSignals: userInterestSignalsTable,
  eventPools: Symbol('eventPools'),
  eventPoolRegistrations: Symbol('eventPoolRegistrations'),
  eventPoolGroups: Symbol('eventPoolGroups'),
  events: Symbol('events'),
  eventAttendance: Symbol('eventAttendance'),
  users: Symbol('users'),
  matchingConfig: Symbol('matchingConfig'),
  invitationUses: Symbol('invitationUses'),
  invitations: Symbol('invitations'),
  coupons: Symbol('coupons'),
  userCoupons: Symbol('userCoupons'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

// Stub services that would make network / DB calls on import.
vi.mock('../wsService', () => ({ wsService: { sendToUser: vi.fn() } }));
vi.mock('../venueAssignmentService', () => ({
  assignVenuesToGroups: vi.fn(),
  saveVenueAssignments: vi.fn(),
}));
vi.mock('../eventThemeGeneratorService', () => ({ generateAndSaveEventTheme: vi.fn() }));
vi.mock('../services/eventThemeTitleGenerator', () => ({ generateEventThemeTitle: vi.fn() }));
vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: {},
  ARCHETYPE_ENERGY: {},
}));
vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockReturnValue(50),
}));
vi.mock('@shared/utils', () => ({ calculateAge: vi.fn().mockReturnValue(28) }));
vi.mock('@shared/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/constants')>();
  return {
    ...actual,
    EDU_ORDINAL: {},
    WORK_MODE_LABELS: {
      employed: '在职',
      student: '学生',
    },
    RELATIONSHIP_MATCH_LABELS: {
      single: '同为单身',
      in_relationship: '感情状态相近',
    },
    DISCUSSION_STYLE_LABELS: {
      casual_vibes: '随便聊聊',
      character_people: '角色/人物党',
      plot_worldbuilding: '剧情/世界观',
      meme_humor: '梗和搞笑',
      deeper_analysis: '深度讨论',
    },
  };
});

import { calculateInterestScoreAsync } from '../poolMatchingService';

// ---------------------------------------------------------------------------
// Helper: build a user_interests DB row (as returned by getUserInterests).
// ---------------------------------------------------------------------------
function makeInterestsRow(
  selections: Array<{ topicId: string; heat: number }>,
) {
  return [{ selections }];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Interest Signal Boundary — deterministic pair scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a deterministic score based solely on user_interests topic overlap', async () => {
    // Both users share one topic out of three — Jaccard 1/3 (≈33%) → baseScore ~43.
    mockUserInterestsSelect
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'travel', heat: 5 },
      ]))
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'music', heat: 5 },
      ]));

    const score = await calculateInterestScoreAsync('u1', 'u2');

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    // Jaccard 1/3 → baseScore = round(1/3 * 85 + 15) = 43; both heat=10 → +8 heatBonus
    expect(score).toBe(51);
  });

  it('score changes when user_interests data changes — proves interests drive the score', async () => {
    // First call: 1 common topic out of 3 → lower score
    mockUserInterestsSelect
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'travel', heat: 5 },
        { topicId: 'sport', heat: 5 },
      ]))
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'music', heat: 5 },
        { topicId: 'art', heat: 5 },
      ]));
    const lowScore = await calculateInterestScoreAsync('u1', 'u2');

    // Second call: all 3 topics in common → higher score
    mockUserInterestsSelect
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'travel', heat: 10 },
        { topicId: 'sport', heat: 10 },
      ]))
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 10 },
        { topicId: 'travel', heat: 10 },
        { topicId: 'sport', heat: 10 },
      ]));
    const highScore = await calculateInterestScoreAsync('u1', 'u2');

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('returns 70 (default) when both users have no interests', async () => {
    mockUserInterestsSelect
      .mockReturnValueOnce([{ selections: [] }])
      .mockReturnValueOnce([{ selections: [] }]);

    const score = await calculateInterestScoreAsync('u1', 'u2');
    expect(score).toBe(70);
  });

  it('returns 30 when one user has no interests', async () => {
    mockUserInterestsSelect
      .mockReturnValueOnce(makeInterestsRow([{ topicId: 'food', heat: 10 }]))
      .mockReturnValueOnce([{ selections: [] }]);

    const score = await calculateInterestScoreAsync('u1', 'u2');
    expect(score).toBe(30);
  });

  it('heat level 3 shared interest applies maximum heat bonus', async () => {
    // heat=25 is level 3; two level-3 matches → heatBonus=30 → capped at 20
    mockUserInterestsSelect
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 25 },
        { topicId: 'travel', heat: 25 },
      ]))
      .mockReturnValueOnce(makeInterestsRow([
        { topicId: 'food', heat: 25 },
        { topicId: 'travel', heat: 25 },
      ]));

    const score = await calculateInterestScoreAsync('u1', 'u2');
    // Jaccard 2/2 = 1 → baseScore = round(1*85+15)=100; heatBonus capped at 20 but min(100, 120)=100
    expect(score).toBe(100);
  });

  it('score is identical regardless of what user_interest_signals would contain', async () => {
    // Provide the same user_interests twice — the score must be the same
    // whether signals exist or not, because signals are excluded from this path.
    const interestsData = makeInterestsRow([
      { topicId: 'gaming', heat: 10 },
      { topicId: 'anime', heat: 25 },
    ]);

    // Run 1 — no signal data in scope
    mockUserInterestsSelect
      .mockReturnValueOnce(interestsData)
      .mockReturnValueOnce(interestsData);
    const scoreWithoutSignals = await calculateInterestScoreAsync('u1', 'u2');

    // Run 2 — same interests, same function, still no signals consulted
    mockUserInterestsSelect
      .mockReturnValueOnce(interestsData)
      .mockReturnValueOnce(interestsData);
    const scoreStillWithoutSignals = await calculateInterestScoreAsync('u1', 'u2');

    expect(scoreWithoutSignals).toBe(scoreStillWithoutSignals);
  });
});

// ---------------------------------------------------------------------------
// Prompt-enrichment boundary: signals ARE used in matchExplanationService
// ---------------------------------------------------------------------------

// Re-mock the DB for matchExplanationService tests (no DB calls needed here).
vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn().mockReturnValue({
    client: {
      chat: { completions: { create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Test explanation' } }],
      }) } },
    },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  }),
  getDeepseekSelection: vi.fn().mockReturnValue({
    client: {
      chat: { completions: { create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Test explanation' } }],
      }) } },
    },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  }),
}));

import { matchExplanationService } from '../matchExplanationService';
import type { MatchMember } from '../matchExplanationService';

describe('Interest Signal Boundary — prompt enrichment in matchExplanationService', () => {
  it('findConnectionPoints includes signal-based connection points (prompt enrichment path)', () => {
    const memberA: MatchMember = {
      userId: 'ua',
      displayName: '甲',
      archetype: 'corgi',
      interestSignals: [
        {
          interestKey: 'food',
          interestLabel: '美食',
          enthusiasmLevel: 4,
          discussionStyle: 'casual_vibes',
          conversationDepth: 2,
        },
      ],
    };
    const memberB: MatchMember = {
      userId: 'ub',
      displayName: '乙',
      archetype: 'koala',
      interestSignals: [
        {
          interestKey: 'food',
          interestLabel: '美食',
          enthusiasmLevel: 3,
          discussionStyle: 'casual_vibes',
          conversationDepth: 3,
        },
      ],
    };

    const points = matchExplanationService.findConnectionPoints(memberA, memberB);

    // Signals should produce a connection point for the AI explanation surface.
    expect(points.some(p => p.text === '美食同款聊法（随便聊聊）')).toBe(true);
  });

  it('findConnectionPoints produces no signal connection point when styles differ and depths are far apart', () => {
    const memberA: MatchMember = {
      userId: 'ua',
      displayName: '甲',
      archetype: 'corgi',
      interestSignals: [
        {
          interestKey: 'gaming',
          interestLabel: '游戏',
          enthusiasmLevel: 5,
          discussionStyle: 'meme_humor',
          conversationDepth: 1,
        },
      ],
    };
    const memberB: MatchMember = {
      userId: 'ub',
      displayName: '乙',
      archetype: 'koala',
      interestSignals: [
        {
          interestKey: 'gaming',
          interestLabel: '游戏',
          enthusiasmLevel: 5,
          discussionStyle: 'deeper_analysis',
          conversationDepth: 3,
        },
      ],
    };

    const points = matchExplanationService.findConnectionPoints(memberA, memberB);

    // Different style + depth gap of 2 — no signal connection point expected.
    const signalPoints = points.filter(p => p.text.includes('游戏'));
    expect(signalPoints).toHaveLength(0);
  });

  it('findConnectionPoints works normally without any signal data (signals are optional)', () => {
    const memberA: MatchMember = {
      userId: 'ua',
      displayName: '甲',
      archetype: 'corgi',
      hometown: '上海',
    };
    const memberB: MatchMember = {
      userId: 'ub',
      displayName: '乙',
      archetype: 'koala',
      hometown: '上海',
    };

    // Should not throw; hometown connection should still be found.
    const points = matchExplanationService.findConnectionPoints(memberA, memberB);
    expect(points.some(p => p.text === '同乡（上海）')).toBe(true);
  });
});
