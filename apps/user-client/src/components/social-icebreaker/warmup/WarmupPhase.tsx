import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { SocialTopic, AtmosphereMood } from '@shared/socialIcebreaker';

interface WarmupPhaseProps {
  sessionId: string;
  socialSessionId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string }>;
  topics: SocialTopic[];
  onFetchTopics: (mood: AtmosphereMood) => Promise<SocialTopic[]>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; emoji: string; label: string }> = [
  { mood: 'funny', emoji: '😂', label: '搞笑' },
  { mood: 'life', emoji: '☕', label: '生活' },
  { mood: 'relaxed', emoji: '✨', label: '轻松' },
  { mood: 'emotional', emoji: '💫', label: '情感' },
];

export function WarmupPhase({
  isHost,
  topics,
  onFetchTopics,
  onAdvance,
  isAdvancing,
}: WarmupPhaseProps) {
  const [selectedMood, setSelectedMood] = useState<AtmosphereMood>('funny');
  const [currentTopics, setCurrentTopics] = useState<SocialTopic[]>(topics);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [topicsUsed, setTopicsUsed] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const currentTopic = currentTopics[currentIndex] || null;

  const handleMoodSelect = useCallback(
    async (mood: AtmosphereMood) => {
      setSelectedMood(mood);
      setIsRefreshing(true);
      try {
        const newTopics = await onFetchTopics(mood);
        if (newTopics.length > 0) {
          setCurrentTopics(newTopics);
          setCurrentIndex(0);
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [onFetchTopics]
  );

  const handleRefresh = useCallback(() => {
    const nextIndex = (currentIndex + 1) % currentTopics.length;
    setDirection(1);
    setCurrentIndex(nextIndex);
    setTopicsUsed(prev => prev + 1);
    if (navigator.vibrate) navigator.vibrate(40);
  }, [currentIndex, currentTopics.length]);

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-amber-50 via-rose-50 to-purple-50 dark:from-zinc-900 dark:via-amber-950 dark:to-zinc-900"
      data-testid="warmup-phase"
    >
      {/* Phase pill */}
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-amber-100/80 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          🌅 热身时间
        </span>
      </div>

      {/* Mood selector */}
      <div className="flex justify-center gap-2 px-4 py-3">
        {MOOD_OPTIONS.map(({ mood, emoji, label }) => (
          <button
            key={mood}
            onClick={() => handleMoodSelect(mood)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedMood === mood
                ? 'bg-primary text-white shadow-md scale-105'
                : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Topic card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {isRefreshing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-muted-foreground text-sm"
            >
              小悦正在挑选话题...
            </motion.div>
          ) : currentTopic ? (
            <motion.div
              key={currentTopic.id}
              initial={{ opacity: 0, y: 40 * direction, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -100 * direction, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="w-full max-w-sm bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-3xl shadow-xl border border-white/50 dark:border-white/10 p-8"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">{currentTopic.emoji}</div>
                <p className="text-2xl font-bold leading-snug text-center text-foreground">
                  {currentTopic.question}
                </p>
                <div className="mt-4">
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full">
                    {MOOD_OPTIONS.find(m => m.mood === currentTopic.mood)?.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-muted-foreground text-sm">暂无话题，请选择心情</div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-3">
        {/* Refresh button */}
        <div className="flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || currentTopics.length === 0}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            <motion.span
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.5 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.span>
            换一个 ↺
          </button>
        </div>

        {/* Advance CTA (host only, after ≥1 topic discussed) */}
        {isHost && topicsUsed >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <MobilePrimaryButton
              onClick={onAdvance}
              disabled={isAdvancing}
              className="w-full"
            >
              {isAdvancing ? '切换中...' : '进入挑战 ⚡'}
            </MobilePrimaryButton>
          </motion.div>
        )}

        {!isHost && (
          <p className="text-center text-sm text-muted-foreground">
            等主持人开始下一环节
          </p>
        )}
      </div>
    </div>
  );
}
