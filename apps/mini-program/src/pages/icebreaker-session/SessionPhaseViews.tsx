import type { AtmosphereMood, SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'
import type { MiniScriptGenerationStatus, MiniScriptGenre, MiniScriptLibraryItem, MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import Button from '../../components/ui/Button'
import CustomModeSection from './components/CustomModeSection'
import WaitingPhase from './components/WaitingPhase'
import { apiVibeToClient } from '../../lib/vibeMapping'
import { MicroChallengeHeroView } from './phases/MicroChallengeHeroView'
import { LieDetectiveHeroView } from './phases/LieDetectiveHeroView'
import { PersonalityDiceHeroView } from './phases/PersonalityDiceHeroView'
import { SpeedFriendingHeroView } from './phases/SpeedFriendingHeroView'
import { QuipBattleHeroView } from './phases/QuipBattleHeroView'
import { UndercoverWordHeroView } from './phases/UndercoverWordHeroView'
import { GroupMirrorHeroView } from './phases/GroupMirrorHeroView'
import { AuctionHeroView } from './phases/AuctionHeroView'
import { MiniScriptHeroView } from './phases/MiniScriptHeroView'
import { IcebreakerToolSelector } from './overlays/IcebreakerToolSelector'
import { MiniScriptConfigModal } from './overlays/MiniScriptConfigModal'
import { FallbackPhaseView, RecapPhaseView, WarmupPhaseView, type SessionPhase } from './phaseViews'
import type { SessionParticipant } from './phaseUtils'
import { resolvePersonalityDiceChooseMode } from './viewModels/phaseProgressionModels'
import type { TopicsRecoveryState } from './viewModels/warmupViewModels'
import type { SocialRecapResponse } from './icebreakerSessionModel'

/**
 * SessionPhaseViews — presentational phase dispatch for the icebreaker
 * session page. Extracted from index.tsx (2026-08-12) to keep the page under
 * the harness gate's 1800-line maintainability limit. Pure render: every
 * value and callback arrives via props; no hooks live here.
 */
export interface SessionPhaseViewsProps {
  phase: SessionPhase
  session: SocialSessionState | null
  participants: SessionParticipant[]
  currentUserId: string
  isHost: boolean
  playerCount: number
  pendingAction: string | null
  canChangeTier: boolean
  glanceStackEnabled: boolean
  supportedPhases: SessionPhase[]
  mascotDisplayName: string
  personalityDiceChooseMode: boolean | undefined
  lastTopicsMood: AtmosphereMood | undefined
  topicsError: boolean
  topicsRecovery: TopicsRecoveryState | null
  myVoteIndex: number | null
  hasGeneratedStatements: boolean
  canMoveToNextPlayer: boolean
  socialSessionId: string | null
  miniScriptModalOpen: boolean
  miniScriptSubmitting: boolean
  miniScriptGenerationStatus: MiniScriptGenerationStatus | null
  miniScriptLibraryScripts: MiniScriptLibraryItem[]
  miniScriptLibraryLoading: boolean
  miniScriptLibraryError: string | null
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
    lieDetective?: { aiWinRate: number; hardestRound: number; fooledEveryone: number }
    personalityDice?: { completedBy: string[]; passedBy: string[] }
    undercoverWord?: { caught: boolean; undercoverDisplayName: string }
  } | null
  recapSummary: {
    headline?: string
    moments?: string[]
    closingLine?: string
  } | null
  recapMedals: Array<{ emoji: string; title: string; recipientDisplayName: string; description: string }>
  recapMeta: SocialRecapResponse['meta'] | null
  onOpenTierSheet: () => void
  onOpenMiniScript: () => void
  onMiniScriptClose: () => void
  onMiniScriptSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean; selectedLabel?: string }) => Promise<boolean>
  onLoadMiniScriptLibrary: (style: MiniScriptStyle) => Promise<void>
  onSelectMiniScript: (scriptId: string) => Promise<boolean>
  onRefreshSession: () => void
  onAdvance: () => void
  onGenerateSessionPack: () => void
  onAigcFeedbackTap: (location: 'card') => void
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleWarmupReady: () => void
  onNextWarmupTopic: () => void
  onRitualStart: () => void
  onSelectPhase: (phase: SocialIcebreakerPhase) => void
  onEndSession: () => void
  onCompleteChallenge: () => void
  onCastVote: (statementIndex: number) => void
  onGenerateStatements: (statements?: string[], lieIndex?: number) => void
  onNextLieDetectivePlayer: () => void
  onGenerateLieStatementFromTag: (tag: string) => Promise<string | null>
  onGenerateAuctionLots: () => void
  onAuctionBid: (amount: number) => void
  onCloseAuctionLot: () => void
  onAssignRoles: () => void
  onRevealAct: (act: number) => void
  onMiniScriptVote: (vote: { who: string; what: string; why: string }) => void
  onRevealSolution: () => void
  onMiniScriptReady: (ready: boolean) => void
  onGenerateDiceChallenges: () => void
  onCompleteDiceChallenge: () => void
  onChooseDiceOption: (optionIndex: number) => void
  onDiceReady: (ready: boolean) => void
  onDiceRevealReady: (ready: boolean) => void
  onNextSpeedFriendingRound: () => void
  onCompleteSpeedFriending: () => void
  onGoBack: () => void
  onConnectTap: () => void
}

