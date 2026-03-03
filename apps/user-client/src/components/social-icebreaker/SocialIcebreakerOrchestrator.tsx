import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useSocialIcebreaker } from '@/hooks/useSocialIcebreaker';
import { PhaseProgressBar } from './PhaseProgressBar';
import { WarmupPhase } from './warmup/WarmupPhase';
import { MicroChallengePhase } from './micro-challenge/MicroChallengePhase';
import { LieDetectivePhase } from './lie-detective/LieDetectivePhase';
import { AuctionPhaseStub } from './AuctionPhaseStub';
import { PersonalityDiceStub } from './PersonalityDiceStub';
import { SocialIcebreakerRecap } from './SocialIcebreakerRecap';
import { PulseCheckOverlay } from './PulseCheckOverlay';
import { SocialPhaseTransition } from './SocialPhaseTransition';
import { XiaoYueFloatingHost } from './XiaoYueFloatingHost';
import { MVP_PHASES } from '@shared/socialIcebreaker';
import type { SocialIcebreakerPhase, AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker';

interface SocialIcebreakerOrchestratorProps {
  sessionId: string;
  userId: string;
  displayName: string;
  eventType?: string;
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  onEnd: () => void;
}

type TransitionType = 'warmup_to_challenge' | 'challenge_to_detective' | 'detective_to_recap';

function getTransitionType(
  from: SocialIcebreakerPhase,
  to: SocialIcebreakerPhase
): TransitionType | null {
  if (from === 'warmup' && to === 'micro_challenge') return 'warmup_to_challenge';
  if (from === 'micro_challenge' && to === 'lie_detective') return 'challenge_to_detective';
  if ((from === 'lie_detective' || from === 'micro_challenge' || from === 'warmup') && to === 'recap')
    return 'detective_to_recap';
  return null;
}

export function SocialIcebreakerOrchestrator({
  sessionId,
  userId,
  displayName,
  eventType,
  participants,
  onEnd,
}: SocialIcebreakerOrchestratorProps) {
  const {
    state,
    isLoading,
    isHost,
    socialSessionId,
    startSession,
    isStarting,
    fetchTopics,
    advancePhase,
    submitPulseCheck,
    generateMyStatements,
    castVote,
    completeChallenge,
    isAdvancing,
  } = useSocialIcebreaker({ sessionId, userId, displayName });

  const [showPulseCheck, setShowPulseCheck] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType | null>(null);
  const [previousPhase, setPreviousPhase] = useState<SocialIcebreakerPhase | null>(null);
  // Store from/to pair together so handlePulseComplete always sees the correct transition
  const phaseChangeRef = useRef<{ from: SocialIcebreakerPhase; to: SocialIcebreakerPhase } | null>(null);
  const [pulseGroupAverage, setPulseGroupAverage] = useState<number | undefined>();
  const [warmupTopics, setWarmupTopics] = useState<SocialTopic[]>([]);
  const [xiaoYueVisible, setXiaoYueVisible] = useState(false);
  const [startedOnce, setStartedOnce] = useState(false);

  // Start session on mount
  useEffect(() => {
    if (!startedOnce) {
      setStartedOnce(true);
      startSession();
    }
  }, [startSession, startedOnce]);

  // Show XiaoYue on phase start
  useEffect(() => {
    if (state?.currentPhase) {
      setXiaoYueVisible(true);
      const timer = setTimeout(() => setXiaoYueVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [state?.currentPhase]);

  // Detect phase changes for pulse check + transition
  useEffect(() => {
    if (!state?.currentPhase) return;
    if (previousPhase && previousPhase !== state.currentPhase) {
      // Capture the (from, to) pair atomically before updating previousPhase
      phaseChangeRef.current = { from: previousPhase, to: state.currentPhase };
      setShowPulseCheck(true);
    }
    setPreviousPhase(state.currentPhase);
  }, [state?.currentPhase]);

  const handlePulseSubmit = async (vibe: 1 | 2 | 3) => {
    try {
      const result = await submitPulseCheck(vibe);
      if (result?.averageVibe !== undefined) {
        setPulseGroupAverage(result.averageVibe);
      }
    } catch {
      // silent
    }
  };

  const handlePulseComplete = () => {
    setShowPulseCheck(false);
    const change = phaseChangeRef.current;
    if (change) {
      const tt = getTransitionType(change.from, change.to);
      if (tt) {
        setTransitionType(tt);
        setShowTransition(true);
        if (navigator.vibrate) navigator.vibrate(200);
      }
      phaseChangeRef.current = null;
    }
  };

  const handleTransitionComplete = () => {
    setShowTransition(false);
    setTransitionType(null);
  };

  const handleAdvancePhase = async () => {
    if (navigator.vibrate) navigator.vibrate(100);
    await advancePhase();
  };

  const handleFetchTopics = async (mood: AtmosphereMood): Promise<SocialTopic[]> => {
    const topics = await fetchTopics(mood);
    setWarmupTopics(topics);
    return topics;
  };

  if (isStarting || (isLoading && !state)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">小悦正在准备破冰环节...</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">无法加载破冰会话</p>
      </div>
    );
  }

  const completedPhases = state.completedPhases || [];
  const currentTopics = warmupTopics.length > 0 ? warmupTopics : state.warmupTopics || [];

  return (
    <div className="flex flex-col h-screen overflow-hidden" data-testid="social-icebreaker-orchestrator">
      {/* Host badge */}
      {isHost && (
        <div className="absolute top-16 right-4 z-20 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <span>👑</span>
          <span>你是主持人</span>
        </div>
      )}

      {/* Progress bar */}
      <PhaseProgressBar
        currentPhase={state.currentPhase}
        enabledPhases={MVP_PHASES}
        completedPhases={completedPhases}
        isHost={isHost}
      />

      {/* Phase content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {state.currentPhase === 'warmup' && (
            <motion.div
              key="warmup"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="h-full"
            >
              <WarmupPhase
                sessionId={sessionId}
                socialSessionId={socialSessionId || ''}
                isHost={isHost}
                participants={participants}
                topics={currentTopics}
                onFetchTopics={handleFetchTopics}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'micro_challenge' && (
            <motion.div
              key="micro_challenge"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="h-full"
            >
              <MicroChallengePhase
                sessionId={sessionId}
                socialSessionId={socialSessionId || ''}
                isHost={isHost}
                participants={participants}
                challenge={state.currentChallenge || null}
                completedBy={state.challengeCompletedBy || []}
                userId={userId}
                onComplete={completeChallenge}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'lie_detective' && (
            <motion.div
              key="lie_detective"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="h-full"
            >
              <LieDetectivePhase
                sessionId={sessionId}
                socialSessionId={socialSessionId || ''}
                userId={userId}
                isHost={isHost}
                participants={participants}
                players={state.lieDetectivePlayers || []}
                votes={state.votes || []}
                currentPlayerIndex={state.currentLieDetectivePlayerIndex || 0}
                onGenerateStatements={generateMyStatements}
                onCastVote={castVote}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'auction' && (
            <motion.div
              key="auction"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <AuctionPhaseStub
                isHost={isHost}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'personality_dice' && (
            <motion.div
              key="personality_dice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <PersonalityDiceStub
                isHost={isHost}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'recap' && (
            <motion.div
              key="recap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <SocialIcebreakerRecap
                socialSessionId={socialSessionId || ''}
                participants={participants}
                durationMinutes={Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000)}
                onLeave={onEnd}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pulse check overlay */}
      <PulseCheckOverlay
        isVisible={showPulseCheck}
        onSubmit={handlePulseSubmit}
        onComplete={handlePulseComplete}
        groupAverage={pulseGroupAverage}
      />

      {/* Phase transition */}
      <SocialPhaseTransition
        type={transitionType}
        isVisible={showTransition}
        onComplete={handleTransitionComplete}
      />

      {/* XiaoYue floating host */}
      <XiaoYueFloatingHost
        phase={state.currentPhase}
        isVisible={xiaoYueVisible}
      />
    </div>
  );
}
