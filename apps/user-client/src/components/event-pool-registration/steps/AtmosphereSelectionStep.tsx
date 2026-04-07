/**
 * AtmosphereSelectionStep — Wave 2 EXP_ATMOSPHERE_FRAMING
 *
 * Replaces raw budget numbers with atmosphere-driven framing while preserving
 * the identical underlying budget value sent to the API. This is a controlled
 * experiment: the component is only rendered when
 * `atmosphereFramingEnabled()` is true.
 *
 * Data contract:
 *   - `onSelectBudget` receives the same budget string value (e.g. "150以下")
 *     as `BudgetSelectionStep`. No API or schema changes needed.
 *   - Budget price info is shown as secondary text so users retain full clarity.
 *
 * Metrics: atmosphere_framing_shown, atmosphere_framing_selected
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { DINNER_OPTIONS, BAR_OPTIONS } from "@/lib/event-pool-options";
import { participationExperimentAnalytics } from "@/lib/participationExperimentAnalytics";

// ─── Atmosphere metadata ──────────────────────────────────────────────────────

interface AtmosphereTier {
  budgetValue: string; // raw value sent to API — MUST match BudgetSelectionStep options
  atmosphereLabel: string;
  atmosphereEmoji: string;
  atmosphereDesc: string;
  priceHint: string; // secondary clarity text
  gradient: string;
  borderColor: string;
}

const DINNER_ATMOSPHERE_TIERS: AtmosphereTier[] = [
  {
    budgetValue: "150以下",
    atmosphereLabel: "轻松随意",
    atmosphereEmoji: "🌿",
    atmosphereDesc: "不在乎价格，只在乎氛围",
    priceHint: "人均 ¥150 以下",
    gradient: "from-green-500/10 to-emerald-500/5",
    borderColor: "border-green-500/30",
  },
  {
    budgetValue: "150-200",
    atmosphereLabel: "舒适精致",
    atmosphereEmoji: "✨",
    atmosphereDesc: "品质用餐，好好聊天",
    priceHint: "人均 ¥150–200",
    gradient: "from-blue-500/10 to-sky-500/5",
    borderColor: "border-blue-500/30",
  },
  {
    budgetValue: "200-300",
    atmosphereLabel: "留下印象",
    atmosphereEmoji: "💎",
    atmosphereDesc: "精心挑选，令人难忘",
    priceHint: "人均 ¥200–300",
    gradient: "from-purple-500/10 to-violet-500/5",
    borderColor: "border-purple-500/30",
  },
  {
    budgetValue: "300-500",
    atmosphereLabel: "惊喜之夜",
    atmosphereEmoji: "🌟",
    atmosphereDesc: "不设限制，极致体验",
    priceHint: "人均 ¥300–500",
    gradient: "from-amber-500/10 to-yellow-500/5",
    borderColor: "border-amber-500/30",
  },
];

const BAR_ATMOSPHERE_TIERS: AtmosphereTier[] = [
  {
    budgetValue: "80以下",
    atmosphereLabel: "轻松畅饮",
    atmosphereEmoji: "🍺",
    atmosphereDesc: "随意小酌，不用算账",
    priceHint: "单杯 ¥80 以下",
    gradient: "from-green-500/10 to-lime-500/5",
    borderColor: "border-green-500/30",
  },
  {
    budgetValue: "80-150",
    atmosphereLabel: "品味调酒",
    atmosphereEmoji: "🍸",
    atmosphereDesc: "精品酒水，细细品味",
    priceHint: "单杯 ¥80–150",
    gradient: "from-purple-500/10 to-violet-500/5",
    borderColor: "border-purple-500/30",
  },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AtmosphereSelectionStepProps {
  poolId: string;
  eventType: "饭局" | "酒局";
  selectedBudget: string | undefined;
  onSelectBudget: (budget: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AtmosphereSelectionStep({
  poolId,
  eventType,
  selectedBudget,
  onSelectBudget,
}: AtmosphereSelectionStepProps) {
  const tiers =
    eventType === "饭局" ? DINNER_ATMOSPHERE_TIERS : BAR_ATMOSPHERE_TIERS;

  // Validate that atmosphere tiers cover the same values as the standard options
  // so we never silently drop a budget option.
  const standardOptions =
    eventType === "饭局" ? DINNER_OPTIONS.budget : BAR_OPTIONS.budget;
  const atmosphereValues = new Set(tiers.map((t) => t.budgetValue));
  const standardValues = new Set(standardOptions.map((o) => o.value));
  // In production the sets should always match; mismatches are developer errors.
  if (
    process.env.NODE_ENV !== "production" &&
    (atmosphereValues.size !== standardValues.size ||
      [...atmosphereValues].some((v) => !standardValues.has(v)))
  ) {
    console.warn(
      "[AtmosphereSelectionStep] atmosphere tier values do not match standard budget options",
    );
  }

  // Analytics: report that this experiment arm was shown
  useEffect(() => {
    participationExperimentAnalytics.atmosphereFramingShown(poolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (tier: AtmosphereTier) => {
    onSelectBudget(tier.budgetValue);
    participationExperimentAnalytics.atmosphereFramingSelected(
      poolId,
      tier.budgetValue,
    );
  };

  return (
    <div className="space-y-6">
      {/* Experiment badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/20 w-fit">
        <span className="text-xs">🧪</span>
        <span className="text-xs font-medium text-primary/80">体验新版选择方式</span>
      </div>

      {/* Xiaoyue speech bubble */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl rounded-tl-none p-4 border border-primary/20 relative"
      >
        <div className="absolute -top-2 -left-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">
          告诉我你期待的氛围，我来帮你匹配消费观相近、气场合拍的小伙伴！
        </p>
      </motion.div>

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-1">你想要什么样的氛围？</h2>
        <p className="text-sm text-muted-foreground">
          选择最符合你期待的体验感受
        </p>
      </div>

      {/* Atmosphere cards */}
      <div className="grid grid-cols-2 gap-3">
        {tiers.map((tier, index) => {
          const isSelected = selectedBudget === tier.budgetValue;
          return (
            <motion.button
              key={tier.budgetValue}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(tier)}
              className={[
                "relative flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                `bg-gradient-to-br ${tier.gradient}`,
                isSelected
                  ? `${tier.borderColor} ring-2 ring-primary/30 shadow-md`
                  : "border-border/40 hover:border-primary/30",
              ].join(" ")}
              aria-pressed={isSelected}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white"
                  aria-hidden="true"
                >
                  ✓
                </motion.span>
              )}

              <span className="text-2xl" aria-hidden="true">
                {tier.atmosphereEmoji}
              </span>
              <span className="text-sm font-bold leading-tight">
                {tier.atmosphereLabel}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">
                {tier.atmosphereDesc}
              </span>
              {/* Price hint — always visible for user clarity */}
              <span className="mt-1 text-[11px] text-muted-foreground/60">
                {tier.priceHint}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
