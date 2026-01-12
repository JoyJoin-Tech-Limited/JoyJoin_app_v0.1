import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { VibeGrid } from "@/components/VibeGrid";

import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

// Preload Xiaoyue avatars immediately
const XIAOYUE_AVATAR_URLS = [xiaoyueNormal, xiaoyueExcited, xiaoyuePointing];
XIAOYUE_AVATAR_URLS.forEach((src) => {
  const img = new Image();
  img.src = src;
});

const EXTENDED_CACHE_KEY = "joyjoin_extended_data_progress";

interface ExtendedDataState {
  currentStep: number;
  data: {
    intent: string[];
    interests: string[];
    socialPreferences: string[];
    interestGranularityTags?: string[];
  };
  timestamp: number;
}

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

const INTENT_OPTIONS = [
  { value: "friends", label: "交新朋友" },
  { value: "networking", label: "拓展人脉" },
  { value: "discussion", label: "深度交流" },
  { value: "casual", label: "轻松娱乐" },
  { value: "dating", label: "浪漫邂逅" },
  { value: "learning", label: "学习成长" },
];

const INTEREST_OPTIONS = [
  { value: "food", label: "美食探店" },
  { value: "travel", label: "旅行户外" },
  { value: "music", label: "音乐演出" },
  { value: "sports", label: "运动健身" },
  { value: "reading", label: "读书分享" },
  { value: "movies", label: "电影戏剧" },
  { value: "games", label: "桌游电竞" },
  { value: "art", label: "艺术展览" },
  { value: "tech", label: "科技数码" },
  { value: "pets", label: "萌宠爱好" },
  { value: "photography", label: "摄影创作" },
  { value: "investment", label: "理财投资" },
];

const SOCIAL_PREFERENCE_OPTIONS = [
  { value: "small_group", label: "偏好小圈子 (3-5人)" },
  { value: "medium_group", label: "喜欢中等规模 (6-10人)" },
  { value: "large_group", label: "享受热闹派对 (10+人)" },
  { value: "one_on_one", label: "更爱一对一深聊" },
];

const STEP_CONFIG = [
  {
    id: "intent",
    title: "你想通过悦聚收获什么？",
    subtitle: "可以多选哦",
    mascotMessage: "告诉我你的目标，我帮你精准匹配！",
    mascotMood: "excited" as XiaoyueMood,
    type: "multiSelect" as const,
    options: INTENT_OPTIONS,
    minSelect: 1,
    maxSelect: 3,
  },
  {
    id: "interests",
    title: "你有哪些兴趣爱好？",
    subtitle: "选择3-5个最感兴趣的",
    mascotMessage: "兴趣相投的人更容易成为好朋友！",
    mascotMood: "pointing" as XiaoyueMood,
    type: "multiSelect" as const,
    options: INTEREST_OPTIONS,
    minSelect: 1,
    maxSelect: 5,
  },
  {
    id: "socialPreferences",
    title: "你喜欢怎样的社交场景？",
    subtitle: "选择最舒适的社交方式",
    mascotMessage: "最后一步啦！马上就可以开始探索了~",
    mascotMood: "excited" as XiaoyueMood,
    type: "singleSelect" as const,
    options: SOCIAL_PREFERENCE_OPTIONS,
  },
];

const TOTAL_STEPS = STEP_CONFIG.length;

function XiaoyueMascot({ 
  mood = "normal", 
  message,
  className,
}: { 
  mood?: XiaoyueMood; 
  message: string; 
  className?: string;
}) {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      y: [0, -8, 0],
      transition: { duration: 0.5, ease: "easeOut" }
    });
  }, [message, controls]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <motion.div
        animate={controls}
        className="relative"
      >
        <img 
          src={XIAOYUE_AVATARS[mood]} 
          alt="小悦" 
          className="w-20 h-20 object-contain drop-shadow-lg"
        />
      </motion.div>
      <motion.div 
        className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 rounded-2xl px-4 py-3 max-w-[280px] shadow-sm border border-purple-100 dark:border-purple-800"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-sm text-center text-purple-800 dark:text-purple-200 font-medium">
          {message}
        </p>
      </motion.div>
    </div>
  );
}



function TappableChip({ 
  selected, 
  onClick, 
  children,
}: { 
  selected: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-3 rounded-full border-2 text-sm font-medium transition-all duration-200",
        selected 
          ? "border-primary bg-primary text-primary-foreground shadow-md" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50"
      )}
      whileTap={{ scale: 0.95 }}
      data-testid={`chip-option`}
    >
      {children}
    </motion.button>
  );
}

