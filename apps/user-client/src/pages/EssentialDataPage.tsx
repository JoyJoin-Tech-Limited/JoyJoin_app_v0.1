import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Sparkles, ArrowRight, Loader2, Users, Network, MessageCircle, PartyPopper, Heart, Shuffle, Calendar, Star, Check, AlertCircle } from "lucide-react";
import { SegmentedProgress } from "@/components/ui/progress-segmented";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { INDUSTRY_OPTIONS, type WorkMode } from "@shared/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BirthDatePicker } from "@/components/BirthDatePicker";
import { IndustrySelector } from "@/components/IndustrySelector";
import { EnhancedOccupationSelector } from "@/components/EnhancedOccupationSelector";
import { FancyLineLoadingScreen } from "@/components/FancyLineLoadingScreen";
import { haptics } from "@/lib/haptics";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics";
import type { AuthUser } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

// Preload Xiaoyue avatars immediately
const XIAOYUE_AVATAR_URLS = [xiaoyueNormal, xiaoyueExcited, xiaoyuePointing];
XIAOYUE_AVATAR_URLS.forEach((src) => {
  const img = new Image();
  img.src = src;
});

const ESSENTIAL_CACHE_KEY = "joyjoin_essential_data_progress";

interface EssentialDataState {
  currentStep: number;
  data: {
    displayName: string;
    gender: string;
    birthYear: string;
    relationshipStatus: string;
    education: string;
    workIndustry: string;
    // Three-tier industry classification
    industryCategory?: string;
    industryCategoryLabel?: string;
    industrySegmentNew?: string; // FIXED: renamed from industrySegment to match schema
    industrySegmentLabel?: string;
    industryNiche?: string;
    industryNicheLabel?: string;
    industryRawInput?: string;
    industryNormalized?: string; // NEW - AI-cleaned version
    industrySource?: string;
    industryConfidence?: number;
    // Occupation fields
    occupationId?: string;
    workMode?: string;
    hometown: string;
    currentCity: string;
    intent: string[];
    preFlexibleIntent?: string[]; // Fix: Persist preFlexibleIntent state
  };
  timestamp: number;
}

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

const GENDER_OPTIONS = [
  { value: "女性", label: "女生", emoji: "👩" },
  { value: "男性", label: "男生", emoji: "👨" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "single", label: "单身" },
  { value: "dating", label: "恋爱中" },
  { value: "married", label: "已婚" },
  { value: "prefer_not_say", label: "不想说" },
];

// Main intent options with icons and descriptions
const INTENT_OPTIONS = [
  { value: "friends", label: "交新朋友", subtitle: "认识有趣的人", icon: Users },
  { value: "networking", label: "拓展人脉", subtitle: "扩大社交圈", icon: Network },
  { value: "discussion", label: "深度交流", subtitle: "走心的对话", icon: MessageCircle },
  { value: "fun", label: "轻松娱乐", subtitle: "开心就好", icon: PartyPopper },
  { value: "romance", label: "浪漫邂逅", subtitle: "遇见心动", icon: Heart },
];

// Special "flexible" option - mutually exclusive with others
const FLEXIBLE_OPTION = { value: "flexible", label: "随缘", subtitle: "交给小悦推荐", icon: Shuffle };

const EDUCATION_OPTIONS = [
  { value: "high_school", label: "高中及以下" },
  { value: "college", label: "大专" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "phd", label: "博士" },
];

const CITY_OPTIONS = [
  { value: "shenzhen", label: "深圳" },
  { value: "hongkong", label: "香港" },
  { value: "guangzhou", label: "广州" },
  { value: "dongguan", label: "东莞" },
  { value: "foshan", label: "佛山" },
  { value: "other", label: "其他城市" },
];

const BIRTH_YEARS = Array.from({ length: 50 }, (_, i) => {
  const year = 2006 - i;
  return { value: String(year), label: `${year}年` };
});

