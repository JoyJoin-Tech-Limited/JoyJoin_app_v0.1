import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { LieDetectivePlayer, LieDetectiveVote } from '@shared/socialIcebreaker';

// ─── RevealCountdown sub-component ───────────────────────────────────────────
function RevealCountdown({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(3);
  const doneRef = useRef(false);

  useEffect(() => {
    if (count <= 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
      return;
    }
    const timer = setTimeout(() => setCount(c => c - 1), 700);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {count > 0 && (
          <motion.div
            key={count}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="text-white font-black text-9xl select-none"
          >
            {count}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LieRevealCard sub-component ─────────────────────────────────────────────
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="w-full max-w-sm space-y-3"
    >
      <p className="text-center text-purple-200 font-bold text-lg mb-4">揭晓！🎯</p>
      {statements.map(stmt => {
        const isLie = stmt.index === lieIndex;
        return (
          <div
            key={stmt.index}
            className={`rounded-2xl border-2 p-4 ${
              isLie
                ? 'bg-red-900/50 border-red-500'
                : 'bg-green-900/50 border-green-500'
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
                {isLie && (
                  <p className="text-red-300 text-xs mt-1 font-semibold">🤥 这是谎言！</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="text-center mt-3 bg-purple-900/40 rounded-xl py-3">
        <p className="text-purple-200 text-sm font-semibold">
          {correctVoteCount} 个人猜对了！
        </p>
        {voteCount > 0 && (
          <p className="text-purple-400 text-xs mt-1">
            共 {voteCount} 人投票
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main LieDetectivePhase ───────────────────────────────────────────────────
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

  // Host reveal flow
  const [hostRevealLieIndex, setHostRevealLieIndex] = useState<number | null>(null);
  const [showRevealPicker, setShowRevealPicker] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showRevealResult, setShowRevealResult] = useState(false);

  const currentPlayer = players[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer?.userId === userId;
  const hasVotedForCurrent = currentPlayer
    ? votes.some(v => v.voterId === userId && v.targetUserId === currentPlayer.userId)
    : false;

  // Count votes for the current player
  const votesForCurrent = currentPlayer
    ? votes.filter(v => v.targetUserId === currentPlayer.userId)
    : [];
  const otherPlayerCount = players.filter(p => p.userId !== currentPlayer?.userId).length;
  const allVoted = otherPlayerCount > 0 && votesForCurrent.length >= otherPlayerCount;

  // Count correct votes when we know the lie index
  const correctVoteCount =
    hostRevealLieIndex !== null
      ? votesForCurrent.filter(v => v.guessedStatementIndex === hostRevealLieIndex).length
      : 0;

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

  const handlePickLie = (lieIndex: number) => {
    setHostRevealLieIndex(lieIndex);
    setShowRevealPicker(false);
    setShowCountdown(true);
  };

  const handleCountdownComplete = () => {
    setShowCountdown(false);
    setShowRevealResult(true);
  };

  const handleNextPlayer = () => {
    setShowRevealResult(false);
    setHostRevealLieIndex(null);
    setSelectedVote(null);
    onAdvance();
  };

  const isLastPlayer = currentPlayerIndex >= players.length - 1;

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

        {/* Presenting / voting state */}
        {subPhase === 'presenting' && currentPlayer && !showRevealResult && (
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

            {/* Statement cards */}
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

            {hasVotedForCurrent && !isHost && (
              <div className="text-center py-3">
                <p className="text-purple-300 text-sm">✓ 你已投票</p>
                {allVoted ? (
                  <p className="text-purple-400 text-xs mt-1">等待主持人揭晓...</p>
                ) : (
                  <div className="flex justify-center gap-1 mt-2">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {isMyTurn && !isHost && (
              <div className="text-center py-3">
                <p className="text-purple-300 text-sm">这是你的陈述，等大家投票...</p>
              </div>
            )}

            {/* Host: reveal button when all voted, or manual trigger */}
            {isHost && (
              <div className="space-y-2 pb-2">
                {(allVoted || votesForCurrent.length > 0) && !showRevealPicker && (
                  <MobilePrimaryButton
                    onClick={() => setShowRevealPicker(true)}
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 border-0"
                  >
                    揭晓谎言 🎯
                  </MobilePrimaryButton>
                )}
                <button
                  onClick={onAdvance}
                  disabled={isAdvancing}
                  className="w-full text-sm text-muted-foreground hover:text-purple-300 transition-colors py-2"
                >
                  {isAdvancing ? '切换中...' : '结束侦探游戏 →'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Reveal result state */}
        {showRevealResult && currentPlayer && hostRevealLieIndex !== null && (
          <motion.div
            key="reveal-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-4 gap-4"
          >
            <LieRevealCard
              statements={currentPlayer.statements}
              lieIndex={hostRevealLieIndex}
              voteCount={votesForCurrent.length}
              correctVoteCount={correctVoteCount}
            />
            {isHost && (
              <MobilePrimaryButton
                onClick={handleNextPlayer}
                disabled={isAdvancing}
                className="w-full mt-2"
              >
                {isAdvancing ? '切换中...' : isLastPlayer ? '结束侦探游戏 →' : '下一位 →'}
              </MobilePrimaryButton>
            )}
            {!isHost && (
              <p className="text-purple-400 text-sm text-center">等主持人继续...</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host lie picker bottom sheet */}
      <AnimatePresence>
        {showRevealPicker && currentPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 flex items-end"
            onClick={() => setShowRevealPicker(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full bg-slate-900 rounded-t-3xl p-6 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-purple-200 font-bold text-center mb-4">
                哪句是 {currentPlayer.displayName} 的谎言？
              </p>
              {currentPlayer.statements.map(stmt => (
                <button
                  key={stmt.index}
                  onClick={() => handlePickLie(stmt.index)}
                  className="w-full bg-purple-900/50 border border-purple-700 rounded-2xl px-4 py-4 text-left hover:bg-purple-800/50 transition-colors"
                >
                  <span className="text-purple-300 font-bold mr-2">#{stmt.index}</span>
                  <span className="text-white text-sm">{stmt.text}</span>
                </button>
              ))}
              <button
                onClick={() => setShowRevealPicker(false)}
                className="w-full text-sm text-muted-foreground py-2"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown overlay */}
      {showCountdown && <RevealCountdown onComplete={handleCountdownComplete} />}
    </div>
  );
}
