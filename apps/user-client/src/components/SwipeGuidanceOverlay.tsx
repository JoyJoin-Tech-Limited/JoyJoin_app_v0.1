import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const STORAGE_KEY = "joyjoin_swipe_guidance_seen";

export function SwipeGuidanceOverlay() {
  const prefersReducedMotion = useReducedMotion();
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

  const gesturePulse = prefersReducedMotion
    ? { scale: 1, opacity: 1 }
    : { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm text-white flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-2"
            >
              <p className="text-sm text-white/80">首次进入，试试滑动吧</p>
              <p className="text-xl font-semibold">左滑跳过 · 右滑喜欢 · 上滑超爱</p>
            </motion.div>

            <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-xl">
              <motion.div
                className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4 border border-white/15"
                animate={gesturePulse}
                transition={{ duration: 1.6, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut" }}
              >
                <div className="w-14 h-14 rounded-full bg-red-500/30 border border-red-400/60 flex items-center justify-center">
                  <ArrowLeft className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium">左滑 · 跳过</p>
                <span className="text-xs text-white/70">不感兴趣就滑走</span>
              </motion.div>
              <motion.div
                className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4 border border-white/15"
                animate={gesturePulse}
                transition={{ duration: 1.6, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.15 }}
              >
                <div className="w-14 h-14 rounded-full bg-green-500/30 border border-green-400/60 flex items-center justify-center">
                  <ArrowRight className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium">右滑 · 喜欢</p>
                <span className="text-xs text-white/70">收藏心动选项</span>
              </motion.div>
              <motion.div
                className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4 border border-white/15"
                animate={gesturePulse}
                transition={{ duration: 1.6, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                <div className="w-14 h-14 rounded-full bg-purple-500/40 border border-yellow-300/60 flex items-center justify-center">
                  <ArrowUp className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium">上滑 · 超爱</p>
                <span className="text-xs text-white/70">重点标记灵感</span>
              </motion.div>
            </div>

            <motion.div
              className="mt-10 px-6 py-3 rounded-full bg-white text-black font-semibold shadow-lg"
              whileTap={{ scale: 0.95 }}
            >
              [点击开始]
            </motion.div>
            <p className="mt-3 text-xs text-white/60">点击任意处关闭提示</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!visible && (
        <div className="mb-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowLeft className="w-3 h-3" />跳过</span>
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />超爱</span>
          <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />喜欢</span>
        </div>
      )}
    </>
  );
}
