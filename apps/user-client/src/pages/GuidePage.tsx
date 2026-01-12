import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGuideFlow, shouldShowGuide } from "@/hooks/useGuideFlow";
import { useAchievementTracker } from "@/hooks/useAchievementTracker";
import { GuideStepper } from "@/components/guide";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { User } from "@shared/schema";

/**
 * 引导页
 * 
 * 3 步全屏引导流程:
 * 1. 用户画像生成说明
 * 2. 盲盒活动流程介绍
 * 3. 小悦 AI 助手引导
 */
export default function GuidePage() {
  const [, setLocation] = useLocation();
  const { trackGuideCompleted } = useAchievementTracker();
  
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    staleTime: Infinity,
  });
  
  const {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipGuide,
    completeGuide,
  } = useGuideFlow();
  
  const handleSkipGuide = () => {
    skipGuide();
    trackGuideCompleted();
  };

  const handleCompleteGuide = () => {
    completeGuide();
    trackGuideCompleted();
  };
  
  // 检查是否需要显示引导
  if (!shouldShowGuide()) {
    // 已看过引导，直接跳转首页
    setLocation("/");
    return null;
  }
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  const handleChatWithXiaoyue = () => {
    // 完成引导并跳转到小悦聊天
    completeGuide();
    trackGuideCompleted();
    // 可以跳转到聊天页面或打开聊天对话框
    // setLocation("/chat-registration");
  };
  
  return (
    <GuideStepper
      currentStep={currentStep}
      totalSteps={totalSteps}
      archetype={user?.archetype || undefined}
      onNext={nextStep}
      onPrev={prevStep}
      onSkip={handleSkipGuide}
      onComplete={handleCompleteGuide}
      onChatWithXiaoyue={handleChatWithXiaoyue}
    />
  );
}
