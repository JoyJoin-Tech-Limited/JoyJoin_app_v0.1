import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SocialGoalCard from "../shared/SocialGoalCard";
import { SHARED_OPTIONS } from "@/lib/event-pool-options";

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

  const handleToggleGoal = (goalValue: string) => {
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

  const estimatedMatches = Math.min(Math.floor(registrationCount / 2), 10);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">这次想怎么玩？</h2>
        <p className="text-sm text-muted-foreground">
          小悦会根据你选的，帮你凑一桌最聊得来的人
        </p>
      </div>

      {/* Pre-fill from profile indicator */}
      {isPrefilledFromProfile && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <span>💡</span>
          <span>已沿用你的默认社交偏好 · <button type="button" className="underline" onClick={onClearPrefill}>为这次活动重新选</button></span>
        </div>
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
      {(selectedGoals.length > 0 || isFlexibleMode) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">✨</div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1">预计匹配</p>
              <p className="text-xs text-muted-foreground">
                当前已有 {registrationCount} 人报名，预计可匹配{" "}
                <Badge variant="secondary" className="mx-1">
                  {estimatedMatches}+
                </Badge>
                位志同道合的朋友
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
