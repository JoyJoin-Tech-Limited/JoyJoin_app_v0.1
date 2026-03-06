import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  // Accepted but not used in render body — available for future feature additions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  participants,
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

  // Sync topics when the host's fetch propagates via polling
  useEffect(() => {
    if (topics.length > 0) {
      setCurrentTopics(topics);
      setCurrentIndex(0);
    }
  }, [topics]);

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
    if (currentTopics.length === 0) return;
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

      {/* Mood selector — host only */}
      {isHost && (
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
      )}

      {/* Topic card + inline refresh */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
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

        {/* Host: prominent refresh button with tooltip */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || currentTopics.length === 0}
              className="text-amber-600 dark:text-amber-400 font-medium text-base border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40"
            >
              换个话题 →
            </button>
            <span className="text-xs text-muted-foreground">只有你能看见这个按钮</span>
          </div>
        )}

        {/* Non-host: static hint */}
        {!isHost && (
          <p className="text-xs text-muted-foreground">主持人正在带领话题</p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-3">
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
