
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  completeProfileReview,
  getProfileTagline,
  getUserInterests,
  claimWelcomeCoupon,
  type UserInterestsResponse,
  type WelcomeCouponResponse,
} from '@shared/api'
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '@shared/ai/onboarding'
import { getIntentEmoji, getIntentLabel } from '@shared/constants'
import { MACRO_CATEGORY_LABELS, type MacroCategory } from '@shared/interests'
import { getIndustryDisplayLabel, getOccupationDisplayLabel } from '@shared/occupations'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { getOnboardingVoiceLine } from '@shared/copy/onboardingVoice'
import { STALE_TIME_PROFILE_TAGLINE_MS } from '../../../lib/utils/uiConstants'
import AnalyzingAnimation from '../../../components/loading/AnalyzingAnimation'
import InterestChipCloud from '../../../components/profile/InterestChipCloud'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { haptics } from '../../../lib/utils/haptics'
import { getGenderLabel } from '../../../lib/utils/genderLabel'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, fetchDiscoverShell, getUserState } from '../../../lib/api/api'
import { getPrefetchEngine, injectDiscoverShellIntoCache } from '../../../lib/prefetchEngine'
import { preloadFlowBannerBackgrounds } from '../../../lib/utils/routePreloadAssets'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useStepAbandonGuard } from '../../../hooks/onboarding/useStepAbandonGuard'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { ONBOARDING_MASCOT_SIZE } from '../../../lib/onboarding/onboardingRoutes'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import ProfileReviewInviteCard from '../../../components/onboarding/ProfileReviewInviteCard'
import BoxJourneySpine from '../../../components/onboarding/BoxJourneySpine'
import UnboxingCeremony from '../../../components/onboarding/UnboxingCeremony'
import JoyJoinIntroFlow from '../../../components/flow-animation/JoyJoinIntroFlow'
import { shouldShowFlow } from '../../../components/flow-animation/FlowStorage'
import { getArchetypeVisual, getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const QUERY_TIMEOUT_MS = 12_000

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
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [error, setError] = useState('')
  const [isRevealReady, setIsRevealReady] = useState(false)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [welcomeCoupon, setWelcomeCoupon] = useState<WelcomeCouponResponse | null>(null)
  const [isCouponLoading, setIsCouponLoading] = useState(false)
  const [isInviteCardVisible, setIsInviteCardVisible] = useState(false)
  const [introNextStep, setIntroNextStep] = useState<string | undefined>()
  const [showCeremony, setShowCeremony] = useState(false)
  const hasTrackedInviteImpressionRef = useRef(false)
  const hasStagedDiscoverPrefetchRef = useRef(false)
  const isScrolledRef = useRef(false)
  const aigcLabelsEnabled = useAIGCLabelsEnabled()

  // prefers-reduced-motion gating: skip the ceremonial reveal animation when motion is reduced.
  useEffect(() => {
    if (shouldReduceMotion) {
      setIsRevealReady(true)
    }
  }, [shouldReduceMotion])

  useResetOnShow(setIsPageExiting, setIsSubmitting, setIsCelebrating, setIsRevealReady, setIsInviteCardVisible, setShowCeremony)

  // Reset invite-card impression tracking when the user returns via swipe-back
  // so analytics accurately reflect each visit.
  useDidShow(() => {
    hasTrackedInviteImpressionRef.current = false
    hasStagedDiscoverPrefetchRef.current = false
  })
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuthGuard({
    // The ceremony overlay is a mid-navigation state: keep the onboarding
    // redirect suspended so it cannot yank the user away before routing.
    suspendOnboardingRedirect: isSubmitting || isPageExiting || showCeremony,
  })
  const invalidateAuth = useInvalidateAuth()
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

  // Preload Flow 1 per-archetype banner backgrounds during the analyzing window
  // so the entrance peak never races the network.
  useEffect(() => {
    if (!isRevealReady && user?.primaryArchetype) {
      preloadFlowBannerBackgrounds(user.primaryArchetype as string)
    }
  }, [isRevealReady, user?.primaryArchetype])

  // Claim (or re-fetch) the lifetime welcome coupon once the reveal animation
  // finishes. The coupon content rides inside the UnboxingCeremony's rising
  // entry card (拆盒即得礼); a failed claim degrades to a ceremony card
  // without the gift row — the ceremony never blocks on this request.
  useEffect(() => {
    if (!isRevealReady || !user || isCouponLoading || welcomeCoupon) return

    let cancelled = false
    setIsCouponLoading(true)

    withTimeout(claimWelcomeCoupon(apiRequest), QUERY_TIMEOUT_MS)
      .then((coupon) => {
        if (cancelled) return
        setWelcomeCoupon(coupon)
        analytics.interaction('welcome_gift_card_impression', {
          code: coupon.code,
          discountValue: coupon.discountValue,
          isNewlyAwarded: coupon.isNewlyAwarded,
        })
      })
      .catch((err) => {
        if (cancelled) return
        analytics.errorOccurred('welcome_gift_card_claim_failed', err instanceof Error ? err.message : String(err))
        logError('[ProfileReview] Failed to claim welcome coupon', {
          message: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        if (!cancelled) setIsCouponLoading(false)
      })

    return () => {
      cancelled = true
    }
    // isCouponLoading is intentionally not a dependency: the claim fires once
    // per reveal, and a failure must not retrigger the effect into a loop.
  }, [isRevealReady, user, analytics, welcomeCoupon])

  // Reveal the Xiaoyue invitation teaser once the entry card (and its summary
  // card) has landed — anchored to the reveal, not to the coupon request.
  useEffect(() => {
    if (shouldReduceMotion) {
      if (isRevealReady) {
        setIsInviteCardVisible(true)
      }
      return
    }
    if (!isRevealReady) return
    const timer = setTimeout(() => {
      setIsInviteCardVisible(true)
    }, 900)
    return () => clearTimeout(timer)
  }, [isRevealReady, shouldReduceMotion])

  // Track invite-card impression each time it becomes visible.
  useEffect(() => {
    if (!isInviteCardVisible || hasTrackedInviteImpressionRef.current) return
    hasTrackedInviteImpressionRef.current = true
    analytics.interaction('profile_review_invite_impression')
  }, [isInviteCardVisible, analytics])

  // Predictive Discover shell prefetch: the invite card is the strongest signal
  // that the user will enter Discover next. Warm the composite shell so the tab
  // renders from cache instead of cold-fetching on navigation.
  useEffect(() => {
    if (!isInviteCardVisible || hasStagedDiscoverPrefetchRef.current) return
    hasStagedDiscoverPrefetchRef.current = true

    void getPrefetchEngine(queryClient).run('profile-review-discover', async () => {
      const shell = await fetchDiscoverShell()
      injectDiscoverShellIntoCache(queryClient, shell)
      analytics.interaction('profile_review_discover_prefetch_hit', {
        poolCount: shell.pools.items.length,
      })
    })
  }, [isInviteCardVisible, queryClient, analytics])

  const shouldLoadInterests = !isLoading && Boolean(user?.hasCompletedInterestsCarousel)
  const { data: profileTagline, isLoading: isTaglineLoading, isError: isTaglineError } = useQuery({
    queryKey: ['mini-program', 'onboarding-profile-tagline'],
    queryFn: () => withTimeout(getProfileTagline(apiRequest), QUERY_TIMEOUT_MS),
    enabled: !isLoading && Boolean(user),
    staleTime: STALE_TIME_PROFILE_TAGLINE_MS,
    retry: 1,
  })

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

  const displayName = (user?.displayName as string) || (user?.nickname as string) || '悦聚用户'
  const ageLabel = getAgeLabel(user as Record<string, unknown> | undefined)
  const archetype = (user?.archetype as string) || (user?.primaryArchetype as string) || ''
  const visual = archetype ? getArchetypeVisual(archetype) : null

  // Preload archetype full-body image to prevent flash on cold start
  useEffect(() => {
    if (!visual?.asset) return
    Taro.getImageInfo({ src: visual.asset }).catch(() => { /* fire-and-forget */ })
  }, [visual?.asset])

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
  // Never render the raw gender enum ('female') on the entry card — map to
  // the canonical Chinese chip label; unknown/undisclosed drops out.
  const profileTags = [getGenderLabel(user?.gender as string | undefined), ageLabel, currentCity].filter(
    (item): item is string => Boolean(item),
  )
  const intentLabels = Array.isArray(user?.intent)
    ? user.intent
        .filter((item): item is string => typeof item === 'string')
        .map((item) => ({ value: item, label: getIntentLabel(item), emoji: getIntentEmoji(item) }))
        .filter((item) => item.label !== item.value)
        .slice(0, 3)
    : []

  const topInterestItems = useMemo(() => {
    if (!interestsData) {
      return [] as Array<{ id: string; label: string }>
    }

    if (Array.isArray(interestsData.topPriorities) && interestsData.topPriorities.length > 0) {
      return interestsData.topPriorities
        .map((item) => ({ id: item.topicId, label: item.label }))
        .filter((item) => item.id)
        .slice(0, 4)
    }

    if (!Array.isArray(interestsData.selections)) {
      return [] as Array<{ id: string; label: string }>
    }

    return [...interestsData.selections]
      .sort((left, right) => right.level - left.level || right.heat - left.heat)
      .slice(0, 4)
      .map((item) => ({ id: item.topicId, label: item.label }))
  }, [interestsData])

  const topInterestLabels = useMemo(
    () => topInterestItems.map((item) => item.label),
    [topInterestItems],
  )

  const topInterestIds = useMemo(
    () => topInterestItems.map((item) => item.id),
    [topInterestItems],
  )

  const dominantCategories = useMemo(() => {
    if (!interestsData?.categoryHeat) {
      return [] as MacroCategory[]
    }

    return Object.entries(interestsData.categoryHeat)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([categoryId]) => categoryId as MacroCategory)
  }, [interestsData?.categoryHeat])

  const coachCopy = isCelebrating
    ? '入场卡已确认！去遇见对味的人和局吧。'
    : // R3-9 人格在场: tested users hear the Tier A archetype line (Bet 1);
      // the interests-aware generic line is the no-archetype fallback.
      archetype
      ? getOnboardingVoiceLine('profile-review', archetype)
      : topInterestLabels.length > 0
        ? `${getMascotDisplayName(user)}会按这张卡上的兴趣热量，挑最对味的局给你。`
        : getOnboardingVoiceLine('profile-review', null)

  const aiInsightLine =
    !isTaglineLoading && isTaglineError
      ? GENERIC_PROFILE_TAGLINE_FALLBACK
      : profileTagline?.insightLine?.trim() || ''

  const showInterestSkeleton =
    shouldLoadInterests && !interestsData && !isInterestsError && (isInterestsLoading || isInterestsFetching)

  const pageClassName = ['profile-review', isPageExiting ? 'profile-review--exiting' : '']
    .filter(Boolean)
    .join(' ')

  const handleCeremonyComplete = useCallback(async () => {
    setShowCeremony(false)
    // Keep the auth-guard redirect suspended through routing: between the
    // ceremony's dismissal and beforeNavigate, invalidateAuth() flips
    // nextStep to 'discover', which would otherwise let useAuthGuard fire
    // its own switchTab and tear down the intro flow / double-navigate.
    setIsPageExiting(true)

    try {
      await withTimeout(invalidateAuth(), QUERY_TIMEOUT_MS)
      const userState = await withTimeout(getUserState(), QUERY_TIMEOUT_MS)

      analytics.stepCompleted({
        nextStep: userState.nextStep ?? 'discover',
        hasArchetype: archetype !== '',
        hasInterests: Boolean(interestsData?.totalSelections),
      })

      logInfo('[ProfileReview] Onboarding complete, routing from refreshed nextStep', {
        nextStep: userState.nextStep,
      })

      if (
        userState.nextStep === 'discover'
        && shouldShowFlow('joyjoin-intro', user?.id)
        && user?.features?.flowIntroEnabled !== false
      ) {
        setIsCelebrating(false)
        setIntroNextStep(userState.nextStep)
        return
      }

      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      setIsPageExiting(false)
      setIsCelebrating(false)
      const message = err instanceof Error ? err.message : getErrorMessage('operation-failed')
      setError(message)
      analytics.errorOccurred('complete_failed', message)
      logError('[ProfileReview] Post-ceremony routing failed', { message })
    }
  }, [analytics, archetype, interestsData?.totalSelections, invalidateAuth, user?.id])

  const handleComplete = useCallback(async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      logInfo('[ProfileReview] Completing profile review')
      // Bio is no longer collected here (2026-08-18 simplification) — the
      // server treats it as optional; the profile tab nudges for it later.
      await completeProfileReview(apiRequest)

      // Confirmation succeeded — the ceremony overlay and onward routing are
      // post-completion states, never abandonment.
      markReviewCompleted()

      setIsCelebrating(true)
      haptics('success')

      // Single-ceremony rule: when the first-run intro flow is pending, it IS
      // the completion moment — skip the UnboxingCeremony overlay so the user
      // never sits through two ceremonies back to back.
      const introWillShow =
        shouldShowFlow('joyjoin-intro', user?.id)
        && user?.features?.flowIntroEnabled !== false
      if (introWillShow) {
        await handleCeremonyComplete()
        return
      }

      // Phase 3 completion ceremony (Bet 2, the "second box opening"):
      // the sealed box opens and the entry card rises; routing continues in
      // handleCeremonyComplete on tap or after the overlay's auto-advance.
      setShowCeremony(true)
    } catch (err) {
      setIsPageExiting(false)
      setIsCelebrating(false)
      const message = err instanceof Error ? err.message : getErrorMessage('operation-failed')
      setError(message)
      analytics.errorOccurred('complete_failed', message)
      logError('[ProfileReview] Complete failed', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, isSubmitting, handleCeremonyComplete, markReviewCompleted, user?.id, user?.features?.flowIntroEnabled])

  const handleIntroComplete = useCallback(async () => {
    await invalidateAuth()
    const userState = await getUserState()
    await navigateToMiniProgramNextStep(userState.nextStep, {
      mode: 'replace',
      transition: { beforeNavigate: () => setIsPageExiting(true) },
    })
    setIntroNextStep(undefined)
  }, [invalidateAuth])

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

  // The already-filled data (小档案 / 意向 / 兴趣热量) collapses into one
  // summary card, default folded; 改 expands it in place for a quick check.
  const handleSummaryToggle = useCallback(() => {
    haptics('light')
    setIsSummaryExpanded((prev) => !prev)
  }, [])

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

  const stampText = visual?.rarityPercentage
    ? `稀有度 前${visual.rarityPercentage}%`
    : 'JOYJOIN ORIGINAL'

  if (introNextStep) {
    return (
      <JoyJoinIntroFlow
        userId={user?.id}
        archetypeId={archetype}
        alangEnabled={user?.features?.alangEnabled ?? false}
        onComplete={handleIntroComplete}
      />
    )
  }

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='最后一步 · 入场卡预览'
        title={`${getMascotDisplayName(user)}在翻开你的入场卡`}
        subtitle='最后这一页准备好后，你就可以去发现第一场适合你的局。'
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
            <Text className='profile-review__subtitle'>确认这张入场卡后，就去发现第一场适合你的局。</Text>
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

            <View className='profile-review__stamp'>
              <Text className='profile-review__stamp-text'>{stampText}</Text>
            </View>

            {/* Header: name + archetype + basic tags */}
            <View className='profile-review__poster-header'>
              <View className='profile-review__poster-header-row'>
                <Text className='profile-review__poster-name'>{displayName}</Text>
                {archetype && visual ? (
                  <View
                    className='profile-review__poster-archetype'
                    style={{
                      background: visual.accentSoft,
                      borderColor: visual.accentBorder,
                    }}
                  >
                    <Text
                      className='profile-review__poster-archetype-text'
                      style={{ color: visual.accentText }}
                    >
                      {visual.name}
                    </Text>
                  </View>
                ) : null}
              </View>
              {profileTags.length > 0 ? (
                <View className='profile-review__poster-tags'>
                  {profileTags.map((item) => (
                    <View key={item} className='profile-review__poster-tag'>
                      <Text className='profile-review__poster-tag-text'>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* AI Social Tag — the first wow moment */}
            <View className={`profile-review__section ${getStageClassName(4)}`}>
              <View className='profile-review__section-label'>
                <JoyJoinIcon emoji='✨' tier='mood' size={24} className='profile-review__section-label-icon' />
                <Text className='profile-review__section-label-text'>悦仔的观察</Text>
                <AIGCLabel meta={profileTagline?.meta?.aigc} />
              </View>

              {isTaglineLoading ? (
                <View
                  className='profile-review__ai-tag profile-review__ai-tag--loading'
                  aria-busy='true'
                >
                  <View className='profile-review__ai-tag-shimmer' />
                </View>
              ) : (
                <View
                  className={`profile-review__ai-tag${isTaglineError ? ' profile-review__ai-tag--error' : ''}`}
                >
                  <Text className='profile-review__ai-tag-quote profile-review__ai-tag-quote--top'>“</Text>
                  <View className='profile-review__ai-tag-text-wrap'>
                    <Text className='profile-review__ai-tag-text'>
                      {aiInsightLine || GENERIC_PROFILE_TAGLINE_FALLBACK}
                    </Text>
                  </View>
                  <Text className='profile-review__ai-tag-quote profile-review__ai-tag-quote--bottom'>”</Text>
                  {isTaglineError ? (
                    <Text
                      className='profile-review__ai-tag-retry'
                      onClick={() => {
                        haptics('light')
                        queryClient.invalidateQueries({
                          queryKey: ['mini-program', 'onboarding-profile-tagline'],
                        })
                      }}
                    >
                      重试
                    </Text>
                  ) : null}
                  {aigcLabelsEnabled && !isTaglineError && (
                    <AIContentReportButton
                      className='profile-review__ai-tag-report'
                      options={{
                        reason: '举报“悦仔的观察”AI 生成内容',
                      }}
                    />
                  )}
                </View>
              )}
            </View>
          </Card>

          {/* Folded summary card (2026-08-18 simplification, R2-5/R2-6): the
              already-filled data (小档案 / 意向 / 兴趣热量地图) collapses into
              one compact card, default folded — this page's job is to let the
              user through, not collect more data. 改 expands in place. */}
          <Card className={`profile-review__summary ${getStageClassName(5)}`}>
            <View
              className='profile-review__summary-header'
              onClick={handleSummaryToggle}
              hoverClass='profile-review__summary-header--pressed'
              role='button'
              aria-expanded={isSummaryExpanded}
              aria-label={isSummaryExpanded ? '收起入场卡详情' : '展开入场卡详情'}
            >
              <Text className='profile-review__summary-title'>入场卡详情</Text>
              <View className='profile-review__summary-edit'>
                <Text className='profile-review__summary-edit-text'>
                  {isSummaryExpanded ? '收起' : '改'}
                </Text>
              </View>
            </View>

            {isSummaryExpanded ? (
              <View className='profile-review__summary-body'>
                {/* Profile basics */}
                {profileFields.length > 0 ? (
                  <View className='profile-review__section'>
                    <View className='profile-review__section-label profile-review__section-label--no-icon'>
                      <Text className='profile-review__section-label-text'>你的小档案</Text>
                    </View>
                    <View className='profile-review__info-grid'>
                      {profileFields.map((field) => (
                        <View key={field.label} className='profile-review__info-block'>
                          <View className='profile-review__info-dot' />
                          <Text className='profile-review__info-label'>{field.label}</Text>
                          <Text className='profile-review__info-value'>{field.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Intent */}
                {intentLabels.length > 0 ? (
                  <View className='profile-review__section'>
                    <View className='profile-review__section-label'>
                      <JoyJoinIcon emoji='🎯' tier='semantic' size={24} className='profile-review__section-label-icon' />
                      <Text className='profile-review__section-label-text'>来这里想要什么</Text>
                    </View>
                    <View className='profile-review__intent-wrap'>
                      {intentLabels.map((item) => (
                        <View key={item.value} className='profile-review__intent-chip'>
                          <JoyJoinIcon
                            emoji={item.emoji}
                            tier='intent'
                            size={36}
                            className='profile-review__intent-chip-icon'
                          />
                          <Text className='profile-review__intent-chip-text'>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Interests */}
                <View className='profile-review__section'>
                  <View className='profile-review__section-label'>
                    <JoyJoinIcon emoji='🔥' tier='chemistry' size={24} className='profile-review__section-label-icon' />
                    <Text className='profile-review__section-label-text'>兴趣热量地图</Text>
                  </View>

                  {isInterestsError ? (
                    <View className='profile-review__interest-error' role='status' aria-live='polite'>
                      <Text className='profile-review__interest-error-title'>兴趣数据加载失败</Text>
                      <Text className='profile-review__interest-error-copy'>
                        网络不太稳定，但你的入场卡已经可以用了。先出发，兴趣数据稍后自动同步。
                      </Text>
                      <View
                        className='profile-review__interest-error-retry'
                        onClick={() => {
                          haptics('light')
                          queryClient.invalidateQueries({
                            queryKey: ['mini-program', 'profile-review-interests'],
                          })
                        }}
                        hoverClass='profile-review__interest-error-retry--hover'
                      >
                        <Text className='profile-review__interest-error-retry-text'>重新加载兴趣数据</Text>
                      </View>
                    </View>
                  ) : showInterestSkeleton ? (
                    <View className='profile-review__interest-skeleton' aria-busy='true'>
                      <View className='profile-review__interest-stats'>
                        {[1, 2, 3].map((item) => (
                          <View
                            key={item}
                            className='profile-review__interest-stat profile-review__interest-stat--skeleton'
                          >
                            <View className='profile-review__skeleton-line profile-review__skeleton-line--value' />
                            <View className='profile-review__skeleton-line profile-review__skeleton-line--label' />
                          </View>
                        ))}
                      </View>
                      <View className='profile-review__skeleton-chip-row'>
                        {[1, 2, 3].map((item) => (
                          <View key={item} className='profile-review__skeleton-chip' />
                        ))}
                      </View>
                    </View>
                  ) : interestsData ? (
                    <>
                      <View className='profile-review__interest-stats'>
                        <View className='profile-review__interest-stat'>
                          <Text className='profile-review__interest-value'>
                            {interestsData.totalSelections}
                          </Text>
                          <Text className='profile-review__interest-label'>已选兴趣</Text>
                        </View>
                        <View className='profile-review__interest-stat'>
                          <Text className='profile-review__interest-value'>
                            {interestsData.topPriorities?.length ?? 0}
                          </Text>
                          <Text className='profile-review__interest-label'>重点兴趣</Text>
                        </View>
                        <View className='profile-review__interest-stat'>
                          <Text className='profile-review__interest-value'>
                            {interestsData.totalHeat}
                          </Text>
                          <Text className='profile-review__interest-label'>热度总值</Text>
                        </View>
                      </View>

                      {topInterestLabels.length > 0 ? (
                        <InterestChipCloud
                          labels={topInterestLabels}
                          interestIds={topInterestIds}
                          accent
                          className='profile-review__chip-group'
                        />
                      ) : null}

                      {dominantCategories.length > 0 ? (
                        <InterestChipCloud
                          labels={dominantCategories.map((item) => MACRO_CATEGORY_LABELS[item] || item)}
                          className='profile-review__chip-group'
                        />
                      ) : null}

                      {/* Story pill moved here from the extended-data footer
                          (footer slim-down): the top-category narrative belongs
                          on the entry card, next to the 热度总值 stat above. */}
                      {dominantCategories.length > 1 ? (
                        <View className='profile-review__interest-story-pill'>
                          <JoyJoinIcon emoji='🔥' tier='chemistry' size={24} className='profile-review__interest-story-pill-icon' />
                          <Text className='profile-review__interest-story-pill-text'>
                            {MACRO_CATEGORY_LABELS[dominantCategories[0]]} 是你和同好最容易聊起来的领域
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : !isInterestsLoading && !isInterestsFetching && interestsData === null && !isInterestsError ? (
                    <View className='profile-review__interest-placeholder' role='status' aria-live='polite'>
                      <Text className='profile-review__interest-placeholder-title'>暂无兴趣标签</Text>
                      <Text className='profile-review__interest-placeholder-copy'>
                        你还没点选兴趣标签，但入场卡已经可以使用了。先出发，以后还能随时补充。
                      </Text>
                    </View>
                  ) : (
                    <View className='profile-review__interest-placeholder' role='status' aria-live='polite'>
                      <View className='profile-review__interest-placeholder-pulse'>
                        <View className='profile-review__interest-placeholder-dot' />
                        <View
                          className='profile-review__interest-placeholder-dot'
                          style={{ animationDelay: '0.2s' }}
                        />
                        <View
                          className='profile-review__interest-placeholder-dot'
                          style={{ animationDelay: '0.4s' }}
                        />
                      </View>
                      <Text className='profile-review__interest-placeholder-title'>兴趣摘要马上就位</Text>
                      <Text className='profile-review__interest-placeholder-copy'>
                        你刚选的兴趣正在整理成摘要，先带着这张入场卡出发也完全没问题。
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </Card>

          {error ? (
            <View
              className='profile-review__error'
              role='alert'
              aria-live='polite'
              onClick={() => {
                haptics('light')
                handleComplete()
              }}
              hoverClass='profile-review__error--hover'
            >
              <Text className='profile-review__error-text'>{error}</Text>
              <Text className='profile-review__error-retry'>点击重试</Text>
            </View>
          ) : null}

          <ProfileReviewInviteCard
            visible={isInviteCardVisible}
            reduceMotion={shouldReduceMotion}
            archetypeId={archetype}
            displayName={displayName}
            topInterestLabel={topInterestLabels[0] ?? null}
            intentLabel={intentLabels[0]?.label ?? null}
            className='profile-review__invite-card'
          />

          {/* Reserve space for the floating CTA */}
          <View className='profile-review__footer-reserve' />
        </View>
      </ScrollView>

      {/* Floating bottom CTA */}
      <View
        className={[
          'profile-review__cta',
          isScrolled ? 'profile-review__cta--scrolled' : '',
          getStageClassName(6),
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Button
          variant='brand'
          className='profile-review__submit'
          onClick={() => {
            haptics('heavy')
            handleComplete()
          }}
          disabled={isSubmitting || isCelebrating}
          loading={isSubmitting && !isCelebrating}
        >
          {isCelebrating ? '入场卡已确认' : isSubmitting ? '正在完成…' : '确认并进入发现'}
        </Button>
      </View>

      {/* Phase 3 completion ceremony: the "second box opening" — sealed box
          opens, the entry card rises; tap or auto-advance routes onward. */}
      <UnboxingCeremony
        visible={showCeremony}
        displayName={displayName}
        archetypeName={visual?.name}
        accentText={visual?.accentText}
        giftDiscountValue={welcomeCoupon?.discountValue ?? null}
        giftLoading={isCouponLoading && !welcomeCoupon}
        onAdvance={(mode) => {
          analytics.interaction('ceremony_advance', { mode })
        }}
        onComplete={() => {
          void handleCeremonyComplete()
        }}
      />
    </View>
  )
}
