import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Sparkles, Star, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

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
  };
  xpEarned: number;
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

const EDUCATION_OPTIONS = [
  { value: "high_school", label: "高中及以下" },
  { value: "college", label: "大专" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "phd", label: "博士" },
];

const INDUSTRY_OPTIONS = [
  { value: "tech", label: "互联网/科技" },
  { value: "finance", label: "金融/投资" },
  { value: "education", label: "教育/培训" },
  { value: "media", label: "媒体/创意" },
  { value: "consulting", label: "咨询/专业服务" },
  { value: "healthcare", label: "医疗/健康" },
  { value: "manufacturing", label: "制造/工程" },
  { value: "retail", label: "零售/消费" },
  { value: "real_estate", label: "房地产" },
  { value: "government", label: "政府/公共服务" },
  { value: "other", label: "其他行业" },
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
    xp: 10,
    type: "input" as const,
  },
  {
    id: "genderBirthday",
    title: "基本信息",
    subtitle: "这些会帮助我们更好地匹配",
    mascotMessage: "简单两步，帮你找到更合适的朋友！",
    mascotMood: "pointing" as XiaoyueMood,
    xp: 15,
    type: "dual" as const,
  },
  {
    id: "relationshipStatus",
    title: "你的感情状态？",
    subtitle: "放心，我们会保护好你的隐私",
    mascotMessage: "这个信息只用于精准匹配哦~",
    mascotMood: "normal" as XiaoyueMood,
    xp: 10,
    type: "select" as const,
    options: RELATIONSHIP_OPTIONS,
  },
  {
    id: "education",
    title: "你的教育背景？",
    subtitle: "学历不重要，我们只是想了解你",
    mascotMessage: "不管什么学历，都能找到志同道合的人！",
    mascotMood: "pointing" as XiaoyueMood,
    xp: 10,
    type: "select" as const,
    options: EDUCATION_OPTIONS,
  },
  {
    id: "workIndustry",
    title: "你在哪个行业工作？",
    subtitle: "方便找到同行或跨界有趣的人",
    mascotMessage: "可能会遇到同行前辈或者跨界伙伴哦！",
    mascotMood: "excited" as XiaoyueMood,
    xp: 15,
    type: "select" as const,
    options: INDUSTRY_OPTIONS,
  },
  {
    id: "location",
    title: "你的家乡和常驻城市？",
    subtitle: "老乡见老乡，两眼泪汪汪",
    mascotMessage: "说不定能遇到老乡呢！加油，最后一步！",
    mascotMood: "excited" as XiaoyueMood,
    xp: 20,
    type: "dualCity" as const,
  },
];

const TOTAL_STEPS = STEP_CONFIG.length;
const XP_PER_COMPLETION = 80;

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

function XPMeter({ current, total, className }: { current: number; total: number; className?: string }) {
  const percentage = Math.min((current / total) * 100, 100);
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 min-w-[50px] text-right">
        {current} 悦点
      </span>
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

export default function EssentialDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const [currentStep, setCurrentStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [education, setEducation] = useState("");
  const [workIndustry, setWorkIndustry] = useState("");
  const [hometown, setHometown] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [xpEarned, setXpEarned] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

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
          setXpEarned(state.xpEarned || 0);
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
      data: { displayName, gender, birthYear, relationshipStatus, education, workIndustry, hometown, currentCity },
      xpEarned,
      timestamp: Date.now(),
    };
    localStorage.setItem(ESSENTIAL_CACHE_KEY, JSON.stringify(state));
  }, [currentStep, displayName, gender, birthYear, relationshipStatus, education, workIndustry, hometown, currentCity, xpEarned]);

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
      case 1: return gender && birthYear;
      case 2: return relationshipStatus;
      case 3: return education;
      case 4: return workIndustry;
      case 5: return hometown && currentCity;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;

    // Award XP
    setXpEarned(prev => prev + stepConfig.xp);

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
        const profileData: any = {
          displayName,
          gender,
          relationshipStatus,
          education,
          workIndustry,
          hometown,
          currentCity,
        };
        if (birthYear) {
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
      <motion.div 
        className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div 
          className="text-center text-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <Sparkles className="w-20 h-20 mx-auto mb-4" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-2">太棒了！</h1>
          <p className="text-lg opacity-90">获得 {xpEarned + stepConfig.xp} 悦点</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>保存中...</span>
          </div>
        </motion.div>
      </motion.div>
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
              <span>第 {currentStep + 1} 步 / 共 {TOTAL_STEPS} 步</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
        <XPMeter current={xpEarned} total={XP_PER_COMPLETION} />
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

            {/* Step content */}
            <div className="space-y-4">
              {/* Step 0: Display Name */}
              {currentStep === 0 && (
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="输入你的昵称"
                  className="h-14 text-lg text-center rounded-2xl"
                  maxLength={20}
                  data-testid="input-display-name"
                />
              )}

              {/* Step 1: Gender + Birthday */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-center">性别</label>
                    <div className="grid grid-cols-2 gap-3">
                      {GENDER_OPTIONS.map(opt => (
                        <TappableCard
                          key={opt.value}
                          selected={gender === opt.value}
                          onClick={() => setGender(opt.value)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl">{opt.emoji}</span>
                            <span className="font-medium">{opt.label}</span>
                          </div>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3 text-center">出生年份</label>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                      {BIRTH_YEARS.map(yr => (
                        <TappableCard
                          key={yr.value}
                          selected={birthYear === yr.value}
                          onClick={() => setBirthYear(yr.value)}
                          className="p-3 text-center"
                        >
                          <span className="text-sm">{yr.value}</span>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2-4: Single select */}
              {(currentStep === 2 || currentStep === 3 || currentStep === 4) && stepConfig.options && (
                <div className="grid grid-cols-2 gap-3">
                  {stepConfig.options.map(opt => {
                    const value = currentStep === 2 ? relationshipStatus : currentStep === 3 ? education : workIndustry;
                    const setValue = currentStep === 2 ? setRelationshipStatus : currentStep === 3 ? setEducation : setWorkIndustry;
                    return (
                      <TappableCard
                        key={opt.value}
                        selected={value === opt.value}
                        onClick={() => setValue(opt.value)}
                      >
                        <span className="font-medium">{opt.label}</span>
                      </TappableCard>
                    );
                  })}
                </div>
              )}

              {/* Step 5: Hometown + Current City */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-center">家乡</label>
                    <Input
                      value={hometown}
                      onChange={(e) => setHometown(e.target.value)}
                      placeholder="例如：湖南长沙"
                      className="h-12 text-center rounded-xl"
                      data-testid="input-hometown"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3 text-center">常驻城市</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CITY_OPTIONS.map(city => (
                        <TappableCard
                          key={city.value}
                          selected={currentCity === city.value}
                          onClick={() => setCurrentCity(city.value)}
                          className="p-3 text-center"
                        >
                          <span className="text-sm font-medium">{city.label}</span>
                        </TappableCard>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fixed bottom CTA */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <Button
          className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
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
    </div>
  );
}
