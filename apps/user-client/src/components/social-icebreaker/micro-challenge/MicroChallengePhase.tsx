import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { MicroChallenge } from '@shared/socialIcebreaker';

interface MicroChallengePhaseProps {
  sessionId: string;
  socialSessionId: string;
  isHost: boolean;
  participants: Array<{ userId: string; displayName: string }>;
  challenge: MicroChallenge | null;
  completedBy: string[];
  userId: string;
  phaseStartedAt: number;
  onComplete: () => Promise<void>;
  onAdvance: () => void;
  isAdvancing: boolean;
}

function CircleTimer({ totalSeconds, secondsLeft }: { totalSeconds: number; secondsLeft: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor =
    progress > 0.5 ? '#06b6d4' : progress > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} stroke="#e5e7eb" strokeWidth="6" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={strokeColor}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          className={progress < 0.25 ? 'animate-pulse' : ''}
        />
      </svg>
      <span
        className={`font-mono font-black text-3xl z-10 ${
          progress < 0.25 ? 'text-red-500' : progress < 0.5 ? 'text-amber-500' : 'text-cyan-500'
        }`}
      >
        {secondsLeft}
      </span>
    </div>
  );
}

export function MicroChallengePhase({
  isHost,
  participants,
  challenge,
  completedBy,
  userId,
  phaseStartedAt,
  onComplete,
  onAdvance,
  isAdvancing,
}: MicroChallengePhaseProps) {
  const [secondsLeft, setSecondsLeft] = useState(challenge?.durationSeconds || 120);
  const [hasCompleted, setHasCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!challenge) return;
    const calculateSecondsLeft = () =>
      Math.max(0, Math.ceil((phaseStartedAt + challenge.durationSeconds * 1000 - Date.now()) / 1000));
    setSecondsLeft(calculateSecondsLeft());
    setHasCompleted(false);
  }, [challenge?.id, challenge?.durationSeconds, phaseStartedAt]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!challenge || secondsLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(() => {
        const next = Math.max(0, Math.ceil((phaseStartedAt + challenge.durationSeconds * 1000 - Date.now()) / 1000));
        if (next === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, challenge?.durationSeconds, phaseStartedAt]);

  useEffect(() => {
    if (completedBy.includes(userId)) {
      setHasCompleted(true);
    }
  }, [completedBy, userId]);

  const completedCount = completedBy.length;
  const totalCount = participants.length;
  const timerExpired = secondsLeft <= 0;
  const everyoneCompleted = completedCount >= totalCount;

  if (!challenge) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-muted-foreground text-sm">加载挑战中...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-cyan-950 dark:via-blue-950 dark:to-zinc-900"
      data-testid="micro-challenge-phase"
    >
      {/* Phase pill */}
      <div className="flex justify-center pt-4 pb-2">
        <span className="bg-cyan-100/80 text-cyan-700 px-4 py-1.5 rounded-full text-sm font-semibold">
          ⚡ 微挑战
        </span>
      </div>

      {/* Challenge card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Gradient border card */}
          <div className="p-[1px] rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-xl">
            <div className="bg-card rounded-[calc(1rem-1px)] p-6">
              <div className="text-4xl text-center mb-2">{challenge.visualHint || '⚡'}</div>
              <h3 className="text-2xl font-black text-foreground mb-3">{challenge.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                {challenge.description}
              </p>

              {/* Timer */}
              <div className="flex justify-center">
                <CircleTimer
                  totalSeconds={challenge.durationSeconds}
                  secondsLeft={secondsLeft}
                />
              </div>
            </div>
          </div>

          {/* Completion count */}
          <div className="text-center mt-3 text-sm text-muted-foreground">
            已完成 {completedCount}/{totalCount} 人
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-3">
        {/* Complete button */}
        {!hasCompleted && (
          <MobilePrimaryButton
            onClick={async () => {
              setHasCompleted(true);
              if (navigator.vibrate) navigator.vibrate(40);
              await onComplete();
            }}
            className="w-full min-h-[72px] bg-gradient-to-r from-cyan-500 to-blue-600 border-0"
          >
            ✅ {challenge.completionCTA}
          </MobilePrimaryButton>
        )}

        {hasCompleted && (
          <div className="w-full min-h-[72px] flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-2xl">
            <p className="text-green-700 dark:text-green-300 font-semibold">
              ✅ 你已完成！等待其他人...
            </p>
          </div>
        )}

        {/* Advance (host only) */}
        {isHost && (
          <button
            onClick={onAdvance}
            disabled={isAdvancing || (!everyoneCompleted && !timerExpired)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {isAdvancing ? '切换中...' : everyoneCompleted || timerExpired ? '进入下一环节 →' : '等待大家完成或计时结束'}
          </button>
        )}
      </div>
    </div>
  );
}
