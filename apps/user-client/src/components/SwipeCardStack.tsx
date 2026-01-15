import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { Heart, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwipeParticles } from "./SwipeParticles";
import { 
  InterestCard, 
  SwipeChoice, 
  SwipeResult,
  MacroCategory,
  MACRO_CATEGORY_LABELS,
  INTEREST_CARDS,
} from "@/data/interestCardsData";

export interface SwipeCardStackRef {
  triggerSwipe: (choice: SwipeChoice) => Promise<void>;
}

interface SwipeCardStackProps {
  cards: InterestCard[];
  onSwipe: (result: SwipeResult) => void;
  onComplete: (results: SwipeResult[]) => void;
  xiaoyueMessage?: string;
  onXiaoyueMessageChange?: (message: string) => void;
  onProgressChange?: (currentIndex: number, total: number) => void;
  hideProgress?: boolean;
}

const SWIPE_THRESHOLD_X = 120;
const SWIPE_THRESHOLD_Y = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;
const MIN_DISPLACEMENT_FOR_VELOCITY = 40; // guard tiny flicks
const DIRECTION_DOMINANCE_THRESHOLD = 0.8; // require 80% bias toward a direction

// Softer spring reset animation constants
const RESET_SPRING_STIFFNESS = 300;
const RESET_SPRING_DAMPING = 25;
const RESET_SPRING_MASS = 0.8;
const RESET_SPRING_VELOCITY = 0;

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

export interface SwipeCardRef {
  triggerSwipeAnimation: (choice: SwipeChoice) => Promise<void>;
}

interface SwipeCardProps {
  card: InterestCard;
  isTop: boolean;
  onSwipe: (choice: SwipeChoice, reactionTime: number) => void;
  cardStartTime: number;
  stackIndex?: number;
  totalVisible?: number;
}

