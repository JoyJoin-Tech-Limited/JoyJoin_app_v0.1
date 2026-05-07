import { useState } from 'react';
import { motion } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { LieDetectivePlayer, LieDetectiveReveal, LieDetectiveVote } from '@shared/socialIcebreaker';

interface LieDetectivePhaseProps {
  sessionId: string;
  socialSessionId: string;
  userId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string; archetype?: string; interests?: string[] }>;
  players: LieDetectivePlayer[];
  votes: LieDetectiveVote[];
  currentPlayerIndex: number;
  currentReveal: LieDetectiveReveal | null;
  onGenerateStatements: () => Promise<Array<{ index: number; text: string }>>;
  onCastVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  onNextPlayer: () => Promise<void>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

function LieRevealCard({
  statements,
  lieIndex,
  voteCount,
  correctVoteCount,
}: {
  statements: Array<{ index: number; text: string }>;
  lieIndex: number;
  voteCount: number;
  correctVoteCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="w-full max-w-sm space-y-3"
    >
      <p className="text-center text-purple-200 font-bold text-lg mb-4">揭晓！🎯</p>
      {statements.map((stmt) => {
        const isLie = stmt.index === lieIndex;
        return (
          <div
            key={stmt.index}
            className={`rounded-2xl border-2 p-4 ${
              isLie ? 'bg-red-900/50 border-red-500' : 'bg-green-900/50 border-green-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isLie ? 'bg-red-800 text-red-200' : 'bg-green-800 text-green-200'
                }`}
              >
                #{stmt.index}
              </span>
              <div className="flex-1">
                <p className="text-white text-sm leading-relaxed">{stmt.text}</p>
                {isLie && <p className="text-red-300 text-xs mt-1 font-semibold">🤥 这是谎言！</p>}
              </div>
            </div>
          </div>
        );
      })}
      <div className="text-center mt-3 bg-purple-900/40 rounded-xl py-3">
        <p className="text-purple-200 text-sm font-semibold">{correctVoteCount} 个人猜对了！</p>
        <p className="text-purple-400 text-xs mt-1">共 {voteCount} 人投票</p>
      </div>
    </motion.div>
  );
}

