import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Heart, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const STORAGE_KEY = "joyjoin_swipe_guidance_seen";

export function SwipeGuidanceOverlay() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    } else {
      setHasDismissed(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setVisible(false);
    setHasDismissed(true);
  }, []);

  const gesturePulse = prefersReducedMotion
    ? { scale: 1, opacity: 1 }
    : { scale: [1, 1.06, 1], opacity: [0.95, 1, 0.95] };

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      handleDismiss();
    }
  }, [handleDismiss]);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="滑动引导"
            tabIndex={0}
            className="fixed inset-0 z-50 bg-gradient-to-b from-purple-600/90 via-purple-700/85 to-purple-900/90 backdrop-blur-md text-white flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            onKeyDown={handleKeyDown}
            data-testid="overlay-swipe-guidance"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-center space-y-3 mb-8"
            >
              <h1 className="text-[28px] font-bold leading-tight">
                刷一刷，比问卷更懂你
              </h1>
              <p className="text-lg text-white/90 font-medium">
                几分钟，小悦就能勾勒出你的兴趣画像
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-center mb-6"
            >
              <p className="text-base text-white/80 font-medium">
                左滑跳过 · 点星超爱 · 右滑喜欢
              </p>
            </motion.div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <motion.div
                className="flex flex-col items-center gap-3 rounded-3xl bg-white/15 p-5 border border-white/20"
                animate={gesturePulse}
                transition={{ duration: 1.8, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="w-16 h-16 rounded-full bg-gray-500/40 border-2 border-gray-300/60 flex items-center justify-center shadow-lg">
                  <X className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <p className="text-base font-semibold">跳过</p>
                <span className="text-sm text-white/70">左滑或点击</span>
              </motion.div>

              <motion.div
                className="flex flex-col items-center gap-3 rounded-3xl bg-white/20 p-5 border-2 border-yellow-300/50 shadow-lg shadow-yellow-500/20"
                animate={gesturePulse}
                transition={{ duration: 1.8, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.15 }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1.02 }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/40">
                  <Sparkles className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <p className="text-base font-semibold">超爱</p>
                <span className="text-sm text-white/70">点击星星</span>
              </motion.div>

              <motion.div
                className="flex flex-col items-center gap-3 rounded-3xl bg-white/15 p-5 border border-white/20"
                animate={gesturePulse}
                transition={{ duration: 1.8, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.3 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-green-300/60 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Heart className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <p className="text-base font-semibold">喜欢</p>
                <span className="text-sm text-white/70">右滑或点击</span>
              </motion.div>
            </div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mt-10 px-10 py-4 rounded-full bg-gradient-to-r from-white to-gray-100 text-purple-700 font-bold text-lg shadow-xl shadow-white/20 relative overflow-hidden"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              data-testid="button-start-swiping"
            >
              <span className="relative z-10 flex items-center gap-2">
                马上开刷
                <Sparkles className="w-5 h-5" />
              </span>
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
              )}
            </motion.button>
            <p className="mt-4 text-sm text-white/60">点击任意处开始</p>
          </motion.div>
        )}
      </AnimatePresence>

      {hasDismissed && !visible && (
        <div className="mb-3 flex items-center justify-center gap-5 text-sm text-muted-foreground" aria-label="滑动手势提示">
          <span className="flex items-center gap-1.5"><X className="w-4 h-4" />跳过</span>
          <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400"><Sparkles className="w-4 h-4" />超爱</span>
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><Heart className="w-4 h-4" />喜欢</span>
        </div>
      )}
    </>
  );
}
