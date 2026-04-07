/**
 * PrimaryGoalStep — Wave 2 EXP_SOCIAL_GOAL_REFRAMING
 *
 * Reframes social-goal selection as:
 *   1. One required primary goal (clear intent)
 *   2. Optional secondary goals (nuance / openness)
 *   3. Flexible mode toggle (same as current SocialGoalsStep)
 *
 * Data contract:
 *   - Still calls `onSelectGoals(string[])` with the same shape.
 *   - Primary goal is placed FIRST in the array; secondary goals follow.
 *   - Flexible mode sends `["flexible"]` as before.
 *
 * Metrics: goal_reframe_shown, goal_reframe_primary_selected,
 *          goal_reframe_secondary_added
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SocialGoalCard from "../shared/SocialGoalCard";
import { SHARED_OPTIONS } from "@/lib/event-pool-options";
import { getMatchPreviewCopy } from "@/lib/matchPreviewCopy";
import { participationExperimentAnalytics } from "@/lib/participationExperimentAnalytics";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PrimaryGoalStepProps {
  poolId: string;
  selectedGoals: string[];
  onSelectGoals: (goals: string[]) => void;
  registrationCount?: number;
  isPrefilledFromProfile?: boolean;
  onClearPrefill?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PrimaryGoalStep({
  poolId,
  selectedGoals,
  onSelectGoals,
  registrationCount = 0,
  isPrefilledFromProfile = false,
  onClearPrefill,
}: PrimaryGoalStepProps) {
  const isFlexibleMode = selectedGoals.includes("flexible");

  // When prefilled, the first goal in the array is treated as primary
  const primaryGoal = isFlexibleMode ? null : selectedGoals[0] ?? null;
  const secondaryGoals = isFlexibleMode ? [] : selectedGoals.slice(1);

  const [showSecondary, setShowSecondary] = useState(
    secondaryGoals.length > 0,
  );

  const matchPreview = useMemo(
    () => getMatchPreviewCopy(selectedGoals),
    [selectedGoals],
  );

  // Analytics: shown
  useEffect(() => {
    participationExperimentAnalytics.goalReframeShown(poolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open secondary section automatically when there are pre-existing secondary goals
  useEffect(() => {
    if (secondaryGoals.length > 0) {
      setShowSecondary(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearPrefillIfNeeded = () => {
    if (isPrefilledFromProfile && onClearPrefill) {
      onClearPrefill();
    }
  };

  const handleSelectPrimary = (goalValue: string) => {
    clearPrefillIfNeeded();
    // Keep existing secondary goals when changing primary
    const newGoals = [goalValue, ...secondaryGoals.filter((g) => g !== goalValue)];
    onSelectGoals(newGoals);
    participationExperimentAnalytics.goalReframePrimarySelected(poolId, goalValue);
  };

  const handleToggleSecondary = (goalValue: string) => {
    clearPrefillIfNeeded();
    const alreadySelected = secondaryGoals.includes(goalValue);
    const newSecondary = alreadySelected
      ? secondaryGoals.filter((g) => g !== goalValue)
      : [...secondaryGoals, goalValue];
    const newGoals = primaryGoal
      ? [primaryGoal, ...newSecondary]
      : newSecondary;
    onSelectGoals(newGoals);

    if (!alreadySelected && newSecondary.length > 0) {
      participationExperimentAnalytics.goalReframeSecondaryAdded(
        poolId,
        newSecondary,
      );
    }
  };

  const handleToggleFlexible = () => {
    clearPrefillIfNeeded();
    if (isFlexibleMode) {
      onSelectGoals([]);
    } else {
      onSelectGoals(["flexible"]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title — intent expression, not data capture */}
      <div>
        <h2 className="text-xl font-bold mb-2">调一调这桌的氛围</h2>
        <p className="text-sm text-muted-foreground">
          你的选择会影响系统为你匹配的桌友
        </p>
      </div>

      {/* Pre-filled indicator */}
      {isPrefilledFromProfile && selectedGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg px-3 py-2"
        >
          <span>✨ 已沿用你上次的偏好</span>
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

      {/* Flexible mode */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex-1">
          <Label htmlFor="primary-flexible-mode" className="text-sm font-semibold cursor-pointer">
            随缘模式
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            不挑氛围，交给缘分安排 ✨
          </p>
        </div>
        <Switch
          id="primary-flexible-mode"
          checked={isFlexibleMode}
          onCheckedChange={handleToggleFlexible}
        />
      </div>

      {/* Primary goal selection */}
      {!isFlexibleMode && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">你最想要的氛围</p>
          <div className="grid grid-cols-2 gap-3">
            {SHARED_OPTIONS.socialGoals.map((option, index) => (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
              >
                <SocialGoalCard
                  option={option}
                  selected={primaryGoal === option.value}
                  onClick={() => handleSelectPrimary(option.value)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary goals (collapsible, only after primary is chosen) */}
      {!isFlexibleMode && primaryGoal && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowSecondary((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showSecondary}
          >
            {showSecondary ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="flex items-center gap-1.5">
              还有其他期待吗？<span className="text-xs text-muted-foreground/60">（可选）</span>
            </span>
          </button>

          <AnimatePresence>
            {showSecondary && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {SHARED_OPTIONS.socialGoals
                    .filter((o) => o.value !== primaryGoal)
                    .map((option) => (
                      <SocialGoalCard
                        key={option.value}
                        option={option}
                        selected={secondaryGoals.includes(option.value)}
                        onClick={() => handleToggleSecondary(option.value)}
                      />
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Match preview */}
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
              <p className="text-sm font-medium text-foreground">
                {matchPreview.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {matchPreview.subtitle}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
