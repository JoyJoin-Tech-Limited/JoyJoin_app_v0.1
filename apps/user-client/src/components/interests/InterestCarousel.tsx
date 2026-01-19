import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CategoryPage } from "./CategoryPage";
import {
  INTEREST_CATEGORIES,
  HEAT_LEVELS,
  type HeatLevel,
  type InterestTopic,
  getTopicById,
  isValidHeatLevel,
} from "@/data/interestCarouselData";

interface InterestSelection {
  topicId: string;
  emoji: string;
  label: string;
  fullName: string;
  category: string;
  categoryId: string;
  level: HeatLevel;
  heat: number;
}

interface InterestCarouselProps {
  onComplete: (data: InterestCarouselData) => void;
  onBack: () => void;
}

export interface InterestCarouselData {
  totalHeat: number;
  totalSelections: number;
  categoryHeat: Record<string, number>;
  selections: InterestSelection[];
  topPriorities: Array<{ topicId: string; label: string; heat: number }>;
}

// localStorage keys
const STORAGE_KEY = "joyjoin_interests_carousel_progress";
const CYCLE_EXPLANATION_KEY = "joyjoin_seen_cycle_explanation";
const HEAT_GUIDE_KEY = "joyjoin_seen_heat_guide";

// localStorage expiry (7 days in milliseconds)
const STORAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredProgress {
  selections: Record<string, HeatLevel>;
  currentCategoryIndex: number;
  timestamp: number;
}

