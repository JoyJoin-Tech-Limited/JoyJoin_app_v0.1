import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
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

  const [selections, setSelections] = useState<Record<string, HeatLevel>>({});

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
      currentCategoryIndex: 0, // Not used anymore but keeping for backward compatibility
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [selections]);

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

  const canContinue = totalSelections >= 3;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-medium flex-1">选择兴趣</h1>
          
          {/* Compact counters */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-lg">🔥</span>
              <motion.span 
                key={totalHeat}
                className="font-bold text-orange-600"
                initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {totalHeat}
              </motion.span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg">✓</span>
              <motion.span 
                key={totalSelections}
                className="font-bold text-purple-600"
                initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {totalSelections}
              </motion.span>
            </div>
          </div>
        </div>

        {/* Compact guidance pills */}
        <div className="px-4 py-2 bg-primary/5 border-t">
          <div className="flex items-center gap-2 justify-center flex-wrap text-[10px] text-muted-foreground">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/70">
              <span>💜💗🧡</span>
              <span>点击升级</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/70">
              <span>✓</span>
              <span>至少选3个</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content - NO CAROUSEL */}
      <div className="flex-1 overflow-y-auto pb-24">
        {INTEREST_CATEGORIES.map((category) => (
          <CategoryPage
            key={category.id}
            category={category}
            selections={selections}
            onTopicTap={handleTopicTap}
          />
        ))}
      </div>

      {/* Sticky continue button - slightly more compact */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-[env(safe-area-inset-bottom,1rem)]">
        <div className="px-4 pb-4">
          <Button
            onClick={handleContinue}
            disabled={totalSelections < 3}
            className={cn(
              "w-full h-12 text-base font-bold rounded-xl shadow-lg transition-all",
              totalSelections >= 3
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            继续 {totalSelections >= 3 && `(${totalSelections}个)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
