import { useMemo } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
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
  const primaryGoal = isFlexibleMode ? "flexible" : selectedGoals[0] ?? "";
  const secondaryGoals = isFlexibleMode ? [] : selectedGoals.slice(1, 3);
  const matchPreview = useMemo(() => getMatchPreviewCopy(selectedGoals), [selectedGoals]);

  const clearPrefillIfNeeded = () => {
    if (isPrefilledFromProfile && onClearPrefill) {
      onClearPrefill();
    }
  };

  const handleSelectPrimaryGoal = (goalValue: string) => {
    clearPrefillIfNeeded();

    if (goalValue === "flexible") {
      onSelectGoals(isFlexibleMode ? [] : ["flexible"]);
      return;
    }

    const nextSecondary = secondaryGoals.filter((goal) => goal !== goalValue);
    onSelectGoals([goalValue, ...nextSecondary]);
  };

  const handleToggleSecondaryGoal = (goalValue: string) => {
    if (!primaryGoal || isFlexibleMode) return;
    clearPrefillIfNeeded();

    if (secondaryGoals.includes(goalValue)) {
      onSelectGoals([primaryGoal, ...secondaryGoals.filter((goal) => goal !== goalValue)]);
      return;
    }

    if (secondaryGoals.length >= 2) {
      toast({
        title: "最多补充两张加分卡",
        description: "把信号留得清晰一点，匹配会更懂你。",
      });
      return;
    }

    onSelectGoals([primaryGoal, ...secondaryGoals, goalValue]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-xl font-bold">今晚最想收获什么？</h2>
        <p className="text-sm text-muted-foreground">
          已有 {registrationCount} 人报名。先选一个主愿望，再补 0–2 个顺带想要的感觉。
        </p>
      </div>

      {isPrefilledFromProfile && selectedGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
        >
          <span>✨ 已沿用你的默认社交偏好，想换也完全可以。</span>
          <button
            type="button"
            onClick={() => {
              onSelectGoals([]);
              onClearPrefill?.();
            }}
            className="shrink-0 text-primary underline"
          >
            重新选择
          </button>
        </motion.div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">主愿望</p>
          <span className="text-xs text-muted-foreground">只选 1 项</span>
        </div>

        <div className="grid gap-3">
          {SHARED_OPTIONS.socialGoals.map((goal, index) => {
            const isSelected = primaryGoal === goal.value;
            return (
              <motion.button
                key={goal.value}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectPrimaryGoal(goal.value)}
                className={`rounded-[24px] border px-4 py-4 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-gradient-to-br from-primary/10 to-violet-500/10 shadow-sm"
                    : "border-border bg-background/70 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{goal.emoji}</div>
                  <div>
                    <p className="text-base font-semibold text-foreground">{goal.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}

          <button
            type="button"
            onClick={() => handleSelectPrimaryGoal("flexible")}
            className={`rounded-[24px] border px-4 py-4 text-left transition-all ${
              isFlexibleMode
                ? "border-primary bg-gradient-to-br from-primary/10 to-fuchsia-500/10 shadow-sm"
                : "border-border bg-background/70 hover:border-primary/40"
            }`}
          >
            <p className="text-base font-semibold text-foreground">✨ 随心随缘</p>
            <p className="mt-1 text-sm text-muted-foreground">
              不先框住自己，让小悦用整体气场为你配出最惊喜的一桌。
            </p>
          </button>
        </div>
      </div>

      {!isFlexibleMode && primaryGoal && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">如果顺便能...</p>
            <span className="text-xs text-muted-foreground">最多再选 2 项</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SHARED_OPTIONS.socialGoals
              .filter((goal) => goal.value !== primaryGoal)
              .map((goal) => {
                const isSelected = secondaryGoals.includes(goal.value);
                return (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => handleToggleSecondaryGoal(goal.value)}
                    className={`rounded-full border px-4 py-2 text-sm transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    {goal.emoji} {goal.label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {selectedGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-[24px] border border-primary/10 bg-primary/5 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{matchPreview.emoji}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{matchPreview.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{matchPreview.subtitle}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
