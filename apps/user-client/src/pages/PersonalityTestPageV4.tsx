import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useAdaptiveAssessment, type PreSignupAnswer } from "@/hooks/useAdaptiveAssessment";
import { getOptionFeedback } from "@shared/personality/feedback";
import { StickyCTA, StickyCTAButton, StickyCTASecondaryButton } from "@/components/StickyCTA";
import { SelectionList } from "@/components/SelectionList";
import { useDynamicAccent } from "@/contexts/DynamicAccentContext";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import { useUnifiedProgress } from "@/hooks/useUnifiedProgress";
import { haptics } from "@/lib/haptics";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

// Preload Xiaoyue avatars immediately
const XIAOYUE_AVATAR_URLS = [xiaoyueNormal, xiaoyueExcited, xiaoyuePointing];
XIAOYUE_AVATAR_URLS.forEach((src) => {
  const img = new Image();
  img.src = src;
});

const V4_ANSWERS_KEY = "joyjoin_v4_presignup_answers";

function AnchorPhaseComplete({ onContinue }: { onContinue: () => void }) {
  // Auto-advance after 3 seconds - allows users to read celebration message
  useEffect(() => {
    const timer = setTimeout(onContinue, 3000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="text-center max-w-sm space-y-6"
      >
        {/* Phase 1: Checkmark animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
        >
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Sparkles className="w-10 h-10 text-primary" />
          </motion.div>
        </motion.div>

        {/* Phase 2: Copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <h2 className="text-2xl font-bold">基础画像已完成 ✨</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            已经大概知道你的vibe了！<br/>
            接下来几道精准题，帮你锁定专属原型 🎯
          </p>
        </motion.div>

        {/* Phase 3: Visual transition hint - segmented dots morphing into a bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="flex items-center gap-2 justify-center"
        >
          {/* Animated dots merging into a bar */}
          <motion.div
            className="h-2 bg-primary rounded-full"
            initial={{ width: 8 }}
            animate={{ width: 200 }}
            transition={{ delay: 1.2, duration: 0.8, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Skip button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onContinue}
            className="text-muted-foreground"
          >
            继续 →
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

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
  const [prevCurrent, setPrevCurrent] = useState(current);
  const [showTransition, setShowTransition] = useState(false);
  
  // Detect transition from question 8 to 9
  useEffect(() => {
    let timeoutId: number | undefined;

    if (prevCurrent === 8 && current === 9) {
      setShowTransition(true);
      // Trigger haptic feedback at transition
      haptics.medium();
      // Reset transition state after animation
      timeoutId = window.setTimeout(() => setShowTransition(false), 1000);
    }
    setPrevCurrent(current);

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [current, prevCurrent]);
  
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
                    scale: 1,
                    filter: "blur(0px)",
                  }}
                  transition={{ 
                    duration: 0.5, 
                    ease: [0.4, 0, 0.2, 1],
                    delay: 0.1 
                  }}
                >
                  <Progress 
                    value={progress} 
                    className={cn(
                      "h-2 mb-2 transition-all duration-500",
                      showTransition && !prefersReducedMotion && "shadow-lg shadow-primary/20"
                    )}
                    style={accentColor ? {
                      // @ts-ignore - CSS variable for dynamic accent color
                      '--progress-accent': accentColor,
                    } as React.CSSProperties : undefined}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Question counter and percentage */}
          <motion.div 
            layout={!prefersReducedMotion}
            className="flex justify-between mt-1"
          >
            <span className="text-xs text-muted-foreground font-medium">
              {remaining !== undefined && remaining > 0 ? (
                `第${Math.floor(current)}题 · 还剩约${remaining}题`
              ) : (
                `第${Math.floor(current)}题 / 约${total}题`
              )}
            </span>
            <span className="text-xs font-bold text-primary">
              {Math.round(progress)}%
            </span>
          </motion.div>
          
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
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const { saveCheckpoint } = useOnboardingCheckpoint();
  
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
    const calculated = Math.min(100, Math.round(getUnifiedProgress('assessment', progress.answered, estimatedRemaining)));
    if (process.env.NODE_ENV === 'development') {
      console.log('[PersonalityTestPageV4] Progress calculated:', { 
        answered: progress.answered, 
        estimatedRemaining, 
        calculated 
      });
    }
    return calculated;
  }, [progress, estimatedRemaining, getUnifiedProgress]);
  
  // Detect milestone crossings
  useEffect(() => {
    if (progressPercentage > 0) {
      detectMilestone(progressPercentage);
    }
  }, [progressPercentage, detectMilestone]);

  useEffect(() => {
    // Check for synced session from onboarding (takes priority)
    const syncedSessionId = localStorage.getItem("joyjoin_synced_session_id");
    
    // Also check for pre-signup answers (legacy/direct access path)
    const preSignupAnswers = loadV4PreSignupAnswers();
    
    // Always resume if we have either synced session or pre-signup answers
    const shouldResume = !!syncedSessionId || preSignupAnswers.length > 0;
    
    startAssessment(shouldResume);
  }, []);

  // Detect anchor phase completion and show transition
  useEffect(() => {
    if (progress && progress.answered === 8 && !showPhaseTransition) {
      setShowPhaseTransition(true);
      // Trigger haptic feedback for the transition
      haptics.heavy();
    }
  }, [progress?.answered, showPhaseTransition]);

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
        
        setLocation('/personality-test/results');
      })();
    }
  }, [isComplete, result, setLocation, saveCheckpoint]);

  const handleSelectOption = useCallback((value: string | string[]) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSelectedOption(next);
  }, []);

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || !selectedOption) return;
    
    haptics.medium();
    const selectedOpt = currentQuestion.options.find(o => o.value === selectedOption);
    await submitAnswer(currentQuestion.id, selectedOption, selectedOpt?.traitScores || {});
    
    setSelectedOption(undefined);
  }, [currentQuestion, selectedOption, submitAnswer, answeredCount, estimatedRemaining, currentMatches]);



  const handleSkipQuestion = useCallback(async () => {
    if (!currentQuestion || !canSkip) return;
    
    const success = await skipQuestion(currentQuestion.id);
    if (success) {
      setSelectedOption(undefined);
      toast({
        description: "已换一道题",
      });
    }
  }, [currentQuestion, canSkip, skipQuestion, toast]);

  useEffect(() => {
    if (isInitialized && isComplete) {
      setLocation("/personality-test/results");
    }
  }, [isInitialized, isComplete, setLocation]);

  // Show phase transition screen when completing anchor questions
  if (showPhaseTransition) {
    return <AnchorPhaseComplete onContinue={() => setShowPhaseTransition(false)} />;
  }

  if (isLoading && !currentQuestion && !isComplete) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col">
        {/* Header Skeleton */}
        <div className="h-14 border-b bg-background/95 backdrop-blur-sm flex items-center px-4">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="ml-4 h-6 w-32" />
        </div>
        
        {/* Question Content Skeleton */}
        <div className="flex-1 px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-3/4 mx-auto" /> {/* Question text */}
          <Skeleton className="h-4 w-1/2 mx-auto" /> {/* Scenario */}
          
          {/* Options skeleton */}
          <div className="space-y-3 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
        
        {/* Progress bar skeleton */}
        <Skeleton className="h-2 mx-4 mb-4" />
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

  const scenarioText = stripEmoji(currentQuestion.scenarioText);
  const optionsForList = currentQuestion.options.map(opt => ({
    value: opt.value,
    label: opt.text,
  }));

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      <OnboardingProgress
        current={displayCurrent}
        total={displayTotal as any}
        remaining={estimatedRemaining}
        progress={progressPercentage}
        onBack={() => {
          // Since /onboarding is merged into /personality-test, go back to landing
          setLocation('/');
        }}
        showBack={true}
        showExtendedMessage={answeredCount >= 8 && estimatedRemaining >= 3}
        milestoneReached={milestoneReached}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col px-4 pt-4 pb-2 overflow-hidden"
        >
          <div className="shrink-0 mb-3">
            <p className="text-base text-foreground mb-2 leading-relaxed font-semibold">
              {scenarioText}
            </p>
            <XiaoyueChatBubble 
              pose="casual" // xiaoyue pose change
              content={selectedOption 
                ? getOptionFeedback(currentQuestion.id, selectedOption) || "记下了，很有意思的选择！" 
                : currentQuestion.questionText
              }
              horizontal
              className="mb-1"
            />
          </div>
          
          <div className="flex-1 flex flex-col justify-center py-1 min-h-0">
            <div className="max-h-[70vh] overflow-y-auto pb-20 md:pb-10 -mx-4 px-4">
              <SelectionList
                options={optionsForList}
                selected={selectedOption}
                onSelect={handleSelectOption}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 !space-y-0"
              />
            </div>
          </div>

          <StickyCTA>
            <div className="space-y-3">
              <StickyCTAButton
                onClick={handleSubmitAnswer}
                disabled={!selectedOption || isSubmitting || isSkipping}
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
            </div>
          </StickyCTA>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
