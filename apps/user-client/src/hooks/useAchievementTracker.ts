import { useCallback, useRef } from "react";
import { useAchievementContext } from "@/contexts/AchievementContext";

interface TrackingContext {
  answeredCount: number;
  totalEstimate: number;
  hasStarted: boolean;
}

export function useAchievementTracker() {
  const { unlockAchievement, isUnlocked } = useAchievementContext();
  const trackingRef = useRef<TrackingContext>({
    answeredCount: 0,
    totalEstimate: 0,
    hasStarted: false,
  });

  const trackTestStart = useCallback(
    (estimatedTotal: number) => {
      if (trackingRef.current.hasStarted) return;
      trackingRef.current.hasStarted = true;
      trackingRef.current.totalEstimate = Math.max(estimatedTotal, 0);
      unlockAchievement("personality_started");
    },
    [unlockAchievement]
  );

  const trackQuestionAnswered = useCallback(
    (answered: number) => {
      if (!trackingRef.current.hasStarted) return;
      trackingRef.current.answeredCount = answered;

      if (answered >= 1) {
        unlockAchievement("first_answer");
      }
      if (answered >= 5 && !isUnlocked("five_answers")) {
        unlockAchievement("five_answers");
      }
    },
    [unlockAchievement, isUnlocked]
  );

  const trackTestComplete = useCallback(() => {
    if (!trackingRef.current.hasStarted) return;
    unlockAchievement("test_completed");
  }, [unlockAchievement]);

  const trackGuideCompleted = useCallback(() => {
    unlockAchievement("guide_completed");
  }, [unlockAchievement]);

  const trackProfileViewed = useCallback(() => {
    unlockAchievement("profile_viewed");
  }, [unlockAchievement]);

  return {
    trackTestStart,
    trackQuestionAnswered,
    trackTestComplete,
    trackGuideCompleted,
    trackProfileViewed,
  };
}
