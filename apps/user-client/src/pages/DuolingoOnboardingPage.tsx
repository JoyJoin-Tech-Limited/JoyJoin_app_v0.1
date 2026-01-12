import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Sparkles, PartyPopper, ArrowRight, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiWechat } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdaptiveAssessment, type AssessmentQuestion, type PreSignupAnswer } from "@/hooks/useAdaptiveAssessment";
import { getOptionFeedback } from "@shared/personality/feedback";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SelectionList } from "@/components/SelectionList";

// Use consistent Xiao Yue Avatar-01.png as primary avatar across all screens
import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

// Archetype imports for floating background effect
import corgiImg from "@/assets/开心柯基_transparent_1.png";
import foxImg from "@/assets/机智狐_transparent_2.png";
import bearImg from "@/assets/暖心熊_transparent_3.png";
import dolphinImg from "@/assets/淡定海豚_transparent_7.png";
import octopusImg from "@/assets/灵感章鱼_transparent_12.png";
import owlImg from "@/assets/沉思猫头鹰_transparent_8.png";
import spiderImg from "@/assets/织网蛛_transparent_4.png";
import catImg from "@/assets/隐身猫_transparent_10.png";

// Floating archetypes config - optimized for mobile performance
// Uses CSS transforms only (GPU-accelerated), positioned around screen edges
// Quick fade-in, gentle drift movement, varied sizes for depth effect
const FLOATING_ARCHETYPES = [
  { img: corgiImg, left: 5, top: 10, driftX: 12, driftY: -25, size: 44, delay: 0, duration: 12, opacity: 0.4 },
  { img: foxImg, left: 80, top: 8, driftX: -15, driftY: -20, size: 40, delay: 0.2, duration: 14, opacity: 0.38 },
  { img: bearImg, left: 3, top: 72, driftX: 18, driftY: -35, size: 48, delay: 0.4, duration: 16, opacity: 0.42 },
  { img: dolphinImg, left: 78, top: 68, driftX: -12, driftY: -30, size: 42, delay: 0.3, duration: 13, opacity: 0.36 },
  { img: octopusImg, left: 8, top: 38, driftX: 15, driftY: -18, size: 36, delay: 0.6, duration: 15, opacity: 0.32 },
  { img: owlImg, left: 82, top: 42, driftX: -18, driftY: -25, size: 46, delay: 0.5, duration: 14, opacity: 0.4 },
  { img: spiderImg, left: 15, top: 85, driftX: 8, driftY: -40, size: 34, delay: 0.1, duration: 17, opacity: 0.3 },
  { img: catImg, left: 72, top: 82, driftX: -8, driftY: -38, size: 38, delay: 0.7, duration: 15, opacity: 0.35 },
];

const ONBOARDING_CACHE_KEY = "joyjoin_onboarding_progress";
const V4_SESSION_KEY = "joyjoin_v4_assessment_session";
const V4_ANSWERS_KEY = "joyjoin_v4_presignup_answers";
const CACHE_EXPIRY_HOURS = 24;

interface OnboardingState {
  currentScreen: number;
  answers: Record<string, string>;
  timestamp: number;
}

interface V4AnchorQuestion {
  id: string;
  level: number;
  category: string;
  scenarioText: string;
  questionText: string;
  options: Array<{
    value: string;
    text: string;
    traitScores: Record<string, number>;
  }>;
}

const ONBOARDING_QUESTIONS_COUNT = 8;

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/'/g, '')
    .trim();
}

const CITIES = [
  { value: "shenzhen", label: "深圳" },
  { value: "hongkong", label: "香港" },
  { value: "guangzhou", label: "广州" },
  { value: "other", label: "其他城市" },
];

