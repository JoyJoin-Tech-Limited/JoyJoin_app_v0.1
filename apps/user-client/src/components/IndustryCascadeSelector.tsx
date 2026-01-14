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
import { ChevronRight, Search, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
}

type Step = "category" | "segment" | "niche";

export function IndustryCascadeSelector({
  onSelect,
  onBack,
  className,
}: IndustryCascadeSelectorProps) {
  const [currentStep, setCurrentStep] = useState<Step>("category");
  const [selectedCategory, setSelectedCategory] = useState<IndustryCategory | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<IndustrySegment | null>(null);
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
    if (currentStep === "segment") {
      setCurrentStep("category");
      setSelectedCategory(null);
    } else if (currentStep === "niche") {
      setCurrentStep("segment");
      setSelectedSegment(null);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
      <ScrollArea className="h-[400px] rounded-lg border">
        <div className="p-4 space-y-2">
          {/* 第一步：选择大类 */}
          {currentStep === "category" &&
            filteredCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category)}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <div className="font-medium">{category.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.segments.length} 个细分领域
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}

          {/* 第二步：选择细分 */}
          {currentStep === "segment" &&
            filteredSegments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => handleSegmentSelect(segment)}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <div className="font-medium">{segment.label}</div>
                  {segment.niches.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {segment.niches.length} 个具体赛道
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}

          {/* 第三步：选择赛道 */}
          {currentStep === "niche" &&
            filteredNiches.map((niche) => (
              <button
                key={niche.id}
                onClick={() => handleNicheSelect(niche)}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <div className="font-medium">{niche.label}</div>
                  {niche.synonyms.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {niche.synonyms.slice(0, 3).join("、")}
                    </div>
                  )}
                </div>
              </button>
            ))}

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
        {currentStep === "niche" && (
          <Button
            onClick={handleSkipNiche}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            跳过，不选择具体赛道
          </Button>
        )}
      </div>
    </div>
  );
}
