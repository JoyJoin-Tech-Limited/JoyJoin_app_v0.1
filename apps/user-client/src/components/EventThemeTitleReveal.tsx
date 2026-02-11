import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";
import ConfettiCelebration from "./ConfettiCelebration";

interface EventThemeTitleRevealProps {
  isVisible: boolean;
  eventThemeTitle: string;
  themeTagline: string;
  themeEmoji: string;
  themeHighlights: string[];
  themeVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
  onClose: () => void;
}

// Animation timing constants
const UNVEILING_DURATION_MS = 2000;
const AUTO_DISMISS_DURATION_MS = 7000;
const SCREENSHOT_HINT_DELAY_MS = 2000;

const vibeStyles = {
  playful: {
    gradient: 'from-pink-400 via-purple-400 to-indigo-400',
    glow: 'shadow-[0_0_50px_rgba(219,39,119,0.5)]',
    pattern: '🎉',
  },
  professional: {
    gradient: 'from-blue-600 via-indigo-600 to-purple-600',
    glow: 'shadow-[0_0_50px_rgba(79,70,229,0.5)]',
    pattern: '💼',
  },
  creative: {
    gradient: 'from-amber-400 via-orange-400 to-red-400',
    glow: 'shadow-[0_0_50px_rgba(251,146,60,0.5)]',
    pattern: '🎨',
  },
  adventurous: {
    gradient: 'from-green-400 via-teal-400 to-cyan-400',
    glow: 'shadow-[0_0_50px_rgba(20,184,166,0.5)]',
    pattern: '🚀',
  },
};

export default function EventThemeTitleReveal({
  isVisible,
  eventThemeTitle,
  themeTagline,
  themeEmoji,
  themeHighlights,
  themeVibe,
  onClose,
}: EventThemeTitleRevealProps) {
  const [stage, setStage] = useState<'unveiling' | 'revealed'>('unveiling');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showScreenshotHint, setShowScreenshotHint] = useState(false);

  const vibe = vibeStyles[themeVibe] || vibeStyles.playful;

  useEffect(() => {
    if (isVisible) {
      setStage('unveiling');
      setShowConfetti(false);
      setShowScreenshotHint(false);
      
      // Transition to revealed stage
      const timer = setTimeout(() => {
        setStage('revealed');
        setShowConfetti(true);
      }, UNVEILING_DURATION_MS);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    if (stage === 'revealed') {
      // Show screenshot hint in revealed stage
      const timer = setTimeout(() => setShowScreenshotHint(true), SCREENSHOT_HINT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Auto-dismiss after total duration (unveiling + revealed)
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, AUTO_DISMISS_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Confetti - only during revealed stage */}
          {showConfetti && <ConfettiCelebration isActive={showConfetti} duration={4000} />}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 overflow-hidden"
            onClick={(e) => {
              // Allow clicking background to close only in revealed stage
              if (stage === 'revealed' && e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            {/* Stage 1: Unveiling */}
            {stage === 'unveiling' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="text-6xl"
                >
                  📜
                </motion.div>
                <div className="space-y-2">
                  <p className="text-xl text-white/90">
                    小悦正在为你们的盲盒创造专属主题...
                  </p>
                  {/* Shimmer line animation */}
                  <div className="h-1 w-48 mx-auto bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
                      animate={{ x: [-200, 200] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Stage 2: Gold Foil Reveal */}
            {stage === 'revealed' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotateY: -15 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.8, type: 'spring' }}
                className="relative max-w-lg w-full"
              >
                {/* Screenshot hint */}
                {showScreenshotHint && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs z-10"
                  >
                    📸 长按屏幕截图分享
                  </motion.div>
                )}

                {/* Gold foil card */}
                <div
                  className={`relative min-h-[500px] rounded-3xl border-4 border-yellow-300/50 p-8 bg-gradient-to-br ${vibe.gradient} ${vibe.glow} overflow-hidden`}
                >
                  {/* Embossed pattern background */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="text-6xl leading-relaxed">
                      {Array.from({ length: 100 }).map((_, i) => (
                        <span key={i}>{vibe.pattern}</span>
                      ))}
                    </div>
                  </div>

                  {/* Shine effect */}
                  <motion.div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none -skew-x-[20deg]"
                    initial={{ x: -500 }}
                    animate={{ x: 500 }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    style={{ width: '100px' }}
                  />

                  {/* Content */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    {/* Crown icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      <Crown className="h-12 w-12 text-yellow-200" />
                    </motion.div>

                    {/* Theme emoji */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                      className="text-8xl"
                    >
                      {themeEmoji}
                    </motion.div>

                    {/* Event theme title */}
                    <motion.h1
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="text-6xl font-black text-white drop-shadow-2xl"
                      style={{ textShadow: '0 4px 8px rgba(0,0,0,0.5)' }}
                    >
                      {eventThemeTitle}
                    </motion.h1>

                    {/* Tagline */}
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="text-xl italic text-white/95"
                    >
                      "{themeTagline}"
                    </motion.p>

                    {/* Theme highlights */}
                    {themeHighlights.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="flex gap-2 flex-wrap justify-center"
                      >
                        {themeHighlights.map((power, idx) => (
                          <motion.span
                            key={power}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1 + idx * 0.1 }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-base font-medium"
                          >
                            <Sparkles className="h-4 w-4" />
                            {power}
                          </motion.span>
                        ))}
                      </motion.div>
                    )}

                    {/* CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.3 }}
                      className="pt-4"
                    >
                      <p className="text-sm text-white/80 mb-2">
                        扫码加入下一场活动 👇
                      </p>
                      <Button
                        size="lg"
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border-2 border-white/50 font-bold"
                        onClick={onClose}
                      >
                        继续
                      </Button>
                    </motion.div>
                  </div>

                  {/* Watermark */}
                  <div className="absolute bottom-4 right-4 opacity-30">
                    <span className="text-white text-xs font-medium">
                      JoyJoin 悦聚
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
