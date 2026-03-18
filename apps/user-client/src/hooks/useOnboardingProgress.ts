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
 * Map server-returned nextStep to the local OnboardingStep type.
 * 'guide' and 'discover' both mean onboarding is complete.
 * 'onboarding' is a legacy fallback value that maps to 'registration'.
 */
function nextStepToOnboardingStep(nextStep: NextStepType | undefined): OnboardingStep {
  switch (nextStep) {
    case 'onboarding':       return 'registration';
    case 'personality-test': return 'personality-test';
    case 'essential-data':   return 'essential-data';
    case 'extended-data':    return 'extended-data';
    case 'profile-review':   return 'profile-review';
    case 'guide':            // guide is deprecated; treat as complete
    case 'discover':         return 'complete';
    default:                 return 'complete';
  }
}

/**
 * 注册引导进度管理 Hook
 *
 * Derives the current onboarding step primarily from the server-calculated
 * `nextStep` returned by `/api/auth/user`, so it always matches the router in
 * `App.tsx`. Legacy per-field booleans are kept only to populate the `steps`
 * completion map (for display purposes) and as a fallback when the user object
 * is not yet loaded.
 */
export function useOnboardingProgress(): OnboardingProgress {
  const { user, nextStep, profileExtendedComplete } = useAuth();
  
  const progress = useMemo(() => {
    // --- Completion flags (for display / steps map) ---
    const hasCompletedRegistration = user?.hasCompletedRegistration ?? false;
    const hasCompletedPersonalityTest = user?.hasCompletedPersonalityTest ?? false;
    // Use server-computed `profileEssentialComplete` when available; fall back
    // to field-presence heuristic so the steps map stays accurate.
    const hasCompletedEssentialData =
      user?.profileEssentialComplete ??
      !!(user?.displayName && user?.gender && user?.currentCity);
    // Use server-computed `profileExtendedComplete` (or the canonical flag) —
    // do NOT mix in `intent` field presence, which is not a completion signal.
    const hasCompletedExtendedData =
      profileExtendedComplete ??
      (user?.hasCompletedInterestsCarousel ?? false);
    const hasSeenProfileReview = user?.hasSeenProfileReview ?? false;

    const steps = {
      registration: hasCompletedRegistration,
      personalityTest: hasCompletedPersonalityTest,
      essentialData: hasCompletedEssentialData,
      extendedData: hasCompletedExtendedData,
      profileReview: hasSeenProfileReview,
    };

    // --- Current step: always derived from server nextStep (source of truth) ---
    const currentStep: OnboardingStep = nextStepToOnboardingStep(nextStep);

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
  }, [user, nextStep, profileExtendedComplete]);
  
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
