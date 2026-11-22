
import { View, Text, ScrollView, Image, Canvas } from '@tarojs/components'
import Taro, { useDidShow, useDidHide, useRouter } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  completeProfileReview,
  getProfileTagline,
  getUserInterests,
  claimWelcomeCoupon,
  type UserInterestsResponse,
} from '@shared/api'
import { getIntentLabel } from '@shared/constants'
import {
  INTEREST_LEVEL_LABELS,
  MACRO_CATEGORY_LABELS,
  type MacroCategory,
} from '@shared/interests'
import { getOnboardingVoiceLine } from '@shared/copy/onboardingVoice'
import { getIndustryDisplayLabel, getOccupationDisplayLabel } from '@shared/occupations'
import { STALE_TIME_PROFILE_TAGLINE_MS } from '../../../lib/utils/uiConstants'
import AnalyzingAnimation from '../../../components/loading/AnalyzingAnimation'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { haptics } from '../../../lib/utils/haptics'
import { getGenderLabel } from '../../../lib/utils/genderLabel'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, fetchDiscoverShell, getUserState } from '../../../lib/api/api'
import { getPrefetchEngine, injectDiscoverShellIntoCache } from '../../../lib/prefetchEngine'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useStepAbandonGuard } from '../../../hooks/onboarding/useStepAbandonGuard'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { MINI_PROGRAM_ROUTES, ONBOARDING_MASCOT_SIZE } from '../../../lib/onboarding/onboardingRoutes'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import Button from '../../../components/ui/Button'
import XiaoyueInlineError from '../../../components/mascot/XiaoyueInlineError'
import Card from '../../../components/ui/Card'
import OnboardingLoadingShell, { SHELL_EXIT_HOLD_MS } from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import InsightRevealCard, {
  type InsightLineFeedbackMeta,
  type InsightRevealCompleteMeta,
  type ProfileTaglineV2Response,
} from '../../../components/onboarding/InsightRevealCard'
import InsightShareEntry from '../../../components/onboarding/InsightShareEntry'
import {
  INSIGHT_POSTER_CANVAS_ID,
  resolveInsightShareVisibility,
} from '../../../lib/onboarding/insightPoster'
import { useInsightPosterShare } from '../../../lib/onboarding/useInsightPosterShare'
import WelcomeGiftCard from '../../../components/onboarding/WelcomeGiftCard'
import BoxJourneySpine from '../../../components/onboarding/BoxJourneySpine'
import { resolveGiftRevealDelayMs, GIFT_REVEAL_CAP_MS } from '../../../lib/onboarding/giftRevealTiming'
import { PROFILE_REVIEW_SUCCESS_DWELL_MS, useProfileReviewCompletion } from './useProfileReviewCompletion'
import { useWelcomeGiftClaim } from './useWelcomeGiftClaim'
import { buildInterestHeatConclusion } from '../../../lib/onboarding/profileFieldAnnotations'
import { buildEntryCardInterestFacts } from '../../../lib/onboarding/entryCardFacts'
import {
  buildEntryCardPersonalityLine,
  type EntryCardTraitScores,
} from '../../../lib/onboarding/entryCardPersonality'
import ProfileArchiveSheet from '../../../components/onboarding/ProfileArchiveSheet'
import { getArchetypeVisual, getXiaoyueAsset } from '../personality-test/visuals'
import { getDeepContrastArchetypeColor } from '@shared/archetypeColors'
import './index.scss'

const QUERY_TIMEOUT_MS = 12_000

interface EntryCardAssessmentResult {
  affinityScore?: number
  opennessScore?: number
  conscientiousnessScore?: number
  emotionalStabilityScore?: number
  extraversionScore?: number
  positivityScore?: number
  completedAt?: string | null
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (reason) => {
        clearTimeout(timer)
        reject(reason)
      },
    )
  })
}

function getAgeLabel(user: Record<string, unknown> | undefined): string {
  if (!user) {
    return ''
  }

  if (typeof user.age === 'number' && Number.isFinite(user.age)) {
    return `${user.age}岁`
  }

  if (typeof user.age === 'string' && user.age.trim() !== '') {
    return `${user.age.trim()}岁`
  }

  const birthdate = typeof user.birthdate === 'string' ? user.birthdate : ''
  if (birthdate !== '') {
    const date = new Date(birthdate)
    if (!Number.isNaN(date.getTime())) {
      const today = new Date()
      let age = today.getFullYear() - date.getFullYear()
      const monthDiff = today.getMonth() - date.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age -= 1
      }
      if (age > 0) {
        return `${age}岁`
      }
    }
  }

  const birthYear =
    typeof user.birthYear === 'number'
      ? user.birthYear
      : typeof user.birthYear === 'string' && user.birthYear.trim() !== ''
        ? Number(user.birthYear)
        : 0

  if (Number.isFinite(birthYear) && birthYear > 0) {
    return `${new Date().getFullYear() - birthYear}岁`
  }

  return ''
}

