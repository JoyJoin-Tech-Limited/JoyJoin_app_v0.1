import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Volume2, VolumeX, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useSocialIcebreaker } from '@/hooks/useSocialIcebreaker';
import { useXiaoyueTTS } from '@/hooks/useXiaoyueTTS';
import { PhaseProgressBar } from './PhaseProgressBar';
import { WarmupPhase } from './warmup/WarmupPhase';
import { MoodVoteOverlay } from './warmup/MoodVoteOverlay';
import { MicroChallengePhase } from './micro-challenge/MicroChallengePhase';
import { LieDetectivePhase } from './lie-detective/LieDetectivePhase';
import { AuctionPhaseStub } from './AuctionPhaseStub';
import { PersonalityDicePhase } from './PersonalityDicePhase';
import { MiniScriptBetaStub } from './MiniScriptBetaStub';
import { SocialIcebreakerRecap } from './SocialIcebreakerRecap';
import { PulseCheckOverlay } from './PulseCheckOverlay';
import { SocialPhaseTransition } from './SocialPhaseTransition';
import { XiaoYueFloatingHost } from './XiaoYueFloatingHost';
import { DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES } from '@shared/socialIcebreaker';
import type { SocialIcebreakerPhase, AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker';

interface SocialIcebreakerOrchestratorProps {
  sessionId: string;
  userId: string;
  displayName: string;
  eventType?: string;
  eventId?: string;
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  onEnd: () => void;
}

type TransitionType = 'warmup_to_challenge' | 'challenge_to_detective' | 'detective_to_recap';

const PHASE_COMPLETION_LABELS: Partial<Record<SocialIcebreakerPhase, string>> = {
  warmup: '🌅 热身结束啦，今晚的开场感觉如何？',
  micro_challenge: '⚡ 挑战完成！大家玩得开心吗？',
  lie_detective: '🕵️ 侦探游戏结束！今晚气氛怎么样？',
};

type PhaseStartTTSConfig = {
  text: string;
  emotion: 'warm' | 'excited' | 'playful' | 'happy' | 'neutral';
  callerTag: string;
};

const PHASE_START_TTS: Partial<Record<SocialIcebreakerPhase, PhaseStartTTSConfig>> = {
  warmup: { text: '欢迎来到今晚的破冰时间！先从轻松的话题暖暖场吧 🌅', emotion: 'warm', callerTag: 'phase_warmup_start' },
  micro_challenge: { text: '热身完毕！接下来是微挑战环节，大家准备好了吗？⚡', emotion: 'excited', callerTag: 'phase_micro_challenge_start' },
  lie_detective: { text: '侦探们，仔细听每一句话，找出谎言！🕵️', emotion: 'playful', callerTag: 'phase_lie_detective_start' },
  recap: { text: '今晚的破冰之旅圆满结束！✨', emotion: 'warm', callerTag: 'phase_recap_start' },
};

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
  eventId,
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
    sessionExpired,
    fetchTopics,
    advancePhase,
    submitPulseCheck,
    generateMyStatements,
    castVote,
    completeChallenge,
    generateDiceChallenges,
    completeDiceChallenge,
    isAdvancing,
    error,
    clearError,
  } = useSocialIcebreaker({ sessionId, userId, displayName, eventType });

  const { speak, isMuted, toggleMute } = useXiaoyueTTS();

  // Keep a stable ref to speak so the phase-change effect doesn't need it as a dep
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const [showPulseCheck, setShowPulseCheck] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType | null>(null);
  const [previousPhase, setPreviousPhase] = useState<SocialIcebreakerPhase | null>(null);
  const [phaseLabelForPulse, setPhaseLabelForPulse] = useState<string>('');
  // Store from/to pair together so transition always sees the correct pair
  const phaseChangeRef = useRef<{ from: SocialIcebreakerPhase; to: SocialIcebreakerPhase } | null>(null);
  const [pulseGroupAverage, setPulseGroupAverage] = useState<number | undefined>();
  const [warmupTopics, setWarmupTopics] = useState<SocialTopic[]>([]);
  const [showMoodVote, setShowMoodVote] = useState(false);
  const [xiaoYueVisible, setXiaoYueVisible] = useState(false);
  const [startedOnce, setStartedOnce] = useState(false);

  const enabledPhases = state?.enabledPhases?.length
    ? state.enabledPhases
    : DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES;

  // Start session on mount
  useEffect(() => {
    if (!startedOnce) {
      setStartedOnce(true);
      startSession();
    }
  }, [startSession, startedOnce]);

  // Show mood vote overlay when warmup starts with no topics
  useEffect(() => {
    if (state?.currentPhase === 'warmup' && (!state.warmupTopics || state.warmupTopics.length === 0)) {
      setShowMoodVote(true);
    }
  }, [state?.currentPhase, state?.warmupTopics?.length]);

  // Show XiaoYue on phase start
  useEffect(() => {
    if (state?.currentPhase) {
      setXiaoYueVisible(true);
      const timer = setTimeout(() => setXiaoYueVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [state?.currentPhase]);

  // Detect phase changes → start transition immediately; pulse follows after transition
  useEffect(() => {
    if (!state?.currentPhase) return;
    if (previousPhase && previousPhase !== state.currentPhase) {
      const from = previousPhase;
      const to = state.currentPhase;
      phaseChangeRef.current = { from, to };
      // Set pulse label for when we show it after the transition
      setPhaseLabelForPulse(PHASE_COMPLETION_LABELS[from] ?? '');
      // Start transition immediately
      const tt = getTransitionType(from, to);
      if (tt) {
        setTransitionType(tt);
        setShowTransition(true);
        if (navigator.vibrate) navigator.vibrate(200);
      }
      // Speak phase announcement (non-blocking, TTS failure is gracefully ignored)
      const ttsConfig = PHASE_START_TTS[to];
      if (ttsConfig) {
        void speakRef.current(ttsConfig.text, { emotion: ttsConfig.emotion, callerTag: ttsConfig.callerTag });
      }
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
    setPulseGroupAverage(undefined);
    phaseChangeRef.current = null;
  };

  const handleTransitionComplete = () => {
    setShowTransition(false);
    setTransitionType(null);
    // Show pulse check after transition, only for MVP phase transitions
    const change = phaseChangeRef.current;
    if (change && change.to !== 'recap') {
      setTimeout(() => {
        setShowPulseCheck(true);
      }, 300);
    } else {
      phaseChangeRef.current = null;
    }
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

  const handleMoodVoteComplete = async (mood: AtmosphereMood | null) => {
    setShowMoodVote(false);
    if (isHost && mood) {
      await handleFetchTopics(mood);
    }
  };

  if (isStarting || (isLoading && !state)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">小悦正在准备破冰环节...</p>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <p className="text-xl">⏰</p>
        <p className="font-semibold text-foreground">破冰会话已过期</p>
        <p className="text-sm text-muted-foreground">本次活动的破冰时间已结束，感谢参与！</p>
        <button
          onClick={onEnd}
          className="mt-4 px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
        >
          返回活动页
        </button>
      </div>
    );
  }

  if (!state) {
    const isExpired = error?.kind === 'session_missing';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-foreground font-medium">
          {error?.message || '无法加载破冰会话'}
        </p>
        <div className="flex gap-3">
          {isExpired ? (
            <button
              onClick={onEnd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          ) : (
            <>
              <button
                onClick={() => { clearError(); startSession(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <button
                onClick={onEnd}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const completedPhases = state.completedPhases || [];
  const currentTopics = warmupTopics.length > 0 ? warmupTopics : state.warmupTopics || [];

  // Handlers for personality dice
  const handleGenerateDice = async () => {
    await generateDiceChallenges(participants);
  };

  const handleCompleteDice = async () => {
    await completeDiceChallenge();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" data-testid="social-icebreaker-orchestrator">
      {/* Non-blocking error banner for in-session action failures */}
      {error && (
        <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between gap-2 bg-destructive/90 text-destructive-foreground px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error.message}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {error.kind === 'session_missing' ? (
              <button onClick={onEnd} className="underline text-xs">退出</button>
            ) : (
              <button onClick={clearError} className="underline text-xs">关闭</button>
            )}
          </div>
        </div>
      )}
      {/* Host badge */}
      {isHost && (
        <div className="absolute top-16 right-4 z-20 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <span>👑</span>
          <span>你是主持人</span>
        </div>
      )}

      {/* Mute toggle button */}
      <button
        onClick={toggleMute}
        className="absolute top-16 left-4 z-20 p-2 rounded-full bg-black/10 dark:bg-white/10 text-foreground/60 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
        aria-label={isMuted ? '取消静音' : '静音'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Progress bar */}
      <PhaseProgressBar
        currentPhase={state.currentPhase}
        enabledPhases={enabledPhases}
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
              <PersonalityDicePhase
                socialSessionId={socialSessionId || ''}
                userId={userId}
                isHost={isHost}
                participants={participants}
                challenges={state.personalityDiceChallenges || []}
                currentPlayerIndex={state.currentDicePlayerIndex ?? 0}
                completedBy={state.diceCompletedBy || []}
                onGenerate={handleGenerateDice}
                onComplete={handleCompleteDice}
                onAdvance={handleAdvancePhase}
                isAdvancing={isAdvancing}
              />
            </motion.div>
          )}

          {state.currentPhase === 'mini_script_beta' && (
            <motion.div
              key="mini_script_beta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <MiniScriptBetaStub
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
                durationMinutes={Math.max(1, Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000))}
                onLeave={onEnd}
                eventId={eventId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mood vote overlay (warmup entry) */}
      <MoodVoteOverlay
        isVisible={showMoodVote}
        isHost={isHost}
        onVoteComplete={handleMoodVoteComplete}
      />

      {/* Pulse check overlay */}
      <PulseCheckOverlay
        isVisible={showPulseCheck}
        onSubmit={handlePulseSubmit}
        onComplete={handlePulseComplete}
        groupAverage={pulseGroupAverage}
        phaseLabel={phaseLabelForPulse || undefined}
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
