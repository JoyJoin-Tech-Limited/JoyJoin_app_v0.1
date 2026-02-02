import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ArrowUp } from "lucide-react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(INTEREST_CATEGORIES[0]?.id || "");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

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
    
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('joyjoin_interest_onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
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

  // Track scroll position to show/hide scroll-to-top button and update active category
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Show button after scrolling ~400px (roughly 2 categories)
      const shouldShow = scrollContainer.scrollTop > 400;
      setShowScrollTop(shouldShow);
      
      // Optimize: Set isScrolling state to apply willChange only during scroll
      setIsScrolling(true);
      
      // Update active category based on scroll position
      const scrollTop = scrollContainer.scrollTop;
      let newActiveCategory = INTEREST_CATEGORIES[0]?.id || "";
      
      for (const category of INTEREST_CATEGORIES) {
        const categoryEl = categoryRefs.current[category.id];
        if (categoryEl) {
          const rect = categoryEl.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          // Check if category is in viewport (with some offset for the header)
          if (rect.top <= containerRect.top + 200) {
            newActiveCategory = category.id;
          }
        }
      }
      
      setActiveCategory(newActiveCategory);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Remove willChange after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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

  // Scroll to top handler
  const handleScrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }, [prefersReducedMotion]);

  // Scroll to category handler
  const scrollToCategory = useCallback((categoryId: string) => {
    const categoryEl = categoryRefs.current[categoryId];
    if (categoryEl && scrollContainerRef.current) {
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const categoryRect = categoryEl.getBoundingClientRect();
      const scrollTop = scrollContainerRef.current.scrollTop;
      // Account for sticky headers (main header ~52px + heat meter ~56px + tab bar ~48px = ~156px)
      const offset = categoryRect.top - containerRect.top + scrollTop - 156;
      
      scrollContainerRef.current.scrollTo({
        top: offset,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }, [prefersReducedMotion]);

  // Dismiss onboarding tooltip
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('joyjoin_interest_onboarding_seen', 'true');
  }, []);

  // Handle topic tap - cycle through levels 0 → 1 → 2 → 3 → 0
  // Show toast on first level 3 → 0 cycle to explain behavior
  const handleTopicTap = useCallback((topicId: string) => {
    // Dismiss onboarding on first tap
    if (showOnboarding) {
      dismissOnboarding();
    }
    
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
  }, [toast, showOnboarding, dismissOnboarding]);

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

        {/* Dynamic Heat Meter - replaces guidance pills */}
        <div className="px-4 py-2.5 bg-primary/5 border-t">
          <div className="flex items-center gap-3">
            <span className="text-lg" role="img" aria-label="Heat">🔥</span>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={totalHeat} aria-valuemin={0} aria-valuemax={100}>
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((totalHeat / 100) * 100, 100)}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground tabular-nums min-w-[3rem] text-right">
              {totalSelections >= 3 ? (
                <span className="text-primary">{totalSelections} 个</span>
              ) : (
                <span>{totalSelections}/3+</span>
              )}
            </span>
          </div>
          {totalSelections < 3 && (
            <p className="text-xs text-muted-foreground text-center mt-1.5" role="status" aria-live="polite">
              点击兴趣卡片可多次选择，增加热度 💜 → 💗 → 🧡
            </p>
          )}
        </div>

        {/* Horizontal Category Quick-Nav Tabs */}
        <div className="sticky top-[106px] z-10 bg-background border-b shadow-sm">
          <div className="flex overflow-x-auto gap-1.5 px-3 py-2 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {INTEREST_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all touch-manipulation",
                  activeCategory === cat.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                aria-label={`跳转到 ${cat.name}`}
                aria-current={activeCategory === cat.id ? "true" : undefined}
              >
                <span className="mr-1">{cat.emoji}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding Tooltip - First-time user guidance */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
            className="fixed top-[200px] left-4 right-4 z-30 bg-primary text-primary-foreground rounded-xl shadow-lg p-4"
            role="dialog"
            aria-label="使用提示"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div className="flex-1 text-sm">
                <p className="font-semibold mb-1">如何选择兴趣？</p>
                <p className="opacity-90">
                  点击卡片可多次选择，每次点击增加热度：💜 感兴趣 → 💗 很喜欢 → 🧡 超热爱
                </p>
              </div>
              <button
                onClick={dismissOnboarding}
                className="flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground text-lg font-bold leading-none touch-manipulation p-1"
                aria-label="关闭提示"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content - NO CAROUSEL - with performance optimizations */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-24"
        style={{ 
          willChange: isScrolling ? 'scroll-position' : 'auto',
          WebkitOverflowScrolling: 'touch' as any
        }}
      >
        {INTEREST_CATEGORIES.map((category) => (
          <CategoryPage
            key={category.id}
            category={category}
            selections={selections}
            onTopicTap={handleTopicTap}
            ref={(el) => {
              categoryRefs.current[category.id] = el;
            }}
          />
        ))}
      </div>

      {/* Scroll to top button - appears after 2+ categories */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={handleScrollToTop}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleScrollToTop();
              }
            }}
            className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center touch-manipulation"
            aria-label="Scroll to top"
            tabIndex={0}
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sticky continue button - with selection preview */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-[env(safe-area-inset-bottom,1rem)]">
        {/* Selection preview - shows selected interests */}
        <AnimatePresence>
          {totalSelections >= 3 && (
            <motion.div 
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              className="px-4 pb-3"
            >
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center" role="region" aria-label="已选择的兴趣">
                {Object.entries(selections)
                  .filter(([, level]) => level > 0)
                  .slice(0, 8)
                  .map(([topicId]) => {
                    const topic = getTopicById(topicId);
                    if (!topic) return null;
                    return (
                      <motion.span 
                        key={topicId} 
                        className="text-2xl flex-shrink-0"
                        initial={prefersReducedMotion ? {} : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        role="img"
                        aria-label={topic.label}
                      >
                        {topic.emoji}
                      </motion.span>
                    );
                  })}
                {totalSelections > 8 && (
                  <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full flex-shrink-0">
                    +{totalSelections - 8}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
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
