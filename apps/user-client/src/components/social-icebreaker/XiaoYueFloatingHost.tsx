import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XiaoYueFloatingHostProps {
  phase: string;
  message?: string;
  isVisible: boolean;
}

const DEFAULT_MESSAGES: Record<string, string> = {
  warmup: '这个话题太辣了 🌶️ 快聊！',
  micro_challenge: '加油！时间不多了 ⚡',
  lie_detective: '侦探们，仔细听每一句话 👀',
  auction: '脑洞大开，准备竞拍！🎪',
  personality_dice: '掷出你的命运骰子 🎲',
  recap: '今晚的破冰之旅圆满结束！✨',
};

export function XiaoYueFloatingHost({ phase, message, isVisible }: XiaoYueFloatingHostProps) {
  const [visible, setVisible] = useState(isVisible);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 6000);
    } else {
      setVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, message]);

  const displayMessage = message || DEFAULT_MESSAGES[phase] || '破冰进行中 ✨';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: -10 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 10, x: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed bottom-28 left-4 z-40 flex items-end gap-2"
          data-testid="xiaoyue-floating-host"
        >
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white font-bold text-xs">小悦</span>
          </div>
          {/* Speech bubble */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none shadow-lg max-w-[200px] p-3">
            <p className="text-sm text-foreground leading-snug">{displayMessage}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
