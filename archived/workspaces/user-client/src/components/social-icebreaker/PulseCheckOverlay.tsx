import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PulseCheckOverlayProps {
  isVisible: boolean;
  onSubmit: (vibe: 1 | 2 | 3) => void;
  onComplete: () => void;
  groupAverage?: number;
  phaseLabel?: string;
}

const VIBE_OPTIONS: Array<{ vibe: 1 | 2 | 3; emoji: string; label: string }> = [
  { vibe: 1, emoji: '😐', label: '一般' },
  { vibe: 2, emoji: '😊', label: '不错' },
  { vibe: 3, emoji: '🔥', label: '超燃' },
];

const TIMEOUT_SECONDS = 8;

function getVibeLabel(avg: number): string {
  if (avg >= 2.5) return '🔥 超级燃！';
  if (avg >= 1.5) return '😊 气氛不错！';
  return '😐 继续加油！';
}

export function PulseCheckOverlay({
  isVisible,
  onSubmit,
  onComplete,
  groupAverage,
  phaseLabel,
}: PulseCheckOverlayProps) {
  const [selectedVibe, setSelectedVibe] = useState<1 | 2 | 3 | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setSelectedVibe(null);
      setTimeLeft(TIMEOUT_SECONDS);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible, onComplete]);

  const handleVibe = (vibe: 1 | 2 | 3) => {
    setSelectedVibe(vibe);
    onSubmit(vibe);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          data-testid="pulse-check-overlay"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-card rounded-3xl p-8 shadow-2xl mx-4 w-full max-w-sm"
          >
            {/* Progress bar */}
            <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / TIMEOUT_SECONDS) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>

            <h3 className="text-xl font-bold text-center mb-2">此刻的你感觉怎样？</h3>
            {phaseLabel && (
              <p className="text-sm font-semibold text-center mb-4">{phaseLabel}</p>
            )}
            <p className="text-sm text-muted-foreground text-center mb-6">
              下一环节即将开始
            </p>

            {!selectedVibe ? (
              <div className="flex justify-center gap-6">
                {VIBE_OPTIONS.map(({ vibe, emoji, label }) => (
                  <button
                    key={vibe}
                    onClick={() => handleVibe(vibe)}
                    className="flex flex-col items-center gap-2 transition-transform active:scale-95"
                  >
                    <span className="text-5xl">{emoji}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center">
                {groupAverage !== undefined ? (
                  <>
                    <p className="text-lg font-semibold mb-2">
                      大家的平均热度：{getVibeLabel(groupAverage)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">下一环节准备中</p>
                )}
                <div className="flex justify-center gap-1 mt-3">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