const STEP_CONFIG = [
  {
    id: "displayName",
    title: "大家怎么称呼你？",
    subtitle: "这是大家在活动中看到的名字",
    mascotMessage: "嘿！给自己起个响亮的名字吧，活动中大家会这么叫你~ ✨",
    mascotMood: "excited" as XiaoyueMood,
    type: "input" as const,
  },
  {
    id: "genderBirthday",
    title: "基本信息",
    subtitle: "帮助匹配更合适的活动",
    mascotMessage: "帮你找到年龄相近、聊得来的朋友！",
    mascotMood: "pointing" as XiaoyueMood,
    type: "dual" as const,
  },
  {
    id: "relationshipStatus",
    title: "目前的感情状态？",
    subtitle: "推荐更适合你的社交场景",
    mascotMessage: "小悦会根据这个推荐最合适你的社交场景 🤫",
    mascotMood: "normal" as XiaoyueMood,
    type: "select" as const,
    options: RELATIONSHIP_OPTIONS,
  },
  {
    id: "education",
    title: "最高学历？",
    subtitle: "匹配相似背景的伙伴",
    mascotMessage: "只是帮你匹配聊得来的人，不是相亲网站哈 😄",
    mascotMood: "pointing" as XiaoyueMood,
    type: "select" as const,
    options: EDUCATION_OPTIONS,
  },
  {
    id: "workIndustry",
    title: "你做什么工作？",
    subtitle: "用于兴趣推荐和同行匹配",
    mascotMessage: "说不定能遇到同行大佬，或者完全不同领域的有趣灵魂！",
    mascotMood: "excited" as XiaoyueMood,
    type: "select" as const,
    options: INDUSTRY_OPTIONS,
  },
  {
    id: "location",
    title: "你从哪来，在哪混？",
    subtitle: "老乡见老乡，两眼泪汪汪",
    mascotMessage: "老乡见老乡，配桌优先排！🏠",
    mascotMood: "excited" as XiaoyueMood,
    type: "dualCity" as const,
  },
  {
    id: "intent",
    title: "这次聚会，你最想……",
    subtitle: "选得越准，同桌的人越对味",
    mascotMessage: "最后一个问题！选完之后我就知道该把你安排在哪桌了 😏",
    mascotMood: "excited" as XiaoyueMood,
    type: "multiSelect" as const,
    options: INTENT_OPTIONS,
  },
];

const TOTAL_STEPS = STEP_CONFIG.length;

function TappableCard({ 
  selected, 
  onClick, 
  children,
  className,
  disabled,
}: { 
  selected: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left transition-all duration-200 min-h-[48px]",
        selected 
          ? "border-primary bg-primary/10 shadow-md shadow-primary/10" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      data-testid={`card-option`}
    >
      {children}
    </motion.button>
  );
}

