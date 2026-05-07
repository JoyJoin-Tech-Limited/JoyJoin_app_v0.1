import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface GuideCompletionStateProps {
  className?: string;
}

/**
 * Guide Completion State
 * 
 * Brief, calm completion state shown after guide finishes
 * Duolingo-inspired: warm, simple, encouraging
 * Auto-transitions to Discover page after 2 seconds (handled by parent)
 */
export function GuideCompletionState({
  className,
}: GuideCompletionStateProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-50 bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-orange-950/20 flex flex-col items-center justify-center px-6",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success Icon */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1 }}
        transition={prefersReducedMotion 
          ? { duration: 0.2 }
          : { 
              delay: 0.2,
              type: "spring", 
              stiffness: 200,
              damping: 15
            }
        }
        className="mb-6"
      >
        <div className="relative">
          <CheckCircle2 className="w-20 h-20 text-green-500" strokeWidth={2} />
          {/* Subtle sparkle effect */}
          <motion.div
            className="absolute -top-2 -right-2"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -45 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
            transition={prefersReducedMotion 
              ? { delay: 0.3, duration: 0.2 }
              : { delay: 0.5, duration: 0.3 }
            }
          >
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </motion.div>
        </div>
      </motion.div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          准备好了
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          开始发现吧
        </p>
      </motion.div>

      {/* Subtle pulse animation on background */}
      <motion.div
        className="absolute inset-0 -z-10 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.15, 0] }}
        transition={{ 
          delay: 0.3,
          duration: 1.5,
          ease: "easeInOut"
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-200 dark:bg-green-500/20 rounded-full blur-3xl" />
      </motion.div>
    </motion.div>
  );
}
