import { useMemo } from "react";
import { useAuth } from "./useAuth";

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
    guide: boolean;
  };
}

export type OnboardingStep = 
  | 'registration'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'guide'
  | 'complete';

const STEP_ORDER: OnboardingStep[] = [
  'registration',
  'personality-test',
  'essential-data',
  'extended-data',
  'guide',
  'complete',
];

/**
 * 注册引导进度管理 Hook
 * 
 * 集中管理用户在注册流程中的进度状态
 * 基于 useAuth 返回的用户状态计算
 */
export function useOnboardingProgress(): OnboardingProgress {
  const { user, needsRegistration, needsPersonalityTest, needsProfileSetup } = useAuth();
  
  const progress = useMemo(() => {
    const hasCompletedRegistration = user?.hasCompletedRegistration ?? false;
    const hasCompletedPersonalityTest = user?.hasCompletedPersonalityTest ?? false;
    const hasCompletedEssentialData = !!(user?.displayName && user?.gender && user?.currentCity);
    const hasCompletedExtendedData = !!(user?.intent || user?.interestsTop?.length);
    
    // 检查引导是否已看过 (从 localStorage)
    const hasSeenGuide = typeof window !== 'undefined' 
      ? localStorage.getItem('joyjoin_guide_seen') === 'true'
      : false;
    
    const steps = {
      registration: hasCompletedRegistration,
      personalityTest: hasCompletedPersonalityTest,
      essentialData: hasCompletedEssentialData,
      extendedData: hasCompletedExtendedData,
      guide: hasSeenGuide,
    };
    
    // 计算当前步骤
    let currentStep: OnboardingStep = 'complete';
    if (needsRegistration) {
      currentStep = 'registration';
    } else if (needsPersonalityTest) {
      currentStep = 'personality-test';
    } else if (needsProfileSetup) {
      currentStep = 'essential-data';
    } else if (!hasCompletedExtendedData) {
      currentStep = 'extended-data';
    } else if (!hasSeenGuide) {
      currentStep = 'guide';
    }
    
    // 计算进度
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
  }, [user, needsRegistration, needsPersonalityTest, needsProfileSetup]);
  
  return progress;
}

/**
 * 获取步骤对应的路由
 */
export function getStepRoute(step: OnboardingStep): string {
  switch (step) {
    case 'registration':
      return '/onboarding';
    case 'personality-test':
      return '/personality-test';
    case 'essential-data':
      return '/onboarding/setup';
    case 'extended-data':
      return '/onboarding/extended';
    case 'guide':
      return '/guide';
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
    case 'guide':
      return '新手引导';
    case 'complete':
      return '完成';
  }
}
