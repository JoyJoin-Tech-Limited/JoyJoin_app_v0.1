import type { ReactNode } from 'react';

/**
 * Registry of Social Icebreaker phase UI modules (web / React).
 * Product policy: **WeChat mini-program (Taro) is the primary ship target** — keep
 * `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx` aligned with these
 * phases first; this registry exists for web parity and orchestrator routing.
 * The Game Design compile step should only reference `SocialIcebreakerPhase` values
 * that exist here, on mini-program phase views, and on the server advance path.
 */
import { motion } from 'framer-motion';
import type { SocialIcebreakerPhase, AtmosphereMood, SocialTopic, SocialSessionState } from '@shared/socialIcebreaker';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import { WarmupPhase } from './warmup/WarmupPhase';
import { MicroChallengePhase } from './micro-challenge/MicroChallengePhase';
import { LieDetectivePhase } from './lie-detective/LieDetectivePhase';
import { AuctionPhase } from './AuctionPhase';
import { PersonalityDicePhase } from './PersonalityDicePhase';
import { MiniScriptPhasePanel } from './miniscript/MiniScriptPhasePanel';
import { SocialIcebreakerRecap } from './SocialIcebreakerRecap';

export type SocialIcebreakerParticipantBrief = {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
};

/** Props bundle passed from `SocialIcebreakerOrchestrator` into the active phase template. */
export interface SocialIcebreakerPhasePanelProps {
  sessionId: string;
  socialSessionId: string;
  userId: string;
  isHost: boolean;
  isAdvancing: boolean;
  participants: SocialIcebreakerParticipantBrief[];
  state: SocialSessionState;
  currentTopics: SocialTopic[];
  onFetchTopics: (mood: AtmosphereMood) => Promise<SocialTopic[]>;
  onWarmupReady: (ready?: boolean) => Promise<void>;
  onNextWarmupTopic: () => Promise<void>;
  onAdvancePhase: () => Promise<void>;
  onCompleteChallenge: () => Promise<void>;
  onGenerateStatements: () => Promise<Array<{ index: number; text: string }>>;
  onCastVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  onNextLieDetectivePlayer: () => Promise<void>;
  onGenerateDice: () => Promise<void>;
  onCompleteDice: () => Promise<void>;
  onGenerateMiniScript: (payload: {
    style: MiniScriptStyle;
    genres: MiniScriptGenre[];
  }) => Promise<void>;
  onGenerateAuctionLots: () => Promise<void>;
  onPlaceAuctionBid: (amount: number) => Promise<void>;
  onCloseAuctionLot: () => Promise<void>;
  onEnd: () => void;
  eventId?: string;
}

export type SocialIcebreakerPhaseModule = {
  /** Stable key for AnimatePresence */
  motionKey: SocialIcebreakerPhase;
  /** Renders the phase panel (including motion wrapper). */
  render: (props: SocialIcebreakerPhasePanelProps) => ReactNode;
};

function slideMotionProps() {
  return {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  } as const;
}

function fadeMotionProps() {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as const;
}

export const SOCIAL_ICEBREAKER_PHASE_REGISTRY: Record<
  SocialIcebreakerPhase,
  SocialIcebreakerPhaseModule
