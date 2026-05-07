import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Target, MessageCircle, Users, Briefcase } from "lucide-react";
import { useState } from "react";

interface MatchPoint {
  id: string;
  label: string;
  icon: typeof Users;
  description: string;
}

interface MatchPointValidationProps {
  matchPoints: MatchPoint[];
  initialData?: Record<string, { discussed: string; notes?: string }>;
  onNext: (data: { validation: Record<string, { discussed: string; notes?: string }>; additional: string }) => void;
  onSkip: () => void;
}

const discussionLevels = [
  { value: "deeply", label: "深入聊到了", color: "bg-primary text-primary-foreground" },
  { value: "briefly", label: "简单提及", color: "bg-muted" },
  { value: "not", label: "没聊到", color: "bg-muted/50" },
];

export default function MatchPointValidation({ 
  matchPoints, 
  initialData = {}, 
  onNext, 
  onSkip 
}: MatchPointValidationProps) {
  const [validation, setValidation] = useState<Record<string, { discussed: string; notes?: string }>>(initialData);
  const [additionalPoints, setAdditionalPoints] = useState("");

  const handleDiscussionSelect = (pointId: string, level: string) => {
    setValidation(prev => ({
      ...prev,
      [pointId]: { ...prev[pointId], discussed: level }
    }));
  };

  const handleSubmit = () => {
    onNext({ validation, additional: additionalPoints });
  };

  const completedCount = Object.values(validation).filter(v => v.discussed).length;
  const canProceed = completedCount >= 1; // At least one match point rated

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">帮助我们校准匹配算法</h2>
            <p className="text-sm text-muted-foreground">这些共同点在实际交流中起作用了吗？</p>
          </div>
        </div>

        {/* Privacy Notice */}
        <Card className="bg-muted/30">
          <CardContent className="p-3 flex items-start gap-2">
            <div className="text-sm">
              <span className="font-medium">🔒 你的反馈安全承诺：</span>
              <span className="text-muted-foreground ml-1">
                所有评价严格匿名处理，数据仅用于算法优化
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">可选问题 1/3</span>
        <Badge variant="outline">
          已评价 {completedCount}/{matchPoints.length}
        </Badge>
      </div>

      {/* Match Points List */}
      <div className="space-y-4">
        {matchPoints.map((point, index) => {
          const Icon = point.icon;
          const selectedLevel = validation[point.id]?.discussed;

          return (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={selectedLevel ? "border-primary/30" : ""}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-primary mt-1" />
                    <div className="flex-1">
                      <h3 className="font-semibold">{point.label}</h3>
                      <p className="text-sm text-muted-foreground">{point.description}</p>
                    </div>
                  </div>

                  {/* Discussion Level Selection */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">这个话题：</p>
                    <div className="flex gap-2">
                      {discussionLevels.map(level => (
                        <Button
                          key={level.value}
                          variant={selectedLevel === level.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleDiscussionSelect(point.id, level.value)}
                          className={selectedLevel === level.value ? level.color : ""}
                          data-testid={`button-level-${point.id}-${level.value}`}
                        >
                          {level.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Additional Match Points */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">💡 还有其他促进交流的共同点吗？</h3>
            </div>
            <Textarea
              placeholder="例如：都喜欢旅行、都关注科技新闻、都在学日语..."
              value={additionalPoints}
              onChange={(e) => setAdditionalPoints(e.target.value)}
              className="min-h-20"
              data-testid="textarea-additional-points"
            />
            <p className="text-xs text-muted-foreground">
              可选填写 · 帮助我们发现更多有价值的匹配维度
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Value Impact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-lg bg-primary/5 border border-primary/10"
      >
        <p className="text-sm">
          <span className="font-medium text-primary">💫 每个反馈都在创造价值</span>
          <span className="text-muted-foreground ml-2">
            基于用户们的深度反馈，我们已优化了「职业背景」匹配逻辑，发现了「价值观相似」的重要性
          </span>
        </p>
      </motion.div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="flex-1"
          data-testid="button-skip"
        >
          跳过这一步
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleSubmit}
          disabled={!canProceed}
          className="flex-1"
          data-testid="button-next"
        >
          下一步
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-center text-xs text-muted-foreground">
        你可以随时跳过不感兴趣的部分 · 部分完成也有价值
      </p>
    </div>
  );
}
