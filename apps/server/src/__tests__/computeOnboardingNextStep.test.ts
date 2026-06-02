import { describe, it, expect } from 'vitest';
import { computeOnboardingNextStep } from '../lib/computeOnboardingNextStep';
import type { User } from '@shared/schema';
import type { OnboardingNextStep } from '@shared/onboarding';

type TestUser = Pick<
  User,
  | 'hasCompletedPersonalityTest'
  | 'hasCompletedRegistration'
  | 'displayName'
  | 'gender'
  | 'currentCity'
  | 'hasCompletedInterestsCarousel'
  | 'hasSeenProfileReview'
  | 'onboardingCheckpoint'
>;

function freshUser(overrides?: Partial<TestUser>): TestUser {
  return {
    hasCompletedPersonalityTest: false,
    hasCompletedRegistration: false,
    displayName: null,
    gender: null,
    currentCity: null,
    hasCompletedInterestsCarousel: false,
    hasSeenProfileReview: false,
    onboardingCheckpoint: null,
    ...overrides,
  };
}

describe('computeOnboardingNextStep', () => {
  // ── Basic progression ──

  it('returns "onboarding" when user has neither completed personality test nor registration', () => {
    const next = computeOnboardingNextStep(freshUser());
    expect(next).toBe('onboarding');
  });

  it('returns "personality-test" when registration is done but personality test is not', () => {
    const next = computeOnboardingNextStep(
      freshUser({ hasCompletedRegistration: true }),
    );
    expect(next).toBe('personality-test');
  });

  it('returns "personality-test" when personality test is not done regardless of registration flag', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: false,
        hasCompletedRegistration: true,
      }),
    );
    expect(next).toBe('personality-test');
  });

  it('returns "essential-data" when personality test is done but profile is not essential-complete', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: null,
        gender: null,
        currentCity: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  it('returns "essential-data" when one of displayName/gender/currentCity is missing', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  it('returns "extended-data" when profile is essential-complete but interests carousel is not done', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: false,
      }),
    );
    expect(next).toBe('extended-data');
  });

  it('returns "profile-review" when interests carousel is done but profile review not seen', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: true,
        hasSeenProfileReview: false,
      }),
    );
    expect(next).toBe('profile-review');
  });

  it('returns "discover" when all onboarding steps are complete', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: true,
        hasSeenProfileReview: true,
      }),
    );
    expect(next).toBe('discover');
  });

  // ── Checkpoint recovery ──

  it('bumps user forward when checkpoint is ahead of computed base step', () => {
    // Base is 'essential-data' (profile not essential-complete since city is null)
    // Checkpoint is 'extended-data' (index 3 > index 2), bump to index 4 = 'profile-review'
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: null,
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
        onboardingCheckpoint: 'extended-data',
      }),
    );
    expect(next).toBe('profile-review');
  });

  it('does not bump user backward when checkpoint is behind computed base', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: true,
        hasSeenProfileReview: false,
        onboardingCheckpoint: 'essential-data',
      }),
    );
    // Base is 'profile-review', checkpoint is 'essential-data' (behind)
    expect(next).toBe('profile-review');
  });

  it('caps checkpoint recovery at "discover"', () => {
    // Base is 'essential-data' (index 2, city is null), checkpoint is 'profile-review' (index 4).
    // Bump would be to index 5 which is 'discover' — capped at max index.
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: null,
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
        onboardingCheckpoint: 'profile-review',
      }),
    );
    expect(next).toBe('discover');
  });

  it('bumps to "discover" when checkpoint is "profile-review" and base is earlier', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
        onboardingCheckpoint: 'profile-review',
      }),
    );
    expect(next).toBe('discover');
  });

  it('handles null onboardingCheckpoint gracefully', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: null,
        gender: null,
        currentCity: null,
        onboardingCheckpoint: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  // ── Partial completion edge cases ──

  it('goes to personality-test when registration is done but personality test and profile are incomplete', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedRegistration: true,
        hasCompletedPersonalityTest: false,
        displayName: null,
        gender: null,
        currentCity: null,
      }),
    );
    expect(next).toBe('personality-test');
  });

  it('goes to essential-data when personality test done but registration is not', () => {
    // hasCompletedPersonalityTest=true, hasCompletedRegistration=false
    // The first condition checks both are false → false
    // Second condition checks !personalityTest → false (it is true)
    // Third checks !profileEssentialComplete → true → 'essential-data'
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: false,
        displayName: null,
        gender: null,
        currentCity: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  it('returns "essential-data" when only one essential field is set', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: null,
        currentCity: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  it('returns "essential-data" when only two essential fields are set', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Joy',
        gender: 'female',
        currentCity: null,
      }),
    );
    expect(next).toBe('essential-data');
  });

  // ── All nextStep values are covered ──

  it('covers every possible nextStep value through various inputs', () => {
    const allSteps = new Set<OnboardingNextStep>();

    // onboarding
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({ hasCompletedPersonalityTest: false, hasCompletedRegistration: false }),
      ),
    );

    // personality-test
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({ hasCompletedPersonalityTest: false, hasCompletedRegistration: true }),
      ),
    );

    // essential-data
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
          displayName: null,
          gender: null,
          currentCity: null,
        }),
      ),
    );

    // extended-data
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
          displayName: 'Joy',
          gender: 'female',
          currentCity: 'Hong Kong',
          hasCompletedInterestsCarousel: false,
        }),
      ),
    );

    // profile-review
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
          displayName: 'Joy',
          gender: 'female',
          currentCity: 'Hong Kong',
          hasCompletedInterestsCarousel: true,
          hasSeenProfileReview: false,
        }),
      ),
    );

    // discover
    allSteps.add(
      computeOnboardingNextStep(
        freshUser({
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
          displayName: 'Joy',
          gender: 'female',
          currentCity: 'Hong Kong',
          hasCompletedInterestsCarousel: true,
          hasSeenProfileReview: true,
        }),
      ),
    );

    expect(allSteps.size).toBe(6);
    expect(allSteps.has('onboarding')).toBe(true);
    expect(allSteps.has('personality-test')).toBe(true);
    expect(allSteps.has('essential-data')).toBe(true);
    expect(allSteps.has('extended-data')).toBe(true);
    expect(allSteps.has('profile-review')).toBe(true);
    expect(allSteps.has('discover')).toBe(true);
  });

  it('checkpoint at "personality-test" from "onboarding" base bumps to "essential-data"', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: false,
        hasCompletedRegistration: false,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: false,
        onboardingCheckpoint: 'personality-test',
      }),
    );
    // Base 'onboarding', checkpoint 'personality-test' (index 1 > index 0), bump to index 2 = 'essential-data'
    expect(next).toBe('essential-data');
  });

  it('checkpoint at "essential-data" from "onboarding" base bumps to "extended-data"', () => {
    const next = computeOnboardingNextStep(
      freshUser({
        hasCompletedPersonalityTest: false,
        hasCompletedRegistration: false,
        displayName: 'Joy',
        gender: 'female',
        currentCity: 'Hong Kong',
        hasCompletedInterestsCarousel: false,
        onboardingCheckpoint: 'essential-data',
      }),
    );
    expect(next).toBe('extended-data');
  });
});
