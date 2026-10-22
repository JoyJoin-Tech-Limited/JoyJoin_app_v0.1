/**
 * QA-switch production gate (2026-10-22).
 *
 * Two switches are dangerous enough that a flag alone is not sufficient:
 *   - `onboardingForceSkip`            → every user gets a 跳过 button
 *   - `socialIcebreakerClientForceEnd` → any host can force-end a live session
 *
 * Both therefore require `APP_MODE !== "production"` IN ADDITION to the flag
 * (same fail-safe shape as the Flash QA switches in
 * `routes/domains/alangFlash.ts`). `APP_MODE` unset counts as production.
 *
 * This test pins the behaviour at the /api/auth/user boundary: a mis-flip in
 * the admin portal must not advertise a control that the route will reject.
 * The route-level gates are `403 FORCE_SKIP_DISABLED` /
 * `503 FORCE_END_DISABLED` in `routes/domains/auth.ts` and
 * `routes/socialIcebreakerExtended.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import('../lib/featureFlags');
const { buildAuthUserResponse } = await import('../lib/buildAuthUserResponse');

const QA_FLAG_KEYS = ['onboardingForceSkip', 'socialIcebreakerClientForceEnd'] as const;
/** Derived from the registry so a rename can never silently no-op this test. */
const ENV_KEYS = QA_FLAG_KEYS.map((key) => FLAG_ENV_MAP[key]);

const mockUser = {
  id: 'qa-gate-user',
  displayName: 'QA Gate Tester',
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

/** Turn both QA switches fully ON (env fallback; no DB row, so env wins). */
function enableBothFlags() {
  for (const envKey of ENV_KEYS) process.env[envKey] = 'true';
}

beforeEach(() => {
  vi.clearAllMocks();
  flagDbRows.length = 0;
  delete process.env.APP_MODE;
  mockGetUser.mockResolvedValue(mockUser);
  mockGetAssessmentSessionByUser.mockResolvedValue(null);
  mockGetRoleResult.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.APP_MODE;
  for (const envKey of ENV_KEYS) delete process.env[envKey];
});

describe('QA switch registration', () => {
  it('is DB-backed and defaults to OFF', () => {
    expect(FLAG_ENV_MAP.onboardingForceSkip).toBe('ONBOARDING_FORCE_SKIP_ENABLED');
    expect(FLAG_ENV_MAP.socialIcebreakerClientForceEnd).toBe('SOCIAL_ICEBREAKER_CLIENT_FORCE_END');
    expect(DEFAULT_FLAG_VALUES.onboardingForceSkip).toBe(false);
    expect(DEFAULT_FLAG_VALUES.socialIcebreakerClientForceEnd).toBe(false);
  });
});

describe('non-production: flag decides', () => {
  it('exposes both switches when APP_MODE=staging and the flag is on', async () => {
    process.env.APP_MODE = 'staging';
    enableBothFlags();

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.onboardingForceSkip).toBe(true);
    expect(response?.features?.socialIcebreakerClientForceEnd).toBe(true);
  });
});

describe('production: gate wins over the flag', () => {
  it('hides both switches when APP_MODE=production even with the flag on', async () => {
    process.env.APP_MODE = 'production';
    enableBothFlags();

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.onboardingForceSkip).toBe(false);
    expect(response?.features?.socialIcebreakerClientForceEnd).toBe(false);
  });

  it('treats an unset APP_MODE as production (fail-safe)', async () => {
    enableBothFlags();

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.onboardingForceSkip).toBe(false);
    expect(response?.features?.socialIcebreakerClientForceEnd).toBe(false);
  });
});

describe('flag OFF in non-production stays off', () => {
  it('does not expose a QA switch whose flag is off', async () => {
    process.env.APP_MODE = 'staging';

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.onboardingForceSkip).toBe(false);
    expect(response?.features?.socialIcebreakerClientForceEnd).toBe(false);
  });
});
