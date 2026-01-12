import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SlotPhase } from "./useSlotMachine";
import type { ArchetypeData } from "./archetypeData";

interface SlotFrameProps {
  phase: SlotPhase;
  archetype: ArchetypeData;
  children: ReactNode;
}

export const SlotFrame = memo(function SlotFrame({ phase, archetype, children }: SlotFrameProps) {
  const isLanding = phase === "landed";

  return (
    <motion.div
      className="relative w-full max-w-xl mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div
        className="absolute inset-0 -z-10 blur-3xl"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${archetype.glow}, transparent 65%)`,
          opacity: isLanding ? 1 : 0.85,
          transition: "opacity 0.3s ease",
        }}
      />

      <motion.div
        className={cn(
          "relative rounded-[22px] border bg-gradient-to-br from-background/95 via-background/90 to-background/80 p-4 shadow-xl",
          "backdrop-blur-lg"
        )}
        animate={{ boxShadow: isLanding ? `0 12px 35px -10px ${archetype.glow}` : "0 10px 30px -16px rgba(0,0,0,0.35)" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ borderColor: `${archetype.accent}33` }}
      >
        <div className="absolute inset-x-8 top-2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden />
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">{children}</div>
        </div>

        <motion.div
          className="mt-4 rounded-xl px-4 py-3 flex items-center justify-center bg-gradient-to-r from-white/5 via-white/10 to-white/5 border"
          style={{
            borderColor: `${archetype.accent}40`,
            color: archetype.accent,
          }}
          animate={{ opacity: isLanding ? 1 : 0.8, y: isLanding ? 0 : 4 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <span className="text-sm font-semibold tracking-wide">社交原型</span>
          <span className="ml-2 text-base font-bold">「{archetype.name}」</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});
