import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BubbleProgress } from "@/components/BubbleProgress";
import { X, ChevronLeft, ChevronRight, Sparkles, ThumbsUp, Users, Target } from "lucide-react";
import { useIcebreakerGame, type GameCard } from "@/hooks/useIcebreakerGame";
import { cn } from "@/lib/utils";

interface IcebreakerCardGameProps {
  sessionId?: string;
  eventId?: string;
  groupId?: string;
  onClose?: () => void;
}

const DIFFICULTY_CONFIG = {
  easy: {
    label: "聊着玩",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    glowColor: "shadow-emerald-500/30",
  },
  medium: {
    label: "有点意思",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-amber-500/30",
  },
  deep: {
    label: "走心聊",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/30",
  },
};

const CARD_TYPE_CONFIG = {
  question: {
    icon: Sparkles,
    label: "问题卡",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  vote: {
    icon: ThumbsUp,
    label: "投票卡",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  mission: {
    icon: Target,
    label: "任务卡",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
  },
};

export default function IcebreakerCardGame({
  sessionId: initialSessionId,
  eventId,
  groupId,
  onClose,
}: IcebreakerCardGameProps) {
  const {
    sessionId,
    progress,
    cards,
    currentCard,
    currentCardIndex,
    isLoading,
    initializeGame,
    startNewRound,
    nextCard,
    previousCard,
    goToCard,
    recordVote,
    recordSkip,
    getRoundTimeRemaining,
    hasNextCard,
    hasPreviousCard,
    totalCards,
  } = useIcebreakerGame({
    sessionId: initialSessionId,
    eventId,
    groupId,
    enabled: true,
  });

  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [showVoteResults, setShowVoteResults] = useState(false);
  const voteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId && (eventId || groupId)) {
      initializeGame();
    }
  }, [sessionId, eventId, groupId, initializeGame]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (voteTimeoutRef.current) {
        clearTimeout(voteTimeoutRef.current);
      }
    };
  }, []);

  const timeRemaining = getRoundTimeRemaining();

  const handleVote = async (optionId: string) => {
    if (!currentCard) return;
    
    // Clear any existing timeout
    if (voteTimeoutRef.current) {
      clearTimeout(voteTimeoutRef.current);
    }
    
    setUserVotes(prev => ({ ...prev, [currentCard.id]: optionId }));
    await recordVote(currentCard.id, optionId);
    setShowVoteResults(true);
    
    // Auto-advance after 2 seconds with cleanup
    voteTimeoutRef.current = setTimeout(() => {
      setShowVoteResults(false);
      nextCard();
      voteTimeoutRef.current = null;
    }, 2000);
  };

  const handleSkip = async () => {
    if (!currentCard) return;
    await recordSkip(currentCard.id);
  };

  const renderCard = (card: GameCard) => {
    const difficultyConfig = DIFFICULTY_CONFIG[card.difficulty];
    const typeConfig = CARD_TYPE_CONFIG[card.cardType];
    const TypeIcon = typeConfig.icon;
    const isNewCard = !card.revealedAt; // Check if this is a newly revealed card

    return (
      <motion.div
        key={card.id}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        className="w-full max-w-md relative"
      >
        {/* Ambient glow effect for new cards */}
        {isNewCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0.3], scale: [0.8, 1.2, 1.1] }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute -inset-4 bg-gradient-to-r from-violet-400/20 via-purple-400/20 to-fuchsia-400/20 rounded-3xl blur-2xl pointer-events-none"
          />
        )}
        
        {/* Card with soft glow and thin border */}
        <div 
          className={cn(
            "bg-white dark:bg-gray-900 rounded-3xl p-6 relative",
            "border-2 border-transparent",
            "shadow-xl",
            difficultyConfig.glowColor,
            "transition-all duration-300",
            isNewCard && "animate-pulse-soft"
          )}
          style={{
            boxShadow: isNewCard 
              ? `0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(168, 85, 247, 0.2), 0 20px 25px -5px rgba(0, 0, 0, 0.1)`
              : undefined,
            borderImage: isNewCard 
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.5)) 1'
              : undefined,
          }}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TypeIcon className={cn("h-5 w-5", typeConfig.color)} />
              <Badge variant="secondary" className={cn("text-xs border-0", typeConfig.bgColor, typeConfig.color)}>
                {typeConfig.label}
              </Badge>
            </div>
            <Badge 
              variant="outline" 
              className={cn("text-xs", difficultyConfig.bgColor, difficultyConfig.color, difficultyConfig.borderColor)}
            >
              {difficultyConfig.label}
            </Badge>
          </div>

          {/* Card Content */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground leading-relaxed mb-3">
              {card.content}
            </h2>
            {card.hint && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span className="text-primary">💡</span>
                {card.hint}
              </p>
            )}
          </div>

          {/* AI Recommendation Reason */}
          {card.aiRecommendReason && (
            <div className="mb-6 rounded-2xl p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10">
              <div className="flex items-start gap-2 text-foreground/80">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{card.aiRecommendReason}</span>
              </div>
            </div>
          )}

          {/* Vote Options (if vote card) */}
          {card.cardType === 'vote' && card.voteOptions && (
            <div className="space-y-3 mb-6">
              {card.voteOptions.map((option) => {
                const hasVoted = userVotes[card.id] === option.id;
                const totalVotes = card.voteResults 
                  ? Object.values(card.voteResults).reduce((sum, count) => sum + count, 0) 
                  : 0;
                const optionVotes = card.voteResults?.[option.id] || 0;
                const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;

                return (
                  <Button
                    key={option.id}
                    variant={hasVoted ? "default" : "outline"}
                    className={cn(
                      "w-full h-auto min-h-[60px] text-left justify-start p-4 rounded-2xl transition-all",
                      hasVoted && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => !userVotes[card.id] && handleVote(option.id)}
                    disabled={!!userVotes[card.id]}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {option.emoji && <span className="text-2xl">{option.emoji}</span>}
                      <div className="flex-1">
                        <div className="font-medium text-base">{option.text}</div>
                        {showVoteResults && card.voteResults && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{optionVotes}票</span>
                              <span>{percentage.toFixed(0)}%</span>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Mission Card Info */}
          {card.cardType === 'mission' && (
            <div className="mb-6 p-4 bg-orange-500/10 rounded-2xl border border-orange-500/30">
              <div className="flex items-start gap-2">
                <Users className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-600">
                    {card.missionType === 'group_challenge' && '小组挑战'}
                    {card.missionType === 'pair_challenge' && '双人挑战'}
                    {card.missionType === 'individual_share' && '个人分享'}
                  </p>
                  {card.unlockCondition && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.unlockCondition}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-gray-200 dark:border-gray-800">
            <span>{card.category || '破冰话题'}</span>
            <div className="flex items-center gap-1">
              {card.isAiGenerated && (
                <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-purple-500/10 text-purple-600">
                  AI生成
                </Badge>
              )}
              <span>{currentCardIndex + 1} / {totalCards}</span>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={previousCard}
            disabled={!hasPreviousCard}
            className="flex-1 rounded-2xl h-14"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            上一张
          </Button>
          
          {card.cardType === 'question' && (
            <Button
              variant="ghost"
              size="lg"
              onClick={handleSkip}
              className="flex-1 rounded-2xl h-14"
            >
              跳过
            </Button>
          )}
          
          <Button
            variant="default"
            size="lg"
            onClick={nextCard}
            disabled={!hasNextCard}
            className="flex-1 rounded-2xl h-14"
          >
            下一张
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">准备破冰卡片...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-500 overflow-auto">
      {/* Background Particles */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-300/20 to-fuchsia-300/10 pointer-events-none" />

      <div className="relative z-10 min-h-[100dvh] flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-white text-lg font-semibold">
                破冰时刻 · 第{progress?.currentRound || 1}轮
              </h1>
              {timeRemaining && !timeRemaining.isExpired && (
                <p className="text-white/70 text-xs">
                  剩余 {timeRemaining.remainingMinutes} 分钟
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Round Progress Bar */}
        {timeRemaining && !timeRemaining.isExpired && progress && (
          <div className="mb-6">
            <BubbleProgress 
              value={timeRemaining.progress}
              totalRounds={progress.totalRounds}
              currentRound={progress.currentRound}
            />
          </div>
        )}

        {/* Card Display */}
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <AnimatePresence mode="wait">
            {currentCard && renderCard(currentCard)}
          </AnimatePresence>
        </div>

        {/* Card Indicators */}
        {cards.length > 0 && (
          <div className="flex justify-center gap-2 mb-4">
            {cards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToCard(idx)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  idx === currentCardIndex 
                    ? "w-8 bg-white" 
                    : "w-2 bg-white/30 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        )}

        {/* Round Navigation */}
        {progress && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white/20 hover:bg-white/30 text-white border-0 rounded-2xl"
              onClick={() => startNewRound((progress.currentRound || 1) + 1)}
              disabled={progress.currentRound >= progress.totalRounds}
            >
              {progress.currentRound >= progress.totalRounds ? '游戏结束' : '进入下一轮'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
