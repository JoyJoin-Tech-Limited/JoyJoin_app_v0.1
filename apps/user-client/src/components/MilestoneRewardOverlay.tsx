import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { confettiPresets } from "@/lib/confetti-utils";
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
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onContinue();
    }, 3000);

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
          className="fixed inset-0 z-50 bg-gradient-to-b from-purple-900/95 via-fuchsia-900/95 to-pink-900/95 backdrop-blur-md flex items-center justify-center p-6 cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ 
              delay: 0.1, 
              duration: 0.6, 
              type: "spring",
              stiffness: 200,
              damping: 20
            }}
            className="max-w-md w-full text-center space-y-8"
          >
            {/* Congratulations Title with Rainbow Gradient */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <h1 className="text-4xl font-black bg-gradient-to-r from-amber-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-2">
                太棒啦！🎉
              </h1>
              <p className="text-white/90 text-lg font-medium">
                你已经完成了一半的测试！
              </p>
            </motion.div>

            {/* Xiaoyue Mascot with Bouncing Animation */}
            <motion.div
              animate={{ 
                y: [0, -12, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative inline-block"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 40px 15px rgba(236, 72, 153, 0.4)",
                    "0 0 60px 25px rgba(168, 85, 247, 0.6)",
                    "0 0 40px 15px rgba(236, 72, 153, 0.4)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-full inline-block"
              >
                <img 
                  src={xiaoyueExcited} 
                  alt="小悦庆祝" 
                  className="h-32 w-32 object-contain"
                />
              </motion.div>
              
              {/* Sparkle particles around mascot */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                  className="absolute"
                  style={{
                    left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 6)}%`,
                    top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 6)}%`,
                  }}
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </motion.div>
              ))}
              
              {/* Speech Bubble */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-64 bg-white rounded-2xl px-4 py-3 shadow-2xl"
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-white" />
                <p className="text-sm text-gray-800 font-medium">
                  你做得超棒！继续保持这个节奏~ 🌟
                </p>
              </motion.div>
            </motion.div>

            {/* Blurred Archetype Preview */}
            {archetypeImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
                className="relative"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 30px 10px rgba(168, 85, 247, 0.3)",
                      "0 0 50px 20px rgba(236, 72, 153, 0.5)",
                      "0 0 30px 10px rgba(168, 85, 247, 0.3)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="relative mx-auto w-40 h-40 rounded-3xl overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-sm border-2 border-white/30"
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
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [-5, 5, -5]
                      }}
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
                  transition={{ delay: 0.8 }}
                  className="mt-4 space-y-1"
                >
                  <p className="text-white font-semibold text-lg">
                    你的初步人格画像已生成！
                  </p>
                  <p className="text-purple-200 text-sm">
                    再答几题让画像更精准~ 🎨
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Progress Visualization with Rainbow Gradient */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="relative"
            >
              {/* Progress bar container */}
              <div className="relative bg-white/10 backdrop-blur-sm rounded-full h-8 overflow-hidden border-2 border-white/20">
                {/* Rainbow gradient progress fill */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.answered / progress.total) * 100}%` }}
                  transition={{ delay: 0.9, duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 relative overflow-hidden"
                >
                  {/* Animated shimmer effect */}
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </motion.div>
                
                {/* Progress text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-white font-bold text-sm drop-shadow-lg"
                  >
                    {progress.answered} / {progress.total} 题
                  </motion.p>
                </div>
              </div>
              
              {/* Sparkle particles around progress bar */}
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    y: [0, -20, -40],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                  className="absolute"
                  style={{
                    left: `${25 + i * 20}%`,
                    top: -10,
                  }}
                >
                  <Sparkles className="h-3 w-3 text-amber-300" />
                </motion.div>
              ))}
            </motion.div>

            {/* Tap to continue hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-white/60 text-sm mt-8"
            >
              点击屏幕继续
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
