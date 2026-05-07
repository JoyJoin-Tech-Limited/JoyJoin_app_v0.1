import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ArrowUp, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics"; // Phase 2
import { useAuth } from "@/hooks/useAuth";
import { CategoryPage } from "./CategoryPage";
import {
  INTEREST_CATEGORIES,
  HEAT_LEVELS,
  INTEREST_CAROUSEL_ONBOARDING,
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
  initialSelections?: Record<string, HeatLevel>;  // optional — for edit mode (pre-populate from DB)
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

// Maximum possible heat (56 topics × 25 heat at level 3)
const MAX_HEAT = 1400;

export function InterestCarousel({ onComplete, onBack, initialSelections }: InterestCarouselProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const analytics = useOnboardingAnalytics('extended-data'); // Phase 2: Analytics tracking
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(INTEREST_CATEGORIES[0]?.id || "");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [lastSelectedTopic, setLastSelectedTopic] = useState<string | null>(null);

  // In edit mode (initialSelections prop provided), skip localStorage — DB is the source of truth.
  // Note: we check `initialSelections !== undefined` rather than non-empty, so that users with
  // zero existing interests who arrive via the profile edit route also bypass localStorage.
  const isEditMode = initialSelections !== undefined;
  const [selections, setSelections] = useState<Record<string, HeatLevel>>(
    initialSelections && Object.keys(initialSelections).length > 0
      ? initialSelections
      : {}
  );

  // Enhancement 4: Heat bar milestone burst particles
  const HEAT_MILESTONES = [0.18, 0.35, 0.55, 0.75];
  const [burstKey, setBurstKey] = useState(0);
  const [burstPct, setBurstPct] = useState(0);
  const lastMilestoneRef = useRef(-1);

  // Load from localStorage on mount with expiry check
  useEffect(() => {
    // In edit mode (initialSelections provided), skip localStorage — DB is the source of truth
    if (isEditMode) return;

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
    
    // Check if user has seen onboarding - show after 1 second delay
    const hasSeenOnboarding = localStorage.getItem(INTEREST_CAROUSEL_ONBOARDING);
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Save to localStorage on changes with timestamp — skipped in edit mode to avoid
  // overwriting onboarding progress (joyjoin_interests_carousel_progress) with profile edits.
  useEffect(() => {
    if (isEditMode) return;
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
      // Find the category whose top is closest to being at the top of the viewport
      let newActiveCategory = INTEREST_CATEGORIES[0]?.id || "";
      let minDistance = Infinity;
      
      const containerRect = scrollContainer.getBoundingClientRect();
      const headerHeight = headerRef.current?.getBoundingClientRect().height || 0;
      const threshold = containerRect.top + headerHeight + 50; // Small buffer below header
      
      for (const category of INTEREST_CATEGORIES) {
        const categoryEl = categoryRefs.current[category.id];
        if (categoryEl) {
          const rect = categoryEl.getBoundingClientRect();
          const distance = Math.abs(rect.top - threshold);
          
          // If this category is in view and closer to threshold than previous
          if (rect.top <= threshold && distance < minDistance) {
            minDistance = distance;
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

  // Enhancement 4: Detect milestone crossings for heat bar burst
  const hasInitializedMilestoneRef = useRef(false);
  useEffect(() => {
    const rawHeatPct = MAX_HEAT > 0 ? totalHeat / MAX_HEAT : 0;
    const clampedHeatPct = Number.isFinite(rawHeatPct)
      ? Math.max(0, Math.min(1, rawHeatPct))
      : 0;

    let crossedIndex = -1;
    for (let i = HEAT_MILESTONES.length - 1; i >= 0; i--) {
      if (clampedHeatPct >= HEAT_MILESTONES[i]) { crossedIndex = i; break; }
    }

    // Initialize lastMilestoneRef based on the initial heatPct so we don't
    // trigger a burst on first render or state hydration.
    if (!hasInitializedMilestoneRef.current) {
      hasInitializedMilestoneRef.current = true;
      lastMilestoneRef.current = crossedIndex;
      return;
    }

    if (crossedIndex > lastMilestoneRef.current) {
      lastMilestoneRef.current = crossedIndex;
      // Burst at the current fill endpoint rather than the milestone value.
      setBurstPct(clampedHeatPct);
      setBurstKey(k => k + 1);
    }
  }, [totalHeat]);

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
      
      // Dynamically account for sticky headers by measuring the header container height
      const headerContainer = headerRef.current;
      const headerHeight = headerContainer
        ? headerContainer.getBoundingClientRect().height
        : 0;

      const offset =
        categoryRect.top - containerRect.top + scrollTop - headerHeight;
      
      scrollContainerRef.current.scrollTo({
        top: offset,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }, [prefersReducedMotion]);

  // Dismiss onboarding tooltip
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem(INTEREST_CAROUSEL_ONBOARDING, 'true');
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
      
      // Update last selected topic for screen reader announcement
      setLastSelectedTopic(topicId);
      
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
      // Phase 2: Track validation failure
      analytics.validationFailed('interests', `Only ${totalSelections} selected, minimum 3 required`);
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

    // Phase 2: Track successful completion
    analytics.stepCompleted({
      totalSelections,
      totalHeat,
      topPriorities: topPriorities.length,
      categoriesUsed: Object.keys(categoryHeat).filter(k => categoryHeat[k] > 0).length,
    });

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);

    onComplete(data);
  }, [selections, totalHeat, totalSelections, categoryHeat, onComplete, toast, analytics]);

  const canContinue = totalSelections >= 3;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-medium leading-tight">完善兴趣偏好</h1>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">这些将直接影响你的匹配质量</p>
          </div>
          
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
          <div className="flex items-center gap-3 relative">
            <span className="text-lg" role="img" aria-label="Heat">🔥</span>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.min((totalHeat / MAX_HEAT) * 100, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="兴趣热度进度">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((totalHeat / MAX_HEAT) * 100, 100)}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
            {/* Enhancement 4: Milestone burst particles — outside overflow-hidden bar */}
            {!prefersReducedMotion && burstKey > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ overflow: "visible" }}
                aria-hidden="true"
              >
                {[...Array(8)].map((_, i) => {
                  const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
                  const distance = 14;
                  return (
                    <motion.div
                      key={`burst-${burstKey}-${i}`}
                      className="absolute rounded-full"
                      style={{
                        width: 5,
                        height: 5,
                        // offset from left edge: emoji (~28px) + gap (12px) + bar fill %
                        left: `calc(2.5rem + ${Math.min(burstPct * 100, 97)}%)`,
                        top: "50%",
                        marginLeft: -2.5,
                        marginTop: -2.5,
                        backgroundColor: i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#ec4899" : "#f97316",
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance,
                        opacity: 0,
                        scale: 0,
                      }}
                      transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.025 }}
                    />
                  );
                })}
              </div>
            )}
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
        <div className="z-10 bg-background border-b shadow-sm" role="tablist" aria-label="兴趣分类">
          <LayoutGroup id="interest-category-tabs">
            <div className="flex overflow-x-auto gap-1.5 px-3 py-2 no-scrollbar">
              {INTEREST_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    scrollToCategory(cat.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      const currentIndex = INTEREST_CATEGORIES.findIndex(c => c.id === cat.id);
                      const delta = e.key === 'ArrowRight' ? 1 : -1;
                      const nextIndex = (currentIndex + delta + INTEREST_CATEGORIES.length) % INTEREST_CATEGORIES.length;
                      const nextCategoryId = INTEREST_CATEGORIES[nextIndex].id;
                      setActiveCategory(nextCategoryId);
                      scrollToCategory(nextCategoryId);
                      
                      // Move focus to the next tab
                      const tabs = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                      if (tabs && tabs[nextIndex]) {
                        tabs[nextIndex].focus();
                      }
                    }
                  }}
                  className={cn(
                    "relative flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors touch-manipulation",
                    activeCategory === cat.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  aria-controls={`category-panel-${cat.id}`}
                  tabIndex={activeCategory === cat.id ? 0 : -1}
                  aria-label={`${cat.name} 类别`}
                >
                  {/* Enhancement 1: Sliding pill background */}
                  {activeCategory === cat.id && !prefersReducedMotion && (
                    <motion.span
                      layoutId="active-category-pill"
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      aria-hidden="true"
                    />
                  )}
                  {activeCategory === cat.id && prefersReducedMotion && (
                    <span className="absolute inset-0 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  <span className="relative z-10 flex items-center">
                    <span className="mr-1">{cat.emoji}</span>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        </div>
      </div>

      {/* Onboarding Tooltip - First-time user guidance */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
            className="fixed top-[200px] left-4 right-4 z-30 bg-primary text-primary-foreground dark:bg-gray-900 dark:border dark:border-gray-700 dark:text-gray-100 rounded-xl shadow-lg p-4"
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
            archetypeId={user?.archetype || user?.primaryArchetype}
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

      {/* Live region for screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {lastSelectedTopic && selections[lastSelectedTopic] !== undefined && (() => {
          const level = selections[lastSelectedTopic];
          const topic = getTopicById(lastSelectedTopic);
          if (!topic) return null;

          // For level 0, announce a clear deselection message instead of "已未选择"
          if (level === 0) {
            return `已取消选择 ${topic.label}`;
          }

          return `已${HEAT_LEVELS[level].label} ${topic.label}`;
        })()}
      </div>

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
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center bg-background/50 dark:bg-gray-800/50 rounded-lg px-2 py-2" role="region" aria-label="已选择的兴趣">
                {Object.entries(selections)
                  .filter(([, level]) => level > 0)
                  .slice(0, 6)
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
                {totalSelections > 6 && (
                  <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full flex-shrink-0">
                    +{totalSelections - 6}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="px-4 pb-4 space-y-2">
          {/* Phase 0: Fix #6 - User feedback for minimum selection */}
          {totalSelections < 3 && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-orange-600 dark:text-orange-400 text-center flex items-center justify-center gap-1"
            >
              <AlertCircle className="inline w-4 h-4" />
              还需选择 {3 - totalSelections} 个兴趣才能继续
            </motion.p>
          )}
          
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
            {totalSelections >= 3 ? (
              <>
                完成 <Check className="ml-2 w-5 h-5" />
              </>
            ) : (
              <>已选择 {totalSelections}/3 个</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
