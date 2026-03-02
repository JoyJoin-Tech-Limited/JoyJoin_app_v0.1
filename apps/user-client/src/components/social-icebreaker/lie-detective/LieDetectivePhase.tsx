import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { LieDetectivePlayer, LieDetectiveVote } from '@shared/socialIcebreaker';

interface LieDetectivePhaseProps {
  sessionId: string;
  socialSessionId: string;
  userId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string; archetype?: string; interests?: string[] }>;
  players: LieDetectivePlayer[];
  votes: LieDetectiveVote[];
  currentPlayerIndex: number;
  onGenerateStatements: () => Promise<Array<{ index: number; text: string }>>;
  onCastVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

type SubPhase = 'generating' | 'presenting' | 'voting' | 'revealing';

export function LieDetectivePhase({
  userId,
  isHost,
  participants,
  players,
  votes,
  currentPlayerIndex,
  onGenerateStatements,
  onCastVote,
  onAdvance,
  isAdvancing,
}: LieDetectivePhaseProps) {
  const [subPhase, setSubPhase] = useState<SubPhase>(
    players.length > 0 ? 'presenting' : 'generating'
  );
  const [myStatements, setMyStatements] = useState<Array<{ index: number; text: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const currentPlayer = players[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer?.userId === userId;
  const hasVotedForCurrent = currentPlayer
    ? votes.some(v => v.voterId === userId && v.targetUserId === currentPlayer.userId)
    : false;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const statements = await onGenerateStatements();
      setMyStatements(statements);
      setSubPhase('presenting');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVote = async (statementIndex: number) => {
    if (!currentPlayer || hasVotedForCurrent) return;
    setSelectedVote(statementIndex);
    await onCastVote(currentPlayer.userId, statementIndex);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900"
      data-testid="lie-detective-phase"
    >
      {/* Phase pill */}
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-purple-900/80 text-purple-300 border border-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          🕵️ 谎言侦探
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* Generating state */}
        {subPhase === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-4 gap-6"
          >
            <div className="text-center">
              <div className="text-5xl mb-4">🕵️</div>
              <p className="text-purple-200 text-lg font-semibold mb-2">
                {isGenerating ? '小悦正在为大家准备谎言...' : '准备好你的两真一假了吗？'}
              </p>
              <p className="text-purple-400 text-sm">
                每人提供2个真话和1个谎言，大家来猜
              </p>
            </div>
            {!isGenerating && (
              <MobilePrimaryButton
                onClick={handleGenerate}
                className="bg-gradient-to-r from-purple-600 to-violet-600 border-0"
              >
                ✨ 让小悦帮我生成
              </MobilePrimaryButton>
            )}
            {isGenerating && (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Presenting state */}
        {subPhase === 'presenting' && currentPlayer && (
          <motion.div
            key={`presenting-${currentPlayerIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col px-4 py-4 gap-4"
          >
            <p className="text-center text-purple-300 text-lg font-bold">
              {currentPlayer.displayName} 的陈述
            </p>
            <p className="text-center text-purple-400 text-xs mb-2">其中有一句是谎言...</p>

            {/* Statement cards stacked */}
            <div className="relative flex-1 flex items-center justify-center">
              <div className="w-full max-w-sm space-y-3">
                {currentPlayer.statements.map((stmt, idx) => (
                  <motion.div
                    key={stmt.index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className="bg-slate-800 border border-purple-500/40 rounded-2xl p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-900 border border-purple-600 flex items-center justify-center text-purple-300 text-xs font-bold">
                        #{stmt.index}
                      </span>
                      <p className="text-white text-base leading-relaxed">{stmt.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Voting panel (others vote, not the presenter) */}
            {!isMyTurn && !hasVotedForCurrent && (
              <div className="space-y-2 pb-2">
                <p className="text-center text-purple-300 text-sm font-semibold">你觉得哪句是谎言？</p>
                {currentPlayer.statements.map(stmt => (
                  <button
                    key={stmt.index}
                    onClick={() => handleVote(stmt.index)}
                    className={`w-full min-h-[64px] rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      selectedVote === stmt.index
                        ? 'border-purple-400 bg-purple-900/50 text-purple-100'
                        : 'border-purple-800 bg-slate-800/60 text-slate-300 hover:border-purple-600'
                    }`}
                  >
                    <span className="font-bold mr-2">#{stmt.index}</span>
                    <span className="text-sm">{stmt.text}</span>
                  </button>
                ))}
              </div>
            )}

            {hasVotedForCurrent && (
              <div className="text-center py-3">
                <p className="text-purple-300 text-sm">✓ 你已投票，等待结果...</p>
              </div>
            )}

            {isMyTurn && (
              <div className="text-center py-3">
                <p className="text-purple-300 text-sm">这是你的陈述，等大家投票...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host controls */}
      {isHost && (
        <div className="px-4 pb-6">
          <button
            onClick={onAdvance}
            disabled={isAdvancing}
            className="w-full text-sm text-muted-foreground hover:text-purple-300 transition-colors py-2"
          >
            {isAdvancing ? '切换中...' : '结束侦探游戏 →'}
          </button>
        </div>
      )}
    </div>
  );
}
