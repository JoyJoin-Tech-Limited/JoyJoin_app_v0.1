import { useMemo } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SocialGoalCard from "../shared/SocialGoalCard";
import { SHARED_OPTIONS } from "@/lib/event-pool-options";
import { getMatchPreviewCopy } from "@/lib/matchPreviewCopy";

interface SocialGoalsStepProps {
  selectedGoals: string[];
  onSelectGoals: (goals: string[]) => void;
  registrationCount?: number;
  isPrefilledFromProfile?: boolean;
  onClearPrefill?: () => void;
}

export default function SocialGoalsStep({
  selectedGoals,
  onSelectGoals,
  registrationCount = 0,
  isPrefilledFromProfile = false,
  onClearPrefill,
}: SocialGoalsStepProps) {
  const { toast } = useToast();
  const isFlexibleMode = selectedGoals.includes("flexible");
  const matchPreview = useMemo(
    () => getMatchPreviewCopy(selectedGoals),
    [selectedGoals]
  );

  const handleToggleGoal = (goalValue: string) => {
    // Any manual change clears the pre-filled state
    if (isPrefilledFromProfile && onClearPrefill) {
      onClearPrefill();
    }

    if (goalValue === "flexible") {
      // Toggle flexible mode
      if (isFlexibleMode) {
        onSelectGoals([]);
      } else {
        onSelectGoals(["flexible"]);
      }
    } else {
      // Regular goal selection
      if (isFlexibleMode) {
        // Exit flexible mode and select this goal
        onSelectGoals([goalValue]);
      } else {
        if (selectedGoals.includes(goalValue)) {
          onSelectGoals(selectedGoals.filter(g => g !== goalValue));
        } else {
          const newGoals = [...selectedGoals, goalValue];
          
          // If user selects all 5 goals, suggest flexible mode
          if (newGoals.length === 5) {
            toast({
              title: "试试随缘模式？",
              description: "选择所有目标等同于随缘匹配，AI会帮你找到最合适的组合",
            });
          }
          
          onSelectGoals(newGoals);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">这次想怎么玩？</h2>
        <p className="text-sm text-muted-foreground">
          已有 {registrationCount} 人入座，小悦会帮你找最聊得来的桌友
        </p>
      </div>

      {/* Pre-filled indicator */}
      {isPrefilledFromProfile && selectedGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg px-3 py-2"
        >
          <span>✨ 已沿用你的默认社交偏好，精准度翻倍！</span>
          <button
            type="button"
            onClick={() => {
              onSelectGoals([]);
              if (onClearPrefill) onClearPrefill();
            }}
            className="text-primary underline shrink-0"
          >
            重新选择
          </button>
        </motion.div>
      )}

      {/* Flexible Mode Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex-1">
          <Label htmlFor="flexible-mode" className="text-sm font-semibold cursor-pointer">
            随缘模式
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            什么人都想认识，小悦帮你惊喜搭配 ✨
          </p>
        </div>
        <Switch
          id="flexible-mode"
          checked={isFlexibleMode}
          onCheckedChange={() => handleToggleGoal("flexible")}
        />
      </div>

      {/* Social Goals Grid */}
      {!isFlexibleMode && (
        <div className="grid grid-cols-2 gap-3">
          {SHARED_OPTIONS.socialGoals.map((option, index) => (
            <motion.div
              key={option.value}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <SocialGoalCard
                option={option}
                selected={selectedGoals.includes(option.value)}
                onClick={() => handleToggleGoal(option.value)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Match Preview Card */}
      {selectedGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-primary/5 rounded-xl px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{matchPreview.emoji}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{matchPreview.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{matchPreview.subtitle}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
