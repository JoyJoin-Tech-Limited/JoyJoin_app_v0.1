import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import BudgetCard from "../shared/BudgetCard";
import { DINNER_OPTIONS, BAR_OPTIONS } from "@/lib/event-pool-options";
import { confettiPresets } from "@/lib/confetti-utils";

interface BudgetSelectionStepProps {
  eventType: "饭局" | "酒局";
  selectedBudget: string | undefined;
  onSelectBudget: (budget: string) => void;
}

export default function BudgetSelectionStep({
  eventType,
  selectedBudget,
  onSelectBudget,
}: BudgetSelectionStepProps) {
  const budgetOptions = eventType === "饭局" ? DINNER_OPTIONS.budget : BAR_OPTIONS.budget;

  const handleSelect = (budget: string) => {
    onSelectBudget(budget);
    
    // Trigger micro confetti at card position
    setTimeout(() => {
      confettiPresets.microBurst(0.5, 0.4);
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Xiaoyue Speech Bubble */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl rounded-tl-none p-4 border border-primary/20 relative"
      >
        <div className="absolute -top-2 -left-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">
          告诉我你的预算范围，我帮你匹配消费观相近的小伙伴！
        </p>
      </motion.div>

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">选择预算范围</h2>
        <p className="text-sm text-muted-foreground">
          {eventType === "饭局" ? "人均餐费预算" : "单杯酒水价格"}
        </p>
      </div>

      {/* Budget Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {budgetOptions.map((option, index) => (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <BudgetCard
              option={option}
              selected={selectedBudget === option.value}
              onClick={() => handleSelect(option.value)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
