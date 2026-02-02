/**
 * IndustryCascadeSelector - 三层级联行业选择器
 * 
 * 功能：
 * - 第一步：选择行业大类（15个）
 * - 第二步：选择细分领域（基于大类）
 * - 第三步：选择具体赛道（可选，基于细分）
 * - 支持搜索过滤
 * - 支持返回上一步
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Search, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getCategoryGradient } from "@/lib/industryThemes";
import { INDUSTRY_TAXONOMY, type IndustryCategory, type IndustrySegment, type IndustryNiche } from "@shared/industryTaxonomy";

interface SelectedIndustry {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
}

interface IndustryCascadeSelectorProps {
  onSelect: (selection: SelectedIndustry) => void;
  onBack?: () => void;
  className?: string;
  
  // 🆕 New props for enhanced functionality
  initialCategory?: string;      // Pre-set category ID
  initialSegment?: string;       // Pre-set segment ID
  hideCategory?: boolean;        // Hide category selection step
  startFromSegment?: boolean;    // Start from segment level
  compact?: boolean;             // Compact mode for embedded use
}

type Step = "category" | "segment" | "niche";

export function IndustryCascadeSelector({
  onSelect,
  onBack,
  className,
  initialCategory,
  initialSegment,
  hideCategory = false,
  startFromSegment = false,
  compact = false,
}: IndustryCascadeSelectorProps) {
  const prefersReducedMotion = useReducedMotion();
  
  // Validate that initialCategory is provided when hideCategory is true
  if (hideCategory && !initialCategory) {
    console.error("IndustryCascadeSelector: initialCategory must be provided when hideCategory is true");
  }
  
  // Initialize state based on props
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (startFromSegment || hideCategory) return "segment";
    return "category";
  });
  
  const [selectedCategory, setSelectedCategory] = useState<IndustryCategory | null>(() => {
    if (initialCategory) {
      return INDUSTRY_TAXONOMY.find(c => c.id === initialCategory) || null;
    }
    return null;
  });
  
  const [selectedSegment, setSelectedSegment] = useState<IndustrySegment | null>(() => {
    if (initialSegment && initialCategory) {
      const cat = INDUSTRY_TAXONOMY.find(c => c.id === initialCategory);
      return cat?.segments.find(s => s.id === initialSegment) || null;
    }
    return null;
  });
  
  const [searchQuery, setSearchQuery] = useState("");

  // 过滤逻辑
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return INDUSTRY_TAXONOMY;
    const query = searchQuery.toLowerCase();
    return INDUSTRY_TAXONOMY.filter(
      (cat) =>
        cat.label.toLowerCase().includes(query) ||
        cat.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredSegments = useMemo(() => {
    if (!selectedCategory) return [];
    if (!searchQuery.trim()) return selectedCategory.segments;
    const query = searchQuery.toLowerCase();
    return selectedCategory.segments.filter(
      (seg) =>
        seg.label.toLowerCase().includes(query) ||
        seg.id.toLowerCase().includes(query)
    );
  }, [selectedCategory, searchQuery]);

  const filteredNiches = useMemo(() => {
    if (!selectedSegment) return [];
    if (!searchQuery.trim()) return selectedSegment.niches;
    const query = searchQuery.toLowerCase();
    return selectedSegment.niches.filter(
      (niche) =>
        niche.label.toLowerCase().includes(query) ||
        niche.synonyms.some((syn) => syn.toLowerCase().includes(query)) ||
        niche.keywords.some((kw) => kw.toLowerCase().includes(query))
    );
  }, [selectedSegment, searchQuery]);

  // 选择大类
  const handleCategorySelect = (category: IndustryCategory) => {
    setSelectedCategory(category);
    setSelectedSegment(null);
    setSearchQuery("");
    setCurrentStep("segment");
  };

  // 选择细分
  const handleSegmentSelect = (segment: IndustrySegment) => {
    setSelectedSegment(segment);
    setSearchQuery("");
    
    // 如果该细分下有赛道，进入第三步；否则直接确认
    if (segment.niches.length > 0) {
      setCurrentStep("niche");
    } else {
      // 没有赛道，直接返回结果
      if (selectedCategory) {
        onSelect({
          category: { id: selectedCategory.id, label: selectedCategory.label },
          segment: { id: segment.id, label: segment.label },
        });
      }
    }
  };

  // 选择赛道
  const handleNicheSelect = (niche: IndustryNiche) => {
    if (selectedCategory && selectedSegment) {
      onSelect({
        category: { id: selectedCategory.id, label: selectedCategory.label },
        segment: { id: selectedSegment.id, label: selectedSegment.label },
        niche: { id: niche.id, label: niche.label },
      });
    }
  };

  // 跳过赛道选择（直接确认细分）
  const handleSkipNiche = () => {
    if (selectedCategory && selectedSegment) {
      onSelect({
        category: { id: selectedCategory.id, label: selectedCategory.label },
        segment: { id: selectedSegment.id, label: selectedSegment.label },
      });
    }
  };

  // 返回上一步
  const handleGoBack = () => {
    setSearchQuery("");
    if (currentStep === "segment" && !hideCategory) {
      setCurrentStep("category");
      setSelectedCategory(null);
    } else if (currentStep === "niche") {
      setCurrentStep("segment");
      setSelectedSegment(null);
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-4", className)}>
      {/* Locked Category Alert */}
      {hideCategory && selectedCategory && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {selectedCategory.icon} {selectedCategory.label}
            </Badge>
            <span className="text-muted-foreground">已锁定大类</span>
          </div>
        </div>
      )}
      
      {/* Instagram Stories-style Progress Indicator */}
      {!hideCategory && (
        <div className="flex gap-1.5">
          {["category", "segment", "niche"].map((step, index) => {
            const isActive = 
              (step === "category" && currentStep === "category") ||
              (step === "segment" && (currentStep === "segment" || currentStep === "niche")) ||
              (step === "niche" && currentStep === "niche");
            const isCompleted = 
              (step === "category" && (currentStep === "segment" || currentStep === "niche")) ||
              (step === "segment" && currentStep === "niche");
            
            return (
              <div
                key={step}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-300",
                  isActive && "bg-gradient-to-r from-purple-500 to-pink-500",
                  isCompleted && "bg-primary",
                  !isActive && !isCompleted && "bg-gray-200 dark:bg-gray-700"
                )}
              />
            );
          })}
        </div>
      )}
      
      {/* Adjusted Progress for 2-step flow when category is hidden */}
      {hideCategory && (
        <div className="flex gap-1.5">
          {["segment", "niche"].map((step, index) => {
            const isActive = 
              (step === "segment" && (currentStep === "segment" || currentStep === "niche")) ||
              (step === "niche" && currentStep === "niche");
            const isCompleted = 
              (step === "segment" && currentStep === "niche");
            
            return (
              <div
                key={step}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-300",
                  isActive && "bg-gradient-to-r from-purple-500 to-pink-500",
                  isCompleted && "bg-primary",
                  !isActive && !isCompleted && "bg-gray-200 dark:bg-gray-700"
                )}
              />
            );
          })}
        </div>
      )}

      {/* 面包屑导航 */}
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", compact && "text-xs")}>
        {!hideCategory && (
          <>
            <span className={cn("font-medium", currentStep === "category" && "text-foreground")}>
              选择大类
            </span>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className={cn("font-medium", currentStep === "segment" && "text-foreground")}>
                  选择细分
                </span>
              </>
            )}
          </>
        )}
        {hideCategory && (
          <span className={cn("font-medium", currentStep === "segment" && "text-foreground")}>
            选择细分领域
          </span>
        )}
        {selectedSegment && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className={cn("font-medium", currentStep === "niche" && "text-foreground")}>
              选择赛道（可选）
            </span>
          </>
        )}
      </div>

      {/* 已选择路径 */}
      {(selectedCategory || selectedSegment) && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          {selectedCategory && (
            <Badge variant="default">{selectedCategory.label}</Badge>
          )}
          {selectedSegment && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
              <Badge variant="secondary">{selectedSegment.label}</Badge>
            </>
          )}
        </div>
      )}

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            currentStep === "category"
              ? "搜索行业大类..."
              : currentStep === "segment"
              ? "搜索细分领域..."
              : "搜索具体赛道..."
          }
          className="pl-10"
        />
      </div>

      {/* 选项列表 */}
      <ScrollArea className={cn(compact ? "h-[300px]" : "h-[400px]", "rounded-lg border")}>
        <div className={cn(compact ? "p-2 space-y-1.5" : "p-4 space-y-2")}>
          {/* 第一步：选择大类 - Pinterest style grid */}
          {currentStep === "category" && !hideCategory && (
            <div className="grid grid-cols-2 gap-3">
              {filteredCategories.map((category, index) => (
                <motion.button
                  key={category.id}
                  initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : index * 0.03, duration: prefersReducedMotion ? 0.15 : 0.3 }}
                  onClick={() => handleCategorySelect(category)}
                  className="relative aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary hover:shadow-lg transition-all group"
                  style={prefersReducedMotion ? undefined : {
                    // Performance: hint that this element's transform will change
                    willChange: "transform",
                  }}
                >
                  {/* Gradient background with pattern overlay */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity",
                    getCategoryGradient(category.id)
                  )} />
                  
                  {/* Pattern overlay */}
                  <div className="absolute inset-0 opacity-10">
                    {/* Light mode pattern */}
                    <div
                      className="absolute inset-0 dark:hidden"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.05) 10px, rgba(0,0,0,.05) 20px)",
                      }}
                    />
                    {/* Dark mode pattern */}
                    <div
                      className="absolute inset-0 hidden dark:block"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.08) 10px, rgba(255,255,255,.08) 20px)",
                      }}
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                    {/* Emoji with floating animation - Performance: disabled in reduced motion */}
                    <motion.span
                      className="text-4xl mb-2"
                      animate={prefersReducedMotion ? {} : {
                        y: [0, -5, 0],
                      }}
                      transition={prefersReducedMotion ? undefined : {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {category.icon}
                    </motion.span>
                    
                    <span className="font-black text-sm text-white drop-shadow-md">
                      {category.label}
                    </span>
                    
                    <span className="text-xs text-white/80 mt-1">
                      {category.segments.length} 个细分
                    </span>
                    
                    {/* Hot badge for priority 1 */}
                    {category.priority === 1 && (
                      <Badge className="absolute top-2 right-2 bg-red-500 text-white border-0">
                        🔥 热门
                      </Badge>
                    )}
                  </div>
                  
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </motion.button>
              ))}
            </div>
          )}

          {/* 第二步：选择细分 - Vertical list with animations */}
          {currentStep === "segment" && (
            <div className="space-y-2">
              {filteredSegments.map((segment, index) => (
                <motion.button
                  key={segment.id}
                  initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : index * 0.05, duration: prefersReducedMotion ? 0.15 : 0.3 }}
                  onClick={() => handleSegmentSelect(segment)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-transparent hover:border-primary hover:bg-primary/5 transition-all text-left group"
                  style={prefersReducedMotion ? undefined : {
                    // Performance: hint browser about upcoming transforms
                    willChange: "transform",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Category emoji in gradient circle */}
                    {selectedCategory && (
                      <div className={cn(
                        "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0",
                        getCategoryGradient(selectedCategory.id)
                      )}>
                        <span className="text-2xl">{selectedCategory.icon}</span>
                      </div>
                    )}
                    
                    <div>
                      <div className="text-lg font-bold">{segment.label}</div>
                      {segment.niches.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {segment.niches.length} 个具体赛道
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Animated arrow - Performance: disabled in reduced motion */}
                  <motion.div
                    className="text-muted-foreground"
                    animate={prefersReducedMotion ? {} : { x: [0, 5, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </motion.div>
                </motion.button>
              ))}
            </div>
          )}

          {/* 第三步：选择赛道 - Rounded-full chips */}
          {currentStep === "niche" && (
            <div className="flex flex-wrap gap-2">
              {filteredNiches.map((niche, index) => (
                <motion.button
                  key={niche.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={prefersReducedMotion ? false : { opacity: 1, scale: 1 }}
                  transition={prefersReducedMotion ? undefined : { 
                    delay: index * 0.03,
                    type: "spring",
                    stiffness: 300,
                    damping: 20
                  }}
                  onClick={() => handleNicheSelect(niche)}
                  className="px-4 py-2 rounded-full border-2 border-purple-200 dark:border-purple-800 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all text-sm font-medium"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                >
                  {niche.label}
                </motion.button>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {((currentStep === "category" && filteredCategories.length === 0) ||
            (currentStep === "segment" && filteredSegments.length === 0) ||
            (currentStep === "niche" && filteredNiches.length === 0)) && (
            <div className="text-center py-8 text-muted-foreground">
              没有找到匹配的选项
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部操作按钮 */}
      <div className="flex gap-2">
        {currentStep !== "category" ? (
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            上一步
          </Button>
        ) : (
          onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              返回
            </Button>
          )
        )}

        {/* 在赛道选择步骤，允许跳过 */}
        {currentStep === "niche" && selectedSegment && (
          <Button
            onClick={handleSkipNiche}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            跳过，就选 {selectedSegment.label}
          </Button>
        )}
      </div>
    </div>
  );
}
