import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Sparkles, PartyPopper, ArrowRight, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiApple } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdaptiveAssessment, type AssessmentQuestion, type PreSignupAnswer } from "@/hooks/useAdaptiveAssessment";
import { getOptionFeedback } from "@shared/personality/feedback";

import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

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

const ONBOARDING_QUESTIONS_COUNT = 6;

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
  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          key={message}
          initial={{ x: 0 }}
          whileInView={{ 
            x: [0, -5, 5, -5, 5, 0],
          }}
          transition={{ 
            scale: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
            x: {
              duration: 0.4,
            }
          }}
          className="relative shrink-0"
        >
          <img 
            src={XIAOYUE_AVATARS[mood]} 
            alt="小悦" 
            className="w-16 h-16 object-contain drop-shadow-lg"
            data-testid="img-xiaoyue-avatar"
          />
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
        key={message}
        initial={{ x: 0 }}
        whileInView={{ 
          x: [0, -5, 5, -5, 5, 0],
        }}
        transition={{ 
          scale: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          },
          x: {
            duration: 0.4,
          }
        }}
        className="relative"
      >
        <img 
          src={XIAOYUE_AVATARS[mood]} 
          alt="小悦" 
          className="w-28 h-28 object-contain drop-shadow-lg"
          data-testid="img-xiaoyue-avatar"
        />
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
}: { 
  current: number; 
  total: number;
  progress: number;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
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
            <span className="text-xs text-muted-foreground">
              第{Math.floor(current)}题 / 约12题
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionList({
  options,
  selected,
  onSelect,
  multiSelect = false,
  questionId,
}: {
  options: { value: string; label: string; tag?: string }[];
  selected: string | string[] | undefined;
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
  questionId?: string;
}) {
  const handleSelect = (value: string) => {
    if (multiSelect) {
      const currentSelected = Array.isArray(selected) ? selected : [];
      if (currentSelected.includes(value)) {
        onSelect(currentSelected.filter(v => v !== value));
      } else {
        onSelect([...currentSelected, value]);
      }
    } else {
      onSelect(value);
    }
  };

  const isSelected = (value: string) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(value);
    }
    return selected === value;
  };

  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        return (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex flex-col gap-2"
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all duration-200 min-h-[64px]",
                "hover-elevate active-elevate-2 shadow-sm",
                isSelected(option.value)
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              )}
              data-testid={`button-option-${option.value}`}
            >
              <div className="flex-1 text-left">
                <span className={cn(
                  "text-lg font-medium leading-snug",
                  isSelected(option.value) ? "text-primary" : "text-foreground/90"
                )}>
                  {option.label}
                </span>
                {option.tag && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {option.tag}
                  </span>
                )}
              </div>
              {isSelected(option.value) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          </motion.div>
        );
      })}
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
  
  const [currentScreen, setCurrentScreen] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [intents, setIntents] = useState<string[]>([]);
  
  const [birthYear, setBirthYear] = useState<string>("");
  const [showBirthYear, setShowBirthYear] = useState(true);
  const [relationshipStatus, setRelationshipStatus] = useState<string>("");

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
    if (cached && cached.currentScreen > 0) {
      setShowResumePrompt(true);
    }
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
    }
  };

  const handleNext = () => {
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
    mutationFn: async (data: {
      displayName: string;
      gender: string;
      currentCity: string;
      intent: string[];
      birthYear?: number;
      showBirthYear?: boolean;
      relationshipStatus?: string;
      preSignupAnswers: Record<number, string | string[]>;
    }) => {
      return await apiRequest("POST", "/api/auth/complete-onboarding", data);
    },
    onSuccess: () => {
      clearCachedProgress();
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
    const data = {
      displayName: nickname,
      gender,
      currentCity: city,
      intent: intents,
      preSignupAnswers: answers,
      ...(birthYear && !skip && { birthYear: parseInt(birthYear) }),
      ...(!skip && { showBirthYear }),
      ...(relationshipStatus && !skip && { relationshipStatus }),
    };
    completeOnboardingMutation.mutate(data);
  };

  const getScreenProgress = () => {
    if (currentScreen === 0) return 0;
    if (currentScreen <= 6) return (currentScreen / 6) * 40;
    if (currentScreen === 7) return 50;
    if (currentScreen === 8) return 75;
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
            className="flex-1 flex flex-col items-center justify-center px-6 py-8"
          >
            <XiaoyueMascot 
              mood="normal"
              message="嗨！我是小悦，帮你找到最合拍的朋友"
            />
            
            <div className="mt-8 w-full max-w-sm">
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={handleNext}
                data-testid="button-start-explore"
              >
                开始探索
              </Button>
            </div>
          </motion.div>
        );

      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
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
            className="flex-1 flex flex-col px-4 py-3"
          >
            <div className="mb-2">
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
            
            <div className="flex-1 flex flex-col justify-center py-2">
              <SelectionList
                options={optionsForList}
                selected={currentAnswer}
                onSelect={(value) => {
                  const val = Array.isArray(value) ? value[0] : value;
                  const selectedOpt = question.options.find(o => o.value === val);
                  handleAnswer(question.id, val, selectedOpt?.traitScores);
                }}
                questionId={question.id}
              />
            </div>

            <div className="py-3 mt-auto">
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={handleNext}
                disabled={!currentAnswer}
                data-testid="button-continue"
              >
                继续
              </Button>
            </div>
          </motion.div>
        );

      case 7:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center px-6 py-6 pb-24"
          >
            <XiaoyueMascot 
              mood="excited"
              message="快要揭晓你的社交角色了！登录查看结果"
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
                <SiApple className="w-5 h-5 mr-2" />
                其他方式登录
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground text-center">
              2分钟完成剩余测试
            </p>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-40">
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={async () => {
                  if (phone.length < 8) {
                    toast({
                      title: "请输入有效手机号",
                      variant: "destructive",
                    });
                    return;
                  }
                  try {
                    await apiRequest("POST", "/api/auth/quick-login", { phone });
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    setLocation("/personality-test");
                  } catch (error) {
                    console.error("Quick login failed:", error);
                    toast({
                      title: "登录失败",
                      description: "请稍后再试",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={phone.length < 8}
                data-testid="button-phone-login"
              >
                继续
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 8:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col px-6 py-6"
          >
            <XiaoyueMascot 
              mood="pointing"
              message="最后几个问题，帮你找到最合拍的人"
            />

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">昵称</label>
                <Input
                  placeholder="至少2个字符"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-12 rounded-xl"
                  data-testid="input-nickname"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">性别</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "female", label: "女生" },
                    { value: "male", label: "男生" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={gender === option.value ? "default" : "outline"}
                      className="h-12 rounded-xl"
                      onClick={() => setGender(option.value)}
                      data-testid={`button-gender-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">常驻城市</label>
                <div className="grid grid-cols-2 gap-3">
                  {CITIES.map((option) => (
                    <Button
                      key={option.value}
                      variant={city === option.value ? "default" : "outline"}
                      className="h-12 rounded-xl"
                      onClick={() => setCity(option.value)}
                      data-testid={`button-city-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">活动意图（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {INTENTS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={intents.includes(option.value) ? "default" : "outline"}
                      className="px-4 py-2 text-sm cursor-pointer rounded-full"
                      onClick={() => {
                        if (intents.includes(option.value)) {
                          setIntents(intents.filter(i => i !== option.value));
                        } else {
                          setIntents([...intents, option.value]);
                        }
                      }}
                      data-testid={`badge-intent-${option.value}`}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={handleCompleteEssential}
                disabled={nickname.length < 2 || !gender || !city || intents.length === 0}
                data-testid="button-continue-essential"
              >
                继续
              </Button>
            </div>
          </motion.div>
        );

      case 9:
        const years = Array.from({ length: 40 }, (_, i) => 2006 - i);
        
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col px-6 py-6"
          >
            <XiaoyueMascot 
              mood="normal"
              message="再多了解一点，匹配更精准"
            />

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">出生年份</label>
                <div className="flex gap-3">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-input bg-background"
                    data-testid="select-birth-year"
                  >
                    <option value="">选择年份</option>
                    {years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl shrink-0"
                    onClick={() => setShowBirthYear(!showBirthYear)}
                    data-testid="button-toggle-birth-visibility"
                  >
                    {showBirthYear ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {showBirthYear ? "年龄将对其他用户可见" : "年龄将保密"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">感情状态</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "single", label: "单身" },
                    { value: "dating", label: "恋爱中" },
                    { value: "married", label: "已婚" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={relationshipStatus === option.value ? "default" : "outline"}
                      className="h-12 rounded-xl"
                      onClick={() => setRelationshipStatus(option.value)}
                      data-testid={`button-relationship-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 space-y-3">
              <Button 
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
                onClick={() => handleCompleteOnboarding(false)}
                disabled={completeOnboardingMutation.isPending}
                data-testid="button-complete"
              >
                {completeOnboardingMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <PartyPopper className="w-5 h-5 mr-2" />
                    完成
                  </>
                )}
              </Button>
              <button
                onClick={() => handleCompleteOnboarding(true)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                data-testid="button-skip-extended"
              >
                稍后完善
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (showResumePrompt) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
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
    <div className="min-h-screen flex flex-col bg-background">
      {currentScreen > 0 && (
        <OnboardingProgress
          current={currentScreen}
          total={6}
          progress={getScreenProgress()}
          onBack={handleBack}
          showBack={currentScreen > 0}
        />
      )}
      
      <AnimatePresence mode="wait">
        {renderScreen()}
      </AnimatePresence>
    </div>
  );
}
