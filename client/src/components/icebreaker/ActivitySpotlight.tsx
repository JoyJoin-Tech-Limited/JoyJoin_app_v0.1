import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Users,
  Sparkles,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Wine,
  Utensils,
  Globe,
  Zap,
  Palette,
  Heart,
  Target,
  MessageCircle,
} from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import type { IcebreakerGame } from '@shared/icebreakerGames';

interface ActivitySpotlightProps {
  open: boolean;
  onClose: () => void;
  item: {
    type: 'topic' | 'game';
    data: TopicCard | IcebreakerGame;
  } | null;
  participantCount: number;
  onFeedback?: (rating: 'good' | 'neutral' | 'bad') => void;
  onNextRecommendation?: () => void;
}

const COUNTDOWN_DURATION = 180;
const TIP_INTERVAL = 60;
const READY_COUNTDOWN = 5;

const xiaoYueTips = [
  '聊得怎么样？记得让每个人都有机会分享哦～',
  '如果有人比较安静，可以主动邀请TA发言～',
  '快结束啦！可以问问大家有什么新发现～',
];

const sceneIcons = {
  dinner: Utensils,
  bar: Wine,
  both: Globe,
};

const categoryIcons = {
  quick: Zap,
  creative: Palette,
  deep: Heart,
  active: Target,
};

const sceneLabels = {
  dinner: '饭局',
  bar: '酒局',
  both: '通用',
};

const difficultyLabels = {
  easy: '轻松',
  medium: '适中',
  hard: '有挑战',
  deep: '深度',
};

const gradients = {
  topic: 'from-purple-600 via-purple-500 to-pink-500',
  scene: {
    dinner: 'from-amber-500 via-orange-400 to-yellow-500',
    bar: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    both: 'from-purple-600 via-violet-500 to-pink-500',
  },
};

