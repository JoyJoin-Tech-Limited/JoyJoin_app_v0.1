import { Canvas, Image, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { ARCHETYPE_BY_ID, getArchetypeIndex } from '@shared/personality/archetypeNames'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import { useAuth } from '../../../../hooks/useAuth'
import { useUnload } from '../../../../hooks/useUnload'
import { useSpriteReadiness } from '../../../../hooks/useSpriteReadiness'
import { useOnboardingAnalytics } from '../../../../hooks/onboarding/useOnboardingAnalytics'
import { resolveExperimentMarker } from '../../../../lib/experiments'
import { onboardingAnalytics } from '../../../../lib/onboarding/onboardingAnalytics'
import {
  readAnonymousAssessmentSession,
} from '../../../../lib/auth/anonymousOnboarding'
import { logInfo, logWarn } from '../../../../lib/utils/logger'
import { useDeviceTier } from '../../../../hooks/useDeviceTier'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboarding/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboarding/onboardingNavigation'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  getArchetypeSpritesheetLocalPath,
  ASSET_BASE_WEBP_LOCAL,
} from '../visuals'
import { getArchetypeCardVariants } from '../archetypeVariants'
import {
  PERSONALITY_SHARE_POSTER_CANVAS_ID,
} from './sharePoster'
import {
  PERSONALITY_SQUARE_CANVAS_ID,
} from '../../../../lib/utils/momentsPosterFactory'
import {
  MING_CARD_CANVAS_ID,
} from '../../../../lib/utils/mingCardImage'
import {
  buildResolvedResultState,
  buildShareLine,
  buildShareTitle,
  buildTypicalityLabel,
  getTraitEntries,
  resolveCurrentCanvasImage,
  type AnimationProfileName,
  type FlowStage,
  type ResolvedResultState,
} from './resultHelpers'
import LoadingStage from './LoadingStage'
import LoginHandoffOverlay from './LoginHandoffOverlay'
import EmptyStage from './EmptyStage'
import ErrorStage from './ErrorStage'
import SlotStage from './SlotStage'
import RevealStage from './RevealStage'
import BridgeStage from './BridgeStage'
import FinalStage from './FinalStage'
import { useResultShareActions } from './useResultShareActions'
import { useResultsRevealSequence } from './hooks/useResultsRevealSequence'
import { useResultsXiaoyueAnalysis } from './hooks/useResultsXiaoyueAnalysis'
import { useResultsLoginHandoff } from './hooks/useResultsLoginHandoff'
import './index.scss'
import { getSystemReducedMotionCompat } from '../../../../lib/utils/systemInfo'

// helper function for the personality test results page
function buildAuthUserResultState(user: any): ResolvedResultState | null {
  const archetype = user?.archetype ?? user?.primaryArchetype ?? null
  if (!archetype) return null

  const topMatches = [{ archetype, score: 100, confidence: 1 }]

  return {
    sessionId: `profile-${user.id ?? archetype}`,
    completedAt: new Date().toISOString(),
    result: {
      primaryArchetype: archetype,
      secondaryArchetype: user?.secondaryArchetype ?? undefined,
      traitScores: {},
      topMatches,
      archetypeConfidence: 1,
      isDecisive: true,
    },
    topMatches,
  }
}

/**
 * Composition root for the personality-test results page.
 *
 * Orchestration lives in sibling hooks (2026-08-18 split, mirrors the
 * icebreaker-session SessionPhaseViews/useSocialActions pattern):
 * - hooks/useResultsRevealSequence.ts — slot → reveal → bridge → result stage
 *   state machine, timers, retry/restart/skip handlers, flow analytics
 * - hooks/useResultsXiaoyueAnalysis.ts — Xiaoyue AI analysis fetch
 * - hooks/useResultsLoginHandoff.ts — anonymous import + inline login + CTA
 * This file keeps data derivation, feature-flag profile selection, and the
 * stage dispatch JSX.
 */
