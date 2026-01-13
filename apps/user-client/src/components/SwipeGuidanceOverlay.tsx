import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

const STORAGE_KEY = "joyjoin_swipe_guidance_seen";

export function SwipeGuidanceOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
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
          className="fixed inset-0 z-50 bg-gradient-to-b from-[#6930C3] to-[#3B0B8D] text-white flex flex-col items-center justify-center px-6"
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
            className="text-center mb-8"
          >
            <p className="text-base text-white/80 mb-2">首次进入，试试滑动吧</p>
            <h1 className="text-2xl font-bold">
              左滑跳过 · 右滑喜欢 · 上滑超爱
            </h1>
          </motion.div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4"
            >
              <div className="w-14 h-14 rounded-full bg-gray-600/50 flex items-center justify-center">
                <ArrowLeft className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">左滑 · 跳过</p>
                <span className="text-xs text-white/60">不感兴趣就滑走</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4"
            >
              <div className="w-14 h-14 rounded-full bg-green-500/80 flex items-center justify-center">
                <ArrowRight className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">右滑 · 喜欢</p>
                <span className="text-xs text-white/60">收藏心动选项</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4"
            >
              <div className="w-14 h-14 rounded-full bg-purple-400/80 flex items-center justify-center">
                <ArrowUp className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">上滑 · 超爱</p>
                <span className="text-xs text-white/60">重点标记灵感</span>
              </div>
            </motion.div>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-10 px-8 py-3 rounded-full bg-white text-purple-700 font-bold text-base"
            whileTap={{ scale: 0.96 }}
            data-testid="button-start-swiping"
          >
            [点击开始]
          </motion.button>
          <p className="mt-3 text-sm text-white/50">点击任意处关闭提示</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
