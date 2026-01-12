import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ALL_ARCHETYPES, type ArchetypeData } from "./archetypeData";
import type { SlotPhase } from "./useSlotMachine";

interface SlotReelProps {
  phase: SlotPhase;
  activeIndex: number;
  delay?: number;
  target?: ArchetypeData;
}

export const SlotReel = memo(function SlotReel({
  phase,
  activeIndex,
  delay = 0,
  target,
}: SlotReelProps) {
  const current = useMemo(() => ALL_ARCHETYPES[activeIndex % ALL_ARCHETYPES.length], [activeIndex]);
  const isLanding = phase === "landed";

  return (
    <div
      className={cn(
        "relative h-32 overflow-hidden rounded-2xl border bg-gradient-to-b from-background/80 to-background/40 shadow-lg",
        "backdrop-blur-sm"
      )}
      style={{ borderColor: `${(target || current).accent}55` }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${current.name}-${phase}`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{
            duration: isLanding ? 0.35 : 0.18,
            ease: "easeOut",
            delay: delay / 1000,
          }}
          style={{ willChange: isLanding ? undefined : "transform" }}
        >
          <motion.div
            className="flex items-center justify-center w-20 h-20"
            animate={{ scale: isLanding ? [1, 1.05, 1] : 1 }}
            transition={{ duration: isLanding ? 0.6 : 0.3, ease: "easeOut" }}
          >
            <img
              src={current.image}
              alt={current.name}
              className="w-full h-full object-contain drop-shadow-md"
              loading="lazy"
            />
          </motion.div>
          <div className="text-center px-2">
            <p
              className="text-sm font-semibold"
              style={{ color: (target || current).accent }}
            >
              {current.name}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />
    </div>
  );
});
