import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Sparkles, PartyPopper, Gift, Star, RotateCcw, Clock, Users, Brain, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import MiniRadarChart from "@/components/MiniRadarChart";
import { personalityQuestionsV2, type QuestionV2, type TraitScores } from "@/data/personalityQuestionsV2";
import { 
  getCalibrationQuestion, 
  shouldTriggerLowEnergyCalibration,
  getLowEnergyCalibrationQuestions,
  type LowEnergyCalibrationQuestion 
} from "@/data/adaptiveCalibrationQuestions";
import { evaluatePersonality } from "@/lib/cumulativeScoringSystem";
import CelebrationConfetti from "@/components/CelebrationConfetti";
import { cn } from "@/lib/utils";
import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";
import PersonalityTestPageV4 from "./PersonalityTestPageV4";

const PERSONALITY_TEST_CACHE_KEY = "joyjoin_personality_test_progress";
const ONBOARDING_ANSWERS_KEY = "joyjoin_onboarding_answers";
const V4_ANSWERS_KEY = "joyjoin_v4_presignup_answers";
const ONBOARDING_QUESTIONS_COUNT = 6;
const CACHE_EXPIRY_DAYS = 7;

function hasV4PreSignupAnswers(): boolean {
  try {
    const cached = localStorage.getItem(V4_ANSWERS_KEY);
    if (!cached) return false;
    const answers = JSON.parse(cached);
    return Array.isArray(answers) && answers.length > 0;
  } catch {
    return false;
  }
}

interface AnswerV2 {
  type: "single" | "dual";
  value?: string;
  mostLike?: string;
  secondLike?: string;
  traitScores: TraitScores;
  secondTraitScores?: TraitScores;
}

