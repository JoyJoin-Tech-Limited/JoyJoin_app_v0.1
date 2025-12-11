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
import { getCalibrationQuestion } from "@/data/adaptiveCalibrationQuestions";
import RegistrationProgress from "@/components/RegistrationProgress";
import CelebrationConfetti from "@/components/CelebrationConfetti";

const PERSONALITY_TEST_CACHE_KEY = "joyjoin_personality_test_progress";
const CACHE_EXPIRY_DAYS = 7;

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
  timestamp: number;
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

const INTRO_SHOWN_KEY = "joyjoin_personality_intro_shown";

export default function PersonalityTestPage() {
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
  
  // Load cached progress on mount
  useEffect(() => {
    const cached = loadCachedProgress();
    if (cached && cached.currentQuestionIndex > 0) {
      setCachedData(cached);
      setShowResumePrompt(true);
    }
  }, []);
  
  // Save progress whenever answers or currentQuestionIndex change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveCachedProgress({
        currentQuestionIndex,
        answers,
        calibrationChecked,
      });
    }
  }, [currentQuestionIndex, answers, calibrationChecked]);
  
  const handleResumeProgress = useCallback(() => {
    if (cachedData) {
      setCurrentQuestionIndex(cachedData.currentQuestionIndex);
      setAnswers(cachedData.answers);
      setCalibrationChecked(cachedData.calibrationChecked);
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

  const totalQuestions = allQuestions.length;

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
        setLocation(`/personality-test/results`);
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
          className="space-y-3 mb-8"
        >
          <h1 className="text-2xl font-bold">发现你的社交角色</h1>
          <p className="text-muted-foreground max-w-sm">
            通过12道情景题，小悦将为你匹配聊得来的同桌
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-sm space-y-3 mb-8"
        >
          <Card className="p-4 border-0 bg-muted/50">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">约2分钟</p>
                <p className="text-xs text-muted-foreground">轻松完成，可随时暂停</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-0 bg-muted/50">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">精准匹配同桌</p>
                <p className="text-xs text-muted-foreground">性格互补，兴趣相投</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-0 bg-muted/50">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">解锁专属角色</p>
                <p className="text-xs text-muted-foreground">12种社交动物原型等你揭晓</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full max-w-sm"
        >
          <Button 
            onClick={handleStartTest} 
            className="w-full" 
            size="lg"
            data-testid="button-start-personality-test"
          >
            开始测试
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
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
  
  // 进度计算
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const getProgressLabel = () => {
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

  // 计算实际的最后一题
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

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

    if (isLastQuestion) {
      setShowBlindBox(true);
      // 提交时只发送基础题答案（ID 1-12），后端只识别这些ID
      // 校准题（ID 101-106）的特质分数需要合并到基础答案中
      const baseAnswers: Record<number, AnswerV2> = {};
      let calibrationAnswer: AnswerV2 | undefined = undefined;
      
      for (const [id, answer] of Object.entries(answers)) {
        const qId = parseInt(id);
        if (qId >= 1 && qId <= 12) {
          baseAnswers[qId] = answer;
        } else if (qId >= 101 && qId <= 106) {
          // 保存校准题答案用于合并
          calibrationAnswer = answer;
        }
      }
      
      // 将校准题的特质分数合并到Q12的答案中（确保对最终结果有影响）
      // 只有当校准题和Q12都有有效完整答案时才合并
      // 验证Q12保留双选结构（mostLike, secondLike都存在）
      const q12HasDualStructure = baseAnswers[12]?.mostLike && baseAnswers[12]?.secondLike;
      if (calibrationAnswer && calibrationAnswer.traitScores && baseAnswers[12]?.traitScores && q12HasDualStructure) {
        const q12Answer = baseAnswers[12];
        const calScores = calibrationAnswer.traitScores;
        const q12Scores = q12Answer.traitScores;
        
        // 计算校准增量（校准分数的一半）
        const calDelta = {
          A: Math.round((calScores.A ?? 0) / 2),
          O: Math.round((calScores.O ?? 0) / 2),
          C: Math.round((calScores.C ?? 0) / 2),
          E: Math.round((calScores.E ?? 0) / 2),
          X: Math.round((calScores.X ?? 0) / 2),
          P: Math.round((calScores.P ?? 0) / 2),
        };
        
        // 创建合并后的traitScores
        const mergedTraitScores = {
          ...q12Scores,
          A: (q12Scores.A ?? 0) + calDelta.A,
          O: (q12Scores.O ?? 0) + calDelta.O,
          C: (q12Scores.C ?? 0) + calDelta.C,
          E: (q12Scores.E ?? 0) + calDelta.E,
          X: (q12Scores.X ?? 0) + calDelta.X,
          P: (q12Scores.P ?? 0) + calDelta.P,
        };
        
        // 如果有secondTraitScores，也应用同样的校准增量以保持一致性
        let mergedSecondTraitScores = q12Answer.secondTraitScores;
        if (q12Answer.secondTraitScores) {
          const secondScores = q12Answer.secondTraitScores;
          mergedSecondTraitScores = {
            ...secondScores,
            A: (secondScores.A ?? 0) + calDelta.A,
            O: (secondScores.O ?? 0) + calDelta.O,
            C: (secondScores.C ?? 0) + calDelta.C,
            E: (secondScores.E ?? 0) + calDelta.E,
            X: (secondScores.X ?? 0) + calDelta.X,
            P: (secondScores.P ?? 0) + calDelta.P,
          };
        }
        
        // 完整保留Q12的所有其他属性（mostLike, secondLike等）
        baseAnswers[12] = {
          ...q12Answer,
          traitScores: mergedTraitScores,
          ...(mergedSecondTraitScores && { secondTraitScores: mergedSecondTraitScores }),
        };
      }
      
      submitTestMutation.mutate(baseAnswers);
    } else {
      // Q6完成后（索引5）检测是否需要校准 - 仅执行一次
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
    }
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
    <div className="min-h-screen bg-background flex flex-col">
      <RegistrationProgress 
        currentStage="personality" 
        currentStep={currentQuestionIndex + 1}
        totalSteps={totalQuestions}
      />
      
      <AnimatePresence>{showIntro && !showResumePrompt && <IntroScreen />}</AnimatePresence>
      <AnimatePresence>{showResumePrompt && <ResumePrompt />}</AnimatePresence>
      <AnimatePresence>{showBlindBox && <BlindBoxReveal />}</AnimatePresence>
      <AnimatePresence>{showMilestone && <MilestoneCard />}</AnimatePresence>

      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">趣味性格测评</h1>
            {Object.keys(answers).length > 0 && (
              <MiniRadarChart
                progress={progress}
                answeredQuestions={Object.keys(answers).length}
                totalQuestions={totalQuestions}
              />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {currentQuestionIndex + 1}/{totalQuestions}
          </span>
        </div>
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              {getProgressLabel()}
            </span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* Encouragement message with animation */}
        <motion.div
          key={getEncouragementMessage()}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center gap-2 mt-2 text-sm text-primary/80"
        >
          <Sparkles className="w-4 h-4" />
          <span>{getEncouragementMessage()}</span>
        </motion.div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-sm text-muted-foreground mb-2">
              {currentQ.category}
            </div>
            <p className="text-sm text-muted-foreground mb-3 italic leading-relaxed">
              {currentQ.scenarioText}
            </p>
            <h2 className="text-xl font-bold mb-6">{currentQ.questionText}</h2>
          </motion.div>

          {currentQ.questionType === "single" ? (
            <div className="space-y-3">
              {currentQ.options.map((option) => {
                const isSelected = answers[currentQ.id]?.value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      handleSingleChoice(option.value, option.traitScores)
                    }
                    className={`
                      w-full px-4 py-4 text-left rounded-lg border-2 transition-all text-base flex flex-col gap-2
                      ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover-elevate active-elevate-2"
                      }
                    `}
                    data-testid={`button-q${currentQ.id}-${option.value}`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <span className="font-semibold shrink-0">{option.value}.</span>
                      <span className="flex-1">{option.text}</span>
                      {isSelected && (
                        <span className="text-primary font-bold shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    {option.tag && (
                      <div className="flex justify-end w-full">
                        <Badge 
                          variant={isSelected ? "default" : "secondary"} 
                          className="text-xs px-2 py-0.5"
                        >
                          {option.tag}
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium mb-3">最像我的（主选）</div>
                <div className="space-y-3">
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
                        className={`
                          w-full px-4 py-4 text-left rounded-lg border-2 transition-all text-base flex flex-col gap-2
                          ${
                            isDisabled
                              ? "opacity-50 cursor-not-allowed border-border"
                              : isSelected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border hover-elevate active-elevate-2"
                          }
                        `}
                        data-testid={`button-q${currentQ.id}-most-${option.value}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <span className="font-semibold shrink-0">{option.value}.</span>
                          <span className="flex-1">{option.text}</span>
                          {isSelected && (
                            <span className="text-primary font-bold shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        {option.tag && (
                          <div className="flex justify-end w-full">
                            <Badge 
                              variant={isSelected ? "default" : "secondary"} 
                              className="text-xs px-2 py-0.5"
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
                <div className="text-sm font-medium mb-3">其次像我的（副选）</div>
                <div className="space-y-3">
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
                        className={`
                          w-full px-4 py-4 text-left rounded-lg border-2 transition-all text-base flex flex-col gap-2
                          ${
                            isDisabled
                              ? "opacity-50 cursor-not-allowed border-border"
                              : isSelected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border hover-elevate active-elevate-2"
                          }
                        `}
                        data-testid={`button-q${currentQ.id}-second-${option.value}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <span className="font-semibold shrink-0">{option.value}.</span>
                          <span className="flex-1">{option.text}</span>
                          {isSelected && (
                            <span className="text-primary font-bold shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        {option.tag && (
                          <div className="flex justify-end w-full">
                            <Badge 
                              variant={isSelected ? "default" : "secondary"} 
                              className="text-xs px-2 py-0.5"
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
        </div>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentQuestionIndex === 0}
            className="flex-1"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            上一题
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || submitTestMutation.isPending}
            className="flex-1"
            data-testid="button-next"
          >
            {isLastQuestion ? (
              submitTestMutation.isPending ? (
                "提交中..."
              ) : (
                "完成测试"
              )
            ) : (
              <>
                下一题
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
