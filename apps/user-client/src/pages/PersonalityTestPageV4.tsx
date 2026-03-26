import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SegmentedProgress } from "@/components/ui/progress-segmented";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAdaptiveAssessment, type PreSignupAnswer, type AssessmentQuestion } from "@/hooks/useAdaptiveAssessment";
import { getOptionFeedback } from "@shared/personality/feedback";
import { StickyCTA, StickyCTAButton, StickyCTASecondaryButton } from "@/components/StickyCTA";
import { SelectionList } from "@/components/SelectionList";
import { SliderQuestion } from "@/components/SliderQuestion";
import { EmojiTapQuestion } from "@/components/EmojiTapQuestion";
import { useDynamicAccent } from "@/contexts/DynamicAccentContext";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import { useUnifiedProgress } from "@/hooks/useUnifiedProgress";
import { haptics } from "@/lib/haptics";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";
import TransitionOverlay from "@/components/TransitionOverlay";

// Preload Xiaoyue avatars immediately
const XIAOYUE_AVATAR_URLS = [xiaoyueNormal, xiaoyueExcited, xiaoyuePointing];
XIAOYUE_AVATAR_URLS.forEach((src) => {
  const img = new Image();
  img.src = src;
});

const V4_ANSWERS_KEY = "joyjoin_v4_presignup_answers";

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/'/g, '')
    .trim();
}

