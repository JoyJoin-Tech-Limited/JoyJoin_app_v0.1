import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import { SwipeCardStack } from "@/components/SwipeCardStack";
import { SwipeGuidanceOverlay } from "@/components/SwipeGuidanceOverlay";
import { InterestResultSummary } from "@/components/InterestResultSummary";
import { 
  INTEREST_CARDS, 
  getSmartCardSelection, 
  SwipeResult 
} from "@/data/interestCardsData";
import {
  TAXONOMY_VERSION,
  normalizeProfileInterests,
  isActiveInterestId,
  type InterestsTelemetry,
  type InterestTelemetryEvent,
} from "@shared/interests";

const EXTENDED_CACHE_KEY = "joyjoin_extended_data_progress";

type Step = 'swipe' | 'result';

interface ExtendedDataState {
  currentStep: Step;
  swipeResults: SwipeResult[];
  timestamp: number;
}

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [currentStep, setCurrentStep] = useState<Step>('swipe');
  const [swipeResults, setSwipeResults] = useState<SwipeResult[]>([]);
  const [xiaoyueMessage, setXiaoyueMessage] = useState("滑动告诉我你喜欢什么吧～");
  const [showCelebration, setShowCelebration] = useState(false);
  const [cards, setCards] = useState(() => getSmartCardSelection(INTEREST_CARDS, 18));

  useEffect(() => {
    const cached = localStorage.getItem(EXTENDED_CACHE_KEY);
    if (cached) {
      try {
        const state: ExtendedDataState = JSON.parse(cached);
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          if (state.swipeResults && state.swipeResults.length > 0) {
            setSwipeResults(state.swipeResults);
          }
          // Restore currentStep from cache if it was explicitly saved as 'result'
          if (state.currentStep === 'result') {
            setCurrentStep('result');
          }
        }
      } catch {}
    }
  }, []);

  const saveProgress = useCallback(() => {
    const state: ExtendedDataState = {
      currentStep,
      swipeResults,
      timestamp: Date.now(),
    };
    localStorage.setItem(EXTENDED_CACHE_KEY, JSON.stringify(state));
  }, [currentStep, swipeResults]);

  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      localStorage.removeItem(EXTENDED_CACHE_KEY);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/guide");
    },
    onError: (error: Error) => {
      setShowCelebration(false);
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSwipe = useCallback((result: SwipeResult) => {
    setSwipeResults(prev => [...prev, result]);
  }, []);

  const handleSwipeComplete = useCallback((results: SwipeResult[]) => {
    setSwipeResults(results);
    setCurrentStep('result');
  }, []);

  const handleConfirm = useCallback(() => {
    // Validate minimum requirements
    const likedResults = swipeResults.filter(r => r.choice === 'like' || r.choice === 'love');
    const lovedResults = swipeResults.filter(r => r.choice === 'love');
    
    if (likedResults.length < 1) {
      toast({
        title: "请至少选择1个感兴趣的内容",
        description: "向右滑动表示喜欢",
        variant: "destructive",
      });
      return;
    }
    
    setShowCelebration(true);
    
    // Deduplicate and extract interests
    const likedInterests = [...new Set(likedResults.map(r => r.cardId))];
    const lovedInterests = [...new Set(lovedResults.map(r => r.cardId))].slice(0, 3);

    // Normalize using shared validation
    const normalized = normalizeProfileInterests({
      interestsTop: likedInterests.slice(0, 7),
      primaryInterests: lovedInterests,
    });

    // Log any warnings (for debugging)
    if (normalized.warnings.length > 0) {
      console.log('[ExtendedDataPage] Interest normalization warnings:', normalized.warnings);
    }

    // Build structured telemetry
    const telemetryEvents: InterestTelemetryEvent[] = swipeResults
      .filter(r => isActiveInterestId(r.cardId))
      .slice(0, 200) // Cap at 200 events
      .map(r => ({
        interestId: r.cardId,
        choice: r.choice,
        reactionTimeMs: Math.min(Math.max(r.reactionTimeMs, 0), 60000), // Clamp to 1 minute
        timestamp: new Date().toISOString(),
      }));

    const telemetry: InterestsTelemetry = {
      version: TAXONOMY_VERSION,
      events: telemetryEvents,
    };

    setTimeout(() => {
      const profileData = {
        interestsTop: likedInterests.slice(0, 7),
        primaryInterests: lovedInterests,
        interestsDeep: swipeResults.map(r => 
          `${r.cardId}:${r.choice}:${r.reactionTimeMs}`
        ),
        hasCompletedInterestsTopics: true,
      };
      saveMutation.mutate(profileData);
    }, 1500);
  }, [swipeResults, saveMutation, toast]);

  const handleReset = useCallback(() => {
    setSwipeResults([]);
    setCurrentStep('swipe');
    setXiaoyueMessage("滑动告诉我你喜欢什么吧～");
    setCards(getSmartCardSelection(INTEREST_CARDS, 18));
  }, []);

  const canConfirm = swipeResults.length > 0 && 
    swipeResults.some(r => r.choice === 'like' || r.choice === 'love');

  const handleSkip = () => {
    localStorage.removeItem(EXTENDED_CACHE_KEY);
    setLocation("/guide");
  };

  const handleBack = () => {
    if (currentStep === 'result') {
      setCurrentStep('swipe');
    } else {
      setLocation("/onboarding/essential");
    }
  };

  const containerVariants = prefersReducedMotion 
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { 
        hidden: { opacity: 0, x: 50 }, 
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
      };

  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <LoadingLogoSleek loop visible />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            data-testid="button-back"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">
              {currentStep === 'swipe' ? '发现你的兴趣' : '你的兴趣画像'}
            </h1>
          </div>
          {currentStep === 'result' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              data-testid="button-reset"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentStep === 'swipe' && (
            <motion.div
              key="swipe"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="max-w-md mx-auto h-full"
            >
              <div className="mb-4">
                <XiaoyueChatBubble
                  content={xiaoyueMessage}
                  pose="casual"
                  horizontal
                  animate
                />
              </div>

              <SwipeGuidanceOverlay />

              <SwipeCardStack
                cards={cards}
                onSwipe={handleSwipe}
                onComplete={handleSwipeComplete}
                onXiaoyueMessageChange={setXiaoyueMessage}
              />
            </motion.div>
          )}

          {currentStep === 'result' && (
            <motion.div
              key="result"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="max-w-md mx-auto"
            >
              <InterestResultSummary
                results={swipeResults}
                onConfirm={handleConfirm}
                onEdit={handleReset}
                isLoading={saveMutation.isPending}
                disabled={!canConfirm}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentStep === 'swipe' && (
        <motion.div 
          className="p-4 bg-gradient-to-t from-background via-background to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleSkip}
            data-testid="button-skip"
          >
            暂时跳过，稍后补充
          </Button>
        </motion.div>
      )}
    </div>
  );
}
