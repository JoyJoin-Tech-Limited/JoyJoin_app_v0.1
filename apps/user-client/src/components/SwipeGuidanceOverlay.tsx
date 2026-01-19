import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp, Heart, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "joyjoin_swipe_guidance_seen";

export function SwipeGuidanceOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    // For testing: if you want to see it again, manually clear localStorage
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setVisible(false);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      handleDismiss();
    }
  }, [handleDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="滑动引导"
          tabIndex={0}
          className="fixed inset-0 z-50 bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white flex flex-col items-center justify-center px-6"
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
            className="text-center mb-12"
          >
            <p className="text-sm text-white/70 mb-3 font-medium">首次进入，试试滑动吧</p>
            <h1 className="text-3xl font-bold tracking-tight">
              左滑跳过 · 右滑喜欢 · 上滑超爱
            </h1>
          </motion.div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-md px-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-white/15 backdrop-blur-md p-5 border border-white/20"
            >
              <motion.div 
                className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400/40 to-gray-500/40 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 shadow-lg"
                animate={{ x: [-3, 3, -3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowLeft className="w-8 h-8" strokeWidth={2.5} />
              </motion.div>
              <div className="text-center">
                <p className="text-base font-bold mb-1">跳过</p>
                <span className="text-xs text-white/70">不感兴趣</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-white/15 backdrop-blur-md p-5 border border-white/20"
            >
              <motion.div 
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/80 to-green-500/80 flex items-center justify-center border-2 border-white/40 shadow-lg"
                animate={{ x: [3, -3, 3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Heart className="w-8 h-8 fill-white" strokeWidth={2.5} />
              </motion.div>
              <div className="text-center">
                <p className="text-base font-bold mb-1">喜欢</p>
                <span className="text-xs text-white/70">收藏心动</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-pink-400/30 to-rose-500/30 backdrop-blur-md p-5 border-2 border-pink-300/40 shadow-xl"
            >
              <motion.div 
                className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center border-2 border-white/50 shadow-lg"
                animate={{ 
                  y: [-4, 4, -4],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="w-8 h-8 fill-white" strokeWidth={2.5} />
              </motion.div>
              <div className="text-center">
                <p className="text-base font-bold mb-1">超爱</p>
                <span className="text-xs text-white/70">重点标记</span>
              </div>
            </motion.div>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mt-12 px-10 py-3.5 rounded-full bg-white text-purple-700 font-bold text-base shadow-xl hover:shadow-2xl transition-shadow flex items-center gap-2"
            whileTap={{ scale: 0.96 }}
            data-testid="button-start-swiping"
          >
            <span>开始探索</span>
            <Sparkles className="w-4 h-4" />
          </motion.button>
          <p className="mt-4 text-sm text-white/60 font-medium">点击任意处开始</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
