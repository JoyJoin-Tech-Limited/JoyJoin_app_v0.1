import type { AuthUser, NextStepType } from "@/hooks/useAuth";

export type ActiveOnboardingStep =
  | "personality-test"
  | "essential-data"
  | "extended-data"
  | "profile-review"
  | "complete";

export type OnboardingRoute =
  | "/login"
  | "/personality-test"
  | "/onboarding/setup"
  | "/onboarding/extended"
  | "/onboarding/review"
  | "/discover";

export interface OnboardingProgress {
  currentStep: ActiveOnboardingStep;
  totalSteps: number;
  progress: number;
  isComplete: boolean;
  steps: {
    personalityTest: boolean;
    essentialData: boolean;
    extendedData: boolean;
    profileReview: boolean;
  };
}

export interface OnboardingFlowState extends OnboardingProgress {
  nextStep: NextStepType | undefined;
  currentRoute: OnboardingRoute;
  source: "signed-out" | "server-next-step" | "missing-next-step";
}

const ACTIVE_STEP_ORDER: ActiveOnboardingStep[] = [
  "personality-test",
  "essential-data",
  "extended-data",
  "profile-review",
  "complete",
];

export const ACTIVE_ONBOARDING_FILES = {
  orchestrator: "apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts",
  flow: "apps/user-client/src/features/onboarding/active/flow.ts",
  pages: "apps/user-client/src/features/onboarding/active/pages",
  hooks: "apps/user-client/src/features/onboarding/active/hooks",
  legacyPages: "apps/user-client/src/legacy/onboarding/pages",
} as const;

export function nextStepToOnboardingStep(nextStep: NextStepType | undefined): ActiveOnboardingStep {
  switch (nextStep) {
    case "onboarding":
    case "personality-test":
      return "personality-test";
    case "essential-data":
      return "essential-data";
    case "extended-data":
      return "extended-data";
    case "profile-review":
      return "profile-review";
    case "guide":
    case "discover":
    default:
      return "complete";
  }
}

export function getStepRoute(step: ActiveOnboardingStep): OnboardingRoute {
  switch (step) {
    case "personality-test":
      return "/personality-test";
    case "essential-data":
      return "/onboarding/setup";
    case "extended-data":
      return "/onboarding/extended";
    case "profile-review":
      return "/onboarding/review";
    case "complete":
    default:
      return "/discover";
  }
}

export function nextStepToRoute(nextStep: NextStepType | undefined): OnboardingRoute {
  return getStepRoute(nextStepToOnboardingStep(nextStep));
}

export function getStepLabel(step: ActiveOnboardingStep): string {
  switch (step) {
    case "personality-test":
      return "氛围测试";
    case "essential-data":
      return "基本资料";
    case "extended-data":
      return "兴趣偏好";
    case "profile-review":
      return "资料预览";
    case "complete":
      return "完成";
  }
}

export function buildOnboardingProgress(user: AuthUser | undefined): OnboardingProgress {
  const totalSteps = ACTIVE_STEP_ORDER.length - 1;

  if (!user) {
    return {
      currentStep: "personality-test",
      totalSteps,
      progress: 0,
      isComplete: false,
      steps: {
        personalityTest: false,
        essentialData: false,
        extendedData: false,
        profileReview: false,
      },
    };
  }

  const currentStep = nextStepToOnboardingStep(user.nextStep);
  const currentIndex = ACTIVE_STEP_ORDER.indexOf(currentStep);

  return {
    currentStep,
    totalSteps,
    progress: Math.round((currentIndex / totalSteps) * 100),
    isComplete: currentStep === "complete",
    steps: {
      personalityTest: user.hasCompletedPersonalityTest ?? false,
      essentialData: user.profileEssentialComplete ?? false,
      extendedData: user.hasCompletedInterestsCarousel ?? false,
      profileReview: user.hasSeenProfileReview ?? false,
    },
  };
}

export function buildOnboardingFlowState(user: AuthUser | undefined): OnboardingFlowState {
  if (!user) {
    return {
      nextStep: undefined,
      currentRoute: "/login",
      source: "signed-out",
      ...buildOnboardingProgress(undefined),
    };
  }

  return {
    nextStep: user.nextStep,
    currentRoute: nextStepToRoute(user.nextStep),
    source: user.nextStep ? "server-next-step" : "missing-next-step",
    ...buildOnboardingProgress(user),
  };
}
