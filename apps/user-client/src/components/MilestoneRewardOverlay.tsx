import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { confettiPresets } from "@/lib/confetti-utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";

interface MilestoneRewardOverlayProps {
  isVisible: boolean;
  onContinue: () => void;
  topArchetype?: string;
  progress: { answered: number; total: number };
}

export default function MilestoneRewardOverlay({
  isVisible,
  onContinue,
  topArchetype,
  progress,
}: MilestoneRewardOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  // Auto-dismiss after 2 seconds
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onContinue();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isVisible, onContinue]);

  // Trigger confetti and haptic feedback when overlay appears
  useEffect(() => {
    if (isVisible) {
      // Confetti celebration burst
      confettiPresets.celebration();
      
      // Haptic feedback pattern
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
    }
  }, [isVisible]);

  const archetypeImage = topArchetype ? getArchetypeImage(topArchetype) : null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onContinue}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end cursor-pointer"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ 
              duration: 0.4, 
              ease: [0.4, 0, 0.2, 1]
            }}
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
            className="w-full bg-card rounded-t-3xl p-6 space-y-5"
          >
            {/* Congratulations Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring" }}
            >
              <h1 className="text-3xl font-black text-foreground mb-1">
                太棒啦！🎉
              </h1>
              <p className="text-muted-foreground text-base font-medium">
                你已经完成了一半的测试！
              </p>
            </motion.div>

            {/* Xiaoyue Mascot with Bouncing Animation */}
            <motion.div
              animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative inline-block"
            >
              <img 
                src={xiaoyueExcited} 
                alt="小悦庆祝" 
                className="h-32 w-32 object-contain"
              />
              
              {/* Speech Bubble */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-64 bg-muted rounded-2xl px-4 py-3 shadow-md"
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-muted" />
                <p className="text-sm text-foreground font-medium">
                  你做得超棒！继续保持这个节奏~ 🌟
                </p>
              </motion.div>
            </motion.div>

            {/* Blurred Archetype Preview */}
            {archetypeImage && (
              <div className="relative text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="relative mx-auto w-40 h-40 rounded-3xl overflow-hidden bg-muted border border-border"
                >
                  {/* Blurred archetype image */}
                  <img
                    src={archetypeImage}
                    alt="神秘人格"
                    className="w-full h-full object-cover blur-md opacity-50"
                  />
                  
                  {/* ??? Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <p className="text-6xl font-black text-white drop-shadow-2xl">
                        ???
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 space-y-1"
                >
                  <p className="text-foreground font-semibold text-base">
                    你的初步人格画像已生成！
                  </p>
                  <p className="text-muted-foreground text-sm">
                    再答几题让画像更精准~ 🎨
                  </p>
                </motion.div>
              </div>
            )}

            {/* Progress Visualization */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              {/* Progress bar container */}
              <div className="relative bg-muted rounded-full h-8 overflow-hidden">
                {/* Progress fill */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.answered / progress.total) * 100}%` }}
                  transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
                  className="h-full bg-primary"
                />
                
                {/* Progress text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-primary-foreground font-bold text-sm"
                  >
                    {progress.answered} / {progress.total} 题
                  </motion.p>
                </div>
              </div>
            </motion.div>

            {/* Tap to continue hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: prefersReducedMotion ? 0 : Infinity }}
              className="text-muted-foreground text-sm text-center"
            >
              点击屏幕继续
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