export function ActivitySpotlight({
  open,
  onClose,
  item,
  participantCount,
  onFeedback,
  onNextRecommendation,
}: ActivitySpotlightProps) {
  const [phase, setPhase] = useState<'ready' | 'active' | 'ended'>('ready');
  const [countdown, setCountdown] = useState(READY_COUNTDOWN);
  const [timeRemaining, setTimeRemaining] = useState(COUNTDOWN_DURATION);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(-1);
  const [showTip, setShowTip] = useState(false);
  
  const tipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTipTimeout = useCallback(() => {
    if (tipTimeoutRef.current) {
      clearTimeout(tipTimeoutRef.current);
      tipTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase('ready');
      setCountdown(READY_COUNTDOWN);
      setTimeRemaining(COUNTDOWN_DURATION);
      setIsPaused(false);
      setCurrentTipIndex(-1);
      setShowTip(false);
      clearTipTimeout();
    }
  }, [open, clearTipTimeout]);

  useEffect(() => {
    return () => {
      clearTipTimeout();
    };
  }, [clearTipTimeout]);

  useEffect(() => {
    if (!open || phase !== 'ready') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('active');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, phase]);

  useEffect(() => {
    if (!open || phase !== 'active' || isPaused) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('ended');
          return 0;
        }
        
        const elapsed = COUNTDOWN_DURATION - prev + 1;
        const tipIndex = Math.floor(elapsed / TIP_INTERVAL) - 1;
        
        if (tipIndex >= 0 && tipIndex < xiaoYueTips.length && tipIndex !== currentTipIndex) {
          setCurrentTipIndex(tipIndex);
          setShowTip(true);
          
          clearTipTimeout();
          tipTimeoutRef.current = setTimeout(() => {
            setShowTip(false);
          }, 5000);
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, phase, isPaused, currentTipIndex, clearTipTimeout]);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    clearTipTimeout();
    setTimeRemaining(COUNTDOWN_DURATION);
    setCurrentTipIndex(-1);
    setShowTip(false);
    setIsPaused(false);
  }, [clearTipTimeout]);

  const handleSkipToEnd = useCallback(() => {
    clearTipTimeout();
    setPhase('ended');
  }, [clearTipTimeout]);

  const handleFeedbackClick = useCallback((rating: 'good' | 'neutral' | 'bad') => {
    if (onFeedback) {
      onFeedback(rating);
    }
  }, [onFeedback]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!item) return null;

  const isGame = item.type === 'game';
  const game = isGame ? (item.data as IcebreakerGame) : null;
  const topic = !isGame ? (item.data as TopicCard) : null;

  const gradient = isGame && game
    ? gradients.scene[game.scene]
    : gradients.topic;

  const SceneIcon = isGame && game ? sceneIcons[game.scene] : MessageCircle;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col"
          data-testid="activity-spotlight"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
          
          <div className="relative flex-1 flex flex-col p-4 pt-safe pb-safe overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
                data-testid="button-close-spotlight"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Badge className="bg-white/30 text-white border-0" data-testid="badge-type">
                {isGame ? '游戏' : '话题'}
              </Badge>
              
              <Badge className="bg-white/30 text-white border-0 flex items-center gap-1" data-testid="badge-participants">
                <Users className="w-3 h-3" />
                {participantCount}人
              </Badge>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
              {phase === 'ready' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-white/30 flex items-center justify-center mx-auto">
                    <span className="text-5xl font-bold text-white">{countdown}</span>
                  </div>
                  <p className="text-white/80 text-lg">准备开始...</p>
                  <h2 className="text-2xl font-bold text-white">
                    {isGame ? game?.name : topic?.question}
                  </h2>
                </motion.div>
              )}

              {phase === 'active' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full space-y-6"
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <SceneIcon className="w-10 h-10 text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {isGame ? game?.name : topic?.question}
                  </h2>
                  
                  <p className="text-white/80 text-base">
                    {isGame ? game?.description : topic?.targetDynamic}
                  </p>

                  {isGame && game?.rules && (
                    <div className="bg-white/20 rounded-xl p-4 text-left space-y-2 max-h-[30vh] overflow-y-auto">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        游戏规则
                      </h3>
                      <ol className="space-y-2">
                        {game.rules.map((rule, idx) => (
                          <li key={idx} className="text-white/90 text-sm flex items-start gap-2">
                            <span className="bg-white/30 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">
                              {idx + 1}
                            </span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ol>
                      {game.tips && game.tips.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <p className="text-white/70 text-xs">
                            小贴士：{game.tips[0]}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-4">
                    {isGame && game && (
                      <>
                        <Badge className="bg-white/30 text-white border-0 flex items-center gap-1">
                          <SceneIcon className="w-3 h-3" />
                          {sceneLabels[game.scene]}
                        </Badge>
                        <Badge className="bg-white/30 text-white border-0">
                          {difficultyLabels[game.difficulty]}
                        </Badge>
                      </>
                    )}
                    {!isGame && topic && (
                      <Badge className="bg-white/30 text-white border-0">
                        {difficultyLabels[topic.difficulty as keyof typeof difficultyLabels] || topic.difficulty}
                      </Badge>
                    )}
                  </div>

                  <div className="bg-white/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5 text-white" />
                      <span className="text-3xl font-bold text-white font-mono" data-testid="text-time-remaining">
                        {formatTime(timeRemaining)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePauseToggle}
                        className="text-white hover:bg-white/20 h-12 w-12"
                        data-testid="button-pause-toggle"
                      >
                        {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="text-white hover:bg-white/20 h-12 w-12"
                        data-testid="button-reset-timer"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      onClick={handleSkipToEnd}
                      className="text-white/70 hover:text-white hover:bg-white/10 text-sm"
                      data-testid="button-skip-to-end"
                    >
                      结束活动
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showTip && currentTipIndex >= 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white/25 backdrop-blur-sm rounded-xl p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            悦
                          </div>
                          <p className="text-white text-sm leading-relaxed">
                            {xiaoYueTips[currentTipIndex]}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isGame && game?.drinkingWarning && (
                    <div className="bg-amber-500/30 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <Wine className="w-4 h-4 text-amber-200 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-100 text-xs leading-relaxed">
                          {game.drinkingWarning}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {phase === 'ended' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full space-y-6"
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-white">活动结束啦！</h2>
                  <p className="text-white/80">这次破冰体验如何？</p>

                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="ghost"
                      onClick={() => handleFeedbackClick('good')}
                      className="flex flex-col items-center gap-2 text-white hover:bg-white/20 h-auto py-4 px-6"
                      data-testid="button-feedback-good"
                    >
                      <ThumbsUp className="w-8 h-8" />
                      <span className="text-sm">很棒</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleFeedbackClick('neutral')}
                      className="flex flex-col items-center gap-2 text-white hover:bg-white/20 h-auto py-4 px-6"
                      data-testid="button-feedback-neutral"
                    >
                      <Meh className="w-8 h-8" />
                      <span className="text-sm">一般</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleFeedbackClick('bad')}
                      className="flex flex-col items-center gap-2 text-white hover:bg-white/20 h-auto py-4 px-6"
                      data-testid="button-feedback-bad"
                    >
                      <ThumbsDown className="w-8 h-8" />
                      <span className="text-sm">不太好</span>
                    </Button>
                  </div>

                  <div className="space-y-3 pt-4">
                    {onNextRecommendation && (
                      <Button
                        onClick={onNextRecommendation}
                        className="w-full bg-white/30 hover:bg-white/40 text-white border-0"
                        data-testid="button-next-recommendation"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        换一个活动
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="w-full text-white/70 hover:text-white hover:bg-white/10"
                      data-testid="button-back-to-toolkit"
                    >
                      返回工具箱
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