const SwipeCard = forwardRef<SwipeCardRef, SwipeCardProps>(({
  card,
  isTop,
  onSwipe,
  cardStartTime,
  stackIndex = 0,
  totalVisible = 1,
}, cardRef) => {
  const controls = useAnimation();
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const dragRafRef = useRef<number | null>(null);
  const lastOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const particleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
      }
      if (particleTimeoutRef.current) {
        clearTimeout(particleTimeoutRef.current);
      }
      lastOffsetRef.current = { x: 0, y: 0 };
    };
  }, []);

  const handleDragEnd = useCallback(
    async (_: any, info: PanInfo) => {
      if (isAnimating) return;
      const { offset, velocity } = info;
      const reactionTime = Date.now() - cardStartTime;
      const absX = Math.abs(offset.x);
      const absY = Math.abs(offset.y);

      const hasMinimumDisplacement =
        (absX > MIN_DISPLACEMENT_FOR_VELOCITY || absY > MIN_DISPLACEMENT_FOR_VELOCITY);

      const dominantX = absX > absY * DIRECTION_DOMINANCE_THRESHOLD;
      const dominantY = absY > absX * DIRECTION_DOMINANCE_THRESHOLD;

      if (
        dominantY &&
        (offset.y < -SWIPE_THRESHOLD_Y || (hasMinimumDisplacement && velocity.y < -SWIPE_VELOCITY_THRESHOLD))
      ) {
        setIsAnimating(true);
        setShowParticles(true);
        particleTimeoutRef.current = window.setTimeout(() => setShowParticles(false), 1000);
        await controls.start({ y: -500, opacity: 0, scale: 0.8, transition: { duration: 0.3 } });
        onSwipe('love', reactionTime);
      } else if (
        dominantX &&
        (offset.x > SWIPE_THRESHOLD_X || (hasMinimumDisplacement && velocity.x > SWIPE_VELOCITY_THRESHOLD))
      ) {
        setIsAnimating(true);
        await controls.start({ x: 500, opacity: 0, rotate: 20, transition: { duration: 0.3 } });
        onSwipe('like', reactionTime);
      } else if (
        dominantX &&
        (offset.x < -SWIPE_THRESHOLD_X || (hasMinimumDisplacement && velocity.x < -SWIPE_VELOCITY_THRESHOLD))
      ) {
        setIsAnimating(true);
        await controls.start({ x: -500, opacity: 0, rotate: -20, transition: { duration: 0.3 } });
        onSwipe('skip', reactionTime);
      } else {
        // softer reset
        await controls.start({
          x: 0,
          y: 0,
          rotate: 0,
          transition: { type: "spring", stiffness: RESET_SPRING_STIFFNESS, damping: RESET_SPRING_DAMPING, mass: RESET_SPRING_MASS, velocity: RESET_SPRING_VELOCITY },
        });
      }
      setDragDirection(null);
      setDragProgress(0);
      setIsAnimating(false);
    },
    [controls, onSwipe, cardStartTime, isAnimating]
  );

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    lastOffsetRef.current = info.offset;
    
    // Calculate progress based on swipe distance (0 to 1)
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);
    const maxDistance = 150; // threshold for full opacity
    
    const progress = Math.min(
      Math.max(absX, absY) / maxDistance,
      1
    );
    
    setDragProgress(progress);
    
    if (dragRafRef.current) return;

    dragRafRef.current = requestAnimationFrame(() => {
      const offset = lastOffsetRef.current;
      const dominantX = Math.abs(offset.x) > Math.abs(offset.y) * DIRECTION_DOMINANCE_THRESHOLD;
      const dominantY = Math.abs(offset.y) > Math.abs(offset.x) * DIRECTION_DOMINANCE_THRESHOLD;

      if (dominantY && offset.y < -50) {
        setDragDirection('up');
      } else if (dominantX && offset.x > 50) {
        setDragDirection('right');
      } else if (dominantX && offset.x < -50) {
        setDragDirection('left');
      } else {
        setDragDirection(null);
      }
      dragRafRef.current = null;
    });
  }, []);

  const triggerSwipeAnimation = useCallback(async (choice: SwipeChoice) => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    if (choice === 'love') {
      setDragDirection('up');
      setShowParticles(true);
      particleTimeoutRef.current = window.setTimeout(() => setShowParticles(false), 1000);
      await controls.start({ y: -500, opacity: 0, scale: 0.8, transition: { duration: 0.25 } });
    } else if (choice === 'like') {
      setDragDirection('right');
      await controls.start({ x: 500, opacity: 0, rotate: 15, transition: { duration: 0.25 } });
    } else {
      setDragDirection('left');
      await controls.start({ x: -500, opacity: 0, rotate: -15, transition: { duration: 0.25 } });
    }
    
    setDragDirection(null);
    setIsAnimating(false);
  }, [controls, isAnimating]);

  useImperativeHandle(cardRef, () => ({
    triggerSwipeAnimation,
  }), [triggerSwipeAnimation]);

  return (
    <motion.div
      className={cn(
        "absolute inset-0 rounded-2xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing",
        !isTop && "pointer-events-none"
      )}
      style={{ 
        touchAction: "none", 
        transform: "translateZ(0)", 
        willChange: "transform", 
        backfaceVisibility: "hidden",
        ...(isAnimating && { pointerEvents: "none" }) 
      }}
      drag={isTop && !isAnimating}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      dragMomentum={true}
      dragTransition={{ 
        bounceStiffness: 400, 
        bounceDamping: 25
      }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={isTop ? { 
        scale: 1, 
        y: 0,
        opacity: 1,
        rotateX: 0
      } : { 
        scale: 0.92, 
        y: 20 * stackIndex,
        opacity: 0.8,
        rotateX: 5
      }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20 
      }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <SwipeParticles show={showParticles} />
      <div className={cn(
        "relative w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800",
        dragDirection === 'right' && "shadow-[0_0_50px_rgba(16,185,129,0.3)]",
        dragDirection === 'left' && "shadow-[0_0_50px_rgba(107,114,128,0.2)]",
        dragDirection === 'up' && "shadow-[0_0_50px_rgba(236,72,153,0.3)]"
      )}>
        <img
          src={card.imageUrl}
          alt={card.label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.85)' }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
            {card.label}
          </h3>
        </div>

        {dragDirection === 'right' && (
          <motion.div
            className="absolute top-8 left-8 pointer-events-none"
            style={{
              rotate: -12,
              opacity: dragProgress,
              scale: 0.8 + (dragProgress * 0.2),
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: dragProgress, scale: 0.8 + (dragProgress * 0.2) }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="
              relative px-5 py-3 rounded-2xl
              bg-gradient-to-br from-emerald-400 to-emerald-600
              border-[3px] border-white
              shadow-[0_0_30px_rgba(16,185,129,0.4)]
              backdrop-blur-sm
            ">
              <Heart 
                className="w-10 h-10 text-white fill-white stroke-white" 
                strokeWidth={2.5}
              />
            </div>
          </motion.div>
        )}

        {dragDirection === 'left' && (
          <motion.div
            className="absolute top-8 right-8 pointer-events-none"
            style={{
              rotate: 12,
              opacity: dragProgress,
              scale: 0.8 + (dragProgress * 0.2),
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: dragProgress, scale: 0.8 + (dragProgress * 0.2) }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="
              relative px-5 py-3 rounded-2xl
              bg-white/20
              backdrop-blur-xl
              border-2 border-white/40
              shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            ">
              <X 
                className="w-10 h-10 text-white stroke-white" 
                strokeWidth={2.5}
              />
            </div>
          </motion.div>
        )}

        {dragDirection === 'up' && (
          <motion.div
            className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              opacity: dragProgress,
              scale: 0.8 + (dragProgress * 0.2),
              y: -10 * dragProgress,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: dragProgress, 
              scale: 0.8 + (dragProgress * 0.2),
              y: -10 * dragProgress
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="
              relative px-6 py-3 rounded-2xl
              bg-gradient-to-br from-pink-500 to-rose-600
              border-[3px] border-white
              shadow-[0_0_40px_rgba(236,72,153,0.5)]
              flex items-center gap-2
            ">
              <Sparkles className="w-6 h-6 text-white fill-white" strokeWidth={2} />
              <span className="text-white font-bold text-xl tracking-wide drop-shadow-lg">
                超爱
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

SwipeCard.displayName = "SwipeCard";

export const SwipeCardStack = forwardRef<SwipeCardStackRef, SwipeCardStackProps>(({
  cards,
  onSwipe,
  onComplete,
  onXiaoyueMessageChange,
  onProgressChange,
  hideProgress = false,
}, ref) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [categoryTracker, setCategoryTracker] = useState<CategoryTracker>(initCategoryTracker);
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);
  const cardStartTimeRef = useRef(Date.now());
  const likeStreakRef = useRef(0);
  const skipStreakRef = useRef(0);
  const topCardRef = useRef<SwipeCardRef>(null);

  useEffect(() => {
    cardStartTimeRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    setCurrentIndex(0);
    setResults([]);
    setCategoryTracker(initCategoryTracker);
    likeStreakRef.current = 0;
    skipStreakRef.current = 0;
  }, [cards]);

  useEffect(() => {
    onProgressChange?.(currentIndex, cards.length);
  }, [currentIndex, cards.length, onProgressChange]);

  useEffect(() => {
    onXiaoyueMessageChange?.("滑动告诉我你喜欢什么吧～");
  }, [onXiaoyueMessageChange]);

  useEffect(() => {
    const nextCard = cards[currentIndex + 1];
    if (typeof window === 'undefined' || !nextCard?.imageUrl) return;

    try {
      // Validate URL (relative allowed)
      // eslint-disable-next-line no-new
      new URL(nextCard.imageUrl, window.location.href);
    } catch (error) {
      console.warn('Skipping preload of invalid image URL:', nextCard.imageUrl, error);
      return;
    }

    const img = new Image();
    img.onload = () => {};
    img.onerror = (error) => {
      console.error('Failed to preload image:', nextCard.imageUrl, error);
    };
    img.src = nextCard.imageUrl;
  }, [cards, currentIndex]);

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
          // Celebration pattern
          navigator.vibrate([30, 50, 30, 50, 60]);
        } else if (choice === 'like') {
          // Satisfying medium pulse
          navigator.vibrate([15, 10, 25]);
        } else if (choice === 'skip') {
          // Subtle single pulse
          navigator.vibrate(10);
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
    async (choice: SwipeChoice) => {
      if (isButtonAnimating) return;
      setIsButtonAnimating(true);
      const reactionTime = Date.now() - cardStartTimeRef.current;
      if (topCardRef.current) {
        await topCardRef.current.triggerSwipeAnimation(choice);
      }
      handleSwipe(choice, reactionTime);
      setIsButtonAnimating(false);
    },
    [handleSwipe, isButtonAnimating]
  );

  useImperativeHandle(ref, () => ({
    triggerSwipe: handleButtonSwipe,
  }), [handleButtonSwipe]);

  const visibleCards = cards.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-[380px] flex items-center justify-center">
        <div className="relative aspect-[3/4] w-full max-w-[340px]" style={{ perspective: "1000px" }}>
          {visibleCards.length > 0 ? (
            visibleCards.map((card, idx) => (
              <SwipeCard
                key={card.id}
                ref={idx === 0 ? topCardRef : undefined}
                card={card}
                isTop={idx === 0}
                onSwipe={handleSwipe}
                cardStartTime={cardStartTimeRef.current}
                stackIndex={idx}
                totalVisible={visibleCards.length}
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
      </div>

      {currentIndex < cards.length && (
        <div className="mt-6 relative pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background to-transparent pointer-events-none" />
          <div className="relative flex justify-center items-center gap-5 pb-4">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleButtonSwipe('skip')}
              disabled={isButtonAnimating}
              data-testid="button-skip-card"
              aria-label="跳过此兴趣卡片"
              className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-shadow border-2"
            >
              <X className="w-7 h-7" strokeWidth={2.5} />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={() => handleButtonSwipe('love')}
              disabled={isButtonAnimating}
              data-testid="button-love-card"
              aria-label="超爱此兴趣卡片"
              className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 border-0 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-white/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <Sparkles className="w-8 h-8 relative z-10" strokeWidth={2.5} />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleButtonSwipe('like')}
              disabled={isButtonAnimating}
              data-testid="button-like-card"
              aria-label="喜欢此兴趣卡片"
              className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white border-0 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Heart className="w-7 h-7 fill-current" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

SwipeCardStack.displayName = "SwipeCardStack";

export default SwipeCardStack;