const INTENTS = [
  { value: "friends", label: "交朋友" },
  { value: "networking", label: "拓展人脉" },
  { value: "discussion", label: "深度交流" },
  { value: "casual", label: "轻松娱乐" },
  { value: "dating", label: "浪漫邂逅" },
];

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

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
          className="relative bg-card border border-border rounded-2xl px-4 py-3 shadow-md flex-1"
        >
          <div className="absolute top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-card" />
          <div className="absolute top-4 -left-[9px] w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-border" />
          <p className="text-lg leading-relaxed" data-testid="text-xiaoyue-message">
            {message}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
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
        className="relative"
      >
        <motion.div animate={controls}>
          <img 
            src={XIAOYUE_AVATARS.normal} 
            alt="小悦" 
            className="w-28 h-28 object-contain drop-shadow-lg"
            data-testid="img-xiaoyue-avatar"
          />
        </motion.div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative bg-card border border-border rounded-2xl px-5 py-3 shadow-md max-w-[280px]"
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-card" />
        <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-border" />
        <p className="text-center text-base leading-relaxed" data-testid="text-xiaoyue-message">
          {message}
        </p>
      </motion.div>
    </div>
  );
}

function OnboardingProgress({ 
  current, 
  total, 
  progress,
  onBack,
  showBack = true,
  displayRange,
}: { 
  current: number; 
  total: number;
  progress: number;
  onBack?: () => void;
  showBack?: boolean;
  displayRange?: string;
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
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground font-medium">
              第{Math.floor(current)}题 / 约{displayRange || "12-16"}题
            </span>
            <span className="text-xs font-bold text-primary">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * MobileActionBar component for sticky bottom buttons on mobile
 */
function MobileActionBar({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn(
      "relative sticky bottom-0 left-0 right-0 z-40 transition-all duration-300",
      className
    )}>
      {/* Gradient fade overlay above the action bar */}
      <div className="pointer-events-none absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
      <div className="bg-background/95 backdrop-blur-sm border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function loadCachedProgress(): OnboardingState | null {
  try {
    const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as OnboardingState;
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (now - data.timestamp > expiryMs) {
      localStorage.removeItem(ONBOARDING_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    localStorage.removeItem(ONBOARDING_CACHE_KEY);
    return null;
  }
}

function saveCachedProgress(data: Omit<OnboardingState, 'timestamp'>) {
  try {
    const cached: OnboardingState = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedProgress() {
  localStorage.removeItem(ONBOARDING_CACHE_KEY);
  localStorage.removeItem(V4_SESSION_KEY);
  localStorage.removeItem(V4_ANSWERS_KEY);
}

function saveV4AnswerToCache(
  questionId: string, 
  selectedOption: string, 
  traitScores: Record<string, number>
) {
  try {
    const cached = localStorage.getItem(V4_ANSWERS_KEY);
    const answers: PreSignupAnswer[] = cached ? JSON.parse(cached) : [];
    answers.push({
      questionId,
      selectedOption,
      traitScores,
      answeredAt: new Date().toISOString(),
    });
    localStorage.setItem(V4_ANSWERS_KEY, JSON.stringify(answers));
  } catch {
  }
}

function getV4CachedAnswers(): PreSignupAnswer[] {
  try {
    const cached = localStorage.getItem(V4_ANSWERS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export default function DuolingoOnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  
  const [currentScreen, setCurrentScreen] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const [temporarySessionId, setTemporarySessionId] = useState<string>("");
  
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [intents, setIntents] = useState<string[]>([]);
  
  const [birthYear, setBirthYear] = useState<string>("");
  const [relationshipStatus, setRelationshipStatus] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const { data: anchorQuestionsData, isLoading: isLoadingQuestions } = useQuery<{
    questions: V4AnchorQuestion[];
    count: number;
  }>({
    queryKey: ['/api/assessment/v4/anchor-questions'],
  });

  const anchorQuestions = anchorQuestionsData?.questions || [];
  const TOTAL_SCREENS = 9;

  useEffect(() => {
    const cached = loadCachedProgress();
    // Only show resume prompt if:
    // 1. There's a valid cached progress with screen > 0
    // 2. User hasn't just authenticated
    // 3. There are actual cached answers (not just empty cache)
    const cachedAnswers = getV4CachedAnswers();
    const hasValidProgress = cached && cached.currentScreen > 0 && cachedAnswers.length > 0;
    if (hasValidProgress && !justAuthenticated) {
      setShowResumePrompt(true);
    }
  }, [justAuthenticated]);

  useEffect(() => {
    let isCancelled = false;
    const existingSession = localStorage.getItem(V4_SESSION_KEY);
    const session = existingSession ?? (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`);
    localStorage.setItem(V4_SESSION_KEY, session);
    setTemporarySessionId(session);
    (async () => {
      try {
        const response = await apiRequest("GET", `/api/auth/presignup-cache/${session}`);
        if (isCancelled) return;
        if (response.ok) {
          const data = await response.json();
          if (isCancelled) return;
          if (data?.answers?.length) {
            const answersArray = data.answers as any[];
            localStorage.setItem(V4_ANSWERS_KEY, JSON.stringify(answersArray));
            const answerMap: Record<string, string> = {};
            answersArray.forEach((ans: any) => {
              if (ans?.questionId && ans?.selectedOption) {
                answerMap[ans.questionId] = ans.selectedOption;
              }
            });
            if (!isCancelled && Object.keys(answerMap).length > 0) {
              setAnswers(prev => ({ ...answerMap, ...prev }));
              setCurrentScreen(prev => {
                const answeredCount = Object.keys(answerMap).length;
                return prev < answeredCount ? Math.min(ONBOARDING_QUESTIONS_COUNT, answeredCount) : prev;
              });
            }
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load cached answers', error);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentScreen > 0) {
      saveCachedProgress({ currentScreen, answers });
    }
  }, [currentScreen, answers]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResume = (resume: boolean) => {
    if (resume) {
      const cached = loadCachedProgress();
      if (cached) {
        setCurrentScreen(cached.currentScreen);
        setAnswers(cached.answers);
      }
    } else {
      clearCachedProgress();
    }
    setShowResumePrompt(false);
  };

  const handleAnswer = (questionId: string, value: string, traitScores?: Record<string, number>) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (traitScores) {
      saveV4AnswerToCache(questionId, value, traitScores);
      if (temporarySessionId) {
        const cachedAnswers = getV4CachedAnswers();
        const deduped = Array.from(new Map(cachedAnswers.map((a) => [a.questionId, a])).values());
        apiRequest("POST", "/api/auth/presignup-cache", {
          sessionId: temporarySessionId,
          answers: deduped,
          metadata: { currentScreen: currentScreen + 1 },
        }).catch((error) => {
          console.error("Failed to cache presignup answers", error);
          toast({
            title: "同步失败",
            description: "当前网络不稳定，你的答题进度可能无法在多设备间同步。",
            variant: "destructive",
          });
        });
      }
    }
  };

  const handleNext = () => {
    // Progress gate: Block moving from last question to login screen if anchors incomplete
    if (currentScreen === ONBOARDING_QUESTIONS_COUNT) {
      const cachedAnswers = getV4CachedAnswers();
      const uniqueAnchorIds = new Set(cachedAnswers.map(a => a.questionId));
      if (uniqueAnchorIds.size < ONBOARDING_QUESTIONS_COUNT) {
        toast({
          title: "请完成所有题目",
          description: `你还剩 ${ONBOARDING_QUESTIONS_COUNT - uniqueAnchorIds.size} 道必答题未完成`,
          variant: "destructive",
        });
        return;
      }
    }
    const nextScreen = currentScreen + 1;
    setCurrentScreen(nextScreen);
  };

  const handleBack = () => {
    if (currentScreen > 0) {
      setCurrentScreen(prev => prev - 1);
    } else {
      setLocation("/");
    }
  };

  const sendCodeMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest("POST", "/api/auth/send-code", { phone: phoneNumber });
    },
    onSuccess: () => {
      setIsCodeSent(true);
      setCountdown(60);
      toast({
        title: "验证码已发送",
        description: "请查看手机短信",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (data: { phone: string; code: string }) => {
      return await apiRequest("POST", "/api/auth/verify-code", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setJustAuthenticated(true);
      handleNext();
    },
    onError: (error: Error) => {
      toast({
        title: "验证失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        authData: { phoneNumber: phone, code: verificationCode },
        profileData: {
          displayName: nickname,
          gender,
          currentCity: city,
          intent: intents,
          birthYear: birthYear ? parseInt(birthYear) : undefined,
          relationshipStatus: relationshipStatus || undefined,
        },
        assessmentAnswers: getV4CachedAnswers(),
        temporarySessionId,
        metadata: { currentScreen },
      };

      await apiRequest("POST", "/api/auth/unified-onboarding", payload);
      return { success: true };
    },
    onSuccess: () => {
      // Clear onboarding progress cache (but NOT the synced session markers - those are consumed by personality test)
      clearCachedProgress();
      // Clear the presignup answers cache since they've been synced
      localStorage.removeItem(V4_ANSWERS_KEY);
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "欢迎加入悦聚",
        description: "开始探索精彩活动吧",
      });
      setLocation("/personality-test");
    },
    onError: (error: Error) => {
      toast({
        title: "注册失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendCode = () => {
    if (phone.length >= 8) {
      sendCodeMutation.mutate(phone);
    }
  };

  const handleVerifyCode = () => {
    if (verificationCode.length === 6) {
      verifyCodeMutation.mutate({ phone, code: verificationCode });
    }
  };

  const handleCompleteEssential = () => {
    if (nickname.length >= 2 && gender && city && intents.length > 0) {
      handleNext();
    }
  };

  const handleCompleteOnboarding = (skip: boolean = false) => {
    if (!phone || verificationCode.length !== 6 || !/^\d{6}$/.test(verificationCode)) {
      toast({
        title: '请填写验证码',
        description: '请输入收到的6位数字验证码完成注册',
        variant: 'destructive',
      });
      return;
    }
    if (!nickname || !gender || !city || intents.length === 0) {
      toast({
        title: '信息不完整',
        description: '请先完成基础信息填写',
        variant: 'destructive',
      });
      return;
    }

    completeOnboardingMutation.mutate();
  };

  const getScreenProgress = () => {
    if (currentScreen === 0) return 0;
    // 8 anchor questions: screens 1-8 = 10% to 80%
    if (currentScreen <= 8) return (currentScreen / 8) * 80;
    // Login screen = 90%
    if (currentScreen === 9) return 90;
    return 100;
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden"
          >
            {/* Floating archetype avatars background - GPU-accelerated */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {FLOATING_ARCHETYPES.map((archetype, i) => (
                prefersReducedMotion ? (
                  <img
                    key={i}
                    src={archetype.img}
                    alt=""
                    className="absolute object-contain"
                    style={{
                      width: archetype.size,
                      height: archetype.size,
                      left: `${archetype.left}%`,
                      top: `${archetype.top}%`,
                      opacity: archetype.opacity * 0.6,
                    }}
                    data-testid={`img-floating-archetype-${i}`}
                  />
                ) : (
                  <motion.img
                    key={i}
                    src={archetype.img}
                    alt=""
                    className="absolute object-contain"
                    style={{
                      width: archetype.size,
                      height: archetype.size,
                      left: `${archetype.left}%`,
                      top: `${archetype.top}%`,
                      willChange: 'transform, opacity',
                    }}
                    initial={{
                      opacity: archetype.opacity * 0.5,
                      scale: 0.85,
                    }}
                    animate={{
                      x: [0, archetype.driftX, 0],
                      y: [0, archetype.driftY, 0],
                      opacity: [archetype.opacity * 0.5, archetype.opacity, archetype.opacity, archetype.opacity * 0.5],
                      scale: [0.85, 1, 1, 0.85],
                      rotate: [0, 6, -6, 0],
                    }}
                    transition={{
                      duration: archetype.duration,
                      repeat: Infinity,
                      delay: archetype.delay,
                      ease: "easeInOut",
                    }}
                    data-testid={`img-floating-archetype-${i}`}
                  />
                )
              ))}
            </div>
            
            {/* Beat 2: Hero gradient backdrop */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute top-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-3xl pointer-events-none"
            />
            
            {/* Beat 3: Mascot with spring entrance */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 20, 
                delay: prefersReducedMotion ? 0 : 0.3 
              }}
              className="relative z-10"
            >
              <motion.div
                animate={prefersReducedMotion ? {} : { 
                  scale: [1, 1.05, 1],
                  rotate: [0, -2, 2, 0]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <img 
                  src={XIAOYUE_AVATARS.normal} 
                  alt="小悦" 
                  className="w-32 h-32 object-contain drop-shadow-xl"
                  data-testid="img-xiaoyue-welcome"
                />
              </motion.div>
            </motion.div>
            
            {/* Speech bubble with staggered entrance */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 150,
                damping: 15,
                delay: prefersReducedMotion ? 0 : 0.5 
              }}
              className="relative mt-4 bg-card border border-border rounded-2xl px-5 py-4 shadow-lg max-w-[320px] z-10"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-card" />
              <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-border" />
              <p className="text-center text-lg leading-relaxed font-medium" data-testid="text-xiaoyue-welcome-message">
                3分钟完成我们自研的氛围测试，让我精准了解你的社交节奏
              </p>
            </motion.div>
            
            {/* Subheadline - whitespace-nowrap on last phrase prevents orphan */}
            <motion.p
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.7, duration: 0.4 }}
              className="mt-4 text-center text-muted-foreground text-sm max-w-[280px] z-10"
              data-testid="text-welcome-subheadline"
            >
              解锁12种社交动物原型，找到最合拍的<span className="whitespace-nowrap">同频伙伴</span>
            </motion.p>
            
            {/* CTA Button */}
            <motion.div 
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.8, duration: 0.4 }}
              className="mt-8 w-full max-w-sm z-10"
            >
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl shadow-lg"
                onClick={handleNext}
                data-testid="button-start-explore"
              >
                开始氛围测试
              </Button>
            </motion.div>
          </motion.div>
        );

      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
        const questionIndex = currentScreen - 1;
        const question = anchorQuestions[questionIndex];
        
        if (!question || isLoadingQuestions) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }
        
        const currentAnswer = answers[question.id];
        const scenarioText = stripEmoji(question.scenarioText);
        const questionTextClean = question.questionText;
        
        const optionsForList = question.options.map((opt) => ({
          value: opt.value,
          label: opt.text,
        }));
        
        return (
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col px-4 py-3 overflow-hidden"
          >
            <div className="shrink-0 mb-2">
              <p className="text-xl text-foreground mb-4 leading-relaxed font-bold">
                {scenarioText}
              </p>
              <XiaoyueMascot 
                mood={currentAnswer ? "excited" : "normal"}
                message={currentAnswer 
                  ? getOptionFeedback(question.id, Array.isArray(currentAnswer) ? currentAnswer[0] : currentAnswer) || "记下了，很有意思的选择！"
                  : questionTextClean
                }
                horizontal
                className="mb-2"
              />
            </div>
            
            <div className="flex-1 flex flex-col justify-center py-2 min-h-0">
              <div className="overflow-y-auto -mx-4 px-4">
                <SelectionList
                  options={optionsForList}
                  selected={currentAnswer}
                  onSelect={(value) => {
                    const val = Array.isArray(value) ? value[0] : value;
                    const selectedOpt = question.options.find(o => o.value === val);
                    handleAnswer(question.id, val, selectedOpt?.traitScores);
                  }}
                />
              </div>
            </div>

            <MobileActionBar>
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={handleNext}
                disabled={!currentAnswer}
                data-testid="button-continue"
              >
                继续
              </Button>
            </MobileActionBar>
          </motion.div>
        );

      case 9:
        // Login screen - after completing all 8 anchor questions
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 flex flex-col items-center px-6 py-6 overflow-y-auto min-h-0">
              <XiaoyueMascot 
                mood="excited"
                message="快要揭晓你的社交角色了！登录继续"
              />

              <div className="w-full max-w-sm mt-8 space-y-4">
                <div className="space-y-2">
                  <Input
                    type="tel"
                    placeholder="输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-14 text-lg rounded-2xl px-5"
                    data-testid="input-phone"
                  />
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">或</span>
                  </div>
                </div>

                <Button 
                  variant="outline"
                  size="lg"
                  className="w-full h-14 text-lg rounded-2xl"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-replit-auth"
                >
                  <SiWechat className="w-5 h-5 mr-2 text-[#07C160]" />
                  微信一键登录
                </Button>
              </div>

              <p className="mt-6 text-sm text-muted-foreground text-center">
                还需约8-12题即可揭晓结果
              </p>
            </div>

            <div className="shrink-0 p-4 bg-background/95 backdrop-blur-sm border-t pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="max-w-md mx-auto w-full">
                <Button 
                  size="lg"
                  className="w-full h-14 text-lg rounded-2xl"
                  disabled={isLoggingIn || phone.length < 8}
                  onClick={async () => {
                    if (phone.length < 8) {
                      toast({
                        title: "请输入有效手机号",
                        variant: "destructive",
                      });
                      return;
                    }
                    setIsLoggingIn(true);
                    try {
                      // 1. Login first
                      await apiRequest("POST", "/api/auth/quick-login", { phone });
                      
                      // 2. Wait for auth state to update before proceeding
                      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
                      
                      // 3. Sync pre-signup answers to the assessment session
                      const cachedAnswers = getV4CachedAnswers();
                      if (cachedAnswers.length > 0) {
                        const syncResponse = await apiRequest("POST", "/api/assessment/v4/presignup-sync", {
                          preSignupAnswers: cachedAnswers,
                        });
                        const syncData = await syncResponse.json();
                        
                        // Store the synced session ID for personality test to resume
                        if (syncData.sessionId) {
                          localStorage.setItem("joyjoin_synced_session_id", syncData.sessionId);
                          localStorage.setItem("joyjoin_synced_answer_count", String(syncData.totalCount || cachedAnswers.length));
                        }
                      }
                      
                      // 4. Clear cache and redirect to personality test to continue
                      clearCachedProgress();
                      setLocation("/personality-test");
                    } catch (error) {
                      console.error("Quick login failed:", error);
                      toast({
                        title: "登录失败",
                        description: "请稍后再试",
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoggingIn(false);
                    }
                  }}
                  data-testid="button-phone-login"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    <>
                      继续完成测试
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (showResumePrompt) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <XiaoyueMascot 
            mood="normal"
            message="上次没做完，要继续吗？"
          />
          <div className="mt-8 w-full max-w-sm space-y-3">
            <Button 
              size="lg"
              className="w-full h-14 text-lg rounded-2xl"
              onClick={() => handleResume(true)}
              data-testid="button-resume"
            >
              继续上次
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="w-full h-14 text-lg rounded-2xl"
              onClick={() => handleResume(false)}
              data-testid="button-restart"
            >
              重新开始
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      {currentScreen > 0 && (
        <OnboardingProgress
          current={currentScreen}
          total={8}
          progress={getScreenProgress()}
          onBack={handleBack}
          showBack={currentScreen > 0}
          displayRange="8-16"
        />
      )}
      
      <AnimatePresence mode="wait">
        {renderScreen()}
      </AnimatePresence>
    </div>
  );
}
