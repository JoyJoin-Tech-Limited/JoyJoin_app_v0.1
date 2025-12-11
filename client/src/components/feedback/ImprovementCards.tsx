import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Check, Target, Dice5, Home, BookOpen, Clock, UtensilsCrossed, Lightbulb } from "lucide-react";

interface ImprovementCardsProps {
  initialAreas?: string[];
  initialOther?: string;
  onNext: (data: { improvementAreas?: string[]; improvementOther?: string }) => void;
  isSubmitting?: boolean;
}

const IMPROVEMENT_OPTIONS = [
  { id: "matching", label: "更精准的匹配算法", icon: Target, description: "提升桌友匹配度" },
  { id: "icebreaker", label: "更有趣的破冰环节", icon: Dice5, description: "快速打开话题" },
  { id: "venue", label: "更舒适的活动场地", icon: Home, description: "提升环境体验" },
  { id: "theme", label: "更明确的主题引导", icon: BookOpen, description: "让聊天更有方向" },
  { id: "timing", label: "优化活动时间安排", icon: Clock, description: "更合理的时长" },
  { id: "food", label: "更好的餐饮选择", icon: UtensilsCrossed, description: "提升用餐体验" },
];

export default function ImprovementCards({
  initialAreas = [],
  initialOther = "",
  onNext,
  isSubmitting = false,
}: ImprovementCardsProps) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialAreas);
  const [otherSuggestion, setOtherSuggestion] = useState(initialOther);

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev => {
      if (prev.includes(areaId)) {
        return prev.filter(id => id !== areaId);
      } else if (prev.length < 3) {
        return [...prev, areaId];
      } else {
        // Max 3 selections - replace the first one
        return [...prev.slice(1), areaId];
      }
    });
  };

  const handleSubmit = () => {
    onNext({
      improvementAreas: selectedAreas.length > 0 ? selectedAreas : undefined,
      improvementOther: otherSuggestion.trim() || undefined,
    });
  };

  const canSubmit = selectedAreas.length > 0 || otherSuggestion.trim().length > 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, ease: "backOut" }}
            >
              <Target className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.h2 
              className="text-xl font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              让下次更完美
            </motion.h2>
            <motion.p 
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              选择最重要的改进方向（最多3项）
            </motion.p>
          </div>

          {/* Selection Counter */}
          <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">已选择</span>
            <span className="font-medium text-primary">
              {selectedAreas.length}/3
            </span>
          </div>

          {/* Improvement Cards Grid */}
          <div className="grid grid-cols-1 gap-3">
            {IMPROVEMENT_OPTIONS.map((option, index) => {
              const isSelected = selectedAreas.includes(option.id);
              const selectionOrder = selectedAreas.indexOf(option.id) + 1;

              return (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => toggleArea(option.id)}
                    className={`relative w-full p-4 rounded-lg border-2 text-left transition-all hover-elevate active-elevate-2 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                        : "border-border bg-background"
                    }`}
                    data-testid={`improvement-card-${option.id}`}
                  >
                    {isSelected && (
                      <motion.div
                        className="absolute inset-0 rounded-lg bg-primary/10 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                    <div className="relative z-10 flex items-start gap-3">
                      {/* Icon & Check */}
                      <div className="relative flex-shrink-0">
                        <motion.div
                          animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <option.icon className="h-6 w-6 text-primary" />
                        </motion.div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center"
                          >
                            <span className="text-xs font-bold">{selectionOrder}</span>
                          </motion.div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      </div>

                      {/* Checkmark */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <Check className="h-5 w-5 text-primary" />
                        </motion.div>
                      )}
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Other Suggestions */}
          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span>其他建议</span>
            </label>
            <Textarea
              value={otherSuggestion}
              onChange={(e) => setOtherSuggestion(e.target.value)}
              placeholder="有其他想法吗？写下来告诉我们..."
              rows={3}
              maxLength={200}
              className="resize-none"
              data-testid="textarea-other-suggestion"
            />
            <p className="text-xs text-muted-foreground text-right">
              {otherSuggestion.length}/200
            </p>
          </div>

          {/* Submit Button */}
          <div className="space-y-2">
            <Button 
              onClick={handleSubmit} 
              size="lg" 
              className="w-full"
              disabled={!canSubmit || isSubmitting}
              data-testid="button-submit-feedback"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  提交中...
                </>
              ) : (
                "完成反馈"
              )}
            </Button>
            {!canSubmit && (
              <p className="text-xs text-center text-muted-foreground">
                请至少选择一项改进方向或填写其他建议
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insight */}
      {selectedAreas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg bg-muted/50 space-y-2"
        >
          <p className="text-sm font-medium">你的反馈将帮助优化：</p>
          <div className="flex flex-wrap gap-2">
            {selectedAreas.map((areaId) => {
              const option = IMPROVEMENT_OPTIONS.find(o => o.id === areaId);
              return option ? (
                <Badge key={areaId} variant="secondary" className="text-xs flex items-center gap-1">
                  <option.icon className="h-3 w-3" />
                  <span>{option.label}</span>
                </Badge>
              ) : null;
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
