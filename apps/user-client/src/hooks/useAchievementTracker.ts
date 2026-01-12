/**
 * useAchievementTracker - Tracking logic for achievement triggers
 */

import { useCallback, useRef } from "react";
import { useAchievements } from "@/contexts/AchievementContext";

interface TraitScores {
  A?: number;
  C?: number;
  E?: number;
  O?: number;
  X?: number;
  P?: number;
}

interface TrackAnswerParams {
  answeredCount: number;
  totalEstimate: number;
  topConfidence: number;
  usedSkip: boolean;
  traitScores?: TraitScores;
}

interface UseAchievementTrackerReturn {
  /** Call when a question starts displaying */
  trackQuestionStart: () => void;
  /** Call when an answer is submitted */
  trackAnswer: (params: TrackAnswerParams) => void;
  /** Call when test is completed */
  trackCompletion: (params: { answeredCount: number; minQuestions: number }) => void;
  /** Call when skip/換題 is used */
  trackSkip: () => void;
}

export function useAchievementTracker(): UseAchievementTrackerReturn {
  const { unlock, isUnlocked } = useAchievements();
  const questionStartTimeRef = useRef<number>(0);
  const hasTrackedFirstAnswer = useRef(false);

  const trackQuestionStart = useCallback(() => {
    questionStartTimeRef.current = Date.now();
  }, []);

  const trackAnswer = useCallback(({
    answeredCount,
    totalEstimate,
    topConfidence,
    usedSkip,
  }: TrackAnswerParams) => {
    // First answer achievement
    if (answeredCount === 1 && !hasTrackedFirstAnswer.current) {
      hasTrackedFirstAnswer.current = true;
      unlock("first_answer");
    }

    // Quick thinker - answered in < 5 seconds
    const answerTime = Date.now() - questionStartTimeRef.current;
    if (answerTime < 5000 && answerTime > 0 && !isUnlocked("quick_thinker")) {
      unlock("quick_thinker");
    }

    // Halfway hero - reached 50% progress
    if (totalEstimate > 0) {
      const progressPercent = answeredCount / totalEstimate;
      if (progressPercent >= 0.5 && !isUnlocked("halfway_hero")) {
        unlock("halfway_hero");
      }
    }

    // Explorer - used skip
    if (usedSkip && !isUnlocked("explorer")) {
      unlock("explorer");
    }

    // Destined match - confidence > 85%
    if (topConfidence >= 0.85 && !isUnlocked("destined_match")) {
      unlock("destined_match");
    }

    // Night owl - answered after 23:00
    const currentHour = new Date().getHours();
    if ((currentHour >= 23 || currentHour < 5) && !isUnlocked("night_owl")) {
      unlock("night_owl");
    }
  }, [unlock, isUnlocked]);

  const trackCompletion = useCallback(({
    answeredCount,
    minQuestions,
  }: { answeredCount: number; minQuestions: number }) => {
    // Perfectionist - answered 4+ more than minimum
    if (answeredCount >= minQuestions + 4 && !isUnlocked("perfectionist")) {
      unlock("perfectionist");
    }
  }, [unlock, isUnlocked]);

  const trackSkip = useCallback(() => {
    if (!isUnlocked("explorer")) {
      unlock("explorer");
    }
  }, [unlock, isUnlocked]);

  return {
    trackQuestionStart,
    trackAnswer,
    trackCompletion,
    trackSkip,
  };
}
