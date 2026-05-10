/**
 * Phase 4: Adaptive weights + redistribution pass tests (H3, H4)
 *
 * These tests verify:
 *   1. calculateWeightedPairScore respects custom weights when provided
 *   2. Redistribution pass places stranded users when customWeights is set
 *   3. No redistribution occurs when customWeights is absent (flag off)
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
  getCalibratedChemistryScore: vi.fn().mockReturnValue(80),
}));

vi.mock('../matchingSemantic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matchingSemantic')>();
  return {
    ...actual,
    isSemanticSimilarityEnabled: vi.fn().mockReturnValue(false),
    isAdaptiveWeightsEnabled: vi.fn().mockReturnValue(false),
    calculateSemanticSimilarityScore: vi.fn().mockReturnValue(50),
  };
});

const { runGreedyPoolMatchingCore } = await import('../poolMatchingService');
import type { UserWithProfile } from '../poolMatchingService';
import { calculateWeightedPairScore } from '../matchingSemantic';

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
    tasteIntensity: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: '饭局',
    ageMatchPreference: null,
    tableVibePreference: null,
    vibeVector: null,
  };
}

describe('calculateWeightedPairScore with custom weights', () => {
  const dimensions = {
    chemistry: 80,
    interest: 70,
    socialAffinity: 60,
    backgroundDiversity: 50,
    preference: 40,
    language: 30,
  };

  it('uses hardcoded legacy weights when customWeights is absent', () => {
    const score = calculateWeightedPairScore(dimensions, false);
    // legacy: chem 0.28, interest 0.28, social 0.20, bg 0.15, pref 0.05, lang 0.04
    const expected = Math.round(
      80 * 0.28 +
      70 * 0.28 +
      60 * 0.20 +
      50 * 0.15 +
      40 * 0.05 +
      30 * 0.04
    );
    expect(score).toBe(expected);
  });

  it('uses custom weights when provided (percentage form)', () => {
    const customWeights = {
      chemistryWeight: 50,
      interestWeight: 20,
      socialAffinityWeight: 10,
      backgroundDiversityWeight: 10,
      preferenceWeight: 5,
      languageWeight: 5,
    };
    const score = calculateWeightedPairScore(dimensions, false, customWeights);
    const expected = Math.round(
      80 * 0.50 +
      70 * 0.20 +
      60 * 0.10 +
      50 * 0.10 +
      40 * 0.05 +
      30 * 0.05
    );
    expect(score).toBe(expected);
  });

  it('uses custom weights when provided (short-key form)', () => {
    const customWeights = {
      chemistry: 50,
      interest: 20,
      socialAffinity: 10,
      backgroundDiversity: 10,
      preference: 5,
      language: 5,
    };
    const score = calculateWeightedPairScore(dimensions, false, customWeights);
    const expected = Math.round(
      80 * 0.50 +
      70 * 0.20 +
      60 * 0.10 +
      50 * 0.10 +
      40 * 0.05 +
      30 * 0.05
    );
    expect(score).toBe(expected);
  });
});

describe('runGreedyPoolMatchingCore redistribution (H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT redistribute stranded users when customWeights is absent', async () => {
    // 5 users with high pair scores, min=4, max=4
    // Greedy will form one group of 4, leaving 1 stranded
    const users = [
      makeUser('u1', 'corgi'),
      makeUser('u2', 'corgi'),
      makeUser('u3', 'corgi'),
      makeUser('u4', 'corgi'),
      makeUser('u5', 'corgi'),
    ];

    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        pairScoreCache.set(`legacy|${users[i].userId}|${users[j].userId}`, 95);
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
      undefined, // no customWeights
    );

    // Without redistribution, 1 user should be stranded
    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(4);
  });

  it('redistributes stranded users into existing groups when customWeights is set', async () => {
    // 6 users with high pair scores, min=4, max=5
    // Greedy forms one group of 5, leaving 1 stranded
    // Redistribution should place the 6th into the existing group (room below max)
    const users = [
      makeUser('u1', 'corgi'),
      makeUser('u2', 'corgi'),
      makeUser('u3', 'corgi'),
      makeUser('u4', 'corgi'),
      makeUser('u5', 'corgi'),
      makeUser('u6', 'corgi'),
    ];

    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        // Adaptive mode uses "legacy|adaptive|" prefix
        pairScoreCache.set(`legacy|adaptive|${users[i].userId}|${users[j].userId}`, 95);
      }
    }

    const customWeights = {
      chemistryWeight: 28,
      interestWeight: 28,
      socialAffinityWeight: 20,
      backgroundDiversityWeight: 15,
      preferenceWeight: 5,
      languageWeight: 4,
    };

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 5, targetGroups: 10 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
      customWeights,
    );

    // Greedy forms group of 5; redistribution places the 6th (room below max=5)
    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(6);
  });

  it('forms a remainder group from stranded users when customWeights is set', async () => {
    // 8 users, min=4, max=4
    // Greedy forms one group of 4, leaving 4 stranded
    // Redistribution should form a second group of 4
    const users: UserWithProfile[] = [];
    for (let i = 1; i <= 8; i++) {
      users.push(makeUser(`u${i}`, 'corgi'));
    }

    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        // Adaptive mode uses "legacy|adaptive|" prefix
        pairScoreCache.set(`legacy|adaptive|${users[i].userId}|${users[j].userId}`, 95);
      }
    }

    const customWeights = {
      chemistryWeight: 28,
      interestWeight: 28,
      socialAffinityWeight: 20,
      backgroundDiversityWeight: 15,
      preferenceWeight: 5,
      languageWeight: 4,
    };

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 4, targetGroups: 10 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
      customWeights,
    );

    // With redistribution, all 8 users should be matched into 2 groups
    expect(groups.length).toBe(2);
    expect(groups[0].members.length).toBe(4);
    expect(groups[1].members.length).toBe(4);

    const allUserIds = new Set<string>();
    for (const group of groups) {
      for (const member of group.members) {
        expect(allUserIds.has(member.userId)).toBe(false);
        allUserIds.add(member.userId);
      }
    }
    expect(allUserIds.size).toBe(8);
  });
});
