import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface TransitionMascotProps {
  show: boolean;
  message: string;
}

export default function TransitionMascot({ show, message }: TransitionMascotProps) {
  const prefersReducedMotion = useReducedMotion();

  const particles = [
    { x: -20, y: -20, delay: 0 },
    { x: 20, y: -15, delay: 0.1 },
    { x: 0, y: -25, delay: 0.2 },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100, y: 100 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -100, y: 100 }}
          transition={{ 
            type: prefersReducedMotion ? "tween" : "spring", 
            damping: 20, 
            stiffness: 300 
          }}
          className="fixed bottom-24 right-4 z-50"
        >
          <div className="relative">
            {/* Sparkle particles */}
            {!prefersReducedMotion && particles.map((particle, index) => (
              <motion.div
                key={index}
                className="absolute"
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: particle.x,
                  y: particle.y,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: particle.delay,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              >
                <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </motion.div>
            ))}
            
            {/* Mascot bubble */}
            <div className="bg-gradient-to-br from-primary to-purple-600 text-white px-4 py-3 rounded-2xl rounded-br-none shadow-lg max-w-[200px]">
              <p className="text-sm font-medium">{message}</p>
            </div>
            
            {/* Mascot character (using emoji for simplicity) */}
            <motion.div
              className="absolute -bottom-2 -right-2 text-4xl"
              animate={prefersReducedMotion ? {} : {
                rotate: [0, 5, -5, 0],
              }}
              transition={prefersReducedMotion ? {} : {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              🌟
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
