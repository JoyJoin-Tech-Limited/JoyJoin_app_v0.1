import { motion } from "framer-motion";

interface BubbleProgressProps {
  value: number; // 0-100
  totalRounds: number;
  currentRound: number;
  className?: string;
}

export function BubbleProgress({ value, totalRounds, currentRound, className }: BubbleProgressProps) {
  // Create bubble elements for each round
  const bubbles = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-3">
        {bubbles.map((round) => {
          const isComplete = round < currentRound;
          const isCurrent = round === currentRound;
          const isFuture = round > currentRound;

          return (
            <div key={round} className="relative">
              {/* Bubble circle */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: isCurrent ? [1, 1.1, 1] : 1, 
                  opacity: 1 
                }}
                transition={{
                  scale: {
                    repeat: isCurrent ? Infinity : 0,
                    duration: 2,
                    ease: "easeInOut"
                  }
                }}
                className={`
                  relative w-12 h-12 rounded-full flex items-center justify-center
                  transition-all duration-500
                  ${isComplete ? 'bg-white text-purple-600 shadow-lg' : ''}
                  ${isCurrent ? 'bg-white/30 backdrop-blur-sm border-2 border-white text-white shadow-xl' : ''}
                  ${isFuture ? 'bg-white/10 border border-white/30 text-white/50' : ''}
                `}
              >
                {/* Round number */}
                <span className="font-bold text-sm">{round}</span>
                
                {/* Liquid fill for current round */}
                {isCurrent && (
                  <motion.div
                    initial={{ height: '0%' }}
                    animate={{ height: `${value}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white to-white/80 rounded-full -z-10"
                    style={{ 
                      clipPath: 'circle(50% at 50% 50%)',
                    }}
                  />
                )}
                
                {/* Checkmark for completed rounds */}
                {isComplete && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 w-full h-full z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    />
                  </motion.svg>
                )}
                
                {/* Ambient glow for current round */}
                {isCurrent && (
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.3, 1],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 rounded-full bg-white/50 blur-xl -z-10"
                  />
                )}
              </motion.div>
              
              {/* Connector line */}
              {round < totalRounds && (
                <div 
                  className={`
                    absolute top-1/2 left-full w-3 h-0.5 -translate-y-1/2
                    transition-all duration-500
                    ${round < currentRound ? 'bg-white' : 'bg-white/20'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Label below */}
      <div className="text-center mt-3">
        <p className="text-white/90 text-sm font-medium">
          第 {currentRound} / {totalRounds} 轮
        </p>
        {value < 100 && (
          <p className="text-white/60 text-xs mt-1">
            本轮进度 {Math.round(value)}%
          </p>
        )}
      </div>
    </div>
  );
}
