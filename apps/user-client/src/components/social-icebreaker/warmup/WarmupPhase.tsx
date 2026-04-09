import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { SocialTopic, AtmosphereMood } from '@shared/socialIcebreaker';

interface WarmupPhaseProps {
  sessionId: string;
  socialSessionId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string }>;
  topics: SocialTopic[];
  currentTopicIndex: number;
  readyUserIds: string[];
  currentUserId: string;
  commonGroundCount: number;
  onFetchTopics: (mood: AtmosphereMood) => Promise<SocialTopic[]>;
  onReadyChange: (ready: boolean) => Promise<void>;
  onNextTopic: () => Promise<void>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; emoji: string; label: string }> = [
  { mood: 'funny', emoji: '😂', label: '搞笑' },
  { mood: 'life', emoji: '☕', label: '生活' },
  { mood: 'relaxed', emoji: '✨', label: '轻松' },
  { mood: 'emotional', emoji: '💫', label: '情感' },
];

const DEPTH_COPY: Record<NonNullable<SocialTopic['depthLevel']>, string> = {
  1: '轻松开场',
  2: '体验分享',
  3: '温和走心',
};

export function WarmupPhase({
  isHost,
  participants,
  topics,
  currentTopicIndex,
  readyUserIds,
  currentUserId,
  commonGroundCount,
  onFetchTopics,
  onReadyChange,
  onNextTopic,
  onAdvance,
  isAdvancing,
}: WarmupPhaseProps) {
  const [selectedMood, setSelectedMood] = useState<AtmosphereMood>('funny');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingReady, setIsSubmittingReady] = useState(false);
  const [isChangingTopic, setIsChangingTopic] = useState(false);

  const currentTopic = topics[currentTopicIndex] || null;
  const readyCount = new Set(readyUserIds).size;
  const totalCount = participants.length;
  const allReady = totalCount > 0 && readyCount >= totalCount;
  const isCurrentUserReady = readyUserIds.includes(currentUserId);
  const hasMoreTopics = currentTopicIndex < topics.length - 1;

  const handleMoodSelect = useCallback(
    async (mood: AtmosphereMood) => {
      setSelectedMood(mood);
      setIsRefreshing(true);
      try {
        await onFetchTopics(mood);
      } finally {
        setIsRefreshing(false);
      }
    },
    [onFetchTopics]
  );

  const handleReadyToggle = useCallback(async () => {
    setIsSubmittingReady(true);
    try {
      await onReadyChange(!isCurrentUserReady);
      if (navigator.vibrate) navigator.vibrate(40);
    } finally {
      setIsSubmittingReady(false);
    }
  }, [isCurrentUserReady, onReadyChange]);

  const handleNextTopic = useCallback(async () => {
    setIsChangingTopic(true);
    try {
      await onNextTopic();
      if (navigator.vibrate) navigator.vibrate(40);
    } finally {
      setIsChangingTopic(false);
    }
  }, [onNextTopic]);

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-amber-50 via-rose-50 to-purple-50 dark:from-zinc-900 dark:via-amber-950 dark:to-zinc-900"
      data-testid="warmup-phase"
    >
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-amber-100/80 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          🌅 热身时间
        </span>
      </div>

      <div className="px-4 pb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1">已准备 {readyCount}/{totalCount}</span>
        <span className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1">共同点 × {commonGroundCount}</span>
      </div>

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
              小悦正在整理更合拍的话题...
            </motion.div>
          ) : currentTopic ? (
            <motion.div
              key={currentTopic.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="w-full max-w-sm bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-3xl shadow-xl border border-white/50 dark:border-white/10 p-8"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">{currentTopic.emoji}</div>
                <p className="text-2xl font-bold leading-snug text-center text-foreground">
                  {currentTopic.question}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full">
                    {currentTopic.category || MOOD_OPTIONS.find(m => m.mood === currentTopic.mood)?.label}
                  </span>
                  {currentTopic.depthLevel && (
                    <span className="text-xs bg-white/80 dark:bg-white/10 text-muted-foreground px-3 py-1 rounded-full">
                      {DEPTH_COPY[currentTopic.depthLevel]}
                    </span>
                  )}
                  {currentTopic.safety && (
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full">
                      {currentTopic.safety === 'reflective' ? '可慢慢聊' : '低压力'}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-muted-foreground text-sm">暂无话题，请选择今晚的热身氛围</div>
          )}
        </AnimatePresence>

        {currentTopic && (
          <button
            onClick={handleReadyToggle}
            disabled={isSubmittingReady}
            className={`w-full max-w-sm rounded-2xl border px-5 py-4 text-left transition-colors ${
              isCurrentUserReady
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'border-amber-200 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/5'
            }`}
          >
            <div className="font-semibold">{isCurrentUserReady ? '✓ 我准备好进入下一题了' : '这题聊得差不多了'}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isCurrentUserReady ? '点一下可取消，继续聊这一题。' : '点一下表示你愿意和大家一起切换节奏。'}
            </div>
          </button>
        )}
      </div>

      <div className="px-4 pb-6 space-y-3">
        {isHost && currentTopic && hasMoreTopics && (
          <button
            onClick={handleNextTopic}
            disabled={!allReady || isChangingTopic}
            className="w-full text-base border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-3 text-amber-700 dark:text-amber-300 disabled:opacity-40"
          >
            {isChangingTopic ? '切换中...' : allReady ? '下一题 →' : '等大家都准备好再切换'}
          </button>
        )}

        {isHost && currentTopic && (
          <MobilePrimaryButton
            onClick={onAdvance}
            disabled={isAdvancing || !allReady}
            className="w-full"
          >
            {isAdvancing ? '切换中...' : allReady ? '进入挑战 ⚡' : '等所有人点头后再继续'}
          </MobilePrimaryButton>
        )}

        {!isHost && (
          <p className="text-center text-sm text-muted-foreground">
            {allReady ? '主持人可以带大家进入下一题或下一环节了' : '等大家都点头，我们再一起往前走'}
          </p>
        )}
      </div>
    </div>
  );
}