export function InterestCarousel({ onComplete, onBack }: InterestCarouselProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, HeatLevel>>({});
  const [showFirstTimeGuide, setShowFirstTimeGuide] = useState(false);

  // Check for first-time guide on mount
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem(HEAT_GUIDE_KEY);
    if (!hasSeenGuide) {
      setShowFirstTimeGuide(true);
    }
  }, []);

  // Load from localStorage on mount with expiry check
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: StoredProgress = JSON.parse(saved);
        
        // Check if data has expired (7 days)
        const isExpired = data.timestamp && (Date.now() - data.timestamp > STORAGE_EXPIRY_MS);
        
        if (isExpired) {
          // Clear expired data
          localStorage.removeItem(STORAGE_KEY);
          console.log('[InterestCarousel] Cleared expired localStorage data');
          return;
        }
        
        if (data.selections && typeof data.selections === "object") {
          setSelections(data.selections);
        }
        if (typeof data.currentCategoryIndex === "number") {
          setCurrentCategoryIndex(data.currentCategoryIndex);
        }
      } catch (e) {
        console.error("Failed to load saved progress:", e);
        // Clear corrupted data
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save to localStorage on changes with timestamp
  useEffect(() => {
    const data: StoredProgress = {
      selections,
      currentCategoryIndex,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [selections, currentCategoryIndex]);

  // Calculate metrics
  const calculateMetrics = useCallback(() => {
    const selectedTopics = Object.entries(selections).filter(
      ([, level]) => level > 0
    );

    const totalSelections = selectedTopics.length;
    const totalHeat = selectedTopics.reduce(
      (sum, [, level]) => sum + HEAT_LEVELS[level].heat,
      0
    );

    const categoryHeat: Record<string, number> = {};
    selectedTopics.forEach(([topicId, level]) => {
      const topic = getTopicById(topicId);
      if (topic) {
        categoryHeat[topic.categoryId] =
          (categoryHeat[topic.categoryId] || 0) + HEAT_LEVELS[level].heat;
      }
    });

    return { totalSelections, totalHeat, categoryHeat };
  }, [selections]);

  const { totalSelections, totalHeat, categoryHeat } = calculateMetrics();

  // Handle topic tap - cycle through levels 0 → 1 → 2 → 3 → 0
  // Show toast on first level 3 → 0 cycle to explain behavior
  const handleTopicTap = useCallback((topicId: string) => {
    setSelections((prev) => {
      const currentLevel = prev[topicId] || 0;
      const nextLevel = (currentLevel + 1) % 4;
      
      // Type guard to ensure nextLevel is a valid HeatLevel
      if (!isValidHeatLevel(nextLevel)) {
        console.error(`Invalid heat level calculated: ${nextLevel}`);
        return prev;
      }
      
      // Show explanation when cycling from max (3) back to unselected (0)
      if (currentLevel === 3 && nextLevel === 0) {
        const hasSeenCycleExplanation = localStorage.getItem(CYCLE_EXPLANATION_KEY);
        if (!hasSeenCycleExplanation) {
          toast({
            title: "提示",
            description: "再次点击可以取消选择哦",
          });
          localStorage.setItem(CYCLE_EXPLANATION_KEY, 'true');
        }
      }
      
      return { ...prev, [topicId]: nextLevel };
    });
  }, [toast]);

  // Handle horizontal swipe
  const handleDragEnd = useCallback(
    (_e: any, info: PanInfo) => {
      const swipeThreshold = 50;
      if (info.offset.x > swipeThreshold && currentCategoryIndex > 0) {
        setCurrentCategoryIndex((prev) => prev - 1);
      } else if (
        info.offset.x < -swipeThreshold &&
        currentCategoryIndex < INTEREST_CATEGORIES.length - 1
      ) {
        setCurrentCategoryIndex((prev) => prev + 1);
      }
    },
    [currentCategoryIndex]
  );

  // Handle "next category" skip button
  const handleSkipCategory = useCallback(() => {
    if (currentCategoryIndex < INTEREST_CATEGORIES.length - 1) {
      setCurrentCategoryIndex((prev) => prev + 1);
    }
  }, [currentCategoryIndex]);

  // Handle continue button
  const handleContinue = useCallback(() => {
    if (totalSelections < 3) {
      toast({
        title: "请至少选择3个兴趣",
        variant: "destructive",
      });
      return;
    }

    // Build selections array
    const selectionsArray: InterestSelection[] = Object.entries(selections)
      .filter(([, level]) => level > 0)
      .map(([topicId, level]) => {
        const topic = getTopicById(topicId)!;
        return {
          topicId,
          emoji: topic.emoji,
          label: topic.label,
          fullName: topic.fullName,
          category: topic.category,
          categoryId: topic.categoryId,
          level,
          heat: HEAT_LEVELS[level].heat,
        };
      });

    // Get top priorities (level 3 items)
    const topPriorities = selectionsArray
      .filter((s) => s.level === 3)
      .map((s) => ({
        topicId: s.topicId,
        label: s.label,
        heat: s.heat,
      }));

    const data: InterestCarouselData = {
      totalHeat,
      totalSelections,
      categoryHeat,
      selections: selectionsArray,
      topPriorities,
    };

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);

    onComplete(data);
  }, [selections, totalHeat, totalSelections, categoryHeat, onComplete, toast]);

  const currentCategory = INTEREST_CATEGORIES[currentCategoryIndex];
  const canContinue = totalSelections >= 3;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* First-time guide tooltip */}
      <AnimatePresence>
        {showFirstTimeGuide && (
          <motion.div 
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-background rounded-2xl p-6 max-w-sm"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="font-bold text-lg mb-3">💡 如何选择</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full"/>
                  <span>点一下 = 有兴趣</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-pink-500 rounded-full"/>
                  <span>点两下 = 很喜欢</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"/>
                  <span>点三下 = 很热爱</span>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setShowFirstTimeGuide(false);
                  localStorage.setItem(HEAT_GUIDE_KEY, 'true');
                }} 
                className="w-full mt-4"
              >
                知道了
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-medium">兴趣选择</h1>
          </div>
          {/* Mini heat counter badge */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <motion.div
                key={totalHeat}
                className="text-lg font-bold text-orange-600"
                initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {totalHeat}
              </motion.div>
              <div className="text-[10px] text-muted-foreground">热度</div>
            </div>
            <div className="flex flex-col items-center">
              <motion.div
                key={totalSelections}
                className="text-lg font-bold text-purple-600"
                initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {totalSelections}
              </motion.div>
              <div className="text-[10px] text-muted-foreground">已选</div>
            </div>
          </div>
        </div>

        {/* Scrollable category tabs */}
        <div className="overflow-x-auto scrollbar-hide px-4 pb-2">
          <div className="flex gap-2 min-w-min">
            {INTEREST_CATEGORIES.map((category, index) => (
              <button
                key={category.id}
                onClick={() => setCurrentCategoryIndex(index)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap text-sm transition-all touch-manipulation",
                  index === currentCategoryIndex
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                <span>{category.emoji}</span>
                <span className="font-medium">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={{ x: -currentCategoryIndex * 100 + "%" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 35, mass: 0.8 }
          }
          style={{ 
            touchAction: 'pan-x' as const,
          }}
        >
          {INTEREST_CATEGORIES.map((category) => (
            <div key={category.id} className="min-w-full h-full">
              <CategoryPage
                category={category}
                selections={selections}
                onTopicTap={handleTopicTap}
              />
            </div>
          ))}
        </motion.div>
      </div>

      {/* Skip to next category button */}
      {currentCategoryIndex < INTEREST_CATEGORIES.length - 1 && (
        <div className="px-4 pb-2 text-center">
          <button
            onClick={handleSkipCategory}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group touch-manipulation"
          >
            <span>不感兴趣，下一类</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* Continue button - Duolingo style */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-[env(safe-area-inset-bottom,1rem)]">
        <div className="px-4 pb-4">
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className={cn(
              "w-full h-14 text-lg font-bold rounded-2xl shadow-lg",
              "!border-0 transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              canContinue 
                ? "bg-primary text-primary-foreground hover:brightness-95" 
                : "bg-muted"
            )}
          >
            继续 {totalSelections >= 3 && `(${totalSelections} 个兴趣)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
