import { describe, expect, it } from 'vitest';
import {
  collapseLatestRoleResults,
  getLatestRoleResultsForUsers,
  MAX_BATCH_ROLE_RESULT_USERS,
  normalizeRoleTraitScores,
  prepareBatchRoleResultUserIds,
} from '../repositories/assessmentRepo';

describe('prepareBatchRoleResultUserIds', () => {
  it('dedupes, trims, and drops blank ids', () => {
    expect(prepareBatchRoleResultUserIds([' a ', 'a', '', '  ', 'b'])).toEqual(['a', 'b']);
  });

  it('caps the batch at the documented bound', () => {
    const ids = Array.from({ length: 30 }, (_, index) => `user-${index}`);
    const prepared = prepareBatchRoleResultUserIds(ids);
    expect(prepared).toHaveLength(MAX_BATCH_ROLE_RESULT_USERS);
    expect(MAX_BATCH_ROLE_RESULT_USERS).toBe(12);
    expect(prepared[0]).toBe('user-0');
  });

  it('handles null/undefined input', () => {
    expect(prepareBatchRoleResultUserIds(undefined)).toEqual([]);
    expect(prepareBatchRoleResultUserIds(null)).toEqual([]);
  });
});

describe('normalizeRoleTraitScores', () => {
  it('passes V4 0–100 scores through unchanged', () => {
    expect(
      normalizeRoleTraitScores({
        testVersion: 4,
        extraversionScore: 82,
        affinityScore: 64,
        emotionalStabilityScore: 71,
      }),
    ).toEqual({ extraversion: 82, affinity: 64, emotionalStability: 71 });
  });

  it('upscales legacy 0–10 scores so both scales average together', () => {
    expect(
      normalizeRoleTraitScores({
        testVersion: 1,
        extraversionScore: 8,
        affinityScore: 6,
        emotionalStabilityScore: 7,
      }),
    ).toEqual({ extraversion: 80, affinity: 60, emotionalStability: 70 });
  });

  it('clamps out-of-range values and neutralizes missing ones', () => {
    expect(
      normalizeRoleTraitScores({
        testVersion: 4,
        extraversionScore: 140,
        affinityScore: -10,
        emotionalStabilityScore: null,
      }),
    ).toEqual({ extraversion: 100, affinity: 0, emotionalStability: 50 });
  });

  it('does not upscale MatcherV2 rows: testVersion 2 already writes 0–100', () => {
    expect(
      normalizeRoleTraitScores({
        testVersion: 2,
        extraversionScore: 8,
        affinityScore: 6,
        emotionalStabilityScore: 7,
      }),
    ).toEqual({ extraversion: 8, affinity: 6, emotionalStability: 7 });
  });

  it('keeps a legacy row above the 0–10 band unscaled (defensive)', () => {
    expect(
      normalizeRoleTraitScores({
        testVersion: 2,
        extraversionScore: 55,
        affinityScore: 55,
        emotionalStabilityScore: 55,
      }).extraversion,
    ).toBe(55);
  });
});

describe('collapseLatestRoleResults', () => {
  it('keeps the first (newest) row per user', () => {
    const map = collapseLatestRoleResults([
      { userId: 'u1', testVersion: 4, extraversionScore: 90, affinityScore: 80, emotionalStabilityScore: 70 },
      { userId: 'u2', testVersion: 4, extraversionScore: 50, affinityScore: 50, emotionalStabilityScore: 50 },
      // Older duplicate from the same user must not overwrite the newest row.
      { userId: 'u1', testVersion: 4, extraversionScore: 10, affinityScore: 10, emotionalStabilityScore: 10 },
    ]);
    expect(map.size).toBe(2);
    expect(map.get('u1')).toEqual({ extraversion: 90, affinity: 80, emotionalStability: 70 });
    expect(map.get('u2')).toEqual({ extraversion: 50, affinity: 50, emotionalStability: 50 });
  });

  it('returns an empty map for no rows', () => {
    expect(collapseLatestRoleResults([]).size).toBe(0);
  });
});

describe('getLatestRoleResultsForUsers', () => {
  it('short-circuits on an empty input without querying', async () => {
    await expect(getLatestRoleResultsForUsers([])).resolves.toEqual(new Map());
    await expect(getLatestRoleResultsForUsers(['  '])).resolves.toEqual(new Map());
  });
});
