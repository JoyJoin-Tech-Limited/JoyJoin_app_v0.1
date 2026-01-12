import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Sparkles, Loader2, Gift, Star, PartyPopper, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAdaptiveAssessment, type PreSignupAnswer } from "@/hooks/useAdaptiveAssessment";
import CelebrationConfetti from "@/components/CelebrationConfetti";
import { getOptionFeedback } from "@shared/personality/feedback";
import { StickyCTA, StickyCTAButton, StickyCTASecondaryButton } from "@/components/StickyCTA";
import { SelectionList } from "@/components/SelectionList";

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

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

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
}: { 
  current: number; 
  total: number | string;
  remaining?: number;
  progress: number;
  onBack?: () => void;
  showBack?: boolean;
  showExtendedMessage?: boolean;
}) {
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
          <Progress 
            value={progress} 
            className="h-2 transition-all duration-500" 
          />
          <div className="flex flex-col mt-1.5 gap-0.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium" data-testid="text-progress-indicator">
                {remaining !== undefined && remaining > 0 ? (
                  `第${Math.floor(current)}题 · 还剩约${remaining}题`
                ) : (
                  `第${Math.floor(current)}题`
                )}
              </span>
              <span className="text-xs font-bold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {showExtendedMessage ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  差一点就能揭晓啦
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground/70">
                  精准校准你的社交风格
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function XiaoyueMascot({ 
  mood = "normal", 
  message,
  className,
  horizontal = false,
}: { 
  mood?: XiaoyueMood; 
  message: string;
  className?: string;
  horizontal?: boolean;
}) {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      x: [0, -5, 5, -5, 5, 0],
      transition: { duration: 0.4 }
    });
  }, [message, controls]);

  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            scale: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }
          }}
          className="relative shrink-0"
        >
          <motion.div animate={controls}>
            <img 
              src={XIAOYUE_AVATARS.normal} 
              alt="小悦" 
              className="w-16 h-16 object-contain drop-shadow-lg"
              data-testid="img-xiaoyue-avatar"
            />
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 rounded-2xl px-4 py-3 shadow-sm border border-purple-100 dark:border-purple-800 flex-1"
        >
          <p className="text-base leading-relaxed text-purple-800 dark:text-purple-200 font-medium" data-testid="text-xiaoyue-message">
            {message}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <motion.div
        animate={controls}
        className="relative"
      >
        <img 
          src={XIAOYUE_AVATARS.normal} 
          alt="小悦" 
          className="w-20 h-20 object-contain drop-shadow-lg"
          data-testid="img-xiaoyue-avatar"
        />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 rounded-2xl px-4 py-3 max-w-[280px] shadow-sm border border-purple-100 dark:border-purple-800",
          !message && "hidden"
        )}
      >
        <p className="text-sm text-center text-purple-800 dark:text-purple-200 font-medium" data-testid="text-xiaoyue-message">
          {message}
        </p>
      </motion.div>
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
  localStorage.removeItem("joyjoin_v4_assessment_session");
}

export default function PersonalityTestPageV4() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [showMilestone, setShowMilestone] = useState(false);
  const [showBlindBox, setShowBlindBox] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  
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
    if (!progress) return 0;
    const total = progress.answered + estimatedRemaining;
    if (total <= 0) return 100;
    return Math.min(100, Math.round((progress.answered / total) * 100));
  }, [progress, estimatedRemaining]);

  useEffect(() => {
    const preSignupAnswers = loadV4PreSignupAnswers();
    if (preSignupAnswers.length > 0) {
      startAssessment(true);
    } else {
      startAssessment(false);
    }
  }, []);

  useEffect(() => {
    if (encouragement && answeredCount > 0 && answeredCount % 5 === 0) {
      setShowMilestone(true);
    }
  }, [encouragement, answeredCount]);

  useEffect(() => {
    if (isComplete && result) {
      clearV4PreSignupAnswers();
      setShowBlindBox(true);
      // Invalidate multiple query keys to ensure result page AND profile page are fresh
      queryClient.invalidateQueries({ queryKey: ['/api/assessment/result'] });
      queryClient.invalidateQueries({ queryKey: ['/api/personality-test/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/personality-test/stats'] });
      // Critical: Also invalidate user data so profile page shows updated archetype
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      setTimeout(() => {
        setLocation('/personality-test/results');
      }, 2000);
    }
  }, [isComplete, result, setLocation]);

  const handleSelectOption = useCallback((value: string | string[]) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSelectedOption(next);
  }, []);

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || !selectedOption) return;
    
    setDirection("forward");
    const selectedOpt = currentQuestion.options.find(o => o.value === selectedOption);
    await submitAnswer(currentQuestion.id, selectedOption, selectedOpt?.traitScores || {});
    setSelectedOption(undefined);
  }, [currentQuestion, selectedOption, submitAnswer]);

  const handleMilestoneContinue = useCallback(() => {
    setShowMilestone(false);
  }, []);

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

  if (isLoading && !currentQuestion && !isComplete) {
    return (
      <div className="h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载测评中...</p>
        </div>
      </div>
    );
  }

  if (showBlindBox) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center p-6 relative">
        <CelebrationConfetti show={true} />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center"
        >
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/40 rounded-3xl flex items-center justify-center">
            <Gift className="w-16 h-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">测评完成！</h2>
          <p className="text-muted-foreground">正在分析你的社交原型...</p>
        </motion.div>
      </div>
    );
  }

  if (showMilestone && encouragement) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <XiaoyueMascot 
            mood="excited"
            message={encouragement.message}
          />
          
          {topArchetype && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 p-4 bg-primary/10 rounded-xl"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 text-primary" />
                <span className="font-medium">当前最可能原型</span>
              </div>
              <p className="text-xl font-bold text-primary">{topArchetype}</p>
              {currentMatches[0] && (
                <p className="text-sm text-muted-foreground mt-1">
                  匹配度 {Math.round(currentMatches[0].confidence * 100)}%
                </p>
              )}
            </motion.div>
          )}
          
          <Button 
            size="lg"
            className="w-full mt-6 h-14 text-lg rounded-2xl"
            onClick={handleMilestoneContinue}
            data-testid="button-milestone-continue"
          >
            继续测评
          </Button>
        </motion.div>
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
        onBack={() => setLocation('/profile')}
        showBack={true}
        showExtendedMessage={answeredCount >= 8 && estimatedRemaining >= 3}
      />

      <div className="px-4 pt-1 flex justify-end">
        <Button variant="ghost" size="sm" className="px-1 text-primary" onClick={() => setLocation('/onboarding/setup')}>
          编辑基础信息
        </Button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: direction === "forward" ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction === "forward" ? -60 : 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col px-4 py-2 overflow-hidden"
        >
          <div className="shrink-0 mb-3">
            <p className="text-lg text-foreground mb-3 leading-relaxed font-bold">
              {scenarioText}
            </p>
            <XiaoyueMascot 
              mood={selectedOption ? "excited" : "normal"}
              message={selectedOption 
                ? getOptionFeedback(currentQuestion.id, selectedOption) || "记下了，很有意思的选择！" 
                : currentQuestion.questionText
              }
              horizontal
              className="mb-1"
            />
          </div>
          
          <div className="flex-1 flex flex-col justify-center py-1 min-h-0">
            <div className="overflow-y-auto -mx-4 px-4">
              <SelectionList
                options={optionsForList}
                selected={selectedOption}
                onSelect={handleSelectOption}
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