export default function PersonalityTestResultsPage() {
  const auth = useAuth()
  const deviceTier = useDeviceTier()

  const personalityShareEnabled = auth.user?.features?.personalityShareEnabled ?? true
  const personalitySlotAnimationEnabled = auth.user?.features?.personalitySlotAnimationEnabled ?? true
  // K3 tempo retune (2026-08-17 polish pass): fast is the product default,
  // but it stays remotely switchable — personalitySlotProfileFast defaults to
  // true server-side, so ops can roll back to the legacy baseline by setting
  // the DB flag to false (no release needed). Precedence: dramatic > fast >
  // baseline; baseline is also selectable via the web-sandbox
  // `?animationProfile=` override.
  const personalitySlotProfileName: AnimationProfileName = auth.user?.features?.personalitySlotProfileDramatic
    ? 'dramatic'
    : auth.user?.features?.personalitySlotProfileFast
      ? 'fast'
      : 'baseline'

  const initialSnapshot = useMemo(() => readAnonymousAssessmentSession(), [])
  const authUserResult = useMemo(() => buildAuthUserResultState(auth.user), [auth.user])

  const initialResolvedResult = useMemo(
    () => buildResolvedResultState(initialSnapshot) ?? authUserResult,
    [initialSnapshot, authUserResult],
  )

  // A fresh local completion (snapshot with result but no resultSequenceCompletedAt)
  // must still play the slot animation — only a watched sequence (replay) or an
  // authenticated archetype-holder with no fresh local result skips it.
  const hasFreshLocalCompletion = Boolean(
    initialSnapshot?.result && !initialSnapshot.resultSequenceCompletedAt,
  )
  const hasCompletedReplay = Boolean(
    (initialSnapshot?.resultSequenceCompletedAt && initialResolvedResult) ||
      (authUserResult && !hasFreshLocalCompletion),
  )
  /**
   * OS-level reduced-motion (pre-ship pipeline blocker fix, 2026-07-19): the
   * `--reduce-motion` SCSS guards were dead code until this class wiring.
   * Mirrors the sibling pattern in personality-test/index.tsx.
   */
  const [systemReducedMotion] = useState(() => {
    try {
      // reduceMotion is absent from Taro's typed SystemInfo but present at runtime (sibling: personality-test/index.tsx:153)
      return getSystemReducedMotionCompat()
    } catch {
      return false
    }
  })

  // Track spritesheet decode readiness before starting slot animation.
  // Falls back after 500ms so we never block indefinitely.
  const spriteReady = useSpriteReadiness(
    hasCompletedReplay ? '' : getArchetypeSpritesheetLocalPath(),
  )
  const shareAnimatedClipEnabled = auth.user?.features?.shareAnimatedClipEnabled ?? false

  const analytics = useOnboardingAnalytics('personality-test-results', {
    enabled: !auth.isLoading,
    startMetadata: {
      hasSessionId: Boolean(initialSnapshot?.sessionId),
      hasStoredResult: Boolean(initialResolvedResult),
      hasCompletedReplay,
      isAuthenticated: auth.isAuthenticated,
    },
  })

  // R3-10 experiment marker: while the server remotely selects a non-baseline
  // slot animation profile, every onboarding analytics event carries
  // { flagKey, bucket } (bucket = stable userId||anonymousId hash) — this is
  // what puts the bucket on the slot-start interaction fired by the reveal
  // hook, and on its downstream funnel events.
  const slotProfileExperiment = useMemo(
    () =>
      resolveExperimentMarker({
        flagKey: 'personality_slot_profile',
        flagEnabled: Boolean(
          auth.user?.features?.personalitySlotProfileFast
            || auth.user?.features?.personalitySlotProfileDramatic,
        ),
        userId: auth.user?.id ?? null,
        anonymousId: onboardingAnalytics.getAnonymousId(),
      }),
    [
      auth.user?.features?.personalitySlotProfileFast,
      auth.user?.features?.personalitySlotProfileDramatic,
      auth.user?.id,
    ],
  )

  useEffect(() => {
    analytics.setExperiment(slotProfileExperiment)
  }, [analytics, slotProfileExperiment])

  /**
   * Indirection for the share-poster reset inside the reveal-sequence hook:
   * useResultShareActions is created below from the hook's outputs, so the
   * clear handler cannot be passed as a plain value (circular). Assigned
   * during render right after useResultShareActions — always populated before
   * any effect can start the flow.
   */
  const clearSharePosterRef = useRef<() => void>(() => {})

  const {
    flowStage,
    sessionSnapshot,
    resultState,
    resultStateRef,
    topMatches,
    isDecisive,
    displayArchetype,
    displayArchetypeName,
    slotPhase,
    revealPhase,
    reelIndex,
    progress,
    phaseText,
    celebrationTier,
    isFetchingResult,
    isSlowNetwork,
    isOffline,
    errorMessage,
    showSkipAnimation,
    handleRetry,
    handleRestart,
    handleSkipAnimation,
    skipBridge,
  } = useResultsRevealSequence({
    hasCompletedReplay,
    initialSnapshot,
    initialResolvedResult,
    authUserResult,
    personalitySlotAnimationEnabled,
    personalitySlotProfileName,
    spriteReady,
    analytics,
    isAuthenticated: auth.isAuthenticated,
    authUserArchetype: auth.user?.archetype ?? auth.user?.primaryArchetype ?? null,
    clearSharePosterRef,
  })

  const secondaryArchetypeId = resultState?.result.secondaryArchetype ?? sessionSnapshot?.result?.secondaryArchetype
  const secondaryDisplayName = secondaryArchetypeId
    ? (ARCHETYPE_BY_ID[secondaryArchetypeId]?.nameCn ?? '')
    : undefined

  const visual = useMemo(() => getArchetypeVisual(displayArchetype), [displayArchetype])
  const summary = useMemo(() => visual.summary, [visual.summary])
  const traitEntries = useMemo(() => getTraitEntries(resultState?.result ?? sessionSnapshot?.result), [resultState, sessionSnapshot])
  const skillSet = useMemo(() => (displayArchetype ? getArchetypeSkills(displayArchetype) : undefined), [displayArchetype])

  // Phase 2: card variants, energy, rank badges
  const variants = useMemo(() => (displayArchetype ? getArchetypeCardVariants(displayArchetype) : []), [displayArchetype])
  const energyLevel = useMemo(() => {
    if (!displayArchetype) return undefined
    return archetypeRegistry[displayArchetype]?.profile.energyLevel
  }, [displayArchetype])
  const archetypeRank = useMemo(() => {
    if (!displayArchetype) return undefined
    const index = getArchetypeIndex(displayArchetype)
    if (index === null) {
      logWarn('[PersonalityResults] Archetype not found in registry', { archetype: displayArchetype })
      return 1
    }
    return index
  }, [displayArchetype])
  const serialNumber = useMemo(() => {
    const sessionId = sessionSnapshot?.sessionId ?? 'unknown'
    // Deterministic pseudo-serial from sessionId hash
    let hash = 0
    for (let i = 0; i < sessionId.length; i++) {
      hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
    }
    const num = Math.abs(hash) % 90000 + 10000
    return `#${num}`
  }, [sessionSnapshot?.sessionId])

  const typicalityLabel = useMemo(
    () => buildTypicalityLabel(isDecisive, displayArchetypeName, visual.accentText),
    [isDecisive, displayArchetypeName, visual.accentText],
  )

  // Phase 3 (2026-08-01): rare-variant easter egg — a highly typical match
  // (典型 = decisive AND high-confidence) upgrades the land moment to the
  // 闪光 treatment. Deterministic per result; no probability involved.
  const isRareVariant = useMemo(() => {
    const confidence = resultState?.result.archetypeConfidence
      ?? sessionSnapshot?.result?.archetypeConfidence
      ?? 0
    return isDecisive === true && confidence >= 0.85
  }, [isDecisive, resultState?.result.archetypeConfidence, sessionSnapshot?.result?.archetypeConfidence])

  const secondaryVisual = useMemo(
    () => (secondaryArchetypeId ? getArchetypeVisual(secondaryArchetypeId) : undefined),
    [secondaryArchetypeId],
  )
  const shareLine = useMemo(
    () => buildShareLine(displayArchetypeName, visual.tagline || visual.description, summary),
    [displayArchetypeName, summary, visual.description, visual.tagline],
  )
  const shareTitle = useMemo(
    () => buildShareTitle(displayArchetypeName, visual.tagline || visual.description),
    [displayArchetypeName, visual.description, visual.tagline],
  )
  const displayAsset = useMemo(
    () =>
      // Primary: local bundled WebP — always available, immune to CDN
      // whitelist / network issues that plague getImageInfo in subpackages.
      (displayArchetype ? `${ASSET_BASE_WEBP_LOCAL}/archetype-${displayArchetype}.webp` : '') ||
      // Fallback: CDN WebP (for environments where local assets were stripped)
      visual.asset ||
      // Fallback 2: Xiaoyue mascot (never blank)
      getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate),
    [displayArchetype, visual.asset],
  )

  const preResolvedImageRef = useRef<{ asset: string; path: string; width?: number; height?: number } | null>(null)

  // Pre-resolve the archetype image for canvas poster generation.
  // `Taro.getImageInfo` returns a temp file path that canvas.drawImage
  // can consume without a redundant network fetch.
  useEffect(() => {
    if (!displayAsset || preResolvedImageRef.current?.asset === (displayArchetype ?? displayAsset)) return
    let cancelled = false
    resolveCurrentCanvasImage(
      displayArchetype ?? displayAsset,
      [displayAsset, visual.asset, visual.assetPng],
      preResolvedImageRef.current,
      Taro.getImageInfo,
    )
      .then((resolved) => {
        if (!cancelled) {
          preResolvedImageRef.current = resolved
          logInfo('[PersonalityResults] Archetype image pre-resolved for canvas', {
            asset: resolved.asset,
            path: resolved.path.substring(0, 60),
          })
        }
      })
      .catch((err: unknown) => {
        logWarn('[PersonalityResults] Failed to pre-resolve archetype image for canvas', {
          displayAsset,
          error: String(err),
        })
      })
    return () => { cancelled = true }
  }, [displayArchetype, displayAsset, visual.asset, visual.assetPng])

  const { xiaoyueAnalysis, isLoadingAnalysis } = useResultsXiaoyueAnalysis({
    flowStage,
    resultStateRef,
    sessionSnapshot,
  })

  const {
    sharePosterPath,
    isGeneratingPoster,
    isGeneratingClip,
    posterError,
    generationPhase,
    selectedVariantIndex,
    clearSharePoster,
    handleGeneratePoster,
    handleGenerateClip,
  } = useResultShareActions({
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    visual,
    variants,
    shareLine,
    summary,
    traitEntries,
    topMatches,
    skillSet,
    typicalityLabel,
    energyLevel,
    archetypeRank,
    serialNumber,
    isDecisive,
    secondaryDisplayName,
    deviceTier,
    shareAnimatedClipEnabled,
    analytics,
    user: auth.user,
    preResolvedImageRef,
  })

  // Render-phase assignment: guaranteed to land before any effect can invoke
  // the reveal flow (see clearSharePosterRef declaration above).
  clearSharePosterRef.current = clearSharePoster

  const queryClient = useQueryClient()

  const {
    isLoggingIn,
    loginError,
    continueButtonLabel,
    handleContinue,
  } = useResultsLoginHandoff({
    auth,
    analytics,
    queryClient,
    displayArchetypeName,
  })

  // WeChat share requires a network URL or temp file path. Local bundled
  // paths don't work for share preview images. Fall back to CDN URL.
  const shareImageUrl = sharePosterPath || visual.asset || displayAsset

  useShareAppMessage(() => ({
    title: shareTitle,
    path: MINI_PROGRAM_ROUTES.personalityTest,
    imageUrl: shareImageUrl,
  }))

  useShareTimeline(() => ({
    title: shareTitle,
    query: 'source=personality-result',
    imageUrl: shareImageUrl,
  }))

  /**
   * Slice 0 (2026-07-19): per-stage dwell instrumentation. Fires on every stage
   * transition with the previous stage's dwell time. PR-2 (2026-08-24): the
   * final stage's dwell is flushed on page unload below — previously it was
   * lost because no further transition fires before exit.
   */
  const stageEnteredAtRef = useRef(Date.now())
  // Initialize from the same expression as flowStage so the replay fast-path
  // doesn't emit a phantom 'loading' dwell event (review concern C1).
  const prevStageRef = useRef<FlowStage>(hasCompletedReplay ? 'result' : 'loading')
  useEffect(() => {
    if (prevStageRef.current === flowStage) return
    const now = Date.now()
    analytics.interaction('result_stage_dwell', {
      stage: prevStageRef.current,
      dwellMs: now - stageEnteredAtRef.current,
    })
    stageEnteredAtRef.current = now
    prevStageRef.current = flowStage
  }, [analytics, flowStage])

  // Flush the final stage's dwell on page unload (swipe-back / forward nav).
  // Dedupe is inherent: the transition effect above resets stageEnteredAtRef
  // whenever the stage changes, so this only ever reports the current stage.
  const flushFinalStageDwellRef = useRef(false)
  useEffect(() => {
    flushFinalStageDwellRef.current = false
  }, [flowStage])
  useUnload(() => {
    if (flushFinalStageDwellRef.current) return
    flushFinalStageDwellRef.current = true
    analytics.interaction('result_stage_dwell', {
      stage: prevStageRef.current,
      dwellMs: Date.now() - stageEnteredAtRef.current,
      exit: 'unload',
    })
  })

  /**
   * Escape hatch for the intro<->results redirect loop.
   *
   * This page renders only the anonymous (pre-login) assessment result read
   * from device storage. An authenticated user who already has an archetype but
   * no local anonymous result (storage cleared at login) cannot be served here:
   * runResultFlow falls into the 'empty' branch, and the personality-test intro
   * redirects archetype-holders straight back to this page — an infinite bounce.
   *
   * When we detect that exact state, forward the user to their real nextStep
   * instead of stranding them on the empty/error screen.
   */
  const forwardedAuthedRef = useRef(false)
  useEffect(() => {
    if (auth.isLoading || isLoggingIn) return
    if (forwardedAuthedRef.current) return

    const existingArchetype = auth.user?.primaryArchetype ?? auth.user?.archetype ?? null
    if (!auth.isAuthenticated || !existingArchetype) return

    // A displayable local result (replay fast-path or a freshly-saved snapshot)
    // means the normal flow can render — never forward in that case.
    if (hasCompletedReplay) return
    if (buildResolvedResultState(readAnonymousAssessmentSession()) || authUserResult) return

    forwardedAuthedRef.current = true
    logInfo('[PersonalityResults] Authenticated archetype-holder with no local result — forwarding to nextStep', {
      nextStep: auth.nextStep ?? null,
    })
    analytics.interaction('results_forwarded_authenticated', { nextStep: auth.nextStep ?? null })
    void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
  }, [auth.isLoading, auth.isAuthenticated, auth.user, auth.nextStep, isLoggingIn, hasCompletedReplay, authUserResult, analytics])

  const content = (() => {
    switch (flowStage) {
      case 'empty':
        return <EmptyStage onRestart={handleRestart} />
      case 'error':
        return (
          <ErrorStage
            errorMessage={errorMessage}
            isFetchingResult={isFetchingResult}
            isOffline={isOffline}
            onRetry={handleRetry}
            onRestart={handleRestart}
          />
        )
      case 'slot':
        return (
          <SlotStage
            reelIndex={reelIndex}
            slotPhase={slotPhase}
            isSlowNetwork={isSlowNetwork}
            progress={progress}
            phaseText={phaseText}
            celebrationTier={celebrationTier}
            isRareVariant={isRareVariant}
            systemReducedMotion={systemReducedMotion}
          />
        )
      case 'reveal':
        return (
          <RevealStage
            displayArchetypeName={displayArchetypeName}
            displayAsset={displayAsset}
            visual={visual}
            revealPhase={revealPhase}
          />
        )
      case 'bridge':
        return (
          <BridgeStage
            displayArchetypeName={displayArchetypeName}
            accentText={visual.accentText}
            typicalityText={typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined}
            phaseText={phaseText}
            onSkip={skipBridge}
          />
        )
      case 'result':
        return (
          <FinalStage
            displayArchetypeName={displayArchetypeName}
            displayArchetypeId={displayArchetype ?? ''}
            displayAsset={displayAsset}
            visual={visual}
            summary={summary}
            shareLine={shareLine}
            traitEntries={traitEntries}
            topMatches={topMatches}
            skillSet={skillSet}
            typicalityLabel={typicalityLabel}
            secondaryAccent={secondaryVisual?.accentText}
            isGeneratingPoster={isGeneratingPoster}
            sharePosterPath={sharePosterPath}
            generationPhase={generationPhase}
            energyLevel={energyLevel}
            archetypeRank={archetypeRank}
            serialNumber={serialNumber}
            variants={variants}
            selectedVariantIndex={selectedVariantIndex}
            onGeneratePoster={handleGeneratePoster}
            continueButtonLabel={continueButtonLabel}
            onContinue={handleContinue}
            onRestart={handleRestart}
            authIsLoading={auth.isLoading}
            isAuthenticated={auth.isAuthenticated}
            isLoggingIn={isLoggingIn}
            loginError={loginError}
            isDecisive={isDecisive}
            isRareVariant={isRareVariant}
            secondaryDisplayName={secondaryDisplayName}
            xiaoyueAnalysis={xiaoyueAnalysis}
            isLoadingAnalysis={isLoadingAnalysis}
            personalityShareEnabled={personalityShareEnabled}
            posterError={posterError}
            shareAnimatedClipEnabled={shareAnimatedClipEnabled}
            isGeneratingClip={isGeneratingClip}
            onGenerateClip={handleGenerateClip}
          />
        )
      case 'loading':
      default:
        return <LoadingStage phaseText={phaseText} />
    }
  })()

  return (
    <View className={`personality-results personality-results--${flowStage}${deviceTier.isDegradation ? ' personality-results--low-end' : ''}${systemReducedMotion ? ' personality-results--reduce-motion' : ''}`}>
      {/* Keyed stage crossfade: each flowStage remounts its stage under a
          200ms opacity+translateY enter so the LoadingStage → slot handoff
          reads as one composed beat (replaces the PR-7 celebrate bridge). */}
      <View key={flowStage} className='personality-results__stage-fade'>
        {content}
      </View>
      {/* R2-7 login handoff: branded transition overlay for the
           anonymous→login handshake. Stays mounted through the navigation
           call so the route change has no dead frame. */}
      {isLoggingIn && (
        <LoginHandoffOverlay archetypeName={displayArchetypeName} />
      )}
      {showSkipAnimation && (
        <View
          className='personality-results__skip-button'
          onClick={handleSkipAnimation}
          hoverClass='personality-results__skip-button--pressed'
          role='button'
          aria-label='跳过动画'
        >
          <Text className='personality-results__skip-text'>跳过动画</Text>
        </View>
      )}
      <Canvas
        canvasId={PERSONALITY_SHARE_POSTER_CANVAS_ID}
        className='personality-results__poster-canvas'
        style={{ width: '1080px', height: '1560px' }}
        aria-hidden='true'
      />
      {/* Slice 4 (2026-07-19): hidden canvas for 命格卡 generation (shared @shared/ui/mingCard).
           Gated like the square-poster canvas — low-end devices skip the ~3MB native
           bitmap; poster generation fails open to raw art (review concern C4). */}
      {!deviceTier.isDegradation && (
        <Canvas
          canvasId={MING_CARD_CANVAS_ID}
          className='personality-results__poster-canvas'
          style={{ width: '744px', height: '1039px' }}
          aria-hidden='true'
        />
      )}
      {!deviceTier.isDegradation && (
        <Canvas
          canvasId={PERSONALITY_SQUARE_CANVAS_ID}
          className='personality-results__poster-canvas personality-results__poster-canvas--square'
          style={{ width: '750px', height: '750px' }}
          aria-hidden='true'
        />
      )}

      {/* ── Hidden image preload layer ──
           Redundant cache priming: getImageInfo primes the native image cache;
           these <Image> nodes prime the webview's HTTP cache. Both together
           ensure the spritesheet and result image are decoded before display. */}
      <View style={{ position: 'absolute', left: '-9999rpx', top: '-9999rpx', width: '2rpx', height: '2rpx' }} aria-hidden='true'>
        <Image
          src='/pages/onboarding/assets/archetypes/archetype-spritesheet.webp'
          mode='aspectFit'
          lazyLoad={false}
          style={{ width: '2rpx', height: '2rpx' }}
          aria-hidden='true'
        />
        {displayAsset && (
          <Image
            src={displayAsset}
            mode='aspectFit'
            lazyLoad={false}
            style={{ width: '2rpx', height: '2rpx' }}
            aria-hidden='true'
          />
        )}
      </View>
    </View>
  )
}