> = {
  warmup: {
    motionKey: 'warmup',
    render: (p) => (
      <motion.div key="warmup" className="h-full" {...slideMotionProps()}>
        <WarmupPhase
          sessionId={p.sessionId}
          socialSessionId={p.socialSessionId}
          isHost={p.isHost}
          participants={p.participants}
          topics={p.currentTopics}
          currentTopicIndex={p.state.currentTopicIndex ?? 0}
          readyUserIds={p.state.warmupReadyUserIds || []}
          currentUserId={p.userId}
          commonGroundCount={p.state.commonGroundCount ?? 0}
          onFetchTopics={p.onFetchTopics}
          onReadyChange={p.onWarmupReady}
          onNextTopic={p.onNextWarmupTopic}
          onAdvance={p.onAdvancePhase}
          isAdvancing={p.isAdvancing}
        />
      </motion.div>
    ),
  },
  micro_challenge: {
    motionKey: 'micro_challenge',
    render: (p) => (
      <motion.div key="micro_challenge" className="h-full" {...slideMotionProps()}>
        <MicroChallengePhase
          sessionId={p.sessionId}
          socialSessionId={p.socialSessionId}
          isHost={p.isHost}
          participants={p.participants}
          challenge={p.state.currentChallenge || null}
          completedBy={p.state.challengeCompletedBy || []}
          userId={p.userId}
          phaseStartedAt={p.state.phaseStartedAt}
          onComplete={p.onCompleteChallenge}
          onAdvance={p.onAdvancePhase}
          isAdvancing={p.isAdvancing}
        />
      </motion.div>
    ),
  },
  lie_detective: {
    motionKey: 'lie_detective',
    render: (p) => (
      <motion.div key="lie_detective" className="h-full" {...slideMotionProps()}>
        <LieDetectivePhase
          sessionId={p.sessionId}
          socialSessionId={p.socialSessionId}
          userId={p.userId}
          isHost={p.isHost}
          participants={p.participants}
          players={p.state.lieDetectivePlayers || []}
          votes={p.state.votes || []}
          currentPlayerIndex={p.state.currentLieDetectivePlayerIndex || 0}
          currentReveal={p.state.currentLieDetectiveReveal || null}
          onGenerateStatements={p.onGenerateStatements}
          onCastVote={p.onCastVote}
          onNextPlayer={p.onNextLieDetectivePlayer}
          onAdvance={p.onAdvancePhase}
          isAdvancing={p.isAdvancing}
        />
      </motion.div>
    ),
  },
  auction: {
    motionKey: 'auction',
    render: (p) => (
      <motion.div key="auction" className="h-full" {...fadeMotionProps()}>
        <AuctionPhase
          state={p.state}
          userId={p.userId}
          isHost={p.isHost}
          isAdvancing={p.isAdvancing}
          onGenerateAuctionLots={p.onGenerateAuctionLots}
          onPlaceAuctionBid={p.onPlaceAuctionBid}
          onCloseAuctionLot={p.onCloseAuctionLot}
          onAdvancePhase={p.onAdvancePhase}
        />
      </motion.div>
    ),
  },
  personality_dice: {
    motionKey: 'personality_dice',
    render: (p) => (
      <motion.div key="personality_dice" className="h-full" {...fadeMotionProps()}>
        <PersonalityDicePhase
          socialSessionId={p.socialSessionId}
          userId={p.userId}
          isHost={p.isHost}
          participants={p.participants}
          challenges={p.state.personalityDiceChallenges || []}
          currentPlayerIndex={p.state.currentDicePlayerIndex ?? 0}
          completedBy={p.state.diceCompletedBy || []}
          onGenerate={p.onGenerateDice}
          onComplete={p.onCompleteDice}
          onAdvance={p.onAdvancePhase}
          isAdvancing={p.isAdvancing}
        />
      </motion.div>
    ),
  },
  mini_script: {
    motionKey: 'mini_script',
    render: (p) => (
      <motion.div key="mini_script" className="h-full" {...fadeMotionProps()}>
        <MiniScriptPhasePanel
          state={p.state}
          isHost={p.isHost}
          isAdvancing={p.isAdvancing}
          onAdvancePhase={p.onAdvancePhase}
          onGenerateMiniScript={p.onGenerateMiniScript}
        />
      </motion.div>
    ),
  },
  recap: {
    motionKey: 'recap',
    render: (p) => (
      <motion.div key="recap" className="h-full" {...fadeMotionProps()}>
        <SocialIcebreakerRecap
          socialSessionId={p.socialSessionId}
          participants={p.participants}
          durationMinutes={Math.max(
            1,
            Math.round((Date.now() - (p.state.sessionStartedAt || p.state.phaseStartedAt)) / 60000),
          )}
          commonGroundCount={p.state.commonGroundCount ?? 0}
          onLeave={p.onEnd}
          eventId={p.eventId}
        />
      </motion.div>
    ),
  },
};

/** Ordered list of phase ids for docs, tests, and compile-time validation against the registry. */
export const SOCIAL_ICEBREAKER_REGISTERED_PHASES = Object.keys(
  SOCIAL_ICEBREAKER_PHASE_REGISTRY,
) as SocialIcebreakerPhase[];

export function renderSocialIcebreakerPhasePanel(
  phase: SocialIcebreakerPhase,
  props: SocialIcebreakerPhasePanelProps,
): ReactNode {
  const mod = SOCIAL_ICEBREAKER_PHASE_REGISTRY[phase];
  return mod.render(props);
}