function TappableCard({ 
  selected, 
  onClick, 
  children,
  className,
}: { 
  selected: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-2xl border-2 text-left transition-all duration-200",
        selected 
          ? "border-primary bg-primary/10 shadow-md" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50",
        className
      )}
      whileTap={{ scale: 0.98 }}
      data-testid={`card-option`}
    >
      {children}
    </motion.button>
  );
}

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [currentStep, setCurrentStep] = useState(0);
  const [intent, setIntent] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [socialPreferences, setSocialPreferences] = useState<string[]>([]);
  const [microInterests, setMicroInterests] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  // Load cached progress
  useEffect(() => {
    const cached = localStorage.getItem(EXTENDED_CACHE_KEY);
    if (cached) {
      try {
        const state: ExtendedDataState = JSON.parse(cached);
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          setCurrentStep(state.currentStep);
          setIntent(state.data.intent || []);
          setInterests(state.data.interests || []);
          setSocialPreferences(state.data.socialPreferences || []);
        }
      } catch {}
    }
  }, []);

  // Save progress
  const saveProgress = useCallback(() => {
    const state: ExtendedDataState = {
      currentStep,
      data: { intent, interests, socialPreferences, interestGranularityTags: microInterests },
      timestamp: Date.now(),
    };
    localStorage.setItem(EXTENDED_CACHE_KEY, JSON.stringify(state));
  }, [currentStep, intent, interests, socialPreferences, microInterests]);

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
      // 跳转到引导页
      setLocation("/guide");
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stepConfig = STEP_CONFIG[currentStep];
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const getCurrentValue = (): string[] => {
    switch (currentStep) {
      case 0: return intent;
      case 1: return interests;
      case 2: return socialPreferences;
      default: return [];
    }
  };

  const setCurrentValue = (value: string[]) => {
    switch (currentStep) {
      case 0: setIntent(value); break;
      case 1: setInterests(value); break;
      case 2: setSocialPreferences(value); break;
    }
  };

  const toggleOption = (value: string) => {
    const current = getCurrentValue();
    const config = stepConfig;
    
    if (config.type === "singleSelect") {
      setCurrentValue([value]);
      return;
    }
    
    if (current.includes(value)) {
      setCurrentValue(current.filter(v => v !== value));
    } else {
      const maxSelect = (config as any).maxSelect || 10;
      if (current.length < maxSelect) {
        setCurrentValue([...current, value]);
      }
    }
  };

  const canProceed = () => {
    const current = getCurrentValue();
    const minSelect = (stepConfig as any).minSelect || 1;
    return current.length >= minSelect;
  };

  const handleNext = () => {
    if (!canProceed()) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step - save and navigate
      setShowCelebration(true);
      setTimeout(() => {
        const profileData = {
          intent,
          interests,
          socialPreferences: socialPreferences[0],
          interestGranularityTags: microInterests,
        };
        saveMutation.mutate(profileData);
      }, 2000);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    // Skip extended data and go to guide
    localStorage.removeItem(EXTENDED_CACHE_KEY);
    setLocation("/guide");
  };

  const containerVariants = prefersReducedMotion 
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { 
        hidden: { opacity: 0, x: 50 }, 
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
      };

  // Celebration overlay
  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <LoadingLogoSleek loop visible />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with progress */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          {currentStep > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
              <span>选填信息 {currentStep + 1}/{TOTAL_STEPS}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-md mx-auto"
          >
            {/* Mascot */}
            <XiaoyueMascot 
              mood={stepConfig.mascotMood}
              message={stepConfig.mascotMessage}
              className="mb-6"
            />

            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {stepConfig.title}
              </h1>
              <p className="text-muted-foreground">
                {stepConfig.subtitle}
              </p>
            </div>

            {/* Options */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <VibeGrid
                  selectedMacros={interests}
                  onPick={(macro, micro) => {
                    setInterests((prev) => (prev.includes(macro) ? prev : [...prev, macro]));
                    setMicroInterests((prev) => (prev.includes(micro) ? prev : [...prev, micro]));
                  }}
                />
                {microInterests.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {microInterests.map((m) => (
                      <Button key={m} size="sm" variant="outline" data-testid="chip-micro-interest">
                        {m}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={cn(
              stepConfig.type === "singleSelect" ? "space-y-3" : "flex flex-wrap gap-2 justify-center"
            )}>
              {stepConfig.options.map(opt => {
                const isSelected = getCurrentValue().includes(opt.value);
                
                if (stepConfig.type === "singleSelect") {
                  return (
                    <TappableCard
                      key={opt.value}
                      selected={isSelected}
                      onClick={() => toggleOption(opt.value)}
                    >
                      <span className="font-medium">{opt.label}</span>
                    </TappableCard>
                  );
                }
                
                return (
                  <TappableChip
                    key={opt.value}
                    selected={isSelected}
                    onClick={() => toggleOption(opt.value)}
                  >
                    {opt.label}
                  </TappableChip>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer for floating button */}
      <div className="h-36" />

      {/* Floating CTA button */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      >
        <div className="max-w-md mx-auto space-y-2">
          <Button 
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-all duration-200 border-0"
            onClick={handleNext}
            disabled={!canProceed() || saveMutation.isPending}
            data-testid="button-next"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                保存中...
              </>
            ) : currentStep === TOTAL_STEPS - 1 ? (
              <>
                开始探索
                <Sparkles className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                继续
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleSkip}
            data-testid="button-skip"
          >
            暂时跳过，稍后补充
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            没问题，随时可以补充~
          </p>
        </div>
      </motion.div>
    </div>
  );
}