function OnboardingProgress({ 
  current, 
  total, 
  remaining,
  progress,
  onBack,
  showBack = true,
  showExtendedMessage = false,
  milestoneReached = false,
}: { 
  current: number; 
  total: number | string;
  remaining?: number;
  progress: number;
  onBack?: () => void;
  showBack?: boolean;
  showExtendedMessage?: boolean;
  milestoneReached?: boolean;
}) {
  const { currentAccent } = useDynamicAccent();
  const prefersReducedMotion = useReducedMotion();
  const prevCurrentRef = useRef(current);
  const [showTransition, setShowTransition] = useState(false);
  const [showMicroCopy, setShowMicroCopy] = useState(false);
  const transitionTimeoutRef = useRef<number | undefined>();
  const microCopyTimeoutRef = useRef<number | undefined>();
  
  // Detect transition from question 8 to 9
  useEffect(() => {
    const prevCurrent = prevCurrentRef.current;
    
    if (prevCurrent === 8 && current === 9) {
      setShowTransition(true);
      setShowMicroCopy(true);
      // Trigger haptic feedback at transition (medium + heavy punch)
      haptics.medium();
      haptics.heavy();
      // Reset transition state after animation
      transitionTimeoutRef.current = window.setTimeout(() => setShowTransition(false), 1000);
      // Auto-hide micro-copy after 2 seconds
      microCopyTimeoutRef.current = window.setTimeout(() => setShowMicroCopy(false), 2000);
    }
    
    prevCurrentRef.current = current;

    return () => {
      if (transitionTimeoutRef.current !== undefined) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (microCopyTimeoutRef.current !== undefined) {
        clearTimeout(microCopyTimeoutRef.current);
      }
    };
  }, [current]);
  
  // Determine which progress bar to show
  const isAnchorPhase = current >= 1 && current <= 8;
  
  // Dynamic accent color for smooth progress bar
  const accentColor = currentAccent 
    ? `hsl(${currentAccent.h}, ${currentAccent.s}%, ${currentAccent.l}%)` 
    : undefined;
  
  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 safe-top">
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] shrink-0"
            data-testid="button-onboarding-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex-1">
          {/* Progress bar with smooth transition animation */}
          <div className="relative">
            <AnimatePresence mode="wait" initial={false}>
              {isAnchorPhase ? (
                <motion.div
                  key="segmented"
                  initial={false}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.98,
                          filter: "blur(4px)",
                        }
                  }
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                >
                  <SegmentedProgress 
                    current={current - 1}
                    total={8}
                    variant="duolingo"
                    className="mb-2"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="smooth"
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 1.02,
                          filter: "blur(4px)",
                        }
                  }
                  animate={{ 
                    opacity: 1, 
                    scale: showTransition && !prefersReducedMotion ? [1, 1.02, 1] : 1,
                    filter: "blur(0px)",
                  }}
                  transition={{ 
                    duration: 0.5, 
                    ease: [0.4, 0, 0.2, 1],
                    delay: 0.1,
                    scale: {
                      duration: 0.6,
                      ease: "easeInOut",
                    }
                  }}
                >
                  <Progress 
                    value={progress} 
                    className={cn(
                      "h-2 mb-2 transition-all duration-500",
                      showTransition && !prefersReducedMotion && "shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                    )}
                    style={accentColor ? {
                      // @ts-ignore - CSS variable for dynamic accent color
                      '--progress-accent': accentColor,
                    } as React.CSSProperties : undefined}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Inline micro-copy toast - appears briefly during Q8→Q9 transition */}
            <AnimatePresence initial={false}>
              {showMicroCopy && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="flex items-center gap-1 text-sm text-primary font-medium mt-0.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>已锁定你的vibe ✨ 进入精准匹配</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Question counter and percentage */}
          <div className="flex justify-start mt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {remaining !== undefined && remaining > 0 ? (
                `第${Math.floor(current)}题 · 还剩约${remaining}题`
              ) : (
                `第${Math.floor(current)}题 / 约${total}题`
              )}
            </span>
          </div>
          
          {/* Extended message for near completion */}
          {showExtendedMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 mt-1"
            >
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-1" />
                差一点就能揭晓啦
              </Badge>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function loadV4PreSignupAnswers(): PreSignupAnswer[] {
  try {
    const cached = localStorage.getItem(V4_ANSWERS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function clearV4PreSignupAnswers() {
  localStorage.removeItem(V4_ANSWERS_KEY);
  // Don't remove joyjoin_v4_assessment_session - it's needed for result page fallback
  // localStorage.removeItem("joyjoin_v4_assessment_session");
}

export default function PersonalityTestPageV4() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [sliderValue, setSliderValue] = useState<number | undefined>(undefined);
  const { saveCheckpoint } = useOnboardingCheckpoint();
  const [showMilestoneReward, setShowMilestoneReward] = useState(false);
  const milestoneShownRef = useRef(false); // Track if milestone has been shown

  // Question history for back-navigation (client-side, read-only review)
  const [questionHistory, setQuestionHistory] = useState<Array<{ question: AssessmentQuestion; answerValue: string }>>([]);
  const [historyViewIndex, setHistoryViewIndex] = useState<number | null>(null);
  // Derived helpers
  const isViewingHistory = historyViewIndex !== null;
  const historyEntry = historyViewIndex !== null ? questionHistory[historyViewIndex] : null;
  
  const { setArchetype: setDynamicAccent, reset: resetDynamicAccent } = useDynamicAccent();
  const { milestoneReached, detectMilestone, getUnifiedProgress } = useUnifiedProgress();
  
  const {
    sessionId,
    currentQuestion,
    progress,
    currentMatches,
    isComplete,
    isInitialized,
    result,
    encouragement,
    isLoading,
    isSubmitting,
    isSkipping,
    error,
    startAssessment,
    submitAnswer,
    skipQuestion,
    canSkip,
    remainingSkips,
    topArchetype,
    answeredCount,
    estimatedRemaining,
  } = useAdaptiveAssessment();

  // Simple question number: answered + 1 (working on next question)
  // Backend now correctly resets session, so progress.answered is accurate
  const displayCurrent = useMemo(() => {
    if (!progress) return 1;
    return progress.answered + 1;
  }, [progress]);

  // Dynamic remaining count
  const displayTotal = useMemo(() => {
    if (!progress) return "8-16";
    // Show total as answered + remaining
    const total = progress.answered + estimatedRemaining;
    return String(Math.max(total, progress.answered + 1));
  }, [progress, estimatedRemaining]);

  const progressPercentage = useMemo(() => {
    if (!progress) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PersonalityTestPageV4] Progress is null, returning 0');
      }
      return 0;
    }
    
    // During anchor phase (questions 1-8): show simple fraction progress
    const isAnchorPhase = progress.answered < 8;
    
    if (isAnchorPhase) {
      // Calculate progress as fraction of answered / estimated total
      const estimatedTotal = progress.answered + estimatedRemaining;
      const total = Math.max(estimatedTotal, progress.answered + 1);
      const calculated = Math.min(100, Math.round((progress.answered / total) * 100));
      if (process.env.NODE_ENV === 'development') {
        console.log('[PersonalityTestPageV4] Anchor phase progress:', { 
          answered: progress.answered, 
          estimatedRemaining, 
          total,
          calculated 
        });
      }
      return calculated;
    }
    
    // After anchor phase: use unified progress calculation
    const calculated = Math.min(100, Math.round(getUnifiedProgress('assessment', displayCurrent, estimatedRemaining)));
    if (process.env.NODE_ENV === 'development') {
      console.log('[PersonalityTestPageV4] Progress calculated:', { 
        answered: progress.answered, 
        estimatedRemaining, 
        calculated 
      });
    }
    return calculated;
  }, [progress, estimatedRemaining, displayCurrent, getUnifiedProgress]);
  
  // Detect milestone crossings
  useEffect(() => {
    if (progressPercentage > 0) {
      detectMilestone(progressPercentage);
    }
  }, [progressPercentage, detectMilestone]);

  // Show milestone reward when answeredCount reaches 8 (only once)
  useEffect(() => {
    if (answeredCount === 8 && !milestoneShownRef.current) {
      setShowMilestoneReward(true);
      milestoneShownRef.current = true;
    }
  }, [answeredCount]);

  useEffect(() => {
    // Check for synced session from onboarding (takes priority)
    const syncedSessionId = localStorage.getItem("joyjoin_synced_session_id");
    
    // Also check for pre-signup answers (legacy/direct access path)
    const preSignupAnswers = loadV4PreSignupAnswers();
    
    // Always resume if we have either synced session or pre-signup answers
    const shouldResume = !!syncedSessionId || preSignupAnswers.length > 0;
    
    startAssessment(shouldResume);
  }, []);

  // Update dynamic accent color based on top archetype
  useEffect(() => {
    if (topArchetype && currentMatches[0]) {
      setDynamicAccent(topArchetype, currentMatches[0].confidence);
    }
  }, [topArchetype, currentMatches, setDynamicAccent]);

  // Reset dynamic accent on unmount
  useEffect(() => {
    return () => resetDynamicAccent();
  }, [resetDynamicAccent]);

  useEffect(() => {
    if (isComplete && result) {
      clearV4PreSignupAnswers();
      
      // Invalidate query keys to ensure result page fetches fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/assessment/result'] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessment/anonymous-result'] });
      queryClient.invalidateQueries({ queryKey: ['/api/personality-test/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/personality-test/stats'] });
      
      // Save checkpoint and navigate
      (async () => {
        try {
          await saveCheckpoint.mutateAsync('personality-test');
        } catch (e) {
          console.error('[PersonalityTestPageV4] Failed to save checkpoint:', e);
        }
        
        setLocation('/personality-test/auth-gate');
      })();
    }
  }, [isComplete, result, setLocation, saveCheckpoint]);

  const handleSelectOption = useCallback((value: string | string[]) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSelectedOption(next);
  }, []);

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion) return;

    // Slider question: compute traitScores from slider value, then map to nearest discrete option
    if (currentQuestion.questionType === 'slider' && currentQuestion.sliderConfig) {
      if (sliderValue === undefined) return; // require interaction before submitting
      haptics.medium();
      // Save to history before submitting
      setQuestionHistory(prev => [...prev, { question: currentQuestion, answerValue: String(sliderValue) }]);
      const config = currentQuestion.sliderConfig;
      const traitScores: Record<string, number> = {};
      for (const mapping of config.traitMappings) {
        traitScores[mapping.traitKey] =
          mapping.scoreAtZero + (sliderValue / 100) * (mapping.scoreAt100 - mapping.scoreAtZero);
      }
      // Map the continuous 0-100 value to the nearest discrete option so that
      // selectedOption always matches an existing question.options entry (API requirement).
      const options = currentQuestion.options ?? [];
      if (options.length === 0) {
        console.error('[handleSubmitAnswer] Slider question has no options:', currentQuestion.id);
        return;
      }
      const maxIndex = options.length - 1;
      const clampedIndex = Math.max(0, Math.min(maxIndex, Math.round((sliderValue / 100) * maxIndex)));
      const selectedOptionForSlider = options[clampedIndex]?.value;
      if (!selectedOptionForSlider) return;
      await submitAnswer(currentQuestion.id, selectedOptionForSlider, traitScores);
      setSliderValue(undefined);
      return;
    }

    // emoji_tap and choice questions: use selectedOption
    if (!selectedOption) return;
    haptics.medium();
    // Save to history before submitting
    setQuestionHistory(prev => [...prev, { question: currentQuestion, answerValue: selectedOption }]);
    const selectedOpt = currentQuestion.options.find(o => o.value === selectedOption);
    await submitAnswer(currentQuestion.id, selectedOption, selectedOpt?.traitScores || {});
    
    setSelectedOption(undefined);
  }, [currentQuestion, selectedOption, sliderValue, submitAnswer, answeredCount, estimatedRemaining, currentMatches]);

  // Back handler: navigates to previous question in local history, or exits to '/' at the start
  const handleBack = useCallback(() => {
    if (isViewingHistory && historyViewIndex !== null) {
      if (historyViewIndex > 0) {
        setHistoryViewIndex(historyViewIndex - 1);
      } else {
        // At the very first answered question; exit back to landing
        setHistoryViewIndex(null);
        setLocation('/');
      }
    } else {
      if (questionHistory.length > 0) {
        setHistoryViewIndex(questionHistory.length - 1);
      } else {
        // No history yet (on the first question); exit to landing
        setLocation('/');
      }
    }
  }, [isViewingHistory, historyViewIndex, questionHistory.length, setLocation]);



  const handleSkipQuestion = useCallback(async () => {
    if (!currentQuestion || !canSkip) return;
    
    const success = await skipQuestion(currentQuestion.id);
    if (success) {
      setSelectedOption(undefined);
      setSliderValue(undefined);
      toast({
        description: "已换一道题",
      });
    }
  }, [currentQuestion, canSkip, skipQuestion, toast]);

  useEffect(() => {
    if (isInitialized && isComplete) {
      setLocation("/personality-test/auth-gate");
    }
  }, [isInitialized, isComplete, setLocation]);

  const prefersReducedMotion = useReducedMotion();

  // Dynamic Xiaoyue pose based on user state (H1)
  const xiaoyuePose = useMemo((): "thinking" | "casual" | "pointing" => {
    if (selectedOption || sliderValue !== undefined) return "pointing"; // user made a choice — Xiaoyue points approvingly
    if (answeredCount === 0) return "pointing";   // very first question — Xiaoyue welcomes/guides
    if (estimatedRemaining <= 2) return "casual"; // almost done — relaxed, encouraging
    return "thinking";                            // mid-assessment — Xiaoyue is thoughtfully considering
  }, [selectedOption, sliderValue, answeredCount, estimatedRemaining]);

  if (isLoading && !currentQuestion && !isComplete) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col">
        {/* Sticky header skeleton - matches real OnboardingProgress */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="flex-1 px-4 pt-4 space-y-4 overflow-hidden">
          {/* Scenario text */}
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          
          {/* Xiaoyue bubble skeleton - horizontal layout */}
          <div className="flex items-start gap-3 mt-2">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <Skeleton className="h-16 flex-1 rounded-2xl" />
          </div>
          
          {/* Option rows */}
          <div className="grid grid-cols-1 gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
        
        {/* Sticky CTA skeleton */}
        <div className="border-t p-4 bg-background/95">
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Don't render anything if complete - redirect happens in useEffect
  if (isComplete) {
    return (
      <div className="h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">正在生成结果...</p>
        </div>
      </div>
    );
  }



  if (error && !isLoading && !currentQuestion) {
    return (
      <div className="h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <p className="text-muted-foreground">加载题目失败，请检查网络后重试</p>
          <Button
            onClick={async () => {
              try {
                await startAssessment(false);
              } catch {
                toast({
                  variant: "destructive",
                  description: "重试失败，请稍后再试",
                });
              }
            }}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">准备题目中...</p>
        </div>
      </div>
    );
  }

  const scenarioText = stripEmoji((isViewingHistory && historyEntry?.question ? historyEntry.question : currentQuestion).scenarioText);
  const displayedQuestion: AssessmentQuestion = isViewingHistory && historyEntry?.question ? historyEntry.question : currentQuestion;
  const optionsForList = displayedQuestion.options.map((opt) => ({
    value: opt.value,
    label: opt.text,
  }));
  // In history view: pre-select the stored answer; in live view: use current selectedOption
  const displayedSelection = isViewingHistory ? historyEntry?.answerValue : selectedOption;
  // Display question number: history view shows historical position, live shows current
  const historyDisplayCurrent = isViewingHistory && historyViewIndex !== null ? (historyViewIndex + 1) : displayCurrent;

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Transition Overlay - auto-dismissing Apple-style modal at question 8 milestone */}
      <TransitionOverlay
        isVisible={showMilestoneReward}
        onComplete={() => setShowMilestoneReward(false)}
      />

      <OnboardingProgress
        current={historyDisplayCurrent}
        total={displayTotal as any}
        remaining={isViewingHistory ? 0 : estimatedRemaining}
        progress={isViewingHistory ? Math.round((historyDisplayCurrent / Math.max(Number(displayTotal) || 8, historyDisplayCurrent)) * 100) : progressPercentage}
        showBack={true}
        onBack={handleBack}
        showExtendedMessage={!isViewingHistory && answeredCount >= 8 && estimatedRemaining >= 3}
        milestoneReached={milestoneReached}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isViewingHistory ? `history-${historyViewIndex}` : currentQuestion.id}
          initial={prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, x: 60, rotateY: 8, transformPerspective: 1200 }
          }
          animate={prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 1, x: 0, rotateY: 0, transformPerspective: 1200 }
          }
          exit={prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, x: -60, rotateY: -8, transformPerspective: 1200 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 260, damping: 24, mass: 0.9 }
          }
          style={prefersReducedMotion ? undefined : { transformStyle: "preserve-3d" }}
          className="flex-1 flex flex-col px-4 pt-4 pb-2 overflow-hidden"
        >
          <div className="shrink-0 mb-3">
            <p className="text-base text-foreground mb-2 leading-relaxed font-semibold">
              {scenarioText}
            </p>
            {/* Xiaoyue bubble — content varies by question type */}
            {displayedQuestion.questionType !== 'slider' && (
              <XiaoyueChatBubble 
                pose={isViewingHistory ? "casual" : xiaoyuePose}
                content={isViewingHistory
                  ? displayedQuestion.questionText
                  : (selectedOption 
                    ? getOptionFeedback(displayedQuestion.id, selectedOption) || "记下了，很有意思的选择！" 
                    : displayedQuestion.questionText)
                }
                horizontal
                animate={!prefersReducedMotion}
                className="mb-1"
              />
            )}
            {displayedQuestion.questionType === 'slider' && !isViewingHistory && sliderValue === undefined && (
              <XiaoyueChatBubble
                pose="pointing"
                content={displayedQuestion.questionText}
                horizontal
                animate={!prefersReducedMotion}
                className="mb-1"
              />
            )}
          </div>
          
          <div className="flex-1 flex flex-col justify-center py-1 min-h-0">
            <div className="max-h-[70vh] overflow-y-auto pb-20 md:pb-10 -mx-4 px-4">
              {/* Branch rendering by questionType */}
              {displayedQuestion.questionType === 'slider' && displayedQuestion.sliderConfig ? (
                <SliderQuestion
                  questionId={displayedQuestion.id}
                  sliderConfig={displayedQuestion.sliderConfig}
                  value={isViewingHistory ? Number(historyEntry?.answerValue) : sliderValue}
                  onChange={isViewingHistory ? () => {} : setSliderValue}
                  animate={!prefersReducedMotion}
                />
              ) : displayedQuestion.questionType === 'emoji_tap' ? (
                <EmojiTapQuestion
                  options={displayedQuestion.options}
                  selected={displayedSelection}
                  onSelect={isViewingHistory ? () => {} : handleSelectOption}
                  animate={!prefersReducedMotion}
                />
              ) : (
                <SelectionList
                  options={optionsForList}
                  selected={displayedSelection}
                  onSelect={isViewingHistory ? () => {} : handleSelectOption}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 !space-y-0"
                />
              )}
            </div>
          </div>

          <StickyCTA>
            <div className="space-y-3">
              {isViewingHistory ? (
                <StickyCTAButton
                  onClick={() => setHistoryViewIndex(null)}
                  data-testid="button-return-current"
                >
                  返回当前题目 →
                </StickyCTAButton>
              ) : (
                <>
                  <StickyCTAButton
                    onClick={handleSubmitAnswer}
                    disabled={
                      (displayedQuestion.questionType === 'slider'
                        ? sliderValue === undefined
                        : !selectedOption) ||
                      isSubmitting ||
                      isSkipping
                    }
                    isLoading={isSubmitting}
                    data-testid="button-submit-answer"
                  >
                    继续
                  </StickyCTAButton>
                  
                  {canSkip && (
                    <div className="flex flex-col items-center gap-1">
                      <StickyCTASecondaryButton
                        onClick={handleSkipQuestion}
                        disabled={isSkipping || isSubmitting}
                        isLoading={isSkipping}
                        data-testid="button-skip-question"
                      >
                        <RefreshCw className="h-5 w-5" />
                        换一道题
                      </StickyCTASecondaryButton>
                      <span className="text-xs text-muted-foreground/70">
                        选项都不合适？还剩{remainingSkips}次机会
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </StickyCTA>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
