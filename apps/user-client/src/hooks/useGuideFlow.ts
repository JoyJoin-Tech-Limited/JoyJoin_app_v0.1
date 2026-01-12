import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

const GUIDE_SEEN_KEY = "joyjoin_guide_seen";
const TOTAL_STEPS = 3;

export interface GuideFlowState {
  /** 当前步骤 (0-2) */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 是否已看过引导 (server-driven) */
  hasSeenGuide: boolean;
  /** 是否显示引导 */
  showGuide: boolean;
  /** 进入下一步 */
  nextStep: () => void;
  /** 返回上一步 */
  prevStep: () => void;
  /** 跳过引导 */
  skipGuide: () => void;
  /** 完成引导 */
  completeGuide: () => void;
  /** 开始引导 (用于测试或重置) */
  startGuide: () => void;
}

/**
 * 引导流程管理 Hook
 * 
 * 管理 3 步引导页的状态和导航
 * - 步骤 1: 用户画像生成说明
 * - 步骤 2: 盲盒活动流程介绍
 * - 步骤 3: 小悦 AI 助手引导
 * 
 * Now uses server-driven state for guide persistence (B2).
 * Local storage is used as a fallback/hint only.
 * 
 * @param options.autoShowAfterRegistration - 注册完成后自动显示引导
 */
export function useGuideFlow(options?: {
  autoShowAfterRegistration?: boolean;
}): GuideFlowState {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  
  // Server-driven guide state (B2)
  const { data: user } = useQuery<User & { hasSeenGuide?: boolean }>({
    queryKey: ["/api/auth/user"],
    staleTime: Infinity,
  });
  
  // Server-side mark as seen mutation
  const markSeenMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/guide/mark-seen");
    },
    onSuccess: () => {
      // Also set local storage as a hint
      localStorage.setItem(GUIDE_SEEN_KEY, 'true');
      // Invalidate user query to refresh hasSeenGuide
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
  
  // Check if guide has been seen - prefer server state, fallback to local storage
  const hasSeenGuide = user?.hasSeenGuide === true || (
    typeof window !== 'undefined' && localStorage.getItem(GUIDE_SEEN_KEY) === 'true'
  );
  
  // 自动显示引导 (如果需要)
  useEffect(() => {
    if (options?.autoShowAfterRegistration && !hasSeenGuide) {
      setShowGuide(true);
    }
  }, [options?.autoShowAfterRegistration, hasSeenGuide]);
  
  const markAsSeen = useCallback(() => {
    // Always set local storage immediately for UX
    localStorage.setItem(GUIDE_SEEN_KEY, 'true');
    // Persist to server
    markSeenMutation.mutate();
  }, [markSeenMutation]);
  
  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // 最后一步，完成引导
      markAsSeen();
      setShowGuide(false);
      setLocation("/");
    }
  }, [currentStep, markAsSeen, setLocation]);
  
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);
  
  const skipGuide = useCallback(() => {
    markAsSeen();
    setShowGuide(false);
    setLocation("/");
  }, [markAsSeen, setLocation]);
  
  const completeGuide = useCallback(() => {
    markAsSeen();
    setShowGuide(false);
    setLocation("/");
  }, [markAsSeen, setLocation]);
  
  const startGuide = useCallback(() => {
    setCurrentStep(0);
    setShowGuide(true);
  }, []);
  
  return {
    currentStep,
    totalSteps: TOTAL_STEPS,
    hasSeenGuide,
    showGuide,
    nextStep,
    prevStep,
    skipGuide,
    completeGuide,
    startGuide,
  };
}

/**
 * 检查是否需要显示引导
 * Uses local storage as a hint - the actual decision should use server state
 */
export function shouldShowGuide(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GUIDE_SEEN_KEY) !== 'true';
}

/**
 * 重置引导状态 (用于测试)
 */
export function resetGuideState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GUIDE_SEEN_KEY);
  }
}
