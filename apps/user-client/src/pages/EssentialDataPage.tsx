import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Sparkles, ArrowRight, Loader2, Users, Network, MessageCircle, PartyPopper, Heart, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { INDUSTRY_OPTIONS } from "@shared/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BirthDatePicker } from "@/components/BirthDatePicker";
import { SmartIndustryInput } from "@/components/SmartIndustryInput";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { haptics } from "@/lib/haptics";

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
    hometown: string;
    currentCity: string;
    intent: string[];
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
  { value: "Woman", label: "女生", emoji: "👩" },
  { value: "Man", label: "男生", emoji: "👨" },
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
    title: "你想让大家怎么称呼你？",
    subtitle: "一个有趣的昵称会让人印象深刻",
    mascotMessage: "嘿！先给自己取个响亮的名字吧~",
    mascotMood: "excited" as XiaoyueMood,
    type: "input" as const,
  },
  {
    id: "genderBirthday",
    title: "选择出生日期",
    subtitle: "用于个性化体验，不会公开显示",
    mascotMessage: "简单两步，帮你找到更合适的朋友！",
    mascotMood: "pointing" as XiaoyueMood,
    type: "dual" as const,
  },
  {
    id: "relationshipStatus",
    title: "你的感情状态？",
    subtitle: "放心，我们会保护好你的隐私",
    mascotMessage: "这个信息只用于精准匹配哦~",
    mascotMood: "normal" as XiaoyueMood,
    type: "select" as const,
    options: RELATIONSHIP_OPTIONS,
  },
  {
    id: "education",
    title: "你的教育背景？",
    subtitle: "学历不重要，我们只是想了解你",
    mascotMessage: "不管什么学历，都能找到志同道合的人！",
    mascotMood: "pointing" as XiaoyueMood,
    type: "select" as const,
    options: EDUCATION_OPTIONS,
  },
  {
    id: "workIndustry",
    title: "你在哪个行业工作？",
    subtitle: "方便找到同行或跨界有趣的人",
    mascotMessage: "可能会遇到同行前辈或者跨界伙伴哦！",
    mascotMood: "excited" as XiaoyueMood,
    type: "select" as const,
    options: INDUSTRY_OPTIONS,
  },
  {
    id: "location",
    title: "你的家乡和常驻城市？",
    subtitle: "老乡见老乡，两眼泪汪汪",
    mascotMessage: "说不定能遇到老乡呢！",
    mascotMood: "excited" as XiaoyueMood,
    type: "dualCity" as const,
  },
  {
    id: "intent",
    title: "你想通过悦聚收获什么？",
    subtitle: "可以多选哦（最多5个）",
    mascotMessage: "告诉我你的目标，我帮你精准匹配！最后一步啦！",
    mascotMood: "excited" as XiaoyueMood,
    type: "multiSelect" as const,
    options: INTENT_OPTIONS,
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
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.div
        animate={controls}
        className="relative"
      >
        <img 
          src={XIAOYUE_AVATARS[mood]} 
          alt="小悦" 
          className="w-24 h-24 object-contain drop-shadow-lg"
        />
      </motion.div>
      <motion.div 
        className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 rounded-2xl px-5 py-4 max-w-[320px] shadow-sm border border-purple-100 dark:border-purple-800"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-base text-center text-purple-800 dark:text-purple-200 font-semibold leading-relaxed">
          {message}
        </p>
      </motion.div>
    </div>
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
        "w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 min-h-[56px]",
        selected 
          ? "border-primary bg-primary/10 shadow-md shadow-primary/10" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50",
        className
      )}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { 
        scale: [1, 1.02, 1],
        transition: { duration: 0.2 },
      } : { scale: 1 }}
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

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const [currentStep, setCurrentStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthDate, setBirthDate] = useState<{ year: number; month: number; day: number } | undefined>();
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [education, setEducation] = useState("");
  const [workIndustry, setWorkIndustry] = useState("");
  const [hometown, setHometown] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [intent, setIntent] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showManualIndustry, setShowManualIndustry] = useState(false);

  // Load cached progress
  useEffect(() => {
    const cached = localStorage.getItem(ESSENTIAL_CACHE_KEY);
    if (cached) {
      try {
        const state: EssentialDataState = JSON.parse(cached);
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          setCurrentStep(state.currentStep);
          setDisplayName(state.data.displayName || "");
          setGender(state.data.gender || "");
          setBirthYear(state.data.birthYear || "");
          setRelationshipStatus(state.data.relationshipStatus || "");
          setEducation(state.data.education || "");
          setWorkIndustry(state.data.workIndustry || "");
          setHometown(state.data.hometown || "");
          setCurrentCity(state.data.currentCity || "");
          setIntent(state.data.intent || []);
        }
      } catch {}
    }
    
    // Pre-fill from user data if available
    if (user) {
      if (user.displayName) setDisplayName(user.displayName);
      if (user.gender) setGender(user.gender);
      if (user.currentCity) setCurrentCity(user.currentCity);
    }
  }, [user]);

  // Save progress
  const saveProgress = useCallback(() => {
    const state: EssentialDataState = {
      currentStep,
      data: { displayName, gender, birthYear, relationshipStatus, education, workIndustry, hometown, currentCity, intent },
      timestamp: Date.now(),
    };
    localStorage.setItem(ESSENTIAL_CACHE_KEY, JSON.stringify(state));
  }, [currentStep, displayName, gender, birthYear, relationshipStatus, education, workIndustry, hometown, currentCity, intent]);

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
      setLocation("/onboarding/extended");
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

  const canProceed = () => {
    switch (currentStep) {
      case 0: return displayName.trim().length >= 2;
      case 1: return gender && (birthDate?.year || birthYear);
      case 2: return relationshipStatus;
      case 3: return education;
      case 4: return workIndustry;
      case 5: return hometown && currentCity;
      case 6: return intent.length >= 1;
      default: return false;
    }
  };

  const toggleIntent = (value: string) => {
    setIntent(prev => {
      // Handle "flexible" (随缘) - mutually exclusive with other options
      if (value === "flexible") {
        if (prev.includes("flexible")) {
          return []; // Deselect flexible
        } else {
          return ["flexible"]; // Select only flexible, clear others
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

  const handleNext = () => {
    if (!canProceed()) return;

    // Haptic feedback
    haptics.medium();

    if (currentStep < TOTAL_STEPS - 1) {
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
        };
        if (birthDate) {
          profileData.birthdate = `${birthDate.year}-${String(birthDate.month).padStart(2, '0')}-${String(birthDate.day).padStart(2, '0')}`;
        } else if (birthYear) {
          profileData.birthdate = `${birthYear}-01-01`;
        }
        saveMutation.mutate(profileData);
      }, 1500);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
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
      {/* Header with progress - Duolingo-style segmented dots */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-4">
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between text-base font-medium text-muted-foreground mb-3">
              <span>第 {currentStep + 1} 步 / 共 {TOTAL_STEPS} 步</span>
              <span className="text-primary font-semibold">{Math.round(progress)}%</span>
            </div>
            {/* Segmented progress dots - Duolingo style */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isUpcoming = index > currentStep;
                
                return (
                  <motion.div
                    key={index}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      isCompleted && "bg-primary h-2 flex-1",
                      isCurrent && "bg-primary h-3 flex-[1.5] shadow-md shadow-primary/30",
                      isUpcoming && "bg-gray-200 dark:bg-gray-700 h-2 flex-1"
                    )}
                    initial={false}
                    animate={isCurrent ? {
                      scale: [1, 1.05, 1],
                      transition: { duration: 0.4, repeat: Infinity, repeatDelay: 2 }
                    } : { scale: 1 }}
                  />
                );
              })}
            </div>
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
            <div className="text-center mb-8">
              <h1 className="text-[28px] leading-tight font-bold text-foreground mb-3">
                {stepConfig.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {stepConfig.subtitle}
              </p>
            </div>

            {/* Step content */}
            <div className="space-y-4">
              {/* Step 0: Display Name */}
              {currentStep === 0 && (
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="输入你的昵称"
                  className="h-16 text-xl text-center rounded-2xl font-medium"
                  maxLength={20}
                  data-testid="input-display-name"
                />
              )}

              {/* Step 1: Gender + Birthday */}
              {currentStep === 1 && (
                <div className="space-y-8">
                  <div>
                    <label className="block text-lg font-semibold mb-4 text-center">性别</label>
                    <div className="grid grid-cols-2 gap-4">
                      {GENDER_OPTIONS.map(opt => (
                        <TappableCard
                          key={opt.value}
                          selected={gender === opt.value}
                          onClick={() => setGender(opt.value)}
                        >
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">{opt.emoji}</span>
                            <span className="text-lg font-semibold">{opt.label}</span>
                          </div>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                  <div>
                    <BirthDatePicker
                      value={birthDate}
                      onChange={(date) => {
                        setBirthDate(date);
                        setBirthYear(String(date.year));
                      }}
                      minYear={1960}
                      maxYear={new Date().getFullYear()}
                    />
                  </div>
                </div>
              )}

              {/* Step 2-4: Single select */}
              {(currentStep === 2 || currentStep === 3) && stepConfig.options && (
                <div className="grid grid-cols-2 gap-4">
                  {stepConfig.options.map(opt => {
                    const value = currentStep === 2 ? relationshipStatus : education;
                    const setValue = currentStep === 2 ? setRelationshipStatus : setEducation;
                    return (
                      <TappableCard
                        key={opt.value}
                        selected={value === opt.value}
                        onClick={() => setValue(opt.value)}
                      >
                        <span className="text-lg font-semibold">{opt.label}</span>
                      </TappableCard>
                    );
                  })}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <SmartIndustryInput
                    options={INDUSTRY_OPTIONS}
                    value={workIndustry}
                    onSelect={(val) => {
                      setWorkIndustry(val);
                      setShowManualIndustry(false);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="default"
                    onClick={() => setShowManualIndustry((prev) => !prev)}
                    className="text-muted-foreground text-base"
                    data-testid="button-industry-manual"
                  >
                    {showManualIndustry ? "收起手动选择" : "手动选择"}
                  </Button>
                  {showManualIndustry && (
                    <div className="grid grid-cols-2 gap-4">
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <TappableCard
                          key={opt.value}
                          selected={workIndustry === opt.value}
                          onClick={() => setWorkIndustry(opt.value)}
                        >
                          <span className="text-lg font-semibold">{opt.label}</span>
                        </TappableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Hometown + Current City */}
              {currentStep === 5 && (
                <div className="space-y-8">
                  <div>
                    <label className="block text-lg font-semibold mb-4 text-center">家乡</label>
                    <Input
                      value={hometown}
                      onChange={(e) => setHometown(e.target.value)}
                      placeholder="例如：湖南长沙"
                      className="h-14 text-lg text-center rounded-2xl"
                      data-testid="input-hometown"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold mb-4 text-center">常驻城市</label>
                    <div className="grid grid-cols-3 gap-3">
                      {CITY_OPTIONS.map(city => (
                        <TappableCard
                          key={city.value}
                          selected={currentCity === city.value}
                          onClick={() => setCurrentCity(city.value)}
                          className="p-4 text-center"
                        >
                          <span className="text-base font-semibold">{city.label}</span>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Intent (multiSelect) - Duolingo Style */}
              {currentStep === 6 && (
                <div className="space-y-6">
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
                            delay: index * 0.05,
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
                            "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
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
                              "w-10 h-10 rounded-xl flex items-center justify-center",
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
                      delay: 0.3,
                      type: "spring",
                      stiffness: 300,
                      damping: 24
                    }}
                    onClick={() => {
                      haptics.medium();
                      toggleIntent("flexible");
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed transition-all duration-200",
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
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        isFlexibleSelected 
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" 
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}
                    >
                      <Shuffle className="w-6 h-6" />
                    </motion.div>
                    
                    {/* Text */}
                    <div className="flex-1 text-left">
                      <p className={cn(
                        "font-bold text-base",
                        isFlexibleSelected ? "text-purple-700 dark:text-purple-300" : "text-foreground"
                      )}>
                        {FLEXIBLE_OPTION.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {FLEXIBLE_OPTION.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
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
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center text-sm text-muted-foreground"
                    >
                      已选择 <span className="font-semibold text-primary">{intent.length}</span> 个目标
                    </motion.p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer for floating button */}
      <div className="h-24" />

      {/* Floating CTA button */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      >
        <div className="max-w-md mx-auto">
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
