import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, ChevronRight, ChevronDown, Lightbulb, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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

interface OccupationSelectorProps {
  selectedOccupationId: string | null;
  selectedWorkMode: WorkMode | null;
  socialIntent: string | null;
  onOccupationChange: (occupationId: string, industryId: string) => void;
  onWorkModeChange: (workMode: WorkMode) => void;
  className?: string;
}

const QUICK_INDUSTRIES = ["tech", "finance", "ecommerce", "marketing"];

export function OccupationSelector({
  selectedOccupationId,
  selectedWorkMode,
  socialIntent,
  onOccupationChange,
  onWorkModeChange,
  className = "",
}: OccupationSelectorProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestOccupation, setRequestOccupation] = useState("");
  const [showWorkModeStep, setShowWorkModeStep] = useState(false);
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

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

  const handleOccupationSelect = useCallback((occupation: Occupation) => {
    onOccupationChange(occupation.id, occupation.industryId);
    setSearchQuery("");
    setShowWorkModeStep(true);
    setExpandedIndustry(null);
  }, [onOccupationChange]);

  const handleRequestSubmit = useCallback(() => {
    if (!requestOccupation.trim()) return;
    
    toast({
      title: "已提交职业补充申请",
      description: "运营团队审核后会加入系统，我们会通知你",
    });
    setRequestOccupation("");
    setIsRequestDialogOpen(false);
  }, [requestOccupation, toast]);

  const toggleIndustry = useCallback((industryId: string) => {
    setExpandedIndustry(prev => prev === industryId ? null : industryId);
  }, []);

  const renderIndustrySection = (industry: { id: string; label: string }) => {
    const isExpanded = expandedIndustry === industry.id;
    const occupations = getOccupationsByIndustry(industry.id);
    
    return (
      <div key={industry.id} className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleIndustry(industry.id)}
          className="w-full flex items-center justify-between p-3 hover-elevate text-left"
          data-testid={`industry-${industry.id}`}
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
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-sm
                        ${isSelected 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover-elevate"
                        }
                      `}
                      data-testid={`occupation-tag-${occ.id}`}
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
    <div className={`space-y-4 ${className}`}>
      <div>
        <Label className="text-base font-medium">{guidance.title}</Label>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-primary" />
          {guidance.subtitle}
        </p>
      </div>

      {selectedOccupation && selectedWorkMode ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-primary/30 bg-primary/5"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedOccupation.displayName}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {WORK_MODE_LABELS[selectedWorkMode]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedIndustry?.label}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onOccupationChange("", "");
                setShowWorkModeStep(false);
              }}
              data-testid="button-change-occupation"
            >
              更改
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-sm text-primary/80">{guidance.matchPreview}</p>
          </div>
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
              data-testid="input-occupation-search"
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
                      data-testid={`search-result-${occ.id}`}
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

          {!searchQuery && (
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
                    data-testid="button-show-all-industries"
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
                      data-testid="button-collapse-industries"
                    >
                      收起
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                data-testid="button-request-occupation"
              >
                找不到？提交职业补充申请
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>职业补充申请</DialogTitle>
                <DialogDescription>
                  请描述你的职业，运营团队审核后会将其加入系统
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Textarea
                  placeholder="请输入你的职业名称和简要描述..."
                  value={requestOccupation}
                  onChange={(e) => setRequestOccupation(e.target.value)}
                  rows={3}
                  data-testid="input-request-occupation"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRequestDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRequestSubmit}
                    disabled={!requestOccupation.trim()}
                    data-testid="button-submit-request"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    提交申请
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <AnimatePresence>
            {showWorkModeStep && selectedOccupation && !selectedWorkMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3 pt-4 border-t"
              >
                <div>
                  <Label className="text-base font-medium">你的身份是？</Label>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    不同身份有不同的社交节奏
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {WORK_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onWorkModeChange(mode)}
                      className={`
                        p-3 rounded-lg border transition-all text-left
                        ${selectedWorkMode === mode
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                        }
                      `}
                      data-testid={`workmode-${mode}`}
                    >
                      <div className="font-medium text-sm">
                        {WORK_MODE_LABELS[mode]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {WORK_MODE_DESCRIPTIONS[mode]}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

export function OccupationDisplay({
  occupationId,
  workMode,
  showIndustry = true,
}: {
  occupationId: string;
  workMode?: WorkMode | null;
  showIndustry?: boolean;
}) {
  const occupation = getOccupationById(occupationId);
  const industry = occupation ? getIndustryById(occupation.industryId) : null;

  if (!occupation) {
    return <span className="text-muted-foreground">未知职业</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{occupation.displayName}</span>
      {workMode && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{WORK_MODE_LABELS[workMode]}</span>
        </>
      )}
      {showIndustry && industry && (
        <Badge variant="secondary" className="text-xs">
          {industry.label}
        </Badge>
      )}
    </span>
  );
}