export function SessionPhaseViews(props: SessionPhaseViewsProps) {
  const {
    phase,
    session,
    participants,
    currentUserId,
    isHost,
    playerCount,
    pendingAction,
    canChangeTier,
    glanceStackEnabled,
    supportedPhases,
    mascotDisplayName,
    personalityDiceChooseMode,
    lastTopicsMood,
    topicsError,
    topicsRecovery,
    myVoteIndex,
    hasGeneratedStatements,
    canMoveToNextPlayer,
    socialSessionId,
    miniScriptModalOpen,
    miniScriptSubmitting,
    miniScriptGenerationStatus,
    miniScriptLibraryScripts,
    miniScriptLibraryLoading,
    miniScriptLibraryError,
    recapData,
    recapSummary,
    recapMedals,
    recapMeta,
    onOpenTierSheet,
    onOpenMiniScript,
    onMiniScriptClose,
    onMiniScriptSubmit,
    onLoadMiniScriptLibrary,
    onSelectMiniScript,
    onRefreshSession,
    onAdvance,
    onGenerateSessionPack,
    onAigcFeedbackTap,
    onGenerateTopics,
    onToggleWarmupReady,
    onNextWarmupTopic,
    onRitualStart,
    onSelectPhase,
    onEndSession,
    onCompleteChallenge,
    onCastVote,
    onGenerateStatements,
    onNextLieDetectivePlayer,
    onGenerateLieStatementFromTag,
    onGenerateAuctionLots,
    onAuctionBid,
    onCloseAuctionLot,
    onAssignRoles,
    onRevealAct,
    onMiniScriptVote,
    onRevealSolution,
    onMiniScriptReady,
    onGenerateDiceChallenges,
    onCompleteDiceChallenge,
    onChooseDiceOption,
    onDiceReady,
    onDiceRevealReady,
    onNextSpeedFriendingRound,
    onCompleteSpeedFriending,
    onGoBack,
    onConnectTap,
  } = props

  return (
    <>
      {phase === 'waiting' && (
        <>
          <WaitingPhase
            playerCount={playerCount}
            hostName={session?.hostDisplayName}
            isHost={isHost}
            currentTier={session?.eventTier ?? 'glow'}
            currentVibe={apiVibeToClient(session?.vibe)}
            canChangeTier={canChangeTier}
            onChangeTier={onOpenTierSheet}
            onAdvance={onAdvance}
            glanceMode={glanceStackEnabled}
          />
          {isHost && !session?.xiaoyueSessionPack && (
            <Button
              variant='secondary'
              className='icebreaker__generate-pack-btn'
              onClick={onGenerateSessionPack}
              disabled={pendingAction !== null}
              loading={pendingAction === 'xiaoyue-pack'}
            >
              {pendingAction === 'xiaoyue-pack' ? '生成中…' : `生成${mascotDisplayName}开场包`}
            </Button>
          )}
        </>
      )}

      {phase === 'warmup' && session && (
        <WarmupPhaseView
          topics={session.warmupTopics ?? []}
          currentIndex={session.currentTopicIndex ?? 0}
          readyUserIds={session.warmupReadyUserIds ?? []}
          warmupDataReady={session.warmupReadyUserIds !== undefined}
          participants={participants}
          currentUserId={currentUserId}
          selectedMood={session.selectedMood ?? lastTopicsMood}
          isHost={isHost}
          vibe={apiVibeToClient(session.vibe)}
          archetypeMixText={session.archetypeMixText}
          isCustomMode={session.eventTier === 'custom'}
          currentTier={session.eventTier ?? 'glow'}
          isTestMode={session.isTestModeSkip ?? false}
          runBots={session.runBots ?? false}
          warmupTopicsMeta={session.warmupTopicsMeta}
          socialSessionId={socialSessionId ?? undefined}
          icebreakerSessionId={session.icebreakerSessionId}
          onAigcFeedbackTap={onAigcFeedbackTap}
          onGenerateTopics={onGenerateTopics}
          onToggleReady={onToggleWarmupReady}
          onNextTopic={onNextWarmupTopic}
          onAdvance={onAdvance}
          isGeneratingTopics={pendingAction === 'topics'}
          isUpdatingReady={pendingAction === 'warmup-ready'}
          isAdvancingTopic={pendingAction === 'warmup-next-topic'}
          isAdvancing={pendingAction === 'advance'}
          topicsError={topicsError}
          topicsRecovery={topicsRecovery}
          glanceStackEnabled={glanceStackEnabled}
          onRitualStart={onRitualStart}
        />
      )}

      {phase === 'phase_selection' && session && (
        <CustomModeSection
          isHost={isHost}
          socialSessionId={socialSessionId}
          session={session}
          playerCount={playerCount}
          pendingAction={pendingAction}
          onSelectPhase={onSelectPhase}
          onEndSession={onEndSession}
        />
      )}

      {phase === 'micro_challenge' && session && (
        <MicroChallengeHeroView
          challenge={session.currentChallenge ?? null}
          challengeMeta={session.currentChallengeMeta}
          completedBy={session.challengeCompletedBy ?? []}
          currentUserId={currentUserId}
          playerCount={playerCount}
          onComplete={onCompleteChallenge}
          isCompleting={pendingAction === 'micro-complete'}
          isHost={isHost}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          canAdvance={new Set(session.challengeCompletedBy ?? []).size >= playerCount}
          advanceDisabledReason='还有小伙伴未完成'
          glanceStackEnabled={glanceStackEnabled}
        />
      )}

      {phase === 'lie_detective' && session && (
        <LieDetectiveHeroView
          players={session.lieDetectivePlayers ?? []}
          playerCount={playerCount}
          currentPlayerIndex={session.currentLieDetectivePlayerIndex ?? 0}
          votes={session.votes ?? []}
          reveal={session.currentLieDetectiveReveal ?? null}
          currentUserId={currentUserId}
          myVoteIndex={myVoteIndex}
          onVote={onCastVote}
          isVoting={pendingAction === 'lie-vote'}
          hasGeneratedStatements={hasGeneratedStatements}
          onGenerateStatements={onGenerateStatements}
          isGeneratingStatements={pendingAction === 'lie-generate'}
          isHost={isHost}
          canMoveToNextPlayer={canMoveToNextPlayer}
          onNextPlayer={onNextLieDetectivePlayer}
          isMovingNextPlayer={pendingAction === 'lie-next-player'}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          statementsMeta={session.lieDetectiveStatementsMeta}
          onGenerateFromTag={onGenerateLieStatementFromTag}
          isGeneratingFromTag={pendingAction === 'lie-tag-generate'}
        />
      )}

      {phase === 'auction' && session && (
        <AuctionHeroView
          session={session}
          currentUserId={currentUserId}
          isHost={isHost}
          onGenerateLots={onGenerateAuctionLots}
          onPlaceBid={onAuctionBid}
          onCloseLot={onCloseAuctionLot}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          isGeneratingLots={pendingAction === 'auction-gen'}
          lotsMeta={session.auctionLotsMeta}
          isPlacingBid={pendingAction === 'auction-bid'}
          isClosingLot={pendingAction === 'auction-close'}
          isSingleTest={session.isTestModeSkip ?? false}
        />
      )}

      {phase === 'mini_script' && session && (
        <>
          {isHost && session.enabledPhases?.includes('mini_script') ? (
            <IcebreakerToolSelector
              onOpenMiniScript={onOpenMiniScript}
            />
          ) : null}
          <MiniScriptHeroView
            session={session}
            currentUserId={currentUserId}
            isHost={isHost}
            playerCount={playerCount}
            onAssignRoles={onAssignRoles}
            onRevealAct={onRevealAct}
            onVote={onMiniScriptVote}
            onRevealSolution={onRevealSolution}
            onAdvance={onAdvance}
            onReady={onMiniScriptReady}
            isAssigningRoles={pendingAction === 'miniscript-assign-roles'}
            isRevealingAct={pendingAction === 'miniscript-reveal-act'}
            isVoting={pendingAction === 'miniscript-vote'}
            isRevealingSolution={pendingAction === 'miniscript-reveal-solution'}
            isAdvancing={pendingAction === 'advance'}
            isSettingReady={pendingAction === 'miniscript-ready'}
          />
          <MiniScriptConfigModal
            open={miniScriptModalOpen}
            onClose={onMiniScriptClose}
            isSubmitting={miniScriptSubmitting}
            generationStatus={miniScriptGenerationStatus}
            scripts={miniScriptLibraryScripts}
            isLibraryLoading={miniScriptLibraryLoading}
            libraryError={miniScriptLibraryError}
            onLoadLibrary={onLoadMiniScriptLibrary}
            onSelectScript={onSelectMiniScript}
            onSubmit={onMiniScriptSubmit}
          />
        </>
      )}

      {phase === 'personality_dice' && session && (
        <PersonalityDiceHeroView
          participants={participants}
          challenges={session.personalityDiceChallenges ?? []}
          currentPlayerIndex={
            resolvePersonalityDiceChooseMode(
              session.personalityDiceChooseModeEnabled,
              personalityDiceChooseMode,
            )
              ? Math.max(0, participants.findIndex((participant) => participant.userId === currentUserId))
              : (session.currentDicePlayerIndex ?? 0)
          }
          completedBy={session.diceCompletedBy ?? []}
          passedBy={session.dicePassedBy ?? []}
          currentUserId={currentUserId}
          isHost={isHost}
          onGenerate={onGenerateDiceChallenges}
          onComplete={onCompleteDiceChallenge}
          isGenerating={pendingAction === 'dice-generate'}
          isCompleting={pendingAction === 'dice-complete'}
          chooseModeEnabled={resolvePersonalityDiceChooseMode(
            session.personalityDiceChooseModeEnabled,
            personalityDiceChooseMode,
          )}
          challengeGroups={session.personalityDiceChallengeGroups ?? []}
          selectedOption={session.diceSelectedOption ?? {}}
          onChoose={onChooseDiceOption}
          onReady={onDiceReady}
          isChoosing={pendingAction === 'dice-choose'}
          isReadying={pendingAction === 'dice-ready'}
          revealOrder={session.diceRevealOrder ?? []}
          revealCountdownEndsAt={session.diceRevealCountdownEndsAt}
          revealReadyBy={session.diceRevealReadyBy ?? []}
          onRevealReady={onDiceRevealReady}
          isRevealReadying={pendingAction === 'dice-reveal-ready'}
          challengesMeta={session.personalityDiceChallengesMeta}
          onAdvance={onAdvance}
        />
      )}

      {phase === 'quip_battle' && session && (
        <QuipBattleHeroView
          socialSessionId={socialSessionId || ''}
          isHost={isHost}
          prompts={session.quipBattlePrompts ?? []}
          answers={session.quipBattleAnswers ?? []}
          results={session.quipBattleResults ?? []}
          revealed={session.quipBattleRevealed ?? false}
          submittedUserIds={session.quipBattleSubmittedUserIds ?? []}
          votedUserIds={session.quipBattleVotedUserIds ?? []}
          userId={currentUserId}
          playerCount={playerCount}
          onRefresh={onRefreshSession}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          promptsMeta={session.quipBattlePromptsMeta}
        />
      )}

      {phase === 'undercover_word' && session && (
        <UndercoverWordHeroView
          socialSessionId={socialSessionId || ''}
          isHost={isHost}
          userId={currentUserId}
          pair={session.undercoverWordPair ?? null}
          undercoverUserId={session.undercoverUserId}
          rounds={session.undercoverWordRounds ?? []}
          currentRound={session.undercoverWordCurrentRound ?? 0}
          votes={session.undercoverWordVotes ?? []}
          votedUserIds={session.undercoverWordVotedUserIds ?? []}
          revealed={session.undercoverWordRevealed ?? false}
          results={session.undercoverWordResults ?? null}
          playerCount={playerCount}
          participants={participants}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          pairMeta={session.undercoverWordPairMeta}
        />
      )}

      {phase === 'group_mirror' && session && (
        <GroupMirrorHeroView
          socialSessionId={socialSessionId || ''}
          isHost={isHost}
          userId={currentUserId}
          questions={session.groupMirrorQuestions ?? []}
          answers={session.groupMirrorAnswers ?? []}
          submittedUserIds={session.groupMirrorSubmittedUserIds ?? []}
          revealed={session.groupMirrorRevealed ?? false}
          results={session.groupMirrorResults ?? []}
          playerCount={playerCount}
          participants={participants}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
          questionsMeta={session.groupMirrorQuestionsMeta}
        />
      )}

      {phase === 'speed_friending' && session && (
        <SpeedFriendingHeroView
          pairs={session.speedFriendingPairs ?? []}
          currentRound={session.speedFriendingCurrentRound ?? 0}
          totalRounds={session.speedFriendingTotalRounds ?? 0}
          roundStartedAt={session.speedFriendingRoundStartedAt}
          allRoundsComplete={session.speedFriendingAllRoundsComplete ?? false}
          participants={participants}
          currentUserId={currentUserId}
          isHost={isHost}
          onNextRound={onNextSpeedFriendingRound}
          onComplete={onCompleteSpeedFriending}
          isLoading={pendingAction === 'speed-next' || pendingAction === 'speed-complete'}
          onAdvance={onAdvance}
          isAdvancing={pendingAction === 'advance'}
        />
      )}

      {(phase === 'recap' || phase === 'ended') && session && (
        <RecapPhaseView
          recapData={recapData ?? session.recapData ?? null}
          summary={recapSummary}
          medals={recapMedals}
          playerCount={playerCount}
          onLeave={onGoBack}
          onConnectTap={onConnectTap}
          socialSessionId={socialSessionId}
          recapMeta={recapMeta}
          phasesCompleted={(session.completedPhases ?? []).filter((p) => p !== 'phase_selection').length}
          isEarlyEnd={Boolean(session.endedEarlyAt) || session.lastAdvanceTrigger === 'early_end_jump'}
        />
      )}

      {!supportedPhases.includes(phase) && session && (
        <FallbackPhaseView phase={phase} isHost={isHost} onAdvance={onAdvance} />
      )}
    </>
  )
}
