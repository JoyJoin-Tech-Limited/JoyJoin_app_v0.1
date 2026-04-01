import { useMemo } from "react";
import { useAuth, type NextStepType } from "./useAuth";

/**
 * 注册引导进度状态
 */
export interface OnboardingProgress {
  /** 当前步骤 */
  currentStep: OnboardingStep;
  /** 总步骤数 */
  totalSteps: number;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 是否完成所有步骤 */
  isComplete: boolean;
  /** 各步骤完成状态 */
  steps: {
    registration: boolean;
    personalityTest: boolean;
    essentialData: boolean;
    extendedData: boolean;
    profileReview: boolean;
  };
}

export type OnboardingStep = 
  | 'registration'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'complete';

const STEP_ORDER: OnboardingStep[] = [
  'registration',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
  'complete',
];

/**
 * Map server-driven nextStep to the equivalent OnboardingStep for progress display.
 * This is the primary source of truth for the current step.
 */
function nextStepToOnboardingStep(nextStep: NextStepType): OnboardingStep {
  switch (nextStep) {
    case 'onboarding':
      return 'registration';
    case 'personality-test':
      return 'personality-test';
    case 'essential-data':
      return 'essential-data';
    case 'extended-data':
      return 'extended-data';
    case 'profile-review':
      return 'profile-review';
    case 'guide':
    case 'discover':
    default:
      return 'complete';
  }
}

/**
 * 注册引导进度管理 Hook
 *
 * Derives onboarding progress from the server-calculated `nextStep` returned by
 * `/api/auth/user`. The legacy boolean reconstruction is kept only as an explicit
 * fallback for the rare case where `nextStep` is absent.
 */
export function useOnboardingProgress(): OnboardingProgress {
  const { user } = useAuth();
  
  const progress = useMemo(() => {
    // --- Completion signals (server-owned flags preferred) ---
    const hasCompletedPersonalityTest = user?.hasCompletedPersonalityTest ?? false;
    // Prefer server-computed flag; fall back to field-presence check only if unavailable.
    const hasCompletedEssentialData =
      user?.profileEssentialComplete ?? !!(user?.displayName && user?.gender && user?.currentCity);
    // Use dedicated server flag; avoid mixing semantic field presence (e.g. `intent`)
    // with onboarding completion.
    const hasCompletedExtendedData = user?.hasCompletedInterestsCarousel ?? false;
    const hasSeenProfileReview = user?.hasSeenProfileReview ?? false;

    const steps = {
      registration: hasCompletedPersonalityTest,
      personalityTest: hasCompletedPersonalityTest,
      essentialData: hasCompletedEssentialData,
      extendedData: hasCompletedExtendedData,
      profileReview: hasSeenProfileReview,
    };

    // --- Primary: derive currentStep from server-calculated nextStep ---
    let currentStep: OnboardingStep;
    if (user?.nextStep) {
      currentStep = nextStepToOnboardingStep(user.nextStep);
    } else {
      // Fallback: reconstruct from server-owned completion flags when nextStep is absent.
      currentStep = 'complete';
      if (!hasCompletedPersonalityTest) {
        currentStep = 'registration';
      } else if (!hasCompletedEssentialData) {
        currentStep = 'essential-data';
      } else if (!hasCompletedExtendedData) {
        currentStep = 'extended-data';
      } else if (!hasSeenProfileReview) {
        currentStep = 'profile-review';
      }
    }

    // Calculate progress
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const totalSteps = STEP_ORDER.length - 1; // 不包括 'complete'
    const progressPercent = Math.round((currentIndex / totalSteps) * 100);
    
    return {
      currentStep,
      totalSteps,
      progress: progressPercent,
      isComplete: currentStep === 'complete',
      steps,
    };
  }, [user]);
  
  return progress;
}

/**
 * 获取步骤对应的路由
 */
export function getStepRoute(step: OnboardingStep): string {
  switch (step) {
    case 'registration':
      return '/personality-test';
    case 'personality-test':
      return '/personality-test';
    case 'essential-data':
      return '/onboarding/setup';
    case 'extended-data':
      return '/onboarding/extended';
    case 'profile-review':
      return '/onboarding/review';
    case 'complete':
    default:
      return '/';
  }
}

/**
 * 获取步骤标签 (中文)
 */
export function getStepLabel(step: OnboardingStep): string {
  switch (step) {
    case 'registration':
      return '注册';
    case 'personality-test':
      return '氛围测试';
    case 'essential-data':
      return '基本资料';
    case 'extended-data':
      return '补充资料';
    case 'profile-review':
      return '资料预览';
    case 'complete':
      return '完成';
  }
}
