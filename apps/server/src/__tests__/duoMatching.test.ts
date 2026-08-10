/**
 * 双人成行 (duo registration) — greedy matching tests.
 *
 * Locks in the hard atomic-unit semantics in runGreedyPoolMatchingCore:
 *   - a duo is placed atomically (both members in the SAME group, 2 seats)
 *   - MAX 1 duo per group (admission-time cap)
 *   - a duo that cannot be placed stays unmatched TOGETHER (variant A 整组顺延)
 *   - duo-internal pair is excluded from group quality metrics
 *   - R1 no-isolate rule holds for EACH duo member individually
 *   - zero-duo pools are byte-identical to the legacy behavior
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
  getCalibratedChemistryScore: vi.fn().mockReturnValue(90),
}));

vi.mock('../matchingSemantic', () => ({
  isSemanticSimilarityEnabled: vi.fn().mockReturnValue(false),
  calculateSemanticSimilarityScore: vi.fn().mockReturnValue(50),
}));

const { runGreedyPoolMatchingCore } = await import('../poolMatchingService');
import type { UserWithProfile } from '../poolMatchingService';

function makeUser(id: string, archetype = 'corgi'): UserWithProfile {
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

/** Pre-populate the pair-score cache; keys use sorted ids like the service. */
function buildPairScoreCache(
  userIds: string[],
  scoreFor: (a: string, b: string) => number,
): Map<string, number> {
  const cache = new Map<string, number>();
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const [a, b] = [userIds[i], userIds[j]].sort();
      cache.set(`legacy|${a}|${b}`, scoreFor(userIds[i], userIds[j]));
    }
  }
  return cache;
}

const DUO = (a: string, b: string) => [{ inviterId: a, inviteeId: b }];

function groupOf(groups: Awaited<ReturnType<typeof runGreedyPoolMatchingCore>>, userId: string) {
  return groups.find((g) => g.members.some((m) => m.userId === userId));
}

describe('runGreedyPoolMatchingCore — 双人成行 duo atomic units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places a duo atomically and excludes the duo-internal pair from avgPairScore', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    // Duo-internal pair scores 20; every other pair scores 95. With the
    // exclusion the group average must stay 95; without it it would drop to 90.
    const cache = buildPairScoreCache(ids, (a, b) =>
      [a, b].sort().join('|') === 'u1|u2' ? 20 : 95,
    );

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 6, maxGroupSize: 6, targetGroups: 1 },
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      false,
      DUO('u1', 'u2'),
    );

    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(6);
    // Atomicity: both duo members are in the SAME group.
    expect(groupOf(groups, 'u1')).toBe(groups[0]);
    expect(groupOf(groups, 'u2')).toBe(groups[0]);
    // Duo-internal pair excluded from group quality metrics.
    expect(groups[0].avgPairScore).toBe(95);
  });

  it('enforces MAX 1 duo per group; the second duo stays unmatched together', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 's1', 's2', 's3', 's4'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    const cache = buildPairScoreCache(ids, () => 95);

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 },
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      false,
      [...DUO('u1', 'u2'), ...DUO('u3', 'u4')],
    );

    // The first duo fills a group with solos; the group can never contain both duos.
    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(6);
    expect(groupOf(groups, 'u1')).toBe(groups[0]);
    expect(groupOf(groups, 'u2')).toBe(groups[0]);
    // FALLBACK (variant A 整组顺延): the capped-out duo is not split — both
    // members remain unmatched together.
    expect(groupOf(groups, 'u3')).toBeUndefined();
    expect(groupOf(groups, 'u4')).toBeUndefined();
  });

  it('never seeds a group containing TWO different duos (cap holds from the first seat)', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 's1', 's2'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    // The cross-duo pair (u1,u3) is the TOP seed candidate — a naive atomic
    // seed would force-add both partners and commit a 2-duo group.
    const cache = buildPairScoreCache(ids, (a, b) => {
      const key = [a, b].sort().join('|');
      if (key === 'u1|u3') return 98;
      if (key === 'u1|u2' || key === 'u3|u4') return 95;
      return 90;
    });

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 },
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      false,
      [...DUO('u1', 'u2'), ...DUO('u3', 'u4')],
    );

    // Invariant: no committed group ever contains members of both duos.
    for (const group of groups) {
      const memberIds = new Set(group.members.map((m) => m.userId));
      const duoCount =
        (memberIds.has('u1') && memberIds.has('u2') ? 1 : 0) +
        (memberIds.has('u3') && memberIds.has('u4') ? 1 : 0);
      expect(duoCount).toBeLessThanOrEqual(1);
    }
    // The first duo commits with the solos; the second stays unmatched together.
    expect(groups.length).toBe(1);
    expect(groupOf(groups, 'u1')).toBe(groups[0]);
    expect(groupOf(groups, 'u2')).toBe(groups[0]);
    expect(groupOf(groups, 'u3')).toBeUndefined();
    expect(groupOf(groups, 'u4')).toBeUndefined();
  });

  it('keeps an unplaceable duo unmatched TOGETHER when the quality gate fails', async () => {
    const users = ['u1', 'u2', 's1', 's2', 's3', 's4'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    // Duo members score 30 against everyone (below the 60 admission gate);
    // solos score 95 among themselves.
    const cache = buildPairScoreCache(ids, (a, b) => {
      const duoInvolved = a.startsWith('u') || b.startsWith('u');
      return duoInvolved ? 30 : 95;
    });

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 },
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      false,
      DUO('u1', 'u2'),
    );

    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(4);
    // The duo was never split: neither member appears anywhere.
    expect(groupOf(groups, 'u1')).toBeUndefined();
    expect(groupOf(groups, 'u2')).toBeUndefined();
  });

  it('is byte-identical for zero-duo pools (duoPairs omitted vs empty)', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    const pool = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 };

    const withoutParam = await runGreedyPoolMatchingCore(
      users,
      pool,
      new Map(),
      buildPairScoreCache(ids, () => 95),
      undefined,
      false,
      undefined,
      [],
    );

    const withEmptyDuo = await runGreedyPoolMatchingCore(
      users,
      pool,
      new Map(),
      buildPairScoreCache(ids, () => 95),
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      false,
      [],
    );

    const shape = (groups: typeof withoutParam) =>
      groups.map((g) => g.members.map((m) => m.userId).sort());
    expect(shape(withEmptyDuo)).toEqual(shape(withoutParam));
  });

  it('R1 no-isolate holds for EACH duo member individually (duo-internal tie does not count)', async () => {
    const users = ['u1', 'u2', 's1', 's2', 's3', 's4'].map((id) => makeUser(id));
    const ids = users.map((u) => u.userId);
    // Duo-internal tie is strong (95); u1 has external ties (65 ≥ threshold);
    // u2 has NO external tie (55 < 60). With the magnetism rules ON, u2 can
    // never satisfy R1 — so no committed group may contain the duo, even
    // though the duo-internal score alone would have carried them before.
    const cache = buildPairScoreCache(ids, (a, b) => {
      const key = [a, b].sort().join('|');
      if (key === 'u1|u2') return 95;
      if (a.startsWith('u') || b.startsWith('u')) {
        const duoMember = a.startsWith('u') ? a : b;
        return duoMember === 'u1' ? 65 : 55;
      }
      return 95;
    });

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 10 },
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
      false,
      false,
      true, // magnetismGroupRulesEnabled
      DUO('u1', 'u2'),
    );

    expect(groupOf(groups, 'u1')).toBeUndefined();
    expect(groupOf(groups, 'u2')).toBeUndefined();
  });
});
