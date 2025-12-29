import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Sparkles, PartyPopper, Phone, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiApple } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

const ONBOARDING_CACHE_KEY = "joyjoin_onboarding_progress";
const CACHE_EXPIRY_HOURS = 24;

interface OnboardingState {
  currentScreen: number;
  answers: Record<number, string | string[]>;
  timestamp: number;
}

interface OnboardingQuestion {
  id: number;
  question: string;
  options: { value: string; label: string }[];
  multiSelect?: boolean;
}

const PRE_SIGNUP_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 1,
    question: "周末你更喜欢怎么度过？",
    options: [
      { value: "home", label: "在家充电刷剧" },
      { value: "friends", label: "约朋友聚餐聊天" },
      { value: "outdoor", label: "户外运动探索" },
      { value: "random", label: "看心情随缘" },
    ],
  },
  {
    id: 2,
    question: "社交场合你通常是哪种风格？",
    options: [
      { value: "initiator", label: "主动破冰，热场王" },
      { value: "observer", label: "慢热观察，再出手" },
      { value: "connector", label: "喜欢牵线搭桥" },
      { value: "listener", label: "更爱倾听陪伴" },
    ],
  },
  {
    id: 3,
    question: "聚会时你最享受哪种氛围？",
    options: [
      { value: "deep", label: "深度交流，聊人生" },
      { value: "fun", label: "轻松搞笑，开心就好" },
      { value: "learn", label: "互相学习，有收获" },
      { value: "chill", label: "安静放松，不social" },
    ],
  },
  {
    id: 4,
    question: "你希望认识什么样的新朋友？",
    options: [
      { value: "similar", label: "志同道合，兴趣相似" },
      { value: "industry", label: "行业前辈，拓展人脉" },
      { value: "creative", label: "有趣灵魂，脑洞大开" },
      { value: "diverse", label: "各行各业，开阔视野" },
    ],
  },
  {
    id: 5,
    question: "对于小型聚会（4-6人），你的期待是？",
    options: [
      { value: "quality", label: "质量优先，遇到合拍的人" },
      { value: "frequency", label: "多参加，扩大社交圈" },
      { value: "topic", label: "有主题，聊得有深度" },
      { value: "casual", label: "随缘，开心就好" },
    ],
  },
];

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
}: { 
  mood?: XiaoyueMood; 
  message: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.div
        animate={{ 
          scale: [1, 1.02, 1],
          y: [0, -3, 0],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
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
  onBack,
  showBack = true,
}: { 
  current: number; 
  total: number;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const percentage = Math.round((current / total) * 100);
  
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
            value={percentage} 
            className="h-2 transition-all duration-500" 
          />
        </div>
        <span className="text-sm text-muted-foreground shrink-0 min-w-[40px] text-right">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function SelectionList({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: { value: string; label: string }[];
  selected: string | string[] | undefined;
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
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
      {options.map((option, index) => (
        <motion.button
          key={option.value}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect(option.value)}
          className={cn(
            "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 min-h-[56px]",
            "hover-elevate active-elevate-2",
            isSelected(option.value)
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid={`button-option-${option.value}`}
        >
          <span className={cn(
            "text-base font-medium text-left flex-1",
            isSelected(option.value) && "text-primary"
          )}>
            {option.label}
          </span>
          {isSelected(option.value) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0"
            >
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </motion.div>
          )}
        </motion.button>
      ))}
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
}

export default function DuolingoOnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentScreen, setCurrentScreen] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
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

  const handleAnswer = (questionId: number, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    setCurrentScreen(prev => prev + 1);
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
    if (currentScreen <= 5) return (currentScreen / 5) * 33;
    if (currentScreen === 6) return 40;
    if (currentScreen === 7) return 70;
    if (currentScreen === 8) return 90;
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
        const questionIndex = currentScreen - 1;
        const question = PRE_SIGNUP_QUESTIONS[questionIndex];
        const currentAnswer = answers[question.id];
        
        return (
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col px-6 py-6"
          >
            <XiaoyueMascot 
              mood="normal"
              message={question.question}
              className="mb-6"
            />
            
            <SelectionList
              options={question.options}
              selected={currentAnswer}
              onSelect={(value) => handleAnswer(question.id, value)}
              multiSelect={question.multiSelect}
            />

            <div className="mt-auto pt-6">
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

      case 6:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center px-6 py-6"
          >
            <XiaoyueMascot 
              mood="excited"
              message="快要揭晓你的社交角色了！登录查看结果"
            />

            <div className="w-full max-w-sm mt-8 space-y-4">
              {!isCodeSent ? (
                <>
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
                  <Button 
                    size="lg"
                    className="w-full h-14 text-lg rounded-2xl"
                    onClick={handleSendCode}
                    disabled={phone.length < 8 || sendCodeMutation.isPending}
                    data-testid="button-send-code"
                  >
                    {sendCodeMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Phone className="w-5 h-5 mr-2" />
                        发送验证码
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="输入6位验证码"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                      className="h-14 text-lg rounded-2xl px-5 text-center tracking-widest"
                      maxLength={6}
                      data-testid="input-code"
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      验证码已发送到 {phone}
                      {countdown > 0 ? (
                        <span className="ml-2">({countdown}s)</span>
                      ) : (
                        <button
                          onClick={handleSendCode}
                          className="ml-2 text-primary underline"
                        >
                          重新发送
                        </button>
                      )}
                    </p>
                  </div>
                  <Button 
                    size="lg"
                    className="w-full h-14 text-lg rounded-2xl"
                    onClick={handleVerifyCode}
                    disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}
                    data-testid="button-verify-code"
                  >
                    {verifyCodeMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "验证登录"
                    )}
                  </Button>
                </>
              )}

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
          </motion.div>
        );

      case 7:
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

      case 8:
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
          current={getScreenProgress()}
          total={100}
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