export default function ProfileReviewPage() {
  const router = useRouter()
  const { shouldReduceMotion } = useMiniRevealMotion(router?.params)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isRevealReady, setIsRevealReady] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isCouponCardVisible, setIsCouponCardVisible] = useState(false)
  // entry-card-insight-v2 (AC-10/D7): the gift card waits for the 悦仔的观察
  // row sequence to land (+1.5s dwell), with a 10s post-reveal hard cap.
  const [insightRowsLanded, setInsightRowsLanded] = useState(false)
  const [giftCapReached, setGiftCapReached] = useState(false)
  // AC-19: bumped on every useDidShow so the insight sequence (and its
  // telemetry emission) re-runs per page visit on swipe-back.
  const [insightReplayNonce, setInsightReplayNonce] = useState(0)
  // Loading-shell continuity bridge (same pattern as essential/extended-data):
  // hold the shell through a short exit fade once auth resolves.
  const [shellFading, setShellFading] = useState(false)
  const [shellDismissed, setShellDismissed] = useState(false)
  const shellRenderedRef = useRef(false)
  const hasTrackedGiftImpressionRef = useRef(false)
  // AC-19: per-visit dedupe for the insight_reveal_complete telemetry event.
  const insightRevealTrackedRef = useRef(false)
  // AC-19 latencyMs anchor: set once when the tagline query first becomes
  // eligible to run (same condition as the query's `enabled`).
  const taglineQueryStartedAtRef = useRef<number | null>(null)
  const hasStagedDiscoverPrefetchRef = useRef(false)
  const isScrolledRef = useRef(false)
  const aigcLabelsEnabled = useAIGCLabelsEnabled()

  // prefers-reduced-motion gating: skip the ceremonial reveal animation when motion is reduced.
  useEffect(() => {
    if (shouldReduceMotion) {
      setIsRevealReady(true)
    }
  }, [shouldReduceMotion])

  const {
    error,
    begin: handleComplete,
    handleHide: handleCompletionHide,
    handleShow: handleCompletionShow,
    isSubmitting,
    isCelebrating,
    isPageExiting,
  } = useProfileReviewCompletion({
    shouldReduceMotion,
    complete: () => withTimeout(completeProfileReview(apiRequest), QUERY_TIMEOUT_MS),
    resolveNextStep: () => withTimeout(getUserState(), QUERY_TIMEOUT_MS),
    navigate: (nextStep) => navigateToMiniProgramNextStep(nextStep ?? undefined, { mode: 'replace' }),
    onServerComplete: () => {
      markReviewCompleted()
      haptics('success')
      logInfo('[ProfileReview] Profile review completed; showing inline confirmation')
      void invalidateAuth()
    },
    onStepCompleted: (nextStep) => {
      analytics.stepCompleted({
        nextStep: nextStep ?? 'unknown',
        hasArchetype: archetype !== '',
        hasInterests: Boolean(interestsData?.totalSelections),
      })
    },
    onNavigate: (nextStep) => {
      logInfo('[ProfileReview] Routing from server nextStep after inline confirmation', { nextStep: nextStep ?? 'unknown' })
      if (nextStep === 'discover' && user?.id) {
        try {
          Taro.setStorageSync(`joyjoin_discover_arrival_pending:${user.id}`, true)
        } catch {
          // Arrival guidance is best-effort and never gates navigation.
        }
      }
    },
    onFailure: (stage, _failure, message) => {
      analytics.errorOccurred(stage === 'complete' && message.includes('网络') ? 'submit_offline' : 'complete_failed', message)
      logError('[ProfileReview] Completion flow failed', { stage, message })
    },
  })

  useDidShow(() => {
    handleCompletionShow()
  })
  useDidHide(() => {
    handleCompletionHide()
  })

  useResetOnShow(
    setIsRevealReady,
    setIsCouponCardVisible,
    setShellFading,
    setInsightRowsLanded,
    setGiftCapReached,
    setIsArchiveOpen,
  )

  // Reset per-visit impression tracking on swipe-back.
  useDidShow(() => {
    hasTrackedGiftImpressionRef.current = false
    insightRevealTrackedRef.current = false
    hasStagedDiscoverPrefetchRef.current = false
    setInsightReplayNonce((nonce) => nonce + 1)
  })
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuthGuard({
    // Keep the onboarding redirect suspended through inline confirmation and
    // routing so the auth cache cannot trigger a second navigation.
    suspendOnboardingRedirect: isSubmitting || isPageExiting || isCelebrating,
  })

  // Loading-shell continuity bridge: hold the shell for a short exit fade
  // once auth resolves so the shell → analyzing-animation swap never flashes
  // a bare background. Reduced motion swaps instantly; a shell that never
  // rendered (fast cached auth) is dismissed without any hold. The fading
  // guard is a ref — see the same effect in essential-data for why the
  // state flag must NOT be a dependency (stuck-shell bug).
  const shellFadingRef = useRef(false)

  useEffect(() => {
    if (isLoading) {
      shellRenderedRef.current = true
      return
    }
    if (shellDismissed || !shellRenderedRef.current) return
    if (shouldReduceMotion) {
      setShellDismissed(true)
      return
    }
    if (shellFadingRef.current) return
    shellFadingRef.current = true
    setShellFading(true)
    const t = setTimeout(() => setShellDismissed(true), SHELL_EXIT_HOLD_MS)
    return () => clearTimeout(t)
  }, [isLoading, shellDismissed, shouldReduceMotion])
  const invalidateAuth = useInvalidateAuth()

  const openEssentialEdit = useCallback((step: string) => {
    void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.essentialData}?from=review&step=${step}` })
  }, [])

  // Returning from an edit re-enters this page; refresh the strip so the saved
  // field is visible without a manual reload.
  useDidShow(() => {
    void invalidateAuth()
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-review-interests'] })
  })
  const analytics = useOnboardingAnalytics('profile-review', { enabled: !isLoading })

  // R1-3 funnel: single-screen enter/abandon discipline (uniform with the
  // essential-data sub-step and extended-data enter events).
  useEffect(() => {
    if (isLoading) return
    analytics.stepEnter({ stepId: 'review', stepIndex: 0 })
  }, [analytics, isLoading])

  const { markCompleted: markReviewCompleted } = useStepAbandonGuard(() => {
    if (isLoading) return
    analytics.stepAbandoned('exit', { stepId: 'review', stepIndex: 0 })
  })

  // The gift is progressive enhancement: one live request at a time, safe
  // coded diagnostics, and no dependency in the completion/navigation path.
  const {
    coupon: welcomeCoupon,
    isLoading: isCouponLoading,
    error: couponError,
    retry: retryWelcomeGift,
  } = useWelcomeGiftClaim({
    enabled: isRevealReady && Boolean(user),
    claim: () => withTimeout(claimWelcomeCoupon(apiRequest), QUERY_TIMEOUT_MS),
    onError: (giftError) => {
      analytics.errorOccurred(
        'welcome_gift_card_claim_failed',
        giftError.diagnostics.code ?? giftError.diagnostics.category,
      )
      logError('[ProfileReview] Failed to claim welcome coupon', { ...giftError.diagnostics })
    },
  })

  // Replay the gift-card entrance animation when the user swipes back to this
  // page. useDidShow's return value is discarded by Taro, so the timer lives
  // in a ref and is cleared from useDidHide instead.
  const giftReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useDidShow(() => {
    if (!welcomeCoupon) return
    if (shouldReduceMotion) {
      setIsCouponCardVisible(true)
      return
    }
    giftReplayTimerRef.current = setTimeout(() => setIsCouponCardVisible(true), 100)
  })
  useDidHide(() => {
    if (giftReplayTimerRef.current) {
      clearTimeout(giftReplayTimerRef.current)
      giftReplayTimerRef.current = null
    }
  })

  // Reduced-motion users should see the card immediately without waiting for animation.
  useEffect(() => {
    if (shouldReduceMotion && welcomeCoupon) {
      setIsCouponCardVisible(true)
    }
  }, [shouldReduceMotion, welcomeCoupon])

  // Predictive Discover shell prefetch remains one-shot and fail-open. It is
  // triggered by the actual entry-card reveal, not a duplicate summary card.
  const stageDiscoverPrefetch = useCallback(() => {
    if (hasStagedDiscoverPrefetchRef.current) return
    hasStagedDiscoverPrefetchRef.current = true

    void getPrefetchEngine(queryClient).run('profile-review-discover', async () => {
      const shell = await fetchDiscoverShell()
      injectDiscoverShellIntoCache(queryClient, shell)
      analytics.interaction('profile_review_discover_prefetch_hit', {
        poolCount: shell.pools.items.length,
      })
    })
  }, [queryClient, analytics])

  useEffect(() => {
    if (!isRevealReady) return
    stageDiscoverPrefetch()
  }, [isRevealReady, stageDiscoverPrefetch])

  // Fast confirmers also warm Discover during the short inline success beat.
  useEffect(() => {
    if (!isCelebrating) return
    stageDiscoverPrefetch()
  }, [isCelebrating, stageDiscoverPrefetch])

  const shouldLoadInterests = !isLoading && Boolean(user?.hasCompletedInterestsCarousel)
  const { data: profileTagline, isLoading: isTaglineLoading, isError: isTaglineError } = useQuery({
    queryKey: ['mini-program', 'onboarding-profile-tagline'],
    queryFn: () => withTimeout(getProfileTagline(apiRequest), QUERY_TIMEOUT_MS),
    enabled: !isLoading && Boolean(user),
    staleTime: STALE_TIME_PROFILE_TAGLINE_MS,
    retry: 1,
  })

  // entry-card-insight-v2: v2 shape detection. The shared DTO is landing in
  // parallel (AC-01); cast through the local mirror interface until then.
  const taglineV2 = profileTagline as ProfileTaglineV2Response | undefined
  // AC-18 kill-switch: `features.entryCardInsightV2Enabled` from
  // /api/auth/user. Explicitly false → legacy single-line UI + original 200ms
  // gift timing; true/undefined → v2. Read via a tolerant record cast until
  // the typed shared feature key lands with the parallel server change.
  const entryCardInsightV2Enabled =
    ((user?.features as Record<string, unknown> | undefined)?.entryCardInsightV2Enabled) !== false
  const isV2Insight =
    entryCardInsightV2Enabled && Array.isArray(taglineV2?.lines) && taglineV2.lines.length > 0

  // AC-19 latency anchor: stamp the moment the tagline query first becomes
  // eligible (mirrors the query's `enabled` condition).
  useEffect(() => {
    if (isLoading || !user || taglineQueryStartedAtRef.current !== null) return
    taglineQueryStartedAtRef.current = Date.now()
  }, [isLoading, user])

  // AC-19: fire `insight_reveal_complete` once per page visit when the reveal
  // sequence settles (any shape). The component re-fires per visit via the
  // replay nonce; this ref keeps the emission visit-scoped.
  const handleInsightRevealComplete = useCallback(
    (meta: InsightRevealCompleteMeta) => {
      if (insightRevealTrackedRef.current) return
      insightRevealTrackedRef.current = true
      analytics.interaction('insight_reveal_complete', { ...meta })
    },
    [analytics],
  )

  // AC-23/P1: one card-level feedback answer per visit. The component
  // ref-dedupes the vote and forwards the primary reveal row's payload; the
  // page only forwards the anonymous payload to the onboarding analytics channel.
  const handleInsightLineFeedback = useCallback(
    (meta: InsightLineFeedbackMeta) => {
      analytics.interaction('insight_line_feedback', { ...meta })
    },
    [analytics],
  )

  // AC-10 hard cap: the gift must enter no later than 10s after isRevealReady,
  // even if the insight sequence (or its query) is still pending.
  useEffect(() => {
    if (!isRevealReady || giftCapReached) return
    const timer = setTimeout(() => setGiftCapReached(true), GIFT_REVEAL_CAP_MS)
    return () => clearTimeout(timer)
  }, [isRevealReady, giftCapReached])

  // Reveal the on-page gift card once the insight sequence has settled:
  // v2 waits for all rows + a 1.5s dwell; tagline error / old shape / cap /
  // reduced-motion all fall back to the original (immediate-ish) path.
  // Keeping this timer separate prevents the fetch effect's welcomeCoupon
  // dependency cleanup from cancelling it and leaving a full-height but
  // transparent gift card in the layout.
  useEffect(() => {
    if (!welcomeCoupon || shouldReduceMotion || isCouponCardVisible) return
    const delay = resolveGiftRevealDelayMs({
      isV2Insight,
      insightRowsLanded,
      isTaglineError,
      shouldReduceMotion,
      giftCapReached,
      v2Enabled: entryCardInsightV2Enabled,
    })
    if (delay === null) return
    const timer = setTimeout(() => setIsCouponCardVisible(true), delay)
    return () => clearTimeout(timer)
  }, [welcomeCoupon, shouldReduceMotion, isCouponCardVisible, isV2Insight, insightRowsLanded, isTaglineError, giftCapReached, entryCardInsightV2Enabled])

  // AC-10: fire `welcome_gift_impression` only on actual exposure of the gift
  // card (any entry path), once per page visit.
  useEffect(() => {
    if (!isCouponCardVisible || !welcomeCoupon || hasTrackedGiftImpressionRef.current) return
    hasTrackedGiftImpressionRef.current = true
    analytics.interaction('welcome_gift_impression', {
      code: welcomeCoupon.code,
      discountValue: welcomeCoupon.discountValue,
      isNewlyAwarded: welcomeCoupon.isNewlyAwarded,
    })
  }, [isCouponCardVisible, welcomeCoupon, analytics])

  const {
    data: interestsData,
    isLoading: isInterestsLoading,
    isFetching: isInterestsFetching,
    isError: isInterestsError,
  } = useQuery<UserInterestsResponse | null>({
    queryKey: ['mini-program', 'profile-review-interests'],
    enabled: shouldLoadInterests,
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return (await withTimeout(getUserInterests(apiRequest), QUERY_TIMEOUT_MS)) as UserInterestsResponse | null
      } catch (queryError) {
        const statusCode =
          typeof queryError === 'object' && queryError !== null && 'statusCode' in queryError
            ? Number((queryError as { statusCode?: unknown }).statusCode)
            : undefined

        if (statusCode === 404) {
          return null
        }

        throw queryError
      }
    },
  })

  const { data: assessmentResult } = useQuery<EntryCardAssessmentResult | null>({
    queryKey: ['mini-program', 'entry-card-assessment'],
    enabled: !isLoading && Boolean(user),
    retry: 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await withTimeout(
          apiRequest<EntryCardAssessmentResult>({ path: '/api/assessment/result' }),
          QUERY_TIMEOUT_MS,
        )
      } catch (queryError) {
        const statusCode =
          typeof queryError === 'object' && queryError !== null && 'statusCode' in queryError
            ? Number((queryError as { statusCode?: unknown }).statusCode)
            : undefined

        if (statusCode === 404) {
          return null
        }

        throw queryError
      }
    },
  })

  const displayName = (user?.displayName as string) || (user?.nickname as string) || '悦聚用户'
  const ageLabel = getAgeLabel(user as Record<string, unknown> | undefined)
  const archetype = (user?.archetype as string) || (user?.primaryArchetype as string) || ''
  const visual = archetype ? getArchetypeVisual(archetype) : null
  // Small dog-ear/eyebrow text on the peach poster needs the deep cap (L ≤ 32);
  // the bright visual.accentText is for large display shapes only.
  const archiveAccentText = getDeepContrastArchetypeColor(archetype)

  // Preload archetype full-body image to prevent flash on cold start
  useEffect(() => {
    if (!visual?.asset) return
    Taro.getImageInfo({ src: visual.asset }).catch(() => { /* fire-and-forget */ })
  }, [visual?.asset])

  // ── Insight share poster (sprint insight-share-poster, AC-01/AC-03) ──
  // Fail-closed visibility matrix: v2 shape + all rows landed + visual
  // present + AC-18 kill-switch not explicitly off. Quiet entry — zero
  // reward/incentive wording; generation + share layer live in the hook.
  const insightShareVisible = resolveInsightShareVisibility({
    isV2Insight,
    insightRowsLanded,
    hasVisual: visual !== null,
    flagEnabled: entryCardInsightV2Enabled !== false,
  })
  const insightPosterShare = useInsightPosterShare({
    enabled: insightShareVisible,
    analytics,
    displayName,
    archetypeName: visual?.name,
    archetypeAsset: visual?.asset,
    accentText: visual?.accentText,
    lines: taglineV2?.lines ?? [],
    evidence: taglineV2?.evidence ?? [],
    aigcLabelsEnabled,
  })

  const currentCity = typeof user?.currentCity === 'string' ? user.currentCity : ''
  const hometownRegionCity =
    typeof user?.hometownRegionCity === 'string' ? user.hometownRegionCity : ''
  const relationshipStatus =
    typeof user?.relationshipStatus === 'string' ? user.relationshipStatus : ''
  const educationLevel = typeof user?.educationLevel === 'string' ? user.educationLevel : ''
  const occupationLabel = getOccupationDisplayLabel(
    user?.occupationId as string | undefined,
    user?.workMode as string | undefined,
    { showWorkMode: true, fallback: '' },
  )
  const industryLabel = getIndustryDisplayLabel(
    user?.occupationId as string | undefined,
    typeof user?.industryCategoryLabel === 'string' ? user.industryCategoryLabel : '',
  )
  const lifeStage = typeof user?.lifeStage === 'string' ? user.lifeStage : ''
  const industryNicheLabel =
    typeof user?.industryNicheLabel === 'string' ? user.industryNicheLabel : ''
  const profileIndustryLabel = industryNicheLabel || industryLabel
  // The card face is screenshot-safe: it may carry the public-facing role +
  // industry line, but never the hometown/education/relationship values. Those
  // stay on the card back (ProfileArchiveSheet).
  const identityMeta = [
    getGenderLabel(user?.gender as string | undefined),
    ageLabel,
    currentCity,
  ].filter((item): item is string => Boolean(item))
  const isStudentProfile = occupationLabel === '学生' || lifeStage === '学生党'
  const profileRolePrimary =
    occupationLabel || (isStudentProfile ? '' : profileIndustryLabel) || lifeStage
  const profileRoleSecondary =
    occupationLabel && !isStudentProfile ? profileIndustryLabel : ''
  const profileMeta = lifeStage && lifeStage !== profileRolePrimary ? lifeStage : ''
  const entryCardTraits = useMemo<EntryCardTraitScores | null>(() => {
    if (!assessmentResult) {
      return null
    }
    return {
      A: assessmentResult.affinityScore,
      O: assessmentResult.opennessScore,
      C: assessmentResult.conscientiousnessScore,
      E: assessmentResult.emotionalStabilityScore,
      X: assessmentResult.extraversionScore,
      P: assessmentResult.positivityScore,
    }
  }, [assessmentResult])

  const personalityLine = useMemo(
    () => buildEntryCardPersonalityLine(entryCardTraits),
    [entryCardTraits],
  )

  const hasProfileChapter = Boolean(
    profileRolePrimary || profileRoleSecondary || profileMeta || personalityLine,
  )
  const archiveHint = [
    hometownRegionCity ? '家乡' : '',
    educationLevel ? '学历' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const intentLabels = Array.isArray(user?.intent)
    ? user.intent
        .filter((item): item is string => typeof item === 'string')
        .map((item) => ({ value: item, label: getIntentLabel(item) }))
        .filter((item) => item.label !== item.value)
        .slice(0, 3)
    : []

  const entryCardInterestFacts = useMemo(
    () => buildEntryCardInterestFacts(interestsData),
    [interestsData],
  )

  const topInterestLabels = useMemo(
    () => entryCardInterestFacts.all.map((item) => item.label),
    [entryCardInterestFacts],
  )

  const interestLevels = useMemo(() => {
    const map: Record<string, 1 | 2 | 3> = {}
    for (const item of entryCardInterestFacts.all) {
      map[item.label] = item.level
    }
    return Object.keys(map).length > 0 ? map : undefined
  }, [entryCardInterestFacts])

  const dominantCategories = useMemo(() => {
    if (!interestsData?.categoryHeat) {
      return [] as MacroCategory[]
    }

    return Object.entries(interestsData.categoryHeat)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([categoryId]) => categoryId as MacroCategory)
  }, [interestsData?.categoryHeat])

  const interestCategoryLine = useMemo(() => {
    const labels = dominantCategories
      .map((category) => MACRO_CATEGORY_LABELS[category])
      .filter((label): label is string => Boolean(label))
      .slice(0, 2)
    return labels.length > 0 ? `热量集中在 ${labels.join(' · ')}` : ''
  }, [dominantCategories])

  const heatConclusion = useMemo(
    () => buildInterestHeatConclusion(topInterestLabels),
    [topInterestLabels],
  )

  const coachCopy = isCelebrating
    ? '入场卡已生效！去挑一场合拍的局吧。'
    : // R3-9 人格在场: tested users hear the Tier A archetype line (Bet 1);
      // the interests-aware generic line is the no-archetype fallback.
      archetype
      ? getOnboardingVoiceLine('profile-review', archetype)
      : topInterestLabels.length > 0
        ? `${getMascotDisplayName(user)}会按这张卡上的兴趣热量，挑最对味的局给你。`
        : getOnboardingVoiceLine('profile-review', null)

  const showInterestSkeleton =
    shouldLoadInterests && !interestsData && !isInterestsError && (isInterestsLoading || isInterestsFetching)

  const pageClassName = [
    'profile-review',
    isPageExiting ? 'profile-review--exiting' : '',
    isCelebrating ? 'profile-review--celebrating' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const getStageClassName = useCallback(
    (step: number) =>
      [
        'profile-review__stage',
        `profile-review__stage--${step}`,
        isRevealReady ? 'profile-review__stage--visible' : '',
      ]
        .filter(Boolean)
        .join(' '),
    [isRevealReady],
  )

  const handleScroll = useCallback((event: any) => {
    if (shouldReduceMotion) {
      return
    }
    const next = (event?.detail?.scrollTop ?? 0) > 24
    // Guard setState to avoid re-render churn on every scroll event.
    if (next !== isScrolledRef.current) {
      isScrolledRef.current = next
      setIsScrolled(next)
    }
  }, [shouldReduceMotion])

  const profileFields = useMemo(
    () =>
      [
        hometownRegionCity ? { label: '家乡', value: hometownRegionCity } : null,
        relationshipStatus ? { label: '关系状态', value: relationshipStatus } : null,
        educationLevel ? { label: '学历', value: educationLevel } : null,
        occupationLabel ? { label: '职业', value: occupationLabel } : null,
        industryLabel ? { label: '行业', value: industryLabel } : null,
      ].filter(Boolean) as { label: string; value: string }[],
    [hometownRegionCity, relationshipStatus, educationLevel, occupationLabel, industryLabel],
  )

  const archiveInterestCategories = useMemo(
    () => dominantCategories.map((item) => MACRO_CATEGORY_LABELS[item] || item),
    [dominantCategories],
  )

  const archiveStoryLine =
    dominantCategories.length > 1
      ? `${MACRO_CATEGORY_LABELS[dominantCategories[0]] || dominantCategories[0]} 是你和同好最容易聊起来的领域`
      : ''

  const interestState: 'ready' | 'loading' | 'error' | 'empty' = isInterestsError
    ? 'error'
    : showInterestSkeleton
      ? 'loading'
      : topInterestLabels.length > 0
        ? 'ready'
        : 'empty'

  const handleArchiveOpen = useCallback(() => {
    haptics('light')
    analytics.interaction('profile_archive_opened', { source: 'entry_card_back' })
    setIsArchiveOpen(true)
  }, [analytics])

  const handleArchiveClose = useCallback(() => {
    haptics('light')
    setIsArchiveOpen(false)
  }, [])

  const handleArchiveInterestRetry = useCallback(() => {
    haptics('light')
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-review-interests'] })
  }, [queryClient])

  const rarityText =
    typeof visual?.rarityPercentage === 'number' && visual.rarityPercentage > 0
      ? `前${Math.round(visual.rarityPercentage)}%`
      : ''

  if (isLoading || (shellRenderedRef.current && !shellDismissed)) {
    return (
      <OnboardingLoadingShell
        stepLabel='最后一步 · 入场卡预览'
        title={`${getMascotDisplayName(user)}在翻开你的入场卡`}
        subtitle='最后这一页准备好后，你就可以去看看有哪些局正在报名。'
        continuity
        exiting={shellFading}
      />
    )
  }

  return (
    <View className={pageClassName}>
      <ScrollView
        className='profile-review__scroll'
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={handleScroll}
      >
        <View className='profile-review__shell'>
          {!isRevealReady ? (
            <AnalyzingAnimation
              label='正在生成你的专属画像'
              subtitle={`${getMascotDisplayName(user)}正在分析你的性格密码...`}
              minDuration={600}
              onComplete={() => setIsRevealReady(true)}
              shouldReduceMotion={shouldReduceMotion}
            />
          ) : null}

          <View className={`profile-review__welcome-illustration ${getStageClassName(0)}`}>
            {visual?.asset ? (
              <Image
                className='profile-review__welcome-image'
                src={visual.asset}
                mode='aspectFit'
                lazyLoad
              />
            ) : (
              <Image
                className='profile-review__welcome-image'
                src={getXiaoyueAsset('homeWelcome')}
                mode='aspectFit'
                lazyLoad
              />
            )}
          </View>

          <View className={`profile-review__hero ${getStageClassName(1)}`}>
            {/* 装盒进度 spine, sealed state (Bet 3): the box is packed and
                ready to open — sets up the Phase 3 ceremony payload. */}
            <BoxJourneySpine
              step={3}
              accentColor={visual?.accentText}
              className='profile-review__spine'
            />
            <Text className='profile-review__title'>
              你的 <Text className='profile-review__title-en'>JoyJoin</Text> 入场卡已就绪
            </Text>
            <Text className='profile-review__subtitle'>确认后，去看看有哪些局正在报名。</Text>
          </View>

          <View className={`profile-review__mascot ${getStageClassName(2)}`}>
            <XiaoyueChatBubble content={coachCopy} pose='pointing' horizontal showGlow tail avatarSize={ONBOARDING_MASCOT_SIZE} />
          </View>

          <Card
            className={`profile-review__poster ${visual ? 'profile-review__poster--themed' : ''} ${getStageClassName(3)}`}
            style={
              visual
                ? {
                    background: visual.accentSurface,
                    borderColor: visual.accentBorder,
                  }
                : undefined
            }
          >
            {!shouldReduceMotion ? <View className='profile-review__poster-shimmer' /> : null}

            {/* Identity: name, one quiet meta run, archetype seal + rarity. */}
            <View className='profile-review__identity'>
              <Text className='profile-review__poster-name'>{displayName}</Text>
              {identityMeta.length > 0 ? (
                <Text className='profile-review__identity-meta'>
                  {identityMeta.join(' · ')}
                </Text>
              ) : null}
              {(archetype && visual) || rarityText ? (
                <View className='profile-review__identity-strip'>
                  {archetype && visual ? (
                    <View
                      className='profile-review__archetype-seal'
                      aria-label={`原型 ${visual.name}`}
                      style={{
                        background: visual.accentSoft,
                        borderColor: visual.accentBorder,
                      }}
                    >
                      <Text
                        className='profile-review__archetype-seal-text'
                        style={{ color: visual.accentText }}
                      >
                        {visual.name}
                      </Text>
                    </View>
                  ) : null}
                  {rarityText ? (
                    <View
                      className='profile-review__rarity'
                      aria-label={`稀有度 ${rarityText}`}
                    >
                      <Text className='profile-review__rarity-label'>稀有度</Text>
                      <Text className='profile-review__rarity-value'>{rarityText}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {hasProfileChapter ? (
              <View
                className={`profile-review__chapter ${getStageClassName(4)}`}
                role='group'
                aria-label='小档案'
              >
                <View className='profile-review__chapter-head'>
                  <View
                    className='profile-review__chapter-tick'
                    aria-hidden='true'
                    style={{ backgroundColor: archiveAccentText }}
                  />
                  <Text className='profile-review__chapter-title'>小档案</Text>
                  <View
                    className='profile-review__chapter-action'
                    role='button'
                    aria-label='去修改入场卡上的资料'
                    hoverClass='profile-review__chapter-action--pressed'
                    onClick={() => openEssentialEdit('professionalProfile')}
                  >
                    <Text className='profile-review__chapter-action-text'>修改资料</Text>
                  </View>
                </View>
                {profileRolePrimary || profileRoleSecondary ? (
                  <View className='profile-review__role-line'>
                    {profileRolePrimary ? (
                      <Text className='profile-review__role-primary'>{profileRolePrimary}</Text>
                    ) : null}
                    {profileRolePrimary && profileRoleSecondary ? (
                      <Text className='profile-review__role-divider'>·</Text>
                    ) : null}
                    {profileRoleSecondary ? (
                      <Text className='profile-review__role-secondary'>
                        {profileRoleSecondary}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {profileMeta ? (
                  <Text className='profile-review__profile-meta'>{profileMeta}</Text>
                ) : null}
                {personalityLine ? (
                  <Text className='profile-review__personality-line'>{personalityLine}</Text>
                ) : null}
              </View>
            ) : null}

            {intentLabels.length > 0 ? (
              <View
                className={`profile-review__chapter ${getStageClassName(5)}`}
                role='group'
                aria-label='想找'
              >
                <View className='profile-review__chapter-head'>
                  <View
                    className='profile-review__chapter-tick'
                    aria-hidden='true'
                    style={{ backgroundColor: archiveAccentText }}
                  />
                  <Text className='profile-review__chapter-title'>想找</Text>
                </View>
                <Text className='profile-review__intent-line'>
                  {intentLabels.map((item) => item.label).join(' · ')}
                </Text>
              </View>
            ) : null}

            <View
              className={`profile-review__chapter ${getStageClassName(6)}`}
              role='group'
              aria-label='兴趣热量'
            >
              <View className='profile-review__chapter-head'>
                <View
                  className='profile-review__chapter-tick'
                  aria-hidden='true'
                  style={{ backgroundColor: archiveAccentText }}
                />
                <Text className='profile-review__chapter-title'>兴趣热量</Text>
                {entryCardInterestFacts.total > entryCardInterestFacts.items.length ? (
                  <Text className='profile-review__chapter-meta'>
                    共 {entryCardInterestFacts.total} 个
                  </Text>
                ) : null}
              </View>

              {showInterestSkeleton ? (
                <View
                  className='profile-review__heat-skeleton'
                  role='status'
                  aria-live='polite'
                  aria-busy='true'
                  aria-label='兴趣数据加载中'
                >
                  {[0, 1].map((row) => (
                    <View
                      key={row}
                      className='profile-review__heat-skeleton-row'
                      aria-hidden='true'
                    >
                      <View className='profile-review__heat-skeleton-label' />
                      <View className='profile-review__heat-skeleton-track' />
                    </View>
                  ))}
                </View>
              ) : isInterestsError ? (
                <View className='profile-review__heat-state' role='alert'>
                  <Text className='profile-review__heat-state-text'>兴趣暂时没读到</Text>
                  <View
                    className='profile-review__heat-retry'
                    role='button'
                    aria-label='重试加载兴趣'
                    hoverClass='profile-review__heat-retry--pressed'
                    onClick={handleArchiveInterestRetry}
                  >
                    <Text className='profile-review__heat-retry-text'>重试</Text>
                  </View>
                </View>
              ) : entryCardInterestFacts.items.length > 0 ? (
                <View className='profile-review__heat-list' role='list'>
                  {entryCardInterestFacts.items.map((item, index) => (
                    <View
                      key={item.topicId}
                      className='profile-review__heat-row'
                      role='listitem'
                      aria-label={`${item.label}，${INTEREST_LEVEL_LABELS[item.level]}`}
                    >
                      <Text className='profile-review__heat-label'>{item.label}</Text>
                      <View className='profile-review__heat-track' aria-hidden='true'>
                        <View
                          className={`profile-review__heat-fill profile-review__heat-fill--level-${item.level}${shouldReduceMotion ? ' profile-review__heat-fill--static' : ''}`}
                          style={{ animationDelay: `${index * 60}ms` }}
                        />
                      </View>
                      <Text className='profile-review__heat-level'>
                        {INTEREST_LEVEL_LABELS[item.level]}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='profile-review__heat-empty'>
                  兴趣还没标，之后可以在「我的」补充
                </Text>
              )}
              {entryCardInterestFacts.items.length > 0 && interestCategoryLine ? (
                <Text className='profile-review__heat-category'>{interestCategoryLine}</Text>
              ) : null}
            </View>

            {/* AI Social Tag — the first wow moment (v2: staged 3-row reveal
                + evidence pills; legacy shape renders the single-line UI) */}
            <View className={`profile-review__insight-chapter ${getStageClassName(7)}`}>
              <InsightRevealCard
                tagline={taglineV2}
                isLoading={isTaglineLoading}
                isError={isTaglineError}
                active={isRevealReady}
                shouldReduceMotion={shouldReduceMotion}
                aigcLabelsEnabled={aigcLabelsEnabled}
                v2Enabled={entryCardInsightV2Enabled}
                queryStartedAt={taglineQueryStartedAtRef.current}
                replayNonce={insightReplayNonce}
                accentColor={visual?.accentText}
                onRetry={() => {
                  queryClient.invalidateQueries({
                    queryKey: ['mini-program', 'onboarding-profile-tagline'],
                  })
                }}
                onAllRowsLanded={() => setInsightRowsLanded(true)}
                onRevealComplete={handleInsightRevealComplete}
                onLineFeedback={handleInsightLineFeedback}
              />
            </View>

            <View className={`profile-review__card-footer ${getStageClassName(8)}`}>
              <InsightShareEntry
                visible={insightShareVisible}
                variant='inline'
                isGenerating={insightPosterShare.isGenerating}
                reduceMotion={shouldReduceMotion}
                onPress={() => {
                  void insightPosterShare.handleShare()
                }}
                className='profile-review__share-action'
              />
              <View
                className='profile-review__archive-entry'
                onClick={handleArchiveOpen}
                hoverClass='profile-review__archive-entry--pressed'
                role='button'
                aria-label='翻看完整小档案'
              >
                <View className='profile-review__archive-entry-copy'>
                  <Text
                    className='profile-review__archive-entry-text'
                    style={{ color: archiveAccentText }}
                  >
                    完整小档案
                  </Text>
                  {archiveHint ? (
                    <Text className='profile-review__archive-hint'>{archiveHint}</Text>
                  ) : null}
                </View>
                <View className='profile-review__archive-entry-fold' aria-hidden='true' />
              </View>
            </View>

          {isCelebrating ? (
            <View className='profile-review__completion' role='status' aria-live='polite'>
              <View className='profile-review__completion-mark' aria-hidden='true' />
              <Text className='profile-review__completion-title'>入场卡已生效</Text>
              <Text className='profile-review__completion-copy'>正在带你前往下一步</Text>
            </View>
          ) : null}
          </Card>

          <View
            className={`profile-review__purpose ${getStageClassName(8)}`}
            role='note'
            aria-label='入场卡用途'
          >
            <View className='profile-review__purpose-rule' aria-hidden='true' />
            <View className='profile-review__purpose-copy'>
              <Text className='profile-review__purpose-kicker'>排桌参考</Text>
              <Text className='profile-review__purpose-text'>
                兴趣、性格和想找，会用来帮你找到同频的一桌
              </Text>
              <Text className='profile-review__purpose-note'>
                职业和背景，会用来把不同圈子的人搭在一起
              </Text>
            </View>
          </View>

          <View className='profile-review__gift-region'>
            {welcomeCoupon ? (
              <WelcomeGiftCard
                compact
                discountValue={welcomeCoupon.discountValue}
                discountType={welcomeCoupon.discountType}
                validUntil={welcomeCoupon.validUntil ?? null}
                visible={isCouponCardVisible}
                reduceMotion={shouldReduceMotion}
                className='profile-review__gift-card'
              />
            ) : isCouponLoading ? (
              <WelcomeGiftCard compact isLoading visible className='profile-review__gift-card' />
            ) : couponError ? (
              <View
                className='profile-review__coupon-error'
                onClick={couponError.retryable ? () => {
                  haptics('light')
                  analytics.interaction('welcome_gift_card_retry_tap', { ...couponError.diagnostics })
                  retryWelcomeGift()
                } : undefined}
                hoverClass={couponError.retryable ? 'profile-review__coupon-error--pressed' : 'none'}
                role={couponError.retryable ? 'button' : 'status'}
                aria-label={couponError.retryable ? `${couponError.message}，点击重试` : couponError.message}
              >
                <View className='profile-review__coupon-error-copy'>
                  <Text className='profile-review__coupon-error-title'>见面礼状态</Text>
                  <Text className='profile-review__coupon-error-subtitle'>
                    {couponError.message}{couponError.retryable ? '，点击重试' : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

        </View>
      </ScrollView>

      {/* Hidden insight share-poster canvas (AC-02b): the inline px DOM size
          must equal the 1080×1560 export bitmap (results-page convention);
          offscreen via the SCSS class below. */}
      <Canvas
        canvasId={INSIGHT_POSTER_CANVAS_ID}
        className='profile-review__insight-poster-canvas'
        style={{ width: '1080px', height: '1560px' }}
        aria-hidden='true'
      />

      {error ? (
        <View className='profile-review__error'>
          <XiaoyueInlineError
            message={error}
            retryLabel='点击重试'
            onRetry={() => {
              handleComplete()
            }}
          />
        </View>
      ) : null}

      {/* Bottom action bar: idle CTA, or a non-interactive success status strip.
          A disabled solid-purple button reads as tappable; the 720ms success
          dwell uses a quiet status/progress line instead. */}
      {isCelebrating ? (
        <View
          className={[
            'profile-review__cta',
            'profile-review__cta--celebrating',
            isScrolled ? 'profile-review__cta--scrolled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden='true'
        >
          <View className='profile-review__cta-status'>
            <View className='profile-review__cta-status-row'>
              <View className='profile-review__cta-status-dot' aria-hidden='true' />
              <Text className='profile-review__cta-status-text'>正在前往下一步</Text>
            </View>
            <View className='profile-review__cta-status-track' aria-hidden='true'>
              <View
                className={`profile-review__cta-status-fill ${
                  shouldReduceMotion ? 'profile-review__cta-status-fill--static' : ''
                }`}
                style={{ animationDuration: `${PROFILE_REVIEW_SUCCESS_DWELL_MS}ms` }}
              />
            </View>
          </View>
        </View>
      ) : (
        <View
          className={[
            'profile-review__cta',
            isScrolled ? 'profile-review__cta--scrolled' : '',
            getStageClassName(9),
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Button
            variant='brand'
            className='profile-review__submit'
            onClick={() => {
              haptics('medium')
              analytics.interaction('profile_review_cta_tap', {
                labelVariant: 'confirm_pick_compatible',
                summaryMode: 'strip',
                scrollTopBucket: isScrolled ? 'scrolled' : 'top',
              })
              void handleComplete()
            }}
            disabled={isSubmitting || isPageExiting}
            loading={isSubmitting || isPageExiting}
          >
            {isPageExiting ? '正在前往…' : isSubmitting ? '正在完成…' : '确认，去挑一场合拍的局'}
          </Button>
        </View>
      )}

      <ProfileArchiveSheet
        visible={isArchiveOpen}
        onClose={handleArchiveClose}
        fields={profileFields}
        intents={intentLabels}
        interestLabels={topInterestLabels}
        interestLevels={interestLevels}
        interestCategories={archiveInterestCategories}
        heatConclusion={heatConclusion ?? ''}
        storyLine={heatConclusion ? '' : (archiveStoryLine ?? '')}
        interestState={interestState}
        onRetryInterests={handleArchiveInterestRetry}
        accentSurface={visual?.accentSurface}
        accentBorder={visual?.accentBorder}
        accentText={archiveAccentText}
        reduceMotion={shouldReduceMotion}
      />

    </View>
  )
}
