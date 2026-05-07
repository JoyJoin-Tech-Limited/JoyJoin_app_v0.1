import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { PersonalityDiceChallenge } from '@shared/socialIcebreaker';

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: '简单', color: 'bg-green-900/50 text-green-300 border-green-700' },
  medium: { label: '中等', color: 'bg-amber-900/50 text-amber-300 border-amber-700' },
  hard: { label: '困难', color: 'bg-red-900/50 text-red-300 border-red-700' },
};

interface PersonalityDicePhaseProps {
  socialSessionId: string;
  userId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  challenges: PersonalityDiceChallenge[];
  currentPlayerIndex: number;
  completedBy: string[];
  onGenerate: () => Promise<void>;
  onComplete: () => Promise<void>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

export function PersonalityDicePhase({
  userId,
  isHost,
  participants,
  challenges,
  currentPlayerIndex,
  completedBy,
  onGenerate,
  onComplete,
  onAdvance,
  isAdvancing,
}: PersonalityDicePhaseProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const currentChallenge = challenges[currentPlayerIndex] || null;
  const allCompleted = challenges.length > 0 && completedBy.length >= challenges.length;
  const isMyChallenge = currentChallenge?.userId === userId;
  const iHaveCompleted = completedBy.includes(userId);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-pink-900 via-fuchsia-900 to-purple-900"
      data-testid="personality-dice-phase"
    >
      {/* Phase pill */}
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-pink-900/80 text-pink-300 border border-pink-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          🎲 人格骰子
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* No challenges yet */}
        {challenges.length === 0 && (
          <motion.div
            key="no-challenges"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 gap-6"
          >
            <div className="text-center">
              <motion.div
                animate={isGenerating ? { rotate: [0, 60, 120, 180, 240, 300, 360] } : {}}
                transition={{ duration: 0.8, repeat: isGenerating ? Infinity : 0, ease: 'linear' }}
                className="text-7xl mb-4 inline-block"
              >
                🎲
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-2">人格骰子</h2>
              {isGenerating ? (
                <p className="text-pink-200 text-sm">小悦正在分析大家的人格...</p>
              ) : (
                <p className="text-pink-300 text-sm leading-relaxed">
                  掷出命运骰子，触发专属人格挑战！
                </p>
              )}
            </div>

            {isHost && !isGenerating && (
              <MobilePrimaryButton
                onClick={handleGenerate}
                className="bg-gradient-to-r from-pink-600 to-fuchsia-600 border-0 w-full max-w-xs"
              >
                ✨ 掷出命运骰子
              </MobilePrimaryButton>
            )}

            {isGenerating && (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}

            {!isHost && !isGenerating && (
              <p className="text-pink-400 text-sm">等待主持人掷骰子...</p>
            )}
          </motion.div>
        )}

        {/* All completed */}
        {allCompleted && (
          <motion.div
            key="all-completed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-6 gap-6"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🎲</div>
              <h2 className="text-2xl font-black text-white mb-2">今晚人格骰子挑战圆满结束！</h2>
              <p className="text-pink-200 text-sm">每个人都完成了属于自己的挑战 ✨</p>
            </div>
            {isHost && (
              <MobilePrimaryButton
                onClick={onAdvance}
                disabled={isAdvancing}
                className="w-full max-w-xs bg-gradient-to-r from-pink-600 to-fuchsia-600 border-0"
              >
                {isAdvancing ? '切换中...' : '进入精彩回顾 ✨'}
              </MobilePrimaryButton>
            )}
          </motion.div>
        )}

        {/* Active challenge */}
        {challenges.length > 0 && !allCompleted && currentChallenge && (
          <motion.div
            key={`challenge-${currentPlayerIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col px-4 py-4 gap-4"
          >
            {/* Player indicator */}
            <div className="text-center">
              <p className="text-pink-300 text-sm">
                {currentPlayerIndex + 1} / {challenges.length}
              </p>
              <p className="text-white font-bold text-lg">
                {currentChallenge.displayName} 的挑战
              </p>
            </div>

            {/* Challenge card */}
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-full max-w-sm bg-gradient-to-br from-pink-800/60 via-fuchsia-800/60 to-purple-800/60 border border-pink-500/40 rounded-3xl p-8 text-center shadow-2xl"
              >
                <div className="text-6xl mb-4">{currentChallenge.challengeEmoji}</div>
                <h3 className="text-xl font-black text-white mb-3">{currentChallenge.challengeTitle}</h3>
                <p className="text-sm text-fuchsia-200 leading-relaxed mb-4">{currentChallenge.challengeBody}</p>
                <span
                  className={`inline-block text-xs px-3 py-1 rounded-full border font-semibold ${
                    DIFFICULTY_LABELS[currentChallenge.difficulty]?.color || 'bg-gray-800 text-gray-300 border-gray-600'
                  }`}
                >
                  {DIFFICULTY_LABELS[currentChallenge.difficulty]?.label || currentChallenge.difficulty}
                </span>
              </motion.div>
            </div>

            {/* Bottom actions */}
            <div className="space-y-3 pb-2">
              {isMyChallenge && !iHaveCompleted && (
                <MobilePrimaryButton
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="w-full bg-gradient-to-r from-pink-600 to-fuchsia-600 border-0"
                >
                  {isCompleting ? '提交中...' : '✅ 完成挑战！'}
                </MobilePrimaryButton>
              )}

              {isMyChallenge && iHaveCompleted && (
                <div className="w-full flex items-center justify-center bg-green-900/30 border border-green-700 rounded-2xl py-4">
                  <p className="text-green-300 font-semibold text-sm">✅ 已完成！等主持人继续...</p>
                </div>
              )}

              {!isMyChallenge && (
                <div className="text-center py-3">
                  <p className="text-pink-300 text-sm">
                    等 {currentChallenge.displayName} 完成挑战...
                  </p>
                </div>
              )}

              {isHost && (
                <button
                  onClick={onAdvance}
                  disabled={isAdvancing}
                  className="w-full text-sm text-pink-400 hover:text-pink-200 transition-colors py-2"
                >
                  {isAdvancing ? '切换中...' : '结束骰子游戏 →'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      {challenges.length > 0 && (
        <div className="flex justify-center gap-2 pb-4">
          {challenges.map((c, i) => (
            <div
              key={c.userId}
              className={`w-2 h-2 rounded-full transition-all ${
                completedBy.includes(c.userId)
                  ? 'bg-green-400'
                  : i === currentPlayerIndex
                  ? 'bg-pink-400 scale-125'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
