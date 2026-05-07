import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AtmosphereMood } from '@shared/socialIcebreaker';

export const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; emoji: string; label: string }> = [
  { mood: 'funny', emoji: '😂', label: '搞笑' },
  { mood: 'life', emoji: '☕', label: '生活' },
  { mood: 'relaxed', emoji: '✨', label: '轻松' },
  { mood: 'emotional', emoji: '💫', label: '情感' },
];

const COUNTDOWN_SECONDS = 10;

interface MoodVoteOverlayProps {
  isVisible: boolean;
  isHost: boolean;
  onVoteComplete: (mood: AtmosphereMood | null) => void;
}

export function MoodVoteOverlay({ isVisible, isHost, onVoteComplete }: MoodVoteOverlayProps) {
  const [selected, setSelected] = useState<AtmosphereMood | null>(null);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const onVoteCompleteRef = useRef(onVoteComplete);
  const selectedRef = useRef<AtmosphereMood | null>(null);

  // Keep refs in sync so timer closure always calls the latest callback with latest selection
  useEffect(() => {
    onVoteCompleteRef.current = onVoteComplete;
  }, [onVoteComplete]);

  useEffect(() => {
    if (!isVisible) {
      setSelected(null);
      setTimeLeft(COUNTDOWN_SECONDS);
      setDismissed(false);
      doneRef.current = false;
      selectedRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!doneRef.current) {
            doneRef.current = true;
            onVoteCompleteRef.current(selectedRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible]);

  const handleSelect = (mood: AtmosphereMood) => {
    if (dismissed || doneRef.current) return;
    setSelected(mood);
    selectedRef.current = mood;
    if (timerRef.current) clearInterval(timerRef.current);
    setDismissed(true);
    setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onVoteCompleteRef.current(mood);
      }
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center px-6"
          data-testid="mood-vote-overlay"
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <motion.div
              className="h-full bg-amber-400"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / COUNTDOWN_SECONDS) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white mb-1">今晚的你，状态如何？</h2>
              <p className="text-sm text-white/60">投票选出今晚的话题风格</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MOOD_OPTIONS.map(({ mood, emoji, label }) => (
                <button
                  key={mood}
                  onClick={() => handleSelect(mood)}
                  className={`rounded-2xl p-4 min-h-[80px] flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                    selected === mood
                      ? 'bg-amber-500/30 border-amber-400 scale-105'
                      : 'bg-white/10 border-white/20 hover:bg-white/20'
                  }`}
                >
                  <span className="text-4xl">{emoji}</span>
                  <span className="text-white font-semibold text-sm">{label}</span>
                </button>
              ))}
            </div>

            {selected && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-amber-300 text-sm mt-4 font-semibold"
              >
                ✓ 已选择 {MOOD_OPTIONS.find(m => m.mood === selected)?.label}！
              </motion.p>
            )}

            {!isHost && !selected && (
              <p className="text-center text-white/40 text-xs mt-4">
                主持人将根据大家的投票选择话题风格
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
