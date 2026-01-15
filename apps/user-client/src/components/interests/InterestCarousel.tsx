import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import { CategoryPage } from "./CategoryPage";
import { InterestProgress } from "./InterestProgress";
import {
  INTEREST_CATEGORIES,
  HEAT_LEVELS,
  type HeatLevel,
  type InterestTopic,
  getTopicById,
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

const XIAOYUE_MESSAGES = {
  0: {
    content: "选择你感兴趣的话题吧！点一下表示有兴趣，再点更热烈 🔥",
    pose: "pointing" as const,
  },
  3: {
    content:
      "太棒了！已经可以开始匹配了 ✓\n不过...多选2-4个会让我更准确地找到志同道合的朋友哦 😊",
    pose: "casual" as const,
  },
  7: {
    content: "完美！这样的选择能帮你找到最合拍的桌友 🎯",
    pose: "casual" as const,
  },
  10: {
    content: "哇！你的兴趣好广泛 ✨ 这会让盲盒局更精彩！",
    pose: "casual" as const,
  },
};

const STORAGE_KEY = "joyjoin_interests_carousel_progress";

export function InterestCarousel({ onComplete, onBack }: InterestCarouselProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, HeatLevel>>({});
  const [xiaoyueMessage, setXiaoyueMessage] = useState(XIAOYUE_MESSAGES[0]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.selections && typeof data.selections === "object") {
          setSelections(data.selections);
        }
        if (typeof data.currentCategoryIndex === "number") {
          setCurrentCategoryIndex(data.currentCategoryIndex);
        }
      } catch (e) {
        console.error("Failed to load saved progress:", e);
      }
    }
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selections, currentCategoryIndex })
    );
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

  // Update Xiaoyue message based on selection count
  useEffect(() => {
    if (totalSelections >= 10) {
      setXiaoyueMessage(XIAOYUE_MESSAGES[10]);
    } else if (totalSelections >= 7) {
      setXiaoyueMessage(XIAOYUE_MESSAGES[7]);
    } else if (totalSelections >= 3) {
      setXiaoyueMessage(XIAOYUE_MESSAGES[3]);
    } else {
      setXiaoyueMessage(XIAOYUE_MESSAGES[0]);
    }
  }, [totalSelections]);

  // Handle topic tap - cycle through levels 0 → 1 → 2 → 3 → 0
  const handleTopicTap = useCallback((topicId: string) => {
    setSelections((prev) => {
      const currentLevel = prev[topicId] || 0;
      const nextLevel = ((currentLevel + 1) % 4) as HeatLevel;
      return { ...prev, [topicId]: nextLevel };
    });
  }, []);

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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-medium">兴趣选择</h1>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <InterestProgress
            totalHeat={totalHeat}
            totalSelections={totalSelections}
          />
        </div>

        {/* Category dots */}
        <div className="flex justify-center gap-2 mt-3">
          {INTEREST_CATEGORIES.map((category, index) => (
            <button
              key={category.id}
              onClick={() => setCurrentCategoryIndex(index)}
              className="touch-manipulation"
            >
              <motion.div
                className={cn(
                  "rounded-full transition-all",
                  index === currentCategoryIndex
                    ? "bg-primary h-2"
                    : "bg-gray-300 h-2"
                )}
                animate={{
                  width: index === currentCategoryIndex ? 48 : 8,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Xiaoyue guidance */}
      <div className="px-4 py-4">
        <XiaoyueChatBubble
          content={xiaoyueMessage.content}
          pose={xiaoyueMessage.pose}
          horizontal
          animate
        />
      </div>

      {/* Carousel */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          animate={{ x: -currentCategoryIndex * 100 + "%" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 30 }
          }
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

      {/* Continue button */}
      <div className="shrink-0 border-t p-4 bg-background">
        <Button
          onClick={handleContinue}
          className="w-full"
          disabled={!canContinue}
          size="lg"
        >
          继续 ({totalSelections}/3+)
        </Button>
      </div>
    </div>
  );
}