export function LieDetectivePhase({
  userId,
  isHost,
  players,
  votes,
  currentPlayerIndex,
  currentReveal,
  onGenerateStatements,
  onCastVote,
  onNextPlayer,
  onAdvance,
  isAdvancing,
}: LieDetectivePhaseProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [isMovingToNextPlayer, setIsMovingToNextPlayer] = useState(false);

  const currentPlayer = players[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer?.userId === userId;
  const hasGeneratedMine = players.some((player) => player.userId === userId && player.statements.length > 0);
  const hasVotedForCurrent = currentPlayer
    ? votes.some((vote) => vote.voterId === userId && vote.targetUserId === currentPlayer.userId)
    : false;
  const votesForCurrent = currentPlayer
    ? votes.filter((vote) => vote.targetUserId === currentPlayer.userId)
    : [];
  const otherPlayerCount = players.filter((player) => player.userId !== currentPlayer?.userId).length;
  const currentPlayerReveal = currentPlayer && currentReveal?.targetUserId === currentPlayer.userId ? currentReveal : null;
  const allVoted = !!currentPlayerReveal || (otherPlayerCount > 0 && votesForCurrent.length >= otherPlayerCount);
  const isLastPlayer = currentPlayerIndex >= players.length - 1;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerateStatements();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVote = async (statementIndex: number) => {
    if (!currentPlayer || hasVotedForCurrent || currentPlayerReveal) return;
    setSelectedVote(statementIndex);
    await onCastVote(currentPlayer.userId, statementIndex);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const handleNextPlayer = async () => {
    setIsMovingToNextPlayer(true);
    try {
      await onNextPlayer();
    } finally {
      setIsMovingToNextPlayer(false);
      setSelectedVote(null);
    }
  };

  if (!currentPlayer) {
    return (
      <div
        className="flex flex-col min-h-full bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900"
        data-testid="lie-detective-phase"
      >
        <div className="flex justify-center pt-4 pb-2">
          <span className="bg-purple-900/80 text-purple-300 border border-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold">
            🕵️ 谎言侦探
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🕵️</div>
            <p className="text-purple-200 text-lg font-semibold mb-2">
              {isGenerating ? '小悦正在为大家准备谎言...' : '先生成你的两真一假吧'}
            </p>
            <p className="text-purple-400 text-sm">生成后，系统会按顺序带大家进入每一轮猜测。</p>
          </div>
          {!isGenerating && (
            <MobilePrimaryButton
              onClick={handleGenerate}
              className="bg-gradient-to-r from-purple-600 to-violet-600 border-0"
            >
              ✨ 让小悦帮我生成
            </MobilePrimaryButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900"
      data-testid="lie-detective-phase"
    >
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-purple-900/80 text-purple-300 border border-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          🕵️ 谎言侦探
        </span>
      </div>

      {!hasGeneratedMine && (
        <div className="px-4 pt-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full rounded-2xl border border-purple-700 bg-purple-900/40 px-4 py-3 text-left"
          >
            <div className="text-purple-100 font-semibold">
              {isGenerating ? '小悦正在准备你的陈述...' : '先把我的两真一假准备好'}
            </div>
            <div className="text-xs text-purple-300 mt-1">这样轮到你时，节奏不会掉下来。</div>
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col px-4 py-4 gap-4">
        <p className="text-center text-purple-300 text-lg font-bold">{currentPlayer.displayName} 的陈述</p>
        <p className="text-center text-purple-400 text-xs mb-2">其中有一句是谎言...</p>

        {!currentPlayerReveal ? (
          <div className="w-full max-w-sm mx-auto space-y-3">
            {currentPlayer.statements.map((stmt, index) => (
              <motion.div
                key={stmt.index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.12 }}
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
        ) : (
          <div className="flex justify-center">
            <LieRevealCard
              statements={currentPlayer.statements}
              lieIndex={currentPlayerReveal.lieIndex}
              voteCount={currentPlayerReveal.voteCount}
              correctVoteCount={currentPlayerReveal.correctVoteCount}
            />
          </div>
        )}

        {!currentPlayerReveal && !isMyTurn && !hasVotedForCurrent && (
          <div className="space-y-2 pb-2">
            <p className="text-center text-purple-300 text-sm font-semibold">你觉得哪句是谎言？</p>
            {currentPlayer.statements.map((stmt) => (
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

        {!currentPlayerReveal && hasVotedForCurrent && (
          <div className="text-center py-3">
            <p className="text-purple-300 text-sm">✓ 你已投票</p>
            <p className="text-purple-400 text-xs mt-1">
              {allVoted ? '答案已锁定，马上同步揭晓...' : '等待其他人完成投票...'}
            </p>
          </div>
        )}

        {!currentPlayerReveal && isMyTurn && (
          <div className="text-center py-3">
            <p className="text-purple-300 text-sm">这是你的陈述，等大家投票后系统会自动揭晓。</p>
          </div>
        )}

        {currentPlayerReveal && isHost && (
          <MobilePrimaryButton
            onClick={isLastPlayer ? onAdvance : handleNextPlayer}
            disabled={isAdvancing || isMovingToNextPlayer}
            className="w-full mt-2"
          >
            {isAdvancing || isMovingToNextPlayer
              ? '切换中...'
              : isLastPlayer
                ? '结束侦探游戏 →'
                : '下一位 →'}
          </MobilePrimaryButton>
        )}

        {currentPlayerReveal && !isHost && (
          <p className="text-purple-400 text-sm text-center">等主持人继续...</p>
        )}
      </div>
    </div>
  );
}
