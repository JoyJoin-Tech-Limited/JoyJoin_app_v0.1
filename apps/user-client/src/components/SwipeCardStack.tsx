import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { Heart, X, Sparkles } from "lucide-react";
import { 
  InterestCard, 
  SwipeChoice, 
  SwipeResult,
  MacroCategory,
  MACRO_CATEGORY_LABELS,
  INTEREST_CARDS,
} from "@/data/interestCardsData";

interface SwipeCardStackProps {
  cards: InterestCard[];
  onSwipe: (result: SwipeResult) => void;
  onComplete: (results: SwipeResult[]) => void;
  xiaoyueMessage?: string;
  onXiaoyueMessageChange?: (message: string) => void;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

interface CategoryTracker {
  likeCount: Record<MacroCategory, number>;
  skipCount: Record<MacroCategory, number>;
  totalLikes: number;
  totalSkips: number;
}

function initCategoryTracker(): CategoryTracker {
  return {
    likeCount: { food: 0, entertainment: 0, lifestyle: 0, culture: 0, social: 0 },
    skipCount: { food: 0, entertainment: 0, lifestyle: 0, culture: 0, social: 0 },
    totalLikes: 0,
    totalSkips: 0,
  };
}

function getSmartXiaoyueMessage(
  tracker: CategoryTracker,
  currentCard: InterestCard,
  choice: SwipeChoice,
  progress: number,
  hesitant: boolean,
  likeStreak: number,
  skipStreak: number
): string | null {
  if (choice === 'love') {
    return "哇！这个你超喜欢的！";
  }

  if (hesitant) {
    return "慢慢想，不着急～";
  }

  const category = currentCard.macroCategory;
  const categoryLabel = MACRO_CATEGORY_LABELS[category];

  if (choice === 'like') {
    const categoryLikes = tracker.likeCount[category];
    if (categoryLikes === 2) {
      const insights: Record<MacroCategory, string> = {
        food: "看来你是个吃货～",
        entertainment: "你很会玩嘛！",
        lifestyle: "你热爱生活！",
        culture: "有点文艺范儿～",
        social: "你是话题达人！",
      };
      return insights[category];
    }
  }

  if (choice === 'skip') {
    if (skipStreak === 3) {
      return "没关系，继续找找你的菜～";
    }
    
    const categorySkips = tracker.skipCount[category];
    if (categorySkips === 3) {
      return `${categoryLabel}不是你的菜？没关系～`;
    }
  }

  if (likeStreak === 3) {
    return "看来你是个热爱生活的人！";
  }

  const exploredCount = Object.values(tracker.likeCount).filter(v => v > 0).length;
  if (exploredCount === 4 && tracker.totalLikes >= 6) {
    return `你已经探索了${exploredCount}个维度！`;
  }

  if (progress >= 0.9) {
    return "最后几张了！";
  } else if (progress >= 0.66) {
    return "快了快了！";
  } else if (progress >= 0.33 && tracker.totalLikes >= 3) {
    return "继续继续，我在认识你～";
  }

  return null;
}

function SwipeCard({
  card,
  isTop,
  onSwipe,
  cardStartTime,
}: {
  card: InterestCard;
  isTop: boolean;
  onSwipe: (choice: SwipeChoice, reactionTime: number) => void;
  cardStartTime: number;
}) {
  const controls = useAnimation();
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | 'up' | null>(null);

  const handleDragEnd = useCallback(
    async (_: any, info: PanInfo) => {
      const { offset, velocity } = info;
      const reactionTime = Date.now() - cardStartTime;

      if (offset.y < -SWIPE_THRESHOLD || velocity.y < -SWIPE_VELOCITY_THRESHOLD) {
        await controls.start({ y: -500, opacity: 0, scale: 0.8, transition: { duration: 0.3 } });
        onSwipe('love', reactionTime);
      } else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY_THRESHOLD) {
        await controls.start({ x: 500, opacity: 0, rotate: 20, transition: { duration: 0.3 } });
        onSwipe('like', reactionTime);
      } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
        await controls.start({ x: -500, opacity: 0, rotate: -20, transition: { duration: 0.3 } });
        onSwipe('skip', reactionTime);
      } else {
        controls.start({ x: 0, y: 0, rotate: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
      }
      setDragDirection(null);
    },
    [controls, onSwipe, cardStartTime]
  );

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    const { offset } = info;
    if (offset.y < -50) {
      setDragDirection('up');
    } else if (offset.x > 50) {
      setDragDirection('right');
    } else if (offset.x < -50) {
      setDragDirection('left');
    } else {
      setDragDirection(null);
    }
  }, []);

  return (
    <motion.div
      className={cn(
        "absolute inset-0 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing",
        !isTop && "pointer-events-none"
      )}
      style={{ touchAction: "none" }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={isTop ? { scale: 1 } : { scale: 0.95, y: 10 }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <div className="relative w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${card.imageUrl})`,
            filter: 'brightness(0.85)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
            {card.label}
          </h3>
        </div>

        {dragDirection === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-6 px-4 py-2 rounded-xl bg-green-500 text-white font-bold text-xl rotate-[-15deg] border-4 border-white shadow-lg"
          >
            喜欢
          </motion.div>
        )}

        {dragDirection === 'left' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-gray-500 text-white font-bold text-xl rotate-[15deg] border-4 border-white shadow-lg"
          >
            跳过
          </motion.div>
        )}

        {dragDirection === 'up' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-pink-500 text-white font-bold text-xl border-4 border-white shadow-lg flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            超爱
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function SwipeCardStack({
  cards,
  onSwipe,
  onComplete,
  onXiaoyueMessageChange,
}: SwipeCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [categoryTracker, setCategoryTracker] = useState<CategoryTracker>(initCategoryTracker);
  const cardStartTimeRef = useRef(Date.now());
  const likeStreakRef = useRef(0);
  const skipStreakRef = useRef(0);

  useEffect(() => {
    cardStartTimeRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    onXiaoyueMessageChange?.("滑动告诉我你喜欢什么吧～");
  }, [onXiaoyueMessageChange]);

  const handleSwipe = useCallback(
    (choice: SwipeChoice, reactionTime: number) => {
      const card = cards[currentIndex];
      const result: SwipeResult = {
        cardId: card.id,
        choice,
        reactionTimeMs: reactionTime,
      };

      const newResults = [...results, result];
      setResults(newResults);
      onSwipe(result);

      const newTracker = { ...categoryTracker };
      if (choice === 'like' || choice === 'love') {
        newTracker.likeCount = {
          ...newTracker.likeCount,
          [card.macroCategory]: newTracker.likeCount[card.macroCategory] + 1,
        };
        newTracker.totalLikes++;
        likeStreakRef.current++;
        skipStreakRef.current = 0;
      } else {
        newTracker.skipCount = {
          ...newTracker.skipCount,
          [card.macroCategory]: newTracker.skipCount[card.macroCategory] + 1,
        };
        newTracker.totalSkips++;
        skipStreakRef.current++;
        likeStreakRef.current = 0;
      }
      setCategoryTracker(newTracker);

      if (navigator.vibrate) {
        if (choice === 'love') {
          navigator.vibrate([30, 50, 30]);
        } else if (choice === 'like') {
          navigator.vibrate(20);
        }
      }

      const nextIndex = currentIndex + 1;
      const progress = nextIndex / cards.length;
      const hesitant = reactionTime > 3000;

      const smartMessage = getSmartXiaoyueMessage(
        newTracker,
        card,
        choice,
        progress,
        hesitant,
        likeStreakRef.current,
        skipStreakRef.current
      );

      if (smartMessage) {
        onXiaoyueMessageChange?.(smartMessage);
      }

      if (nextIndex >= cards.length) {
        setTimeout(() => {
          onXiaoyueMessageChange?.("我大概了解你了！看看结果？");
          onComplete(newResults);
        }, 300);
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [cards, currentIndex, results, categoryTracker, onSwipe, onComplete, onXiaoyueMessageChange]
  );

  const handleButtonSwipe = useCallback(
    (choice: SwipeChoice) => {
      const reactionTime = Date.now() - cardStartTimeRef.current;
      handleSwipe(choice, reactionTime);
    },
    [handleSwipe]
  );

  const progress = (currentIndex / cards.length) * 100;
  const visibleCards = cards.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>
            {currentIndex < cards.length 
              ? `${currentIndex + 1} / ${cards.length}`
              : `完成`
            }
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="relative flex-1 min-h-[400px]">
        {visibleCards.length > 0 ? (
          visibleCards.map((card, idx) => (
            <SwipeCard
              key={card.id}
              card={card}
              isTop={idx === 0}
              onSwipe={handleSwipe}
              cardStartTime={cardStartTimeRef.current}
            />
          )).reverse()
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">全部完成！</p>
            </div>
          </div>
        )}
      </div>

      {currentIndex < cards.length && (
        <div className="flex items-center justify-center gap-6 mt-6">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe('skip')}
            className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center shadow-lg"
            data-testid="button-skip-card"
          >
            <X className="w-6 h-6 text-gray-500" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe('love')}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg"
            data-testid="button-love-card"
          >
            <Sparkles className="w-7 h-7 text-white" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe('like')}
            className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 flex items-center justify-center shadow-lg"
            data-testid="button-like-card"
          >
            <Heart className="w-6 h-6 text-green-500" />
          </motion.button>
        </div>
      )}

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <span>← 跳过</span>
        <span className="mx-4">↑ 超爱</span>
        <span>喜欢 →</span>
      </div>
    </div>
  );
}

export default SwipeCardStack;
