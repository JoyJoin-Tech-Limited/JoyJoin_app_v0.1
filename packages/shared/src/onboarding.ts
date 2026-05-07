/**
 * Shared onboarding flow logic — platform-agnostic pure functions.
 *
 * Used by the mini-program (apps/mini-program) to ensure consistent
 * onboarding state derivation from the server's nextStep.
 */

export type ActiveOnboardingStep =
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'complete'

export type OnboardingNextStep =
  | 'onboarding'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'discover'

export interface OnboardingProgress {
  currentStep: ActiveOnboardingStep
  totalSteps: number
  progress: number
  isComplete: boolean
  steps: {
    personalityTest: boolean
    essentialData: boolean
    extendedData: boolean
    profileReview: boolean
  }
}

const ACTIVE_STEP_ORDER: ActiveOnboardingStep[] = [
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
  'complete',
]

/**
 * Map a server nextStep value to the corresponding active onboarding step.
 */
export function nextStepToOnboardingStep(nextStep: OnboardingNextStep | string | undefined): ActiveOnboardingStep {
  switch (nextStep) {
    case 'onboarding':
    case 'personality-test':
      return 'personality-test'
    case 'essential-data':
      return 'essential-data'
    case 'extended-data':
      return 'extended-data'
    case 'profile-review':
      return 'profile-review'
    case 'discover':
    default:
      return 'complete'
  }
}

/**
 * Get the Chinese label for an onboarding step.
 */
export function getOnboardingStepLabel(step: ActiveOnboardingStep): string {
  switch (step) {
    case 'personality-test':
      return '氛围测试'
    case 'essential-data':
      return '基本资料'
    case 'extended-data':
      return '兴趣偏好'
    case 'profile-review':
      return '资料预览'
    case 'complete':
      return '完成'
  }
}

/**
 * Build onboarding progress state from a user object.
 * Pure function — no React, no platform APIs.
 */
export function buildOnboardingProgress(user: {
  nextStep?: string
  hasCompletedPersonalityTest?: boolean
  profileEssentialComplete?: boolean
  hasCompletedInterestsCarousel?: boolean
  hasSeenProfileReview?: boolean
} | undefined): OnboardingProgress {
  // totalSteps excludes the 'complete' pseudo-step which is only a terminal marker
  const totalSteps = ACTIVE_STEP_ORDER.length - 1

  if (!user) {
    return {
      currentStep: 'personality-test',
      totalSteps,
      progress: 0,
      isComplete: false,
      steps: {
        personalityTest: false,
        essentialData: false,
        extendedData: false,
        profileReview: false,
      },
    }
  }

  const currentStep = nextStepToOnboardingStep(user.nextStep)
  const currentIndex = ACTIVE_STEP_ORDER.indexOf(currentStep)

  return {
    currentStep,
    totalSteps,
    progress: Math.round((currentIndex / totalSteps) * 100),
    isComplete: currentStep === 'complete',
    steps: {
      personalityTest: user.hasCompletedPersonalityTest ?? false,
      essentialData: user.profileEssentialComplete ?? false,
      extendedData: user.hasCompletedInterestsCarousel ?? false,
      profileReview: user.hasSeenProfileReview ?? false,
    },
  }
}
