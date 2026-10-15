/**
 * entryCardInsightV2Enabled flag contract (sprint entry-card-insight-v2,
 * Amendment A1 AC-18).
 *
 *  - Registration: FLAG_ENV_MAP + DEFAULT_FLAG_VALUES (default TRUE — v2 is
 *    the shipped state; the flag is the same-day rollback lever).
 *  - Resolution chain: DB row wins over env; env wins over the code default.
 *  - /api/auth/user exposure: features.entryCardInsightV2Enabled reflects the
 *    resolved value (same pattern as every other flag in
 *    buildAuthUserResponse).
 *
 * The featureFlags module is REAL here (only ../db is mocked) so the
 * resolution chain itself is exercised, not a replica.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { flagDbRows, mockGetUser, mockGetAssessmentSessionByUser, mockGetRoleResult } = vi.hoisted(
  () => ({
    flagDbRows: [] as Array<{ value: string; updatedAt: Date | null; updatedBy: string | null }>,
    mockGetUser: vi.fn(),
    mockGetAssessmentSessionByUser: vi.fn(),
    mockGetRoleResult: vi.fn(),
  }),
);

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(flagDbRows),
        }),
      }),
    }),
  },
}));

vi.mock('../storage', () => ({
  storage: {
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
    getRoleResult: mockGetRoleResult,
  },
}));

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES, getFeatureFlag } = await import('../lib/featureFlags');
const { buildAuthUserResponse } = await import('../lib/buildAuthUserResponse');

const ENV_KEY = 'ENTRY_CARD_INSIGHT_V2_ENABLED';

const mockUser = {
  id: 'insight-v2-flag-user',
  displayName: 'Insight Flag Tester',
  gender: 'female',
  currentCity: 'Shenzhen',
  educationLevel: 'bachelor',
  industryNicheLabel: 'design',
  industryCategoryLabel: null,
  hometownRegionCity: 'Guangzhou',
  hasCompletedPersonalityTest: true,
  hasCompletedRegistration: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  onboardingCheckpoint: 'profile-review',
  primaryArchetype: 'fox',
  secondaryArchetype: null,
  onboardingRestartCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  flagDbRows.length = 0;
  delete process.env[ENV_KEY];
  mockGetUser.mockResolvedValue(mockUser);
  mockGetAssessmentSessionByUser.mockResolvedValue(null);
  mockGetRoleResult.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('entryCardInsightV2Enabled registration (AC-18)', () => {
  it('is DB-backed with the ENTRY_CARD_INSIGHT_V2_ENABLED env fallback', () => {
    expect(FLAG_ENV_MAP.entryCardInsightV2Enabled).toBe('ENTRY_CARD_INSIGHT_V2_ENABLED');
  });

  it('defaults TRUE when neither DB row nor env var is set (v2 is the shipped state)', async () => {
    expect(DEFAULT_FLAG_VALUES.entryCardInsightV2Enabled).toBe(true);
    expect(await getFeatureFlag('entryCardInsightV2Enabled')).toBe(true);
  });

  it('env fallback is honored both ways when no DB row exists', async () => {
    process.env[ENV_KEY] = 'false';
    expect(await getFeatureFlag('entryCardInsightV2Enabled', true)).toBe(false);

    process.env[ENV_KEY] = 'true';
    expect(await getFeatureFlag('entryCardInsightV2Enabled', false)).toBe(true);
  });

  it('DB row wins over the env var in both directions (rollback lever semantics)', async () => {
    process.env[ENV_KEY] = 'true';
    flagDbRows.push({ value: 'false', updatedAt: new Date(), updatedBy: 'ops' });
    expect(await getFeatureFlag('entryCardInsightV2Enabled', true)).toBe(false);

    flagDbRows.length = 0;
    process.env[ENV_KEY] = 'false';
    flagDbRows.push({ value: 'true', updatedAt: new Date(), updatedBy: 'ops' });
    expect(await getFeatureFlag('entryCardInsightV2Enabled', false)).toBe(true);
  });
});

describe('entryCardInsightV2Enabled /api/auth/user exposure (AC-18)', () => {
  it('features.entryCardInsightV2Enabled is true by default', async () => {
    const response = await buildAuthUserResponse(mockUser.id);

    expect(response).not.toBeNull();
    expect(response?.features?.entryCardInsightV2Enabled).toBe(true);
  });

  it('features.entryCardInsightV2Enabled flips false when the env kill-switch is set', async () => {
    process.env[ENV_KEY] = 'false';

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.entryCardInsightV2Enabled).toBe(false);
  });
});
