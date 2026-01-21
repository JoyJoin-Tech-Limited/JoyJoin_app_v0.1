/**
 * EnhancedOccupationSelector - 混合智能职业与行业选择器
 * 
 * Features:
 * 1. Base occupation selection (from existing OccupationSelector)
 * 2. Auto AI inference when occupation is selected
 * 3. Two refinement options:
 *    a) Natural language dialog
 *    b) Manual cascade selector
 * 4. Work status selection
 * 5. Final preview of all tags
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Check, 
  ChevronRight, 
  ChevronDown, 
  Lightbulb, 
  Send, 
  Loader2,
  Sparkles,
  Edit,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  OCCUPATIONS,
  INDUSTRIES,
  searchOccupations,
  getOccupationById,
  getIndustryById,
  getOccupationsByIndustry,
  getOccupationGuidance,
  type Occupation,
  type WorkMode,
} from "@shared/occupations";
import {
  WORK_MODE_OPTIONS,
  WORK_MODE_LABELS,
  WORK_MODE_DESCRIPTIONS,
} from "@shared/constants";
import { getIndustryPathLabels } from "@shared/industryTaxonomy";
import { IndustryCascadeSelector } from "./IndustryCascadeSelector";
import { cn } from "@/lib/utils";

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <span>{text}</span>;
  }
  
  const q = query.toLowerCase().trim();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(q);
  
  if (index === -1) {
    return <span>{text}</span>;
  }
  
  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);
  
  return (
    <span>
      {before}
      <span className="text-primary font-semibold">{match}</span>
      {after}
    </span>
  );
}

interface EnhancedOccupationSelectorProps {
  selectedOccupationId: string | null;
  selectedWorkMode: WorkMode | null;
  socialIntent: string | null;
  industryCategory: string;
  industrySegment: string;
  industryNiche?: string;
  onOccupationChange: (occupationId: string, industryId: string) => void;
  onWorkModeChange: (workMode: WorkMode) => void;
  onIndustryChange: (
    categoryId: string, 
    segmentId: string, 
    nicheId?: string,
    labels?: { category: string; segment: string; niche?: string }
  ) => void;
}

const QUICK_INDUSTRIES = ["tech", "finance", "ecommerce", "marketing"];

export function EnhancedOccupationSelector({
  selectedOccupationId,
  selectedWorkMode,
  socialIntent,
  industryCategory,
  industrySegment,
  industryNiche,
  onOccupationChange,
  onWorkModeChange,
  onIndustryChange,
}: EnhancedOccupationSelectorProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [showIndustryBrowser, setShowIndustryBrowser] = useState(true);
  
  // AI inference state
  const [aiInferenceStatus, setAiInferenceStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  
  // Refinement state
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementMode, setRefinementMode] = useState<'natural' | 'manual' | null>(null);
  const [naturalDescription, setNaturalDescription] = useState("");

  const guidance = useMemo(() => {
    return getOccupationGuidance(socialIntent || "flexible");
  }, [socialIntent]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchOccupations(searchQuery).slice(0, 8);
  }, [searchQuery]);

  const selectedOccupation = useMemo(() => {
    if (!selectedOccupationId) return null;
    return getOccupationById(selectedOccupationId);
  }, [selectedOccupationId]);

  const selectedIndustry = useMemo(() => {
    if (!selectedOccupation) return null;
    return getIndustryById(selectedOccupation.industryId);
  }, [selectedOccupation]);

  const quickIndustries = useMemo(() => {
    return INDUSTRIES.filter(ind => QUICK_INDUSTRIES.includes(ind.id));
  }, []);

  const allIndustries = useMemo(() => {
    return INDUSTRIES.filter(ind => !QUICK_INDUSTRIES.includes(ind.id));
  }, []);

  // AI classification mutation
  const classifyMutation = useMutation({
    mutationFn: async (data: { description: string; context?: any }) => {
      const response = await apiRequest('/api/inference/classify-industry', 'POST', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      setAiInferenceStatus('success');
      setAiConfidence(data.confidence);
      setAiReasoning(data.reasoning || "");
      
      // Update industry
      onIndustryChange(
        data.category.id,
        data.segment.id,
        data.niche?.id,
        {
          category: data.category.label,
          segment: data.segment.label,
          niche: data.niche?.label,
        }
      );
    },
    onError: () => {
      setAiInferenceStatus('error');
      toast({
        title: "AI 分类失败",
        description: "请手动选择行业分类",
        variant: "destructive",
      });
    },
  });

  // Auto-trigger AI classification when occupation is selected
  useEffect(() => {
    if (selectedOccupationId && !industryCategory) {
      const occupation = getOccupationById(selectedOccupationId);
      if (occupation) {
        setAiInferenceStatus('loading');
        classifyMutation.mutate({
          description: occupation.displayName,
          context: {
            occupationId: selectedOccupationId,
            source: 'occupation_selector',
          },
        });
      }
    }
  }, [selectedOccupationId]);

  const handleOccupationSelect = useCallback((occupation: Occupation) => {
    onOccupationChange(occupation.id, occupation.industryId);
    setSearchQuery("");
    setExpandedIndustry(null);
    setShowIndustryBrowser(false);
  }, [onOccupationChange]);

  const toggleIndustry = useCallback((industryId: string) => {
    setExpandedIndustry(prev => prev === industryId ? null : industryId);
  }, []);

  const handleNaturalRefinement = useCallback(() => {
    if (!naturalDescription.trim()) return;
    
    classifyMutation.mutate({
      description: naturalDescription,
      context: {
        lockedCategoryId: industryCategory,
        source: 'manual_input',
      },
    });
    
    setRefinementMode(null);
    setNaturalDescription("");
  }, [naturalDescription, industryCategory, classifyMutation]);

  const renderIndustrySection = (industry: { id: string; label: string }) => {
    const isExpanded = expandedIndustry === industry.id;
    const occupations = getOccupationsByIndustry(industry.id);
    
    return (
      <div key={industry.id} className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleIndustry(industry.id)}
          className="w-full flex items-center justify-between p-3 hover-elevate text-left"
        >
          <span className="font-medium">{industry.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{occupations.length}个职业</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t"
            >
              <div className="p-3 flex flex-wrap gap-2">
                {occupations.map((occ) => {
                  const isSelected = selectedOccupationId === occ.id;
                  return (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => handleOccupationSelect(occ)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-sm",
                        isSelected 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover-elevate"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      <span>{occ.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">{guidance.title}</Label>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-primary" />
          {guidance.subtitle}
        </p>
      </div>

      {selectedOccupation ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4"
        >
          {/* Occupation Display */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedOccupation.displayName}</span>
                {selectedWorkMode && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {WORK_MODE_LABELS[selectedWorkMode]}
                    </span>
                  </>
                )}
              </div>
              {selectedIndustry && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedIndustry.label}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onOccupationChange("", "");
                setShowIndustryBrowser(true);
                setAiInferenceStatus('idle');
              }}
            >
              更改
            </Button>
          </div>

          {/* AI Inference Status */}
          {aiInferenceStatus === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI 正在分析行业分类...</span>
            </div>
          )}

          {aiInferenceStatus === 'success' && (
            <div className="space-y-2">
              {/* AI Result Display */}
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI 推荐分类</span>
                {aiConfidence >= 0.8 ? (
                  <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                    高置信度 ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                    建议确认 ⚠
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {industryCategory && (
                  <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                    {getIndustryPathLabels(industryCategory).category}
                  </Badge>
                )}
                {industrySegment && (
                  <Badge variant="secondary">
                    {getIndustryPathLabels(industryCategory, industrySegment).segment}
                  </Badge>
                )}
                {industryNiche && (
                  <Badge variant="outline">
                    {getIndustryPathLabels(industryCategory, industrySegment, industryNiche).niche}
                  </Badge>
                )}
              </div>
              
              {aiReasoning && (
                <p className="text-xs text-muted-foreground italic">
                  "{aiReasoning}"
                </p>
              )}
              
              {/* Refinement Options */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRefinement(!showRefinement)}
                className="text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                {showRefinement ? "收起" : "精细调整"}
              </Button>
            </div>
          )}

          {/* Refinement Section */}
          <AnimatePresence>
            {showRefinement && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-3 border-t border-primary/20"
              >
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={refinementMode === 'natural' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRefinementMode('natural')}
                    className="flex-1"
                  >
                    自然语言描述
                  </Button>
                  <Button
                    type="button"
                    variant={refinementMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRefinementMode('manual')}
                    className="flex-1"
                  >
                    手动选择
                  </Button>
                </div>

                {refinementMode === 'natural' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="例：我主要做B2B SaaS产品的用户增长..."
                      value={naturalDescription}
                      onChange={(e) => setNaturalDescription(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNaturalRefinement}
                      disabled={!naturalDescription.trim() || classifyMutation.isPending}
                      className="w-full"
                    >
                      {classifyMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          分析中...
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3 mr-1" />
                          提交
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {refinementMode === 'manual' && (
                  <IndustryCascadeSelector
                    onSelect={(selection) => {
                      onIndustryChange(
                        selection.category.id,
                        selection.segment.id,
                        selection.niche?.id,
                        {
                          category: selection.category.label,
                          segment: selection.segment.label,
                          niche: selection.niche?.label,
                        }
                      );
                      setRefinementMode(null);
                      setShowRefinement(false);
                    }}
                    initialCategory={industryCategory}
                    hideCategory={true}
                    startFromSegment={true}
                    compact={true}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Work Status Selection */}
          {aiInferenceStatus === 'success' && (
            <div className="pt-3 border-t border-primary/20 space-y-3">
              <div>
                <p className="text-sm font-medium">你的身份是？</p>
                <p className="text-xs text-muted-foreground mt-0.5">不同身份有不同的社交节奏</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {WORK_MODE_OPTIONS.map((mode) => {
                  const isSelected = selectedWorkMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onWorkModeChange(mode)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all",
                        isSelected 
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30" 
                          : "border-border hover-elevate"
                      )}
                    >
                      <div className={cn("font-medium text-sm", isSelected ? "text-primary" : "")}>
                        {WORK_MODE_LABELS[mode]}
                      </div>
                      <div className={cn("text-xs mt-0.5", isSelected ? "text-primary/70" : "text-muted-foreground")}>
                        {WORK_MODE_DESCRIPTIONS[mode]}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedWorkMode && (
                <p className="text-sm text-primary/80 pt-2">{guidance.matchPreview}</p>
              )}
            </div>
          )}

          {/* Final Tag Preview */}
          {selectedWorkMode && industryCategory && (
            <div className="pt-3 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-2">同桌可见标签：</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                  {selectedIndustry?.label}
                </Badge>
                <Badge variant="secondary">
                  {WORK_MODE_LABELS[selectedWorkMode]}
                </Badge>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="输入职业名称、行业关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border rounded-lg divide-y overflow-hidden"
              >
                {searchResults.map((occ) => {
                  const industry = getIndustryById(occ.industryId);
                  return (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => handleOccupationSelect(occ)}
                      className="w-full flex items-center justify-between p-3 hover-elevate text-left"
                    >
                      <div>
                        <span className="font-medium">
                          <HighlightText text={occ.displayName} query={searchQuery} />
                        </span>
                        {industry && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (<HighlightText text={industry.label} query={searchQuery} />)
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {!searchQuery && showIndustryBrowser && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">快速浏览</p>
              <div className="space-y-2">
                {quickIndustries.map(industry => renderIndustrySection(industry))}
                
                {!showAllIndustries ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllIndustries(true)}
                  >
                    更多行业
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <>
                    {allIndustries.map(industry => renderIndustrySection(industry))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowAllIndustries(false)}
                    >
                      收起
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
