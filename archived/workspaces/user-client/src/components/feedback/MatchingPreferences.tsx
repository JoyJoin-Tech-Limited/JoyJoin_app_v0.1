import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Lightbulb, Check } from "lucide-react";
import { useState } from "react";

interface PreferenceOption {
  id: string;
  icon: string;
  label: string;
  description: string;
}

interface MatchingPreferencesProps {
  initialData?: {
    preferences?: string[];
    other?: string;
  };
  onNext: (data: { preferences: string[]; other: string }) => void;
  onSkip: () => void;
}

const preferenceOptions: PreferenceOption[] = [
  {
    id: "diversity",
    icon: "🌈",
    label: "遇到更多不同背景的伙伴",
    description: "跨行业、跨领域、多元化视角"
  },
  {
    id: "deep_topics",
    icon: "💡",
    label: "有更深入的专题讨论",
    description: "减少寒暄，聚焦某个话题深入交流"
  },
  {
    id: "casual",
    icon: "☕",
    label: "更多轻松愉快的交流",
    description: "不那么严肃，更随意自然的氛围"
  },
  {
    id: "similar_stage",
    icon: "🎯",
    label: "相似人生阶段的伙伴",
    description: "年龄、职业发展阶段更接近"
  },
  {
    id: "shared_hobbies",
    icon: "🎨",
    label: "有共同兴趣爱好的朋友",
    description: "运动、艺术、科技等具体兴趣契合"
  },
  {
    id: "networking",
    icon: "🤝",
    label: "建立有价值的职业联系",
    description: "可能产生合作或职业发展机会"
  },
];

export default function MatchingPreferences({ 
  initialData = {}, 
  onNext, 
  onSkip 
}: MatchingPreferencesProps) {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
    initialData.preferences ?? []
  );
  const [otherPreference, setOtherPreference] = useState(initialData.other ?? "");

  const togglePreference = (id: string) => {
    setSelectedPreferences(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = () => {
    onNext({ preferences: selectedPreferences, other: otherPreference });
  };

  const canProceed = selectedPreferences.length >= 1 || otherPreference.trim().length > 0;

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
            <Lightbulb className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">帮助我们理解你的偏好</h2>
            <p className="text-sm text-muted-foreground">我希望未来活动中...</p>
          </div>
        </div>
      </motion.div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">可选问题 3/3</span>
        <Badge variant="outline">
          已选择 {selectedPreferences.length} 个偏好
        </Badge>
      </div>

      {/* Preference Options */}
      <div className="grid gap-3">
        {preferenceOptions.map((option, index) => {
          const isSelected = selectedPreferences.includes(option.id);

          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card 
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
                onClick={() => togglePreference(option.id)}
                data-testid={`card-preference-${option.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className={`
                      mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                      ${isSelected 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground/30'
                      }
                    `}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>

                    {/* Icon */}
                    <div className="text-2xl">{option.icon}</div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="font-semibold">{option.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Other Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">💬 其他期待</h3>
            <Textarea
              placeholder="例如：希望活动时长更灵活、想要更小规模的聚会、期待固定的兴趣小组..."
              value={otherPreference}
              onChange={(e) => setOtherPreference(e.target.value)}
              className="min-h-24"
              data-testid="textarea-other-preferences"
            />
            <p className="text-xs text-muted-foreground">
              可选填写 · 你的建议将帮助我们设计更多元的活动类型
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Impact Showcase */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="space-y-3"
      >
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <h3 className="font-semibold">你的反馈如何被使用</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary mt-1">1.</span>
                <div>
                  <p className="font-medium">模式识别</p>
                  <p className="text-muted-foreground">分析大量反馈中的共同模式</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary mt-1">2.</span>
                <div>
                  <p className="font-medium">算法校准</p>
                  <p className="text-muted-foreground">调整契合点权重和逻辑</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary mt-1">3.</span>
                <div>
                  <p className="font-medium">产品迭代</p>
                  <p className="text-muted-foreground">基于体验改进功能设计</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary mt-1">4.</span>
                <div>
                  <p className="font-medium">体验提升</p>
                  <p className="text-muted-foreground">为所有用户创造更好体验</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
          data-testid="button-submit"
        >
          完成深度反馈
        </Button>
      </div>

      {/* Encouragement */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center space-y-2"
      >
        <p className="text-sm text-muted-foreground">
          🤝 共同创造更好的社交体验
        </p>
        <p className="text-xs text-muted-foreground">
          感谢你选择分享见解 · 每个用户的真实体验都宝贵
        </p>
      </motion.div>
    </div>
  );
}
