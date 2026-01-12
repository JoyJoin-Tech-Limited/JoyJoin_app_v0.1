import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, PartyPopper, Sparkles } from "lucide-react";
import CelebrationConfetti from "@/components/CelebrationConfetti";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSlotMachine } from "./useSlotMachine";
import { SlotReel } from "./SlotReel";
import { SlotFrame } from "./SlotFrame";
import { ALL_ARCHETYPES, getArchetypeByName, preloadArchetypeImages } from "./archetypeData";

interface ArchetypeSlotMachineProps {
  targetArchetype?: string | null;
  onComplete?: () => void;
}

export function ArchetypeSlotMachine({ targetArchetype, onComplete }: ArchetypeSlotMachineProps) {
  const reduceMotion = useReducedMotion();
  const archetype = useMemo(() => getArchetypeByName(targetArchetype), [targetArchetype]);

  useEffect(() => {
    preloadArchetypeImages();
  }, []);

  const { phase, activeIndex } = useSlotMachine({
    targetArchetype: archetype.name,
    reduceMotion,
    onComplete,
  });

  const headerText = phase === "landed" ? "匹配完成！" : "测评完成！";
  const subText = phase === "landed"
    ? `你的社交原型是「${archetype.name}」`
    : "正在揭晓你的专属社交原型...";

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center px-6 py-8 relative">
      <CelebrationConfetti show={phase === "landed" && !reduceMotion} type="step" />

      <div className="absolute top-6 inset-x-0 px-6 text-center space-y-3">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-primary bg-primary/10 border-primary/20"
        >
          <Sparkles className="w-4 h-4" />
          社交原型揭晓中
        </motion.div>
        <div className="space-y-1">
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-2xl font-bold"
          >
            {headerText}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="text-sm text-muted-foreground"
          >
            {subText}
          </motion.p>
        </div>
      </div>

      <div className="w-full max-w-xl">
        <SlotFrame phase={phase} archetype={archetype}>
          {[0, 1, 2].map((offset) => (
            <SlotReel
              key={offset}
              phase={phase}
              activeIndex={(activeIndex + offset) % ALL_ARCHETYPES.length}
              delay={offset * 60}
              target={archetype}
            />
          ))}
        </SlotFrame>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-white/5 backdrop-blur",
            "text-sm font-medium"
          )}
          style={{ color: archetype.accent, borderColor: `${archetype.accent}40` }}
        >
          {phase === "landed" ? <PartyPopper className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
          {phase === "landed" ? "正在生成你的匹配和专属建议" : "AI 正在分析你的社交特质"}
        </motion.div>
        <p className="text-xs text-muted-foreground">
          {reduceMotion ? "为尊重系统的低动效设置，已使用精简展示" : "预计数秒内完成，确保最佳展示效果"}
        </p>
      </div>
    </div>
  );
}