export default function EssentialDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const { saveCheckpoint } = useOnboardingCheckpoint();
  const analytics = useOnboardingAnalytics('essential-data'); // Phase 2: Analytics tracking

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const [currentStep, setCurrentStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthDate, setBirthDate] = useState<{ year: number; month: number; day: number } | undefined>();
  const [birthDateSheetOpen, setBirthDateSheetOpen] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [education, setEducation] = useState("");
  const [workIndustry, setWorkIndustry] = useState("");
  // Three-tier industry classification state
  const [industryCategory, setIndustryCategory] = useState("");
  const [industryCategoryLabel, setIndustryCategoryLabel] = useState("");
  const [industrySegmentNew, setIndustrySegmentNew] = useState(""); // FIXED: renamed to match schema
  const [industrySegmentLabel, setIndustrySegmentLabel] = useState("");
  const [industryNiche, setIndustryNiche] = useState("");
  const [industryNicheLabel, setIndustryNicheLabel] = useState("");
  const [industryRawInput, setIndustryRawInput] = useState("");
  const [industryNormalized, setIndustryNormalized] = useState(""); // NEW - AI-cleaned version
  const [industrySource, setIndustrySource] = useState("");
  const [industryConfidence, setIndustryConfidence] = useState<number>();
  const [occupationId, setOccupationId] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode | "">("");
  const [hometown, setHometown] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [intent, setIntent] = useState<string[]>([]);
  const [preFlexibleIntent, setPreFlexibleIntent] = useState<string[]>([]); // Phase 0: Fix #9
  const [showCelebration, setShowCelebration] = useState(false);
  const [showManualIndustry, setShowManualIndustry] = useState(false);
  // Enhancement 5: direction tracking for step number ticker
  const directionRef = useRef<1 | -1>(1);
  // Auto-advance for single-select steps (2 & 3)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, []);

  // Load cached progress (Phase 0: Fix #11 - Error handling)
  useEffect(() => {
    const cached = localStorage.getItem(ESSENTIAL_CACHE_KEY);
    if (cached) {
      try {
        const state: EssentialDataState = JSON.parse(cached);
        // Validate state structure
        if (!state.data || typeof state.data !== 'object') {
          throw new Error('Invalid cached state structure');
        }
        
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          setCurrentStep(state.currentStep);
          setDisplayName(state.data.displayName || "");
          setGender(state.data.gender || "");
          setBirthYear(state.data.birthYear || "");
          setRelationshipStatus(state.data.relationshipStatus || "");
          setEducation(state.data.education || "");
          setWorkIndustry(state.data.workIndustry || "");
          setIndustryCategory(state.data.industryCategory || "");
          setIndustryCategoryLabel(state.data.industryCategoryLabel || "");
          setIndustrySegmentNew(state.data.industrySegmentNew || ""); // FIXED: use correct field name
          setIndustrySegmentLabel(state.data.industrySegmentLabel || "");
          setIndustryNiche(state.data.industryNiche || "");
          setIndustryNicheLabel(state.data.industryNicheLabel || "");
          setIndustryRawInput(state.data.industryRawInput || "");
          setIndustryNormalized(state.data.industryNormalized || ""); // NEW
          setIndustrySource(state.data.industrySource || "");
          setIndustryConfidence(state.data.industryConfidence);
          setOccupationId(state.data.occupationId || "");
          setWorkMode((state.data.workMode as WorkMode) || "");
          setHometown(state.data.hometown || "");
          setCurrentCity(state.data.currentCity || "");
          setIntent(state.data.intent || []);
          setPreFlexibleIntent(state.data.preFlexibleIntent || []); // Fix: Restore preFlexibleIntent
        }
      } catch (error) {
        console.error('[EssentialDataPage] Failed to load cached progress:', error);
        // Clear corrupted cache
        localStorage.removeItem(ESSENTIAL_CACHE_KEY);
        toast({
          title: "缓存已清除",
          description: "请重新填写信息",
          variant: "default",
        });
      }
    }
    
    // Pre-fill from user data if available
    if (user) {
      if (user.displayName) setDisplayName(user.displayName);
      if (user.gender) setGender(user.gender);
      if (user.currentCity) setCurrentCity(user.currentCity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally omit `toast` from deps: error toasts should not cause cache reloads
  }, [user]);

  // Save progress
  const saveProgress = useCallback(() => {
    const state: EssentialDataState = {
      currentStep,
      data: { displayName, gender, birthYear, relationshipStatus, education, workIndustry, 
              industryCategory, industryCategoryLabel, industrySegmentNew, industrySegmentLabel,
              industryNiche, industryNicheLabel, industryRawInput, industryNormalized, industrySource, industryConfidence,
              occupationId, workMode,
              hometown, currentCity, intent, preFlexibleIntent }, // Fix: Persist preFlexibleIntent
      timestamp: Date.now(),
    };
    localStorage.setItem(ESSENTIAL_CACHE_KEY, JSON.stringify(state));
  }, [currentStep, displayName, gender, birthYear, relationshipStatus, education, workIndustry,
      industryCategory, industryCategoryLabel, industrySegmentNew, industrySegmentLabel,
      industryNiche, industryNicheLabel, industryRawInput, industryNormalized, industrySource, industryConfidence,
      occupationId, workMode,
      hometown, currentCity, intent, preFlexibleIntent]); // Fix: Add preFlexibleIntent to deps

  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      localStorage.removeItem(ESSENTIAL_CACHE_KEY);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Phase 2: Track successful completion
      analytics.stepCompleted({
        stepsCompleted: TOTAL_STEPS,
        fieldsProvided: {
          displayName: !!displayName,
          gender: !!gender,
          birthYear: !!(birthDate || birthYear),
          relationshipStatus: !!relationshipStatus,
          education: !!education,
          industry: !!industryCategory,
          hometown: !!hometown,
          currentCity: !!currentCity,
          intent: intent.length > 0,
        },
      });
      
      // Save checkpoint after completing essential data (await to ensure persistence)
      try {
        await saveCheckpoint.mutateAsync('essential-data');
      } catch (error) {
        console.error('[EssentialDataPage] Failed to save checkpoint:', error);
        // Continue navigation even if checkpoint fails (non-blocking)
      }
      
      // Use server-driven nextStep for navigation instead of hardcoded URL
      const updatedUser = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] }) as AuthUser;
      let nextPath = '/';
      switch (updatedUser?.nextStep) {
        case 'onboarding':
          nextPath = '/onboarding';
          break;
        case 'personality-test':
          nextPath = '/personality-test';
          break;
        case 'essential-data':
          nextPath = '/onboarding/setup';
          break;
        case 'extended-data':
          nextPath = '/onboarding/extended';
          break;
        case 'profile-review':
          nextPath = '/onboarding/review';
          break;
        case 'guide':
        case 'discover':
        default:
          nextPath = '/';
          break;
      }
      setLocation(nextPath);
    },
    onError: (error: Error) => {
      // Phase 2: Track errors
      analytics.errorOccurred('save_failed', error.message);
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stepConfig = STEP_CONFIG[currentStep];
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 0: return displayName.trim().length >= 2;
      case 1: return gender && (birthDate?.year || birthYear);
      case 2: return relationshipStatus;
      case 3: return education;
      case 4: return industryCategory && industrySegmentNew; // FIXED: use correct field name
      case 5: return hometown && currentCity;
      case 6: return intent.length >= 1;
      default: return false;
    }
  };

  const toggleIntent = (value: string) => {
    setIntent(prev => {
      // Handle "flexible" (随缘) - mutually exclusive with other options
      // Phase 0: Fix #9 - Preserve previous intents when toggling flexible
      if (value === "flexible") {
        if (prev.includes("flexible")) {
          // Deselecting flexible - restore previous intents if any
          return preFlexibleIntent.length > 0 ? preFlexibleIntent : [];
        } else {
          // Selecting flexible - save current intents and select only flexible
          setPreFlexibleIntent(prev.filter(v => v !== "flexible"));
          return ["flexible"];
        }
      }
      
      // Handle normal options - if selecting a normal option, remove "flexible"
      const withoutFlexible = prev.filter(v => v !== "flexible");
      
      if (withoutFlexible.includes(value)) {
        return withoutFlexible.filter(v => v !== value);
      } else if (withoutFlexible.length < 5) {
        return [...withoutFlexible, value];
      }
      return withoutFlexible;
    });
  };

  // Check if "flexible" is selected
  const isFlexibleSelected = intent.includes("flexible");

  // Auto-advance handler for single-select steps (2 & 3)
  const handleSingleSelect = (setter: (val: string) => void, value: string) => {
    setter(value);
    haptics.light();

    // Cancel any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Capture the step at selection time so the callback won't fire on the wrong step
    const stepAtSelection = currentStep;
    setIsAutoAdvancing(true);
    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      setIsAutoAdvancing(false);
      // Only advance if the user is still on the step that triggered the timer
      setCurrentStep(prev => {
        if (prev !== stepAtSelection) return prev;
        directionRef.current = 1;
        return prev + 1;
      });
    }, 500);
  };

  const handleNext = () => {
    if (!canProceed()) return;
    // Guard against double-advance during auto-advance window
    if (isAutoAdvancing) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      setIsAutoAdvancing(false);
      return;
    }

    // Haptic feedback
    haptics.medium();

    directionRef.current = 1;
    if (currentStep < TOTAL_STEPS - 1) {
      directionRef.current = 1;
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step - save and navigate
      setShowCelebration(true);
      setTimeout(() => {
        const profileData: any = {
          displayName,
          gender,
          relationshipStatus,
          education,
          workIndustry,
          hometown,
          currentCity,
          intent,
          // Three-tier industry classification
          industryCategory,
          industryCategoryLabel,
          industrySegmentNew, // FIXED: use correct field name
          industrySegmentLabel,
          industryNiche,
          industryNicheLabel,
          industryRawInput,
          industryNormalized, // NEW - AI-cleaned version
          industrySource,
          industryConfidence: industryConfidence ? String(industryConfidence) : "0",
          // Occupation fields
          occupationId,
          workMode,
        };
        
        // Age validation (Phase 0: Fix #8) - Client-side pre-check
        let calculatedAge = 0;
        if (birthDate) {
          profileData.birthdate = `${birthDate.year}-${String(birthDate.month).padStart(2, '0')}-${String(birthDate.day).padStart(2, '0')}`;
          
          const birthDateObj = new Date(profileData.birthdate);
          const today = new Date();
          calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
          const monthDiff = today.getMonth() - birthDateObj.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
            calculatedAge--;
          }
        } else if (birthYear) {
          profileData.birthdate = `${birthYear}-01-01`;
          calculatedAge = new Date().getFullYear() - parseInt(birthYear, 10);
        }
        
        // Validate age >= 18
        if (calculatedAge < 18) {
          setShowCelebration(false);
          // Phase 2: Track age validation failure
          analytics.validationFailed('birthdate', `Age under 18 (${calculatedAge})`);
          toast({
            title: "年龄限制",
            description: "JoyJoin 仅面向 18 岁及以上用户开放",
            variant: "destructive",
          });
          return;
        }
        
        saveMutation.mutate(profileData);
      }, 1500);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      directionRef.current = -1;
      setCurrentStep(prev => prev - 1);
    }
  };

  const containerVariants = prefersReducedMotion 
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { 
        hidden: { opacity: 0, x: directionRef.current * 50 }, 
        visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
        exit: { opacity: 0, x: directionRef.current * -50, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
      };

  // Celebration overlay
  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[60]">
        <FancyLineLoadingScreen loop visible />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Match Potential Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="min-w-[44px] min-h-[44px] shrink-0"
              data-testid="button-back"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
              <span
                aria-live="polite"
                aria-atomic="true"
              >
                {/* Screen-reader-only text so live region has the current step in its content */}
                <span className="sr-only">
                  第 {currentStep + 1} 步 / 共 {TOTAL_STEPS} 步
                </span>
                {/* Visible step number ticker hidden — progress bar communicates progress visually */}
                <span className="hidden">
                  第{" "}
                  <span className="relative overflow-hidden h-5 inline-flex items-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={currentStep}
                        initial={prefersReducedMotion ? { opacity: 0 } : {
                          y: directionRef.current > 0 ? 16 : -16,
                          opacity: 0,
                        }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : {
                          y: directionRef.current > 0 ? -16 : 16,
                          opacity: 0,
                        }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="inline-block tabular-nums"
                      >
                        {currentStep + 1}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {" "}步 / 共 {TOTAL_STEPS} 步
                </span>
              </span>
              <span className="text-primary font-semibold">{Math.round(progress)}%</span>
            </div>
            {/* Segmented progress - Duolingo style */}
            <SegmentedProgress 
              current={currentStep}
              total={TOTAL_STEPS}
              variant="duolingo"
              className="h-1.5"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-md mx-auto space-y-4"
          >
            {/* Horizontal Mascot Layout */}
            <XiaoyueChatBubble
              pose={stepConfig.mascotMood === "excited" ? "casual" : stepConfig.mascotMood === "pointing" ? "pointing" : "thinking"}
              content={stepConfig.mascotMessage}
              horizontal
              animate={!prefersReducedMotion}
            />

            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl leading-tight font-bold text-foreground mb-2">
                {stepConfig.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {stepConfig.subtitle}
              </p>
            </div>

            {/* Step content */}
            <div className="space-y-4">
              {/* Step 0: Display Name */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  {/* Input with character counter */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="输入你喜欢的昵称"
                        className={cn(
                          "h-14 text-lg text-center rounded-xl font-medium transition-all",
                          displayName.length >= 2 && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                        )}
                        maxLength={20}
                        autoFocus
                        data-testid="input-display-name"
                      />
                    </div>
                    
                    {/* Character counter - text only, no progress bar */}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>字符数</span>
                      <span className={cn(
                        "font-medium",
                        displayName.length >= 2 && "text-green-600 dark:text-green-400"
                      )}>
                        {displayName.length}/20
                      </span>
                    </div>
                    
                    {/* Real-time validation feedback */}
                    {displayName && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2"
                      >
                        {displayName.length < 2 ? (
                          <>
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                            <span className="text-sm text-orange-600 dark:text-orange-400">
                              至少需要2个字符
                            </span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">
                              很棒的名字！✨
                            </span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Helpful hint instead of suggestions */}
                  <div className="text-center space-y-2 pt-4">
                    <p className="text-xs text-muted-foreground">
                      💡 这是你在小聚活动中显示的名字
                    </p>
                    <p className="text-xs text-muted-foreground">
                      完成后我们会为你生成专属的<strong className="text-primary">社交印象标签</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Gender + Birthday */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-base font-semibold mb-3 text-center">性别</label>
                    <div className="grid grid-cols-2 gap-3">
                      {GENDER_OPTIONS.map((opt, index) => (
                        <motion.button
                          key={opt.value}
                          type="button"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => {
                            haptics.light();
                            setGender(opt.value);
                          }}
                          className={cn(
                            "relative p-4 rounded-xl border-2 transition-all duration-200 overflow-hidden",
                            gender === opt.value
                              ? "border-primary shadow-lg shadow-primary/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                          )}
                          whileTap={{ scale: 0.97 }}
                          data-testid={`card-gender-${opt.value}`}
                        >
                          {/* Background gradient when selected */}
                          {gender === opt.value && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30"
                            />
                          )}
                          
                          {/* Content */}
                          <div className="relative flex flex-col items-center gap-2">
                            {/* Emoji with animation */}
                            <motion.span
                              className="text-4xl"
                              animate={gender === opt.value ? {
                                scale: [1, 1.2, 1],
                                rotate: [0, -10, 10, 0]
                              } : { scale: 1, rotate: 0 }}
                              transition={{ duration: 0.4 }}
                            >
                              {opt.emoji}
                            </motion.span>
                            
                            <span className={cn(
                              "text-base font-semibold",
                              gender === opt.value && "text-primary"
                            )}>
                              {opt.label}
                            </span>
                            
                            {/* Selection checkmark */}
                            {gender === opt.value && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                              >
                                <Check className="w-4 h-4 text-primary-foreground" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-3 text-center">出生日期</label>
                    <button
                      type="button"
                      onClick={() => setBirthDateSheetOpen(true)}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3",
                        birthDate
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50"
                      )}
                      data-testid="button-set-birthdate"
                    >
                      <Calendar className="w-5 h-5" />
                      {birthDate ? (
                        <span className="text-base font-semibold">
                          {birthDate.year}年{birthDate.month}月{birthDate.day}日
                          <span className="text-muted-foreground font-normal ml-2">
                            ({new Date().getFullYear() - birthDate.year}岁)
                          </span>
                        </span>
                      ) : (
                        <span className="text-base">点击设置出生日期</span>
                      )}
                    </button>

                    <Sheet open={birthDateSheetOpen} onOpenChange={setBirthDateSheetOpen}>
                      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
                        <SheetHeader className="mb-4">
                          <SheetTitle className="text-center text-xl">选择出生日期</SheetTitle>
                        </SheetHeader>
                        <BirthDatePicker
                          value={birthDate}
                          onChange={(date) => {
                            setBirthDate(date);
                            setBirthYear(String(date.year));
                          }}
                          minYear={1960}
                          maxYear={new Date().getFullYear()}
                        />
                        <div className="mt-6 px-4">
                          <Button
                            className="w-full h-12 text-base rounded-xl"
                            onClick={() => setBirthDateSheetOpen(false)}
                            data-testid="button-confirm-birthdate"
                          >
                            确认
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              )}

              {/* Step 2-4: Single select */}
              {(currentStep === 2 || currentStep === 3) && stepConfig.options && (
                <div className={cn(
                  "grid gap-3",
                  currentStep === 2 ? "grid-cols-2" : "grid-cols-1"
                )}>
                  {stepConfig.options.map(opt => {
                    const value = currentStep === 2 ? relationshipStatus : education;
                    const setValue = currentStep === 2 ? setRelationshipStatus : setEducation;
                    return (
                      <TappableCard
                        key={opt.value}
                        selected={value === opt.value}
                        onClick={() => handleSingleSelect(setValue, opt.value)}
                        disabled={isAutoAdvancing}
                        className="p-4"
                      >
                        <span className="text-base font-semibold">{opt.label}</span>
                      </TappableCard>
                    );
                  })}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  {/* EnhancedOccupationSelector - Combines occupation & industry with AI */}
                  <div>
                    <label className="block text-base font-semibold mb-3 text-center">职业与行业信息</label>
                    <EnhancedOccupationSelector
                      selectedOccupationId={occupationId}
                      selectedWorkMode={workMode as WorkMode | null}
                      socialIntent={intent[0] || "flexible"}
                      industryCategory={industryCategory}
                      industrySegment={industrySegmentNew}
                      industryNiche={industryNiche}
                      onOccupationChange={(id, industryId) => {
                        setOccupationId(id);
                        // industryId is the old-style single industry field, we can ignore it now
                        // as the AI will infer the three-tier classification
                      }}
                      onWorkModeChange={(mode) => setWorkMode(mode)}
                      onIndustryChange={(categoryId, segmentId, nicheId, labels) => {
                        setIndustryCategory(categoryId);
                        setIndustrySegmentNew(segmentId);
                        setIndustryNiche(nicheId || "");
                        
                        if (labels) {
                          setIndustryCategoryLabel(labels.category);
                          setIndustrySegmentLabel(labels.segment);
                          setIndustryNicheLabel(labels.niche || "");
                          
                          // Also update legacy workIndustry field for backward compatibility
                          const pathParts = [
                            labels.category,
                            labels.segment,
                            labels.niche
                          ].filter(Boolean);
                          setWorkIndustry(pathParts.join(" > "));
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Hometown + Current City */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-base font-semibold mb-3 text-center">家乡</label>
                    <Input
                      value={hometown}
                      onChange={(e) => setHometown(e.target.value)}
                      placeholder="例如：湖南长沙"
                      className="h-12 text-base text-center rounded-xl"
                      data-testid="input-hometown"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-3 text-center">常驻城市</label>
                    <div className="grid grid-cols-3 gap-3">
                      {CITY_OPTIONS.map(city => (
                        <TappableCard
                          key={city.value}
                          selected={currentCity === city.value}
                          onClick={() => setCurrentCity(city.value)}
                          className="p-3 text-center"
                        >
                          <span className="text-sm font-semibold">{city.label}</span>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Intent (multiSelect) - Duolingo Style */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  {/* Main intent options - 2 column grid with icons */}
                  <div className="grid grid-cols-2 gap-3">
                    {INTENT_OPTIONS.map((opt, index) => {
                      const Icon = opt.icon;
                      const isSelected = intent.includes(opt.value);
                      const isDisabled = isFlexibleSelected;
                      
                      return (
                        <motion.button
                          key={opt.value}
                          type="button"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            delay: Math.min(index * 0.04, 0.12),
                            type: "spring",
                            stiffness: 300,
                            damping: 24
                          }}
                          onClick={() => {
                            haptics.light();
                            toggleIntent(opt.value);
                          }}
                          disabled={isDisabled}
                          className={cn(
                            "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                              : isDisabled
                                ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 hover:shadow-md"
                          )}
                          whileTap={{ scale: 0.95 }}
                          data-testid={`card-intent-${opt.value}`}
                        >
                          {/* Selection checkmark */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                            >
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </motion.div>
                          )}
                          
                          {/* Icon */}
                          <motion.div
                            animate={isSelected ? { 
                              scale: [1, 1.15, 1],
                              rotate: [0, -5, 5, 0]
                            } : { scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center",
                              isSelected 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            )}
                          >
                            <Icon className="w-5 h-5" />
                          </motion.div>
                          
                          {/* Text */}
                          <div className="text-center">
                            <p className={cn(
                              "font-semibold text-sm",
                              isSelected ? "text-primary" : "text-foreground"
                            )}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {opt.subtitle}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  
                  {/* Divider with "或者" */}
                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dashed border-gray-300 dark:border-gray-600" />
                    </div>
                    <span className="relative bg-background px-4 text-sm text-muted-foreground">
                      或者
                    </span>
                  </div>
                  
                  {/* Flexible option - special styling */}
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: 0.18,
                      type: "spring",
                      stiffness: 300,
                      damping: 24
                    }}
                    onClick={() => {
                      haptics.medium();
                      toggleIntent("flexible");
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 rounded-xl border-2 border-dashed transition-all duration-200",
                      isFlexibleSelected
                        ? "border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 shadow-lg"
                        : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
                    )}
                    whileTap={{ scale: 0.98 }}
                    data-testid="card-intent-flexible"
                  >
                    {/* Dice icon with animation */}
                    <motion.div
                      animate={isFlexibleSelected ? { 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                      } : { rotate: 0 }}
                      transition={{ 
                        rotate: { duration: 0.5 },
                        scale: { duration: 0.3 }
                      }}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isFlexibleSelected 
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" 
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}
                    >
                      <Shuffle className="w-5 h-5" />
                    </motion.div>
                    
                    {/* Text */}
                    <div className="flex-1 text-left">
                      <p className={cn(
                        "font-bold text-sm",
                        isFlexibleSelected ? "text-purple-700 dark:text-purple-300" : "text-foreground"
                      )}>
                        {FLEXIBLE_OPTION.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {FLEXIBLE_OPTION.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        (我都感兴趣，帮我安排)
                      </p>
                    </div>
                    
                    {/* Toggle indicator */}
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      isFlexibleSelected 
                        ? "border-purple-500 bg-purple-500" 
                        : "border-gray-300 dark:border-gray-600"
                    )}>
                      {isFlexibleSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                  
                  {/* Selection count indicator */}
                  {!isFlexibleSelected && intent.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-2"
                    >
                      <p className="text-sm text-muted-foreground">
                        已选择 <span className="font-semibold text-primary">{intent.length}</span> 个目标
                      </p>
                      {intent.length >= 3 && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm font-medium text-green-600 dark:text-green-400"
                        >
                          🎉 完美！小悦已经知道该帮你找什么样的人了
                        </motion.p>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer for floating button */}
      <div className="h-32" />

      {/* Floating CTA button */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      >
        <div className="max-w-md mx-auto">
          <Button 
            className="w-full h-12 rounded-xl text-base font-bold shadow-lg bg-gradient-to-r from-[#FF6B9D] to-[#A86BFF] hover:from-[#e55f8e] hover:to-[#9257e6] transition-all duration-200 border-0"
            onClick={handleNext}
            disabled={!canProceed() || saveMutation.isPending || isAutoAdvancing}
            data-testid="button-next"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                保存中...
              </>
            ) : currentStep === TOTAL_STEPS - 1 ? (
              <>
                完成
                <Sparkles className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                继续
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
