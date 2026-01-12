import { motion } from "framer-motion";

/**
 * QuestionSkeleton - Loading placeholder for personality test questions
 * 
 * Displays an animated skeleton UI while questions are loading,
 * reducing perceived load time and improving user experience.
 */
export function QuestionSkeleton() {
  const shimmerAnimation = {
    opacity: [0.5, 1, 0.5],
  };

  const shimmerTransition = {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-3">
      {/* Scenario skeleton */}
      <motion.div
        className="h-24 bg-muted/50 rounded-2xl mb-4"
        animate={shimmerAnimation}
        transition={shimmerTransition}
      />

      {/* Mascot skeleton */}
      <div className="flex items-start gap-3 mb-6">
        <motion.div
          className="w-16 h-16 rounded-full bg-muted/50"
          animate={shimmerAnimation}
          transition={{ ...shimmerTransition, delay: 0.1 }}
        />
        <motion.div
          className="flex-1 h-20 bg-muted/50 rounded-2xl"
          animate={shimmerAnimation}
          transition={{ ...shimmerTransition, delay: 0.2 }}
        />
      </div>

      {/* Options skeleton */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="h-[68px] bg-muted/50 rounded-2xl"
            animate={shimmerAnimation}
            transition={{ ...shimmerTransition, delay: 0.1 * i }}
          />
        ))}
      </div>
    </div>
  );
}

export default QuestionSkeleton;