interface CachedProgress {
  currentQuestionIndex: number;
  answers: Record<number, AnswerV2>;
  calibrationChecked: boolean;
  lowEnergyCalibrationActive: boolean;
  lowEnergyQuestionIndex: number;
  timestamp: number;
}

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
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
  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={{ 
            scale: [1, 1.02, 1],
            y: [0, -2, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
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

function SelectionList({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: { value: string; label: string; tag?: string }[];
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
    <div className="space-y-2">
      {options.map((option, index) => (
        <motion.button
          key={option.value}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect(option.value)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 min-h-[48px]",
            "hover-elevate active-elevate-2",
            isSelected(option.value)
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid={`button-option-${option.value}`}
        >
          <div className="flex-1 text-left">
            <span className={cn(
              "text-base font-medium",
              isSelected(option.value) && "text-primary"
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

function loadCachedProgress(): CachedProgress | null {
  try {
    const cached = localStorage.getItem(PERSONALITY_TEST_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedProgress;
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (now - data.timestamp > expiryMs) {
      localStorage.removeItem(PERSONALITY_TEST_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    localStorage.removeItem(PERSONALITY_TEST_CACHE_KEY);
    return null;
  }
}

function saveCachedProgress(data: Omit<CachedProgress, 'timestamp'>) {
  try {
    const cached: CachedProgress = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(PERSONALITY_TEST_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedProgress() {
  localStorage.removeItem(PERSONALITY_TEST_CACHE_KEY);
}

function loadOnboardingAnswers(): Record<number, AnswerV2> | null {
  try {
    const stored = localStorage.getItem(ONBOARDING_ANSWERS_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as Record<number, AnswerV2>;
    const questionCount = Object.keys(parsed).length;
    
    if (questionCount >= ONBOARDING_QUESTIONS_COUNT) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearOnboardingAnswers() {
  localStorage.removeItem(ONBOARDING_ANSWERS_KEY);
}

const INTRO_SHOWN_KEY = "joyjoin_personality_intro_shown";

export default function PersonalityTestPage() {
  const [useV4, setUseV4] = useState(() => {
    if (typeof window === "undefined") return false;
    return hasV4PreSignupAnswers();
  });

  if (useV4) {
    return <PersonalityTestPageV4 />;
  }

  return <PersonalityTestPageV2 />;
}

function PersonalityTestPageV2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerV2>>({});
  const [showMilestone, setShowMilestone] = useState(false);
  const [showBlindBox, setShowBlindBox] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [cachedData, setCachedData] = useState<CachedProgress | null>(null);
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(INTRO_SHOWN_KEY);
  });
  
  // 校准题状态 - 存储检测到的校准题
  const [calibrationQuestion, setCalibrationQuestion] = useState<QuestionV2 | null>(null);
  const [calibrationInsertIndex, setCalibrationInsertIndex] = useState<number | null>(null);
  // 标记是否已执行校准检测（防止重复检测）
  const [calibrationChecked, setCalibrationChecked] = useState(false);
  
  // V6.8 低能量原型校准状态
  const [lowEnergyCalibrationActive, setLowEnergyCalibrationActive] = useState(false);
  const [lowEnergyQuestionIndex, setLowEnergyQuestionIndex] = useState(0);
  const lowEnergyQuestions = useMemo(() => getLowEnergyCalibrationQuestions(), []);
  
  // Load cached progress or onboarding answers on mount
  useEffect(() => {
    const cached = loadCachedProgress();
    if (cached && cached.currentQuestionIndex > 0) {
      setCachedData(cached);
      setShowResumePrompt(true);
      return;
    }
    
    const onboardingAnswers = loadOnboardingAnswers();
    if (onboardingAnswers) {
      setAnswers(onboardingAnswers);
      setCurrentQuestionIndex(ONBOARDING_QUESTIONS_COUNT);
      localStorage.setItem(INTRO_SHOWN_KEY, "true");
      setShowIntro(false);
      clearOnboardingAnswers();
    }
  }, []);
  
  // Save progress whenever answers or currentQuestionIndex change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveCachedProgress({
        currentQuestionIndex,
        answers,
        calibrationChecked,
        lowEnergyCalibrationActive,
        lowEnergyQuestionIndex,
      });
    }
  }, [currentQuestionIndex, answers, calibrationChecked, lowEnergyCalibrationActive, lowEnergyQuestionIndex]);
  
  const handleResumeProgress = useCallback(() => {
    if (cachedData) {
      setCurrentQuestionIndex(cachedData.currentQuestionIndex);
      setAnswers(cachedData.answers);
      setCalibrationChecked(cachedData.calibrationChecked);
      if (cachedData.lowEnergyCalibrationActive) {
        setLowEnergyCalibrationActive(true);
        setLowEnergyQuestionIndex(cachedData.lowEnergyQuestionIndex || 0);
      }
      toast({
        title: "已恢复进度",
        description: `继续第${cachedData.currentQuestionIndex + 1}题`,
      });
    }
    setShowResumePrompt(false);
  }, [cachedData, toast]);
  
  const handleStartFresh = useCallback(() => {
    clearCachedProgress();
    setCurrentQuestionIndex(0);
    setAnswers({});
    setCalibrationChecked(false);
    setLowEnergyCalibrationActive(false);
    setLowEnergyQuestionIndex(0);
    setShowResumePrompt(false);
  }, []);

  // 构建动态题目列表 - 在Q6后插入校准题（如果有）
  const allQuestions = useMemo(() => {
    const baseQuestions = [...personalityQuestionsV2];
    if (calibrationQuestion && calibrationInsertIndex !== null) {
      // 在索引位置插入校准题（Q6后，即索引6处）
      const result = [...baseQuestions];
      result.splice(calibrationInsertIndex, 0, calibrationQuestion);
      return result;
    }
    return baseQuestions;
  }, [calibrationQuestion, calibrationInsertIndex]);

  // 总题目数：基础题 + V7.2校准题(如果有) + 低能量校准题(如果激活)
  const totalQuestions = allQuestions.length + (lowEnergyCalibrationActive ? lowEnergyQuestions.length : 0);
  
  // 当前低能量校准题（如果正在进行低能量校准）
  const currentLowEnergyQuestion = lowEnergyCalibrationActive ? lowEnergyQuestions[lowEnergyQuestionIndex] : null;

  const submitTestMutation = useMutation({
    mutationFn: async (responses: Record<number, AnswerV2>) => {
      return await apiRequest("POST", "/api/personality-test/v2/submit", {
        responses,
      });
    },
    onSuccess: () => {
      clearCachedProgress();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/personality-test/results'] });
        setLocation(`/personality-test/complete`);
      }, 2000);
    },
    onError: (error: Error) => {
      setShowBlindBox(false);
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleStartTest = useCallback(() => {
    localStorage.setItem(INTRO_SHOWN_KEY, "true");
    setShowIntro(false);
  }, []);

  const IntroScreen = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
        >
          <Brain className="w-10 h-10 text-primary" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 mb-6"
        >
          <h1 className="text-2xl font-bold">发现你的社交角色</h1>
          <p className="text-muted-foreground max-w-sm">
            12种社交动物原型等你揭晓，帮你匹配聊得来的同桌
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-sm space-y-3 mb-6"
        >
          <p className="text-sm text-muted-foreground mb-2">选择你喜欢的测试方式</p>
          
          <Card 
            className="p-4 border-2 border-primary/20 bg-primary/5 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={handleStartTest}
            data-testid="button-questionnaire-mode"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium">问卷模式</p>
                <p className="text-xs text-muted-foreground">12道情景题 · 约2分钟</p>
              </div>
              <Badge variant="secondary" className="text-xs">推荐</Badge>
            </div>
          </Card>

          <Card 
            className="p-4 border opacity-50 cursor-not-allowed"
            data-testid="button-chat-mode"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-muted-foreground">和小悦聊聊</p>
                <p className="text-xs text-muted-foreground">对话式测试 · 约3分钟</p>
              </div>
              <Badge variant="outline" className="text-xs">即将推出</Badge>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full max-w-sm space-y-3"
        >
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>精准匹配同桌，性格互补</span>
          </div>
          <p className="text-xs text-muted-foreground">
            没有对错之分，选择最符合你的选项
          </p>
        </motion.div>
      </div>
    </motion.div>
  );

  const ResumePrompt = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <Card className="max-w-sm w-full">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 mx-auto flex items-center justify-center"
          >
            <RotateCcw className="w-12 h-12 text-primary" />
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">发现未完成的测评</h3>
            <p className="text-muted-foreground text-sm">
              上次你完成到了第{cachedData?.currentQuestionIndex ? cachedData.currentQuestionIndex + 1 : 1}题，
              共{Object.keys(cachedData?.answers || {}).length}道已答
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleStartFresh}
              data-testid="button-start-fresh"
            >
              重新开始
            </Button>
            <Button
              className="flex-1"
              onClick={handleResumeProgress}
              data-testid="button-resume-progress"
            >
              继续答题
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // 当前显示的题目
  const currentQ = allQuestions[currentQuestionIndex];
  
  // 判断当前是否显示校准题
  const isShowingCalibration = calibrationQuestion && currentQ?.id === calibrationQuestion.id;
  
  // 进度计算 - 考虑低能量校准模式
  const effectiveQuestionNumber = lowEnergyCalibrationActive 
    ? allQuestions.length + lowEnergyQuestionIndex + 1 
    : currentQuestionIndex + 1;
  // Progress: Start at 8%, grow to 92% as questions are answered (never show 0% or 100% until complete)
  const progress = Math.min(92, Math.max(8, ((effectiveQuestionNumber - 1) / totalQuestions) * 100 + 8));

  const getProgressLabel = () => {
    if (lowEnergyCalibrationActive) return "静谧小屋 · 精准校准";
    if (isShowingCalibration) return "精准校准中";
    const baseIndex = calibrationInsertIndex !== null && currentQuestionIndex > calibrationInsertIndex
      ? currentQuestionIndex - 1
      : currentQuestionIndex;
    if (baseIndex < 3) return "探索社交DNA";
    if (baseIndex < 6) return "解析性格密码";
    if (baseIndex < 9) return "绘制人格图谱";
    return "即将揭晓结果";
  };

  const getEncouragementMessage = () => {
    // 低能量校准模式
    if (lowEnergyCalibrationActive) {
      const remaining = lowEnergyQuestions.length - lowEnergyQuestionIndex - 1;
      if (remaining === 0) return "最后一道校准题，马上揭晓结果！";
      return `还有${remaining}道题就能获得更精准的结果～`;
    }
    
    const remainingBase = calibrationQuestion 
      ? (totalQuestions - 1) - currentQuestionIndex
      : totalQuestions - currentQuestionIndex - 1;
    
    if (isShowingCalibration) {
      return "这道题能让匹配更精准哦～";
    }
    
    if (remainingBase === 0) {
      return "最后一题啦，加油！";
    }
    
    if (remainingBase <= 2) {
      return `还剩${remainingBase}题就能解锁你的社交动物啦！`;
    }
    
    if (remainingBase <= 5) {
      return `离解锁社交人格还有${remainingBase}步～`;
    }
    
    const messages = [
      "每一题都在帮你找到更合拍的朋友",
      "选择没有对错，做真实的自己就好",
      "你的每个选择都很有意思～",
    ];
    return messages[currentQuestionIndex % messages.length];
  };

  // 计算实际的最后一题 - 需要考虑低能量校准
  const isLastBaseQuestion = currentQuestionIndex === allQuestions.length - 1 && !lowEnergyCalibrationActive;
  const isLastLowEnergyQuestion = lowEnergyCalibrationActive && lowEnergyQuestionIndex === lowEnergyQuestions.length - 1;
  const isLastQuestion = lowEnergyCalibrationActive ? isLastLowEnergyQuestion : isLastBaseQuestion;

  // 低能量校准题选择处理
  const handleLowEnergyChoice = (value: string, traitScores: TraitScores) => {
    const questionId = currentLowEnergyQuestion?.id;
    if (questionId) {
      // 存储到主answers中，submitWithCalibration会处理ID 201-203的分数合并
      setAnswers({
        ...answers,
        [questionId]: { type: "single", value, traitScores },
      });
    }
  };

  const handleSingleChoice = (value: string, traitScores: TraitScores) => {
    // 所有答案统一存储到answers中（包括校准题）
    setAnswers({
      ...answers,
      [currentQ.id]: { type: "single", value, traitScores },
    });
  };

  const handleDualChoice = (
    selectionType: "most" | "second",
    value: string,
    traitScores: TraitScores
  ) => {
    const current = answers[currentQ.id] || { type: "dual" };
    const updated: AnswerV2 = {
      type: "dual",
      mostLike: selectionType === "most" ? value : current.mostLike,
      secondLike: selectionType === "second" ? value : current.secondLike,
      traitScores: selectionType === "most" ? traitScores : (current.traitScores || {}),
      secondTraitScores: selectionType === "second" ? traitScores : current.secondTraitScores,
    };
    setAnswers({ ...answers, [currentQ.id]: updated });
  };

  const canProceed = () => {
    // 低能量校准模式
    if (lowEnergyCalibrationActive && currentLowEnergyQuestion) {
      const answer = answers[currentLowEnergyQuestion.id];
      return !!answer?.value;
    }
    
    // 普通模式
    const answer = answers[currentQ?.id];
    if (!answer) return false;

    if (currentQ.questionType === "single") {
      return !!answer.value;
    } else {
      return (
        !!answer.mostLike &&
        !!answer.secondLike &&
        answer.mostLike !== answer.secondLike
      );
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;

    // ========== 低能量校准模式 ==========
    if (lowEnergyCalibrationActive) {
      if (isLastLowEnergyQuestion) {
        // 所有低能量校准题完成，准备提交
        setShowBlindBox(true);
        submitWithCalibration();
      } else {
        // 进入下一道低能量校准题
        setLowEnergyQuestionIndex(lowEnergyQuestionIndex + 1);
      }
      return;
    }

    // ========== 基础题完成后检测低能量校准 ==========
    if (isLastBaseQuestion) {
      // 先计算初步匹配结果
      const traitScoresArray: TraitScores[] = [];
      Object.values(answers).forEach(answer => {
        if (answer.traitScores) traitScoresArray.push(answer.traitScores);
        if (answer.secondTraitScores) traitScoresArray.push(answer.secondTraitScores);
      });
      
      const preliminaryResult = evaluatePersonality(traitScoresArray);
      const primaryArchetype = preliminaryResult.primaryMatch.archetype;
      const primaryScore = preliminaryResult.primaryMatch.similarity;
      const secondaryScore = preliminaryResult.secondaryMatch.similarity;
      
      // V6.8 检测是否需要低能量原型校准
      const needsLowEnergyCalibration = shouldTriggerLowEnergyCalibration(
        primaryArchetype,
        primaryScore,
        secondaryScore
      );
      
      console.log('📊 低能量校准检测:', {
        primaryArchetype,
        primaryScore: (primaryScore * 100).toFixed(2) + '%',
        secondaryScore: (secondaryScore * 100).toFixed(2) + '%',
        scoreDiff: ((primaryScore - secondaryScore) * 100).toFixed(2) + '%',
        triggered: needsLowEnergyCalibration
      });
      
      if (needsLowEnergyCalibration) {
        // 激活低能量校准流程
        setLowEnergyCalibrationActive(true);
        setLowEnergyQuestionIndex(0);
        // 显示过渡提示
        setShowMilestone(true);
        setTimeout(() => {
          setShowMilestone(false);
        }, 2500);
        return;
      }
      
      // 不需要低能量校准，直接提交
      setShowBlindBox(true);
      submitWithCalibration();
      return;
    }

    // ========== 常规题目流程 ==========
    // Q6完成后（索引5）检测是否需要V7.2弱信号校准 - 仅执行一次
    if (currentQuestionIndex === 5 && !calibrationChecked) {
      setCalibrationChecked(true); // 标记已检测
      
      // 转换answers格式用于校准检测（只使用基础题1-6的答案）
      const answersForCalibration: Record<number, { traitScores: TraitScores; secondTraitScores?: TraitScores }> = {};
      Object.entries(answers).forEach(([id, answer]) => {
        const qId = parseInt(id);
        if (qId <= 6) { // 只用Q1-Q6的答案检测
          answersForCalibration[qId] = {
            traitScores: answer.traitScores,
            secondTraitScores: answer.secondTraitScores,
          };
        }
      });
      
      const calibration = getCalibrationQuestion(answersForCalibration);
      if (calibration) {
        // 设置校准题，插入到索引6位置
        setCalibrationQuestion(calibration);
        setCalibrationInsertIndex(6);
        // 显示milestone后进入校准题
        setShowMilestone(true);
        setTimeout(() => {
          setShowMilestone(false);
          setCurrentQuestionIndex(6); // 校准题位于索引6
        }, 2500);
        return;
      }
    }
    
    // 在索引5显示milestone（无论是否有校准题）
    if (currentQuestionIndex === 5 && !showMilestone) {
      setShowMilestone(true);
      setTimeout(() => {
        setShowMilestone(false);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }, 2500);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  // 提交答案（合并所有校准分数）
  const submitWithCalibration = () => {
    // 提交时只发送基础题答案（ID 1-12），后端只识别这些ID
    // 校准题特质分数需要合并到基础答案中
    const baseAnswers: Record<number, AnswerV2> = {};
    let v72CalibrationScores: TraitScores = {};  // V7.2 弱信号校准分数
    let lowEnergyCalibrationScores: TraitScores = {};  // V6.8 低能量校准分数
    
    for (const [id, answer] of Object.entries(answers)) {
      const qId = parseInt(id);
      if (qId >= 1 && qId <= 12) {
        baseAnswers[qId] = answer;
      } else if (qId >= 101 && qId <= 106) {
        // V7.2 弱信号校准答案
        v72CalibrationScores = answer.traitScores;
      } else if (qId >= 201 && qId <= 203) {
        // V6.8 低能量校准答案 - 累加
        Object.entries(answer.traitScores).forEach(([trait, score]) => {
          const t = trait as keyof TraitScores;
          lowEnergyCalibrationScores[t] = (lowEnergyCalibrationScores[t] ?? 0) + (score ?? 0);
        });
      }
    }
    
    // 合并所有校准分数到Q12（支持单选和双选两种结构）
    const hasCalibrationScores = Object.keys(v72CalibrationScores).length > 0 || 
                                  Object.keys(lowEnergyCalibrationScores).length > 0;
    
    if (hasCalibrationScores && baseAnswers[12]?.traitScores) {
      const q12Answer = baseAnswers[12];
      const q12Scores = q12Answer.traitScores;
      
      // 计算校准增量（V7.2权重减半，V6.8全权重）
      const calDelta: TraitScores = {
        A: Math.round(((v72CalibrationScores.A ?? 0) / 2) + (lowEnergyCalibrationScores.A ?? 0)),
        O: Math.round(((v72CalibrationScores.O ?? 0) / 2) + (lowEnergyCalibrationScores.O ?? 0)),
        C: Math.round(((v72CalibrationScores.C ?? 0) / 2) + (lowEnergyCalibrationScores.C ?? 0)),
        E: Math.round(((v72CalibrationScores.E ?? 0) / 2) + (lowEnergyCalibrationScores.E ?? 0)),
        X: Math.round(((v72CalibrationScores.X ?? 0) / 2) + (lowEnergyCalibrationScores.X ?? 0)),
        P: Math.round(((v72CalibrationScores.P ?? 0) / 2) + (lowEnergyCalibrationScores.P ?? 0)),
      };
      
      console.log('🔧 校准分数合并:', { v72CalibrationScores, lowEnergyCalibrationScores, calDelta });
      
      // 创建合并后的traitScores
      const mergedTraitScores = {
        ...q12Scores,
        A: (q12Scores.A ?? 0) + (calDelta.A ?? 0),
        O: (q12Scores.O ?? 0) + (calDelta.O ?? 0),
        C: (q12Scores.C ?? 0) + (calDelta.C ?? 0),
        E: (q12Scores.E ?? 0) + (calDelta.E ?? 0),
        X: (q12Scores.X ?? 0) + (calDelta.X ?? 0),
        P: (q12Scores.P ?? 0) + (calDelta.P ?? 0),
      };
      
      // 如果有secondTraitScores（双选题），也应用同样的校准增量
      let mergedSecondTraitScores = q12Answer.secondTraitScores;
      if (q12Answer.secondTraitScores) {
        const secondScores = q12Answer.secondTraitScores;
        mergedSecondTraitScores = {
          ...secondScores,
          A: (secondScores.A ?? 0) + (calDelta.A ?? 0),
          O: (secondScores.O ?? 0) + (calDelta.O ?? 0),
          C: (secondScores.C ?? 0) + (calDelta.C ?? 0),
          E: (secondScores.E ?? 0) + (calDelta.E ?? 0),
          X: (secondScores.X ?? 0) + (calDelta.X ?? 0),
          P: (secondScores.P ?? 0) + (calDelta.P ?? 0),
        };
      }
      
      // 完整保留Q12的所有其他属性
      baseAnswers[12] = {
        ...q12Answer,
        traitScores: mergedTraitScores,
        ...(mergedSecondTraitScores && { secondTraitScores: mergedSecondTraitScores }),
      };
    }
    
    console.log('📤 提交答案:', {
      baseAnswersCount: Object.keys(baseAnswers).length,
      hasV72Calibration: Object.keys(v72CalibrationScores).length > 0,
      hasLowEnergyCalibration: Object.keys(lowEnergyCalibrationScores).length > 0,
    });
    
    submitTestMutation.mutate(baseAnswers);
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const BlindBoxReveal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0.5, rotateY: 0 }}
          animate={{
            scale: [0.5, 1.1, 1],
            rotateY: [0, 180, 360],
          }}
          transition={{
            duration: 1.5, // 优化：从2秒减少到1.5秒
            times: [0, 0.5, 1],
            ease: "easeInOut",
          }}
          className="w-24 h-24 mx-auto flex items-center justify-center"
        >
          <Gift className="w-20 h-20 text-primary" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }} // 优化：从1.5秒减少到1秒
          className="space-y-2"
        >
          <h2 className="text-2xl font-bold">正在揭晓你的社交角色...</h2>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            即将发现真实的你
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: 1.5, duration: 0.4 }} // 优化：从2秒/0.5秒减少到1.5秒/0.4秒
          className="flex justify-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -10, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );

  const MilestoneCard = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    >
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 0.6 }}
            className="w-16 h-16 mx-auto flex items-center justify-center"
          >
            <Star className="w-12 h-12 text-amber-500" />
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">有意思！</h3>
            <p className="text-muted-foreground">
              我们已经发现了你的一个隐藏特质...
            </p>
            <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
              <PartyPopper className="w-4 h-4" />
              继续答题揭晓完整的社交画像
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="mobile-page bg-background">
      <AnimatePresence>{showIntro && !showResumePrompt && <IntroScreen />}</AnimatePresence>
      <AnimatePresence>{showResumePrompt && <ResumePrompt />}</AnimatePresence>
      <AnimatePresence>{showBlindBox && <BlindBoxReveal />}</AnimatePresence>
      <AnimatePresence>{showMilestone && <MilestoneCard />}</AnimatePresence>

      {/* 顶部导航 - 匹配 onboarding 样式 */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {currentQuestionIndex > 0 && !lowEnergyCalibrationActive ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="shrink-0 -ml-2"
                data-testid="button-back-top"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            ) : (
              <div className="w-9 shrink-0" />
            )}
            <Progress value={progress} className="flex-1 h-1.5" />
            <span className="text-sm font-medium text-muted-foreground shrink-0 min-w-[3rem] text-right">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-3">
        <div className="max-w-2xl mx-auto flex-1 flex flex-col w-full">
          {/* ========== 低能量校准模式渲染 ========== */}
          {lowEnergyCalibrationActive && currentLowEnergyQuestion ? (
            <div className="flex-1 flex flex-col">
              <motion.div
                key={`low-energy-${lowEnergyQuestionIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2"
              >
                <div className="flex items-center gap-2 text-sm text-primary mb-2">
                  <Star className="w-4 h-4" />
                  <span>{currentLowEnergyQuestion.category}</span>
                  <Badge variant="outline" className="text-xs">精准校准</Badge>
                </div>
                <p className="text-lg text-foreground/80 mb-2 leading-relaxed font-medium">
                  {currentLowEnergyQuestion.scenarioText}
                </p>
                <h2 className="sr-only">{currentLowEnergyQuestion.questionText}</h2>
                <XiaoyueMascot 
                  mood="normal"
                  message={currentLowEnergyQuestion.questionText}
                  horizontal
                />
              </motion.div>

              <div className="flex-1 flex flex-col justify-center">
                <SelectionList
                  options={currentLowEnergyQuestion.options.map(opt => ({
                    value: opt.value,
                    label: opt.text,
                    tag: opt.tag,
                  }))}
                  selected={answers[currentLowEnergyQuestion.id]?.value}
                  onSelect={(value) => {
                    const option = currentLowEnergyQuestion.options.find(o => o.value === value);
                    if (option) {
                      handleLowEnergyChoice(option.value, option.traitScores);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            /* ========== 普通题目渲染 (Onboarding-style UI) ========== */
            <div className="flex-1 flex flex-col">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <div className="mb-2">
              <p className="text-lg text-foreground/80 mb-2 leading-relaxed font-medium">
                {stripEmoji(currentQ.scenarioText)}
              </p>
              <XiaoyueMascot 
                mood="normal"
                message={currentQ.questionText}
                horizontal
              />
            </div>

            {currentQ.questionType === "single" ? (
              <SelectionList
                options={currentQ.options.map(opt => ({
                  value: opt.value,
                  label: opt.text,
                  tag: opt.tag,
                }))}
                selected={answers[currentQ.id]?.value}
                onSelect={(value) => {
                  const option = currentQ.options.find(o => o.value === value);
                  if (option) {
                    handleSingleChoice(option.value, option.traitScores);
                  }
                }}
              />
            ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">最像我的（主选）</div>
                <div className="options-compact">
                  {currentQ.options.map((option) => {
                    const isSelected =
                      answers[currentQ.id]?.mostLike === option.value;
                    const isDisabled =
                      answers[currentQ.id]?.secondLike === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          !isDisabled &&
                          handleDualChoice("most", option.value, option.traitScores)
                        }
                        disabled={isDisabled}
                        className={`option-compact ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "selected"
                            : ""
                        }`}
                        data-testid={`button-q${currentQ.id}-most-${option.value}`}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <span className="font-semibold shrink-0 text-muted-foreground">{option.value}.</span>
                          <span className="flex-1">{option.text}</span>
                          {isSelected && (
                            <span className="text-primary font-bold shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {option.tag && (
                          <div className="flex justify-end w-full">
                            <Badge 
                              variant={isSelected ? "default" : "secondary"} 
                              className="text-xs px-1.5 py-0"
                            >
                              {option.tag}
                            </Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">其次像我的（副选）</div>
                <div className="options-compact">
                  {currentQ.options.map((option) => {
                    const isSelected =
                      answers[currentQ.id]?.secondLike === option.value;
                    const isDisabled =
                      answers[currentQ.id]?.mostLike === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          !isDisabled &&
                          handleDualChoice(
                            "second",
                            option.value,
                            option.traitScores
                          )
                        }
                        disabled={isDisabled}
                        className={`option-compact ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "selected"
                            : ""
                        }`}
                        data-testid={`button-q${currentQ.id}-second-${option.value}`}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <span className="font-semibold shrink-0 text-muted-foreground">{option.value}.</span>
                          <span className="flex-1">{option.text}</span>
                          {isSelected && (
                            <span className="text-primary font-bold shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {option.tag && (
                          <div className="flex justify-end w-full">
                            <Badge 
                              variant={isSelected ? "default" : "secondary"} 
                              className="text-xs px-1.5 py-0"
                            >
                              {option.tag}
                            </Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </motion.div>
          </div>
          )}
        </div>

        <div className="py-3 mt-auto">
          <Button
            onClick={handleNext}
            disabled={!canProceed() || submitTestMutation.isPending}
            className="w-full h-14 text-lg rounded-2xl"
            size="lg"
            data-testid="button-next"
          >
            {isLastQuestion ? (
              submitTestMutation.isPending ? (
                "提交中..."
              ) : (
                "完成测试"
              )
            ) : (
              "继续"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
