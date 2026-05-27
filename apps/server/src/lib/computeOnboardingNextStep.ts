import type { OnboardingNextStep } from "@shared/onboarding";
import type { User } from "@shared/schema";

const stepOrder: OnboardingNextStep[] = [
  'onboarding',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
  'discover',
];

/**
 * Compute the server-driven next onboarding step for a user.
 *
 * This is the single source of truth for onboarding routing.
 * Both `buildAuthUserResponse` and `restartOnboarding` use this helper
 * to ensure they never drift.
 *
 * @param user — a User-like object with the fields needed for nextStep computation
 * @returns the next onboarding step (e.g. 'essential-data', 'discover', etc.)
 */
export function computeOnboardingNextStep(
  user: Pick<
    User,
    | 'hasCompletedPersonalityTest'
    | 'hasCompletedRegistration'
    | 'displayName'
    | 'gender'
    | 'currentCity'
    | 'hasCompletedInterestsCarousel'
    | 'hasSeenProfileReview'
    | 'onboardingCheckpoint'
  >,
): OnboardingNextStep {
  const profileEssentialComplete = !!(
    user.displayName &&
    user.gender &&
    user.currentCity
  );

  let nextStep: OnboardingNextStep;
  if (!user.hasCompletedPersonalityTest && !user.hasCompletedRegistration) {
    nextStep = 'onboarding';
  } else if (!user.hasCompletedPersonalityTest) {
    nextStep = 'personality-test';
  } else if (!profileEssentialComplete) {
    nextStep = 'essential-data';
  } else if (!user.hasCompletedInterestsCarousel) {
    nextStep = 'extended-data';
  } else if (!user.hasSeenProfileReview) {
    nextStep = 'profile-review';
  } else {
    nextStep = 'discover';
  }

  // Checkpoint recovery: if the user completed a later step out of order,
  // bump them forward to the step after their checkpoint.
  const baseIndex = stepOrder.indexOf(nextStep);
  const checkpointValue = user.onboardingCheckpoint as OnboardingNextStep | null;
  const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;

  if (
    checkpointValue &&
    checkpointIndex !== -1 &&
    baseIndex !== -1 &&
    checkpointIndex > baseIndex &&
    checkpointIndex < stepOrder.indexOf('discover')
  ) {
    const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
    nextStep = stepOrder[nextStepIndex];
  }

  return nextStep;
}
