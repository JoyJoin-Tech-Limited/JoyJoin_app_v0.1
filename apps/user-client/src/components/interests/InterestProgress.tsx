import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface InterestProgressProps {
  totalHeat: number;
  totalSelections: number;
  className?: string;
}

export function InterestProgress({
  totalHeat,
  totalSelections,
  className,
}: InterestProgressProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Fire icon with flicker animation */}
      <motion.div
        className="text-orange-500"
        animate={
          prefersReducedMotion
            ? {}
            : {
                rotate: [-2, 2, -2],
                scale: [1, 1.05, 1],
              }
        }
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Flame className="w-6 h-6 fill-orange-500" />
      </motion.div>

      {/* Heat counter */}
      <div className="flex flex-col">
        <motion.div
          key={totalHeat}
          className="text-2xl font-bold text-orange-600"
          initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {totalHeat}
        </motion.div>
        <div className="text-xs text-muted-foreground">热度值</div>
      </div>

      {/* Selections counter */}
      <div className="flex flex-col ml-2">
        <motion.div
          key={totalSelections}
          className="text-2xl font-bold text-purple-600"
          initial={prefersReducedMotion ? {} : { scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {totalSelections}
        </motion.div>
        <div className="text-xs text-muted-foreground">已选择</div>
      </div>

      {/* Milestone indicator */}
      {totalSelections >= 3 && (
        <motion.div
          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm"
          initial={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <span className="text-lg">✓</span>
          <span className="font-medium">达标</span>
        </motion.div>
      )}
    </div>
  );
}
