/**
 * Greedy pool matching unit tests (M4)
 * Tests runGreedyPoolMatchingCore in isolation with mocked caches.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: {
    corgi: { corgi: 90, koala: 50 },
    koala: { corgi: 50, koala: 90 },
  },
  ARCHETYPE_ENERGY: {
    corgi: 95,
    koala: 70,
  },
}));

vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((a: string, b: string) => {
    // Return low chemistry for corgi↔koala pairs to test chemistry boundary
    if ((a === 'corgi' && b === 'koala') || (a === 'koala' && b === 'corgi')) {
      return 30;
    }
    return 90;
  }),
}));

vi.mock('../matchingSemantic', () => ({
  isSemanticSimilarityEnabled: vi.fn().mockReturnValue(false),
  calculateSemanticSimilarityScore: vi.fn().mockReturnValue(50),
}));

const { runGreedyPoolMatchingCore } = await import('../poolMatchingService');
import type { UserWithProfile } from '../poolMatchingService';

function makeUser(id: string, archetype: string): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg-${id}`,
    gender: 'male',
    birthdate: '1995-01-01',
    industryNiche: 'tech',
    industryNicheLabel: '科技',
    industryCategoryLabel: '互联网',
    educationLevel: '本科',
    archetype,
    secondaryArchetype: null,
    lifeStage: '职场老手',
    workMode: 'employed',
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: ['中文'],
    eventIntent: ['networking'],
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: '饭局',
    ageMatchPreference: null,
    tableVibePreference: null,
    preferenceStrictness: null,
    genderCompositionPreference: null,
  };
}

describe('runGreedyPoolMatchingCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty groups for an empty pool', async () => {
    const groups = await runGreedyPoolMatchingCore(
      [],
      { minGroupSize: 4, maxGroupSize: 4 },
      new Map(),
      new Map(),
      undefined,
      false,
      undefined,
      [],
    );
    expect(groups).toEqual([]);
  });

  it('forms exactly 1 group of 4 when 4 users and exact size constraints', async () => {
    const users = [
      makeUser('u1', 'corgi'),
      makeUser('u2', 'corgi'),
      makeUser('u3', 'corgi'),
      makeUser('u4', 'corgi'),
    ];

    // Pre-populate pair-score cache so all pairs score 95
    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const key = `legacy|${users[i].userId}|${users[j].userId}`;
        pairScoreCache.set(key, 95);
      }
    }

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 4, targetGroups: 10 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
    );

    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(4);
  });

  it('respects size constraints with remainder users (9 users, min=4, max=6)', async () => {
    const users: UserWithProfile[] = [];
    for (let i = 1; i <= 9; i++) {
      users.push(makeUser(`u${i}`, 'corgi'));
    }

    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const key = `legacy|${users[i].userId}|${users[j].userId}`;
        pairScoreCache.set(key, 95);
      }
    }

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
    );

    // Every formed group must respect size bounds
    for (const group of groups) {
      expect(group.members.length).toBeGreaterThanOrEqual(4);
      expect(group.members.length).toBeLessThanOrEqual(6);
    }

    // All assigned users should be unique
    const assigned = new Set<string>();
    for (const group of groups) {
      for (const member of group.members) {
        expect(assigned.has(member.userId)).toBe(false);
        assigned.add(member.userId);
      }
    }
  });

  it('does not place low-chemistry pairs in the same group', async () => {
    // 4 users: 2 corgi + 2 koala
    // corgi↔koala chemistry is mocked to 30 (below threshold)
    const users = [
      makeUser('u1', 'corgi'),
      makeUser('u2', 'corgi'),
      makeUser('u3', 'koala'),
      makeUser('u4', 'koala'),
    ];

    const pairScoreCache = new Map<string, number>();
    // Within-archetype pairs score high
    pairScoreCache.set('legacy|u1|u2', 95);
    pairScoreCache.set('legacy|u3|u4', 95);
    // Cross-archetype pairs score low (below 60 threshold)
    pairScoreCache.set('legacy|u1|u3', 30);
    pairScoreCache.set('legacy|u1|u4', 30);
    pairScoreCache.set('legacy|u2|u3', 30);
    pairScoreCache.set('legacy|u2|u4', 30);

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 4, targetGroups: 10 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
    );

    // Because cross-pair scores are below the 60 threshold,
    // the algorithm cannot build a group of 4 (it can only form pairs).
    // Therefore no valid groups should be produced.
    expect(groups.length).toBe(0);
  });
});
