import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { DINNER_OPTIONS, BAR_OPTIONS } from "@/lib/event-pool-options";
import { confettiPresets } from "@/lib/confetti-utils";
import AtmosphereSlider, { type AtmosphereOption } from "../AtmosphereSlider";

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
  const atmosphereOptions: AtmosphereOption[] =
    eventType === "饭局"
      ? [
          {
            value: "150以下",
            label: "轻松小聚",
            priceLabel: "¥150 以下",
            mood: "像暖灯下的慢慢开场，轻盈、不费力，也适合第一次见面。",
            accentClass: "from-emerald-400/70 via-teal-400/40 to-sky-400/40",
          },
          {
            value: "150-200",
            label: "认真品味",
            priceLabel: "¥150–200",
            mood: "菜和对话都想认真选，整体更讲究一点，但不端着。",
            accentClass: "from-sky-400/70 via-blue-400/40 to-violet-400/40",
          },
          {
            value: "200-300",
            label: "仪式感",
            priceLabel: "¥200–300",
            mood: "希望这晚有点正式感，细节更好，值得被认真期待。",
            accentClass: "from-violet-400/70 via-fuchsia-400/40 to-rose-400/40",
          },
          {
            value: "300-500",
            label: "全力以赴",
            priceLabel: "¥300–500",
            mood: "想把这次相遇过得更尽兴一点，像为惊喜认真留出预算。",
            accentClass: "from-amber-400/70 via-orange-400/40 to-rose-400/40",
          },
        ]
      : [
          {
            value: "80以下",
            label: "轻松碰杯",
            priceLabel: "¥80 以下 / 杯",
            mood: "更重视轻松开聊和自然氛围，微醺只是陪衬。",
            accentClass: "from-emerald-400/70 via-cyan-400/40 to-sky-400/40",
          },
          {
            value: "80-150",
            label: "认真微醺",
            priceLabel: "¥80–150 / 杯",
            mood: "希望氛围、酒感和对话都更有质感，像一场小型夜晚仪式。",
            accentClass: "from-violet-400/70 via-fuchsia-400/40 to-amber-400/40",
          },
        ];
  const activeAtmosphere =
    atmosphereOptions.find((option) => option.value === selectedBudget) ?? atmosphereOptions[0];

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
          {selectedBudget
            ? `${activeAtmosphere.label} 很有感觉，我会沿着这个气氛帮你找更同频的小伙伴。`
            : "先告诉我今晚想要什么氛围，我会用这个感觉去替你找同频的人。"}
        </p>
      </motion.div>

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">先定今晚的气氛</h2>
        <p className="text-sm text-muted-foreground">
          {eventType === "饭局" ? "预算不只是价格，更像你想要的晚餐节奏。" : "酒局的预算，也是在决定这晚想要的氛围浓度。"}
        </p>
      </div>

      <AtmosphereSlider
        options={atmosphereOptions}
        value={selectedBudget ?? budgetOptions[0]?.value}
        onChange={handleSelect}
      />
    </div>
  );
}
