import {
  getJoinedEvents,
  getMyPoolRegistrations,
  getProfileShell,
  getUserGamificationInfo,
  type NotificationCountsResponse,
} from '@shared/api'
import {
  ARCHETYPE_BY_ID,
} from '@shared/personality/archetypeNames'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { formatHSLAsRGBA, getArchetypeHSL, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import { getGuidanceTipCopy } from '@shared/copy/guidanceCopy'
import type { PersonalStoryResponse } from '@joyjoin/shared/schema'
import { useQuery } from '@tanstack/react-query'
import { Canvas, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GuidanceTipCard from '../../components/guidance/GuidanceTipCard'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import IdentityStageScene from '../../components/profile/IdentityStageScene'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { NOTIFICATION_COUNTS_KEY } from '../../hooks/useNotificationCounts'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { CountUpText } from '../../components/ui/CountUpText'
import { useGuidanceQueue } from '../../hooks/useGuidanceQueue'
import { useSyncDeadline } from '../../hooks/useSyncDeadline'
import { apiRequest } from '../../lib/api/api'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { queryClient } from '../../lib/api/queryClient'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { fetchMyEquipment, type EquipmentItem, type EquipmentOutfit } from '../../lib/profile/equipmentApi'
import { EQUIPMENT_ME_QUERY_KEY } from '../../lib/profile/equipmentQueryKeys'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { getPixelEquipmentThumbnailUrl } from '../../lib/profile/pixelAvatarAssets'
import { writeProfileTabDotCount } from '../../lib/profile/profileTabDot'
import { readSeenBadges, writeSeenBadges } from '../../lib/profile/badgeSeenState'
import { useProfileCardShare } from '../../lib/profile/useProfileCardShare'
import { PROFILE_CARD_CANVAS_ID } from '../../lib/profile/profileCardPoster'
import { isDuoCardSnoozed, snoozeDuoCard } from '../../lib/profile/duoCardSnooze'
import { getDuoStatus } from '../../lib/api/duo'
import { haptics } from '../../lib/utils/haptics'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
import { localAsset } from '../../lib/utils/cdnAssets'
import { logError, logInfo } from '../../lib/utils/logger'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { shouldRefreshOnShow } from '../../lib/utils/showRefreshGate'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import { formatEventDateShort } from '../../lib/utils/eventDisplay'
import './index.scss'
import {
  getProfileCompletion,
  getProfileGrowthSummary,
  getProfilePersonalityActionLabel,
  getProfileV17DataPolicy,
  isProfileV17Enabled,
  ARCHETYPE_FAMILY_NAME,
  getDailyGreeting,
  getStreakMilestoneTeaser,
  getStreakContinuationTarget,
  getNextUpcomingRegistration,
  getEventDayGreeting,
  formatChapterDate,
  stripChapterDatePrefix,
  getBadgeProximity,
  MILESTONES,
  PROFILE_STORY_ARTWORK_PATH,
} from './profileConstants'
import { useProfileScroll } from './useProfileScroll'
import ProfilePartnerVisual, { EquipmentPreviewArtwork } from './ProfilePartnerVisual'
import { REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'

// P1-3 (UIUX memo §9): the four profile numbers count 0→N once on first
// data arrival — 600ms, brand bezier, 33ms cadence floor. Shared options.
const PROFILE_COUNT_UP_OPTS = { duration: 600, easing: 'brandBezier', cadenceFloorMs: 33 } as const

/** Local-storage prefix for the dismissed 悦仔 bio prompt (per user). */
const BIO_PROMPT_DISMISS_STORAGE_PREFIX = 'joyjoin_profile_bio_prompt_dismissed'

function getGenderLabel(value?: string | null): string | null {
  switch (value?.trim().toLowerCase()) {
    case 'male':
    case 'man':
    case '男':
    case '男生':
      return '男生'
    case 'female':
    case 'woman':
    case '女':
    case '女生':
      return '女生'
    default:
      return null
  }
}

function ProfileStoryArtwork({ paused, noDrift }: { paused: boolean; noDrift: boolean }) {
  return (
    <>
      <Image
        className={`profile-page__story-image${paused ? ' profile-page__story-image--paused' : ''}${noDrift ? ' profile-page__story-image--no-drift' : ''}`}
        src={PROFILE_STORY_ARTWORK_PATH}
        mode='aspectFill'
        aria-hidden='true'
      />
      <View className='profile-page__story-wash' />
      {/* Dev-only placeholder marker — never ships on user-facing builds. */}
      {process.env.NODE_ENV !== 'production' && (
        <Text className='profile-page__story-placeholder'>场景示意</Text>
      )}
    </>
  )
}

export default function ProfilePage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const profileV17Enabled = isProfileV17Enabled(authUser)
  const profileV17DataPolicy = getProfileV17DataPolicy(authUser)
  const pixelAvatarEnabled = profileV17Enabled
    && authUser?.features?.profilePixelAvatarEnabled === true
  const deviceTier = useDeviceTier()
  const { navCondensed, handleScroll } = useProfileScroll()

  // (P0-5: useCustomTabBarSync moved below the equipment derivations — it
  // now consumes pendingEntitlementCount, which doesn't exist yet here.)

  // Warm own first-viewport assets + adjacent tabs' assets during idle so
  // the next tab switch paints instantly.
  useEffect(() => {
    preloadRouteAssets('pages/profile/index')
    preloadPredictiveAssets('pages/profile/index')
  }, [])

  const hasDidShowRef = useRef(false)
  // P0-9 playState gating: looping CSS animations (story drift, pulse ring)
  // pause while the tab page is hidden so background pages burn zero frames.
  const [pageVisible, setPageVisible] = useState(true)
  // P1-1 avatar tap bounce: ref-locked (one bounce per tap, no queue). Reset
  // in useDidShow — a swipe-away within the 420ms window must not leave the
  // tap class stuck on the hidden page (page-stack lifecycle rule).
  const [avatarBouncing, setAvatarBouncing] = useState(false)
  const avatarBounceLockRef = useRef(false)
  const handlePartnerTap = useCallback(() => {
    if (avatarBounceLockRef.current) return
    avatarBounceLockRef.current = true
    haptics('medium')
    setAvatarBouncing(true)
    setTimeout(() => {
      setAvatarBouncing(false)
      avatarBounceLockRef.current = false
    }, 420) // 360ms animation + settle margin
  }, [])
  useDidHide(() => {
    setPageVisible(false)
  })
  useDidShow(() => {
    setPageVisible(true)
    setAvatarBouncing(false)
    avatarBounceLockRef.current = false
    setJustUnlockedKeys([])
    setDuoDismissing(false)
    const isFirstShow = !hasDidShowRef.current
    if (isFirstShow) {
      hasDidShowRef.current = true
    }
    // P1-4 badge ledger detection lives in the data-ready effect below
    // (2026-10-24): running it here meant a cold show with stats still
    // loading skipped the read entirely — useDidShow never re-fires when
    // loading finishes, so the fresh-unlock celebration was lost on exactly
    // the cold-start moment it exists for.
    if (isFirstShow) {
      return
    }
    if (authLoading || !authUser) return
    // Auth feature flags are server-owned, while the auth query is cached indefinitely.
    // Refresh on Profile appearance so newly enabled equipment is visible on-device —
    // but at most once per staleness window so tab switches stay instant.
    if (!shouldRefreshOnShow('profile')) return
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'auth-user'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/profile'] })
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_COUNTS_KEY })
    if (profileV17DataPolicy.gamificationEnabled) {
      void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] })
    }
    if (profileV17DataPolicy.equipmentEnabled) {
      void queryClient.invalidateQueries({ queryKey: EQUIPMENT_ME_QUERY_KEY })
    }
  })

  const profileShellQuery = useQuery({
    queryKey: ['mini-program', 'shell/profile'],
    queryFn: () => getProfileShell(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 30_000,
  })
  // P0-2: cache-mirror of notification counts — Discover's active observer
  // is the single fetch loop (this reader never polls, enabled: false).
  // Fail-open: no cache yet → no badge. Profile useDidShow invalidates the
  // key; the refetch flows through Discover's live observer.
  const notificationCountsQuery = useQuery<NotificationCountsResponse>({
    queryKey: NOTIFICATION_COUNTS_KEY,
    enabled: false,
  })
  const notificationUnread = notificationCountsQuery.data?.total ?? 0

  // P1-5 quest line (PM memo §2): registrations come from the SAME cache key
  // the tab-bar sync already fetches app-wide — one shared fetch, no new
  // endpoint. Hide until loaded (fail-closed → no flash-then-hide for users
  // whose quest is already complete).
  const registrationsQuery = useQuery({
    queryKey: REGISTRATIONS_QUERY_KEY,
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 30_000,
  })

  const shellEventsJoined = profileShellQuery.data?.stats?.eventsJoined
  const shellSettled = profileShellQuery.isSuccess || profileShellQuery.isError
  const { data: joinedEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled:
      !authLoading &&
      !!authUser &&
      shellSettled &&
      (profileShellQuery.isError || shellEventsJoined == null),
  })

  const gamificationQuery = useQuery({
    queryKey: ['mini-program', 'gamification'],
    queryFn: () => getUserGamificationInfo(apiRequest),
    enabled: !authLoading && !!authUser && profileV17DataPolicy.gamificationEnabled,
    staleTime: 30_000,
  })
  const equipmentQuery = useQuery({
    queryKey: EQUIPMENT_ME_QUERY_KEY,
    queryFn: fetchMyEquipment,
    enabled: !authLoading && !!authUser && profileV17DataPolicy.equipmentEnabled,
    staleTime: 30_000,
  })

  // Hard UI deadline: a hung-but-reachable server can hold the request for the
  // full timeout × retry window (30s+). Past the deadline with no cached data,
  // fall back to the error state with a retry CTA instead of spinning forever.
  // Manual retry bumps the nonce to start a fresh deadline interval.
  const [equipmentRetryNonce, setEquipmentRetryNonce] = useState(0)
  // isLoading is true only while actively fetching with no cached data, so the
  // deadline starts exactly when the request begins and resets on each retry.
  const equipmentStalled = equipmentQuery.isLoading
  const equipmentSyncExpired = useSyncDeadline(equipmentStalled, equipmentRetryNonce)

  // Lightweight chapter-count teaser for the story card title. Key is scoped
  // with `profile-teaser` so it never collides with the personal-story page
  // query (`[...PERSONAL_STORY_QUERY_KEY, viewerKey]`).
  const personalStoryTeaserQuery = useQuery({
    queryKey: ['mini-program', 'personal-story', 'profile-teaser'],
    queryFn: () => apiRequest<PersonalStoryResponse>({
      path: '/api/personal-story',
      method: 'GET',
    }),
    enabled: !authLoading && !!authUser && profileV17DataPolicy.personalStoryEnabled,
    staleTime: 60_000,
    retry: 1,
  })

  const joinedEventsCount = profileShellQuery.data?.stats.eventsJoined ?? joinedEvents.length
  const connectionsCount = profileShellQuery.data?.stats.connectionsCount
  const isLoadingStats = isLoadingEvents || profileShellQuery.isLoading

  const displayName = authUser?.nickname || authUser?.displayName || '悦聚用户'
  const archetype = authUser?.archetype ?? authUser?.primaryArchetype ?? null
  const archetypeName = archetype ? (ARCHETYPE_BY_ID[archetype]?.nameCn || archetype) : null
  // P0-3: tribe family name + daily-rotating greeting (both keyed off the
  // resolved archetype; constants lived unused in profileConstants).
  const archetypeFamilyName = archetype ? (ARCHETYPE_FAMILY_NAME[archetype] ?? null) : null
  const dailyGreeting = useMemo(() => getDailyGreeting(archetype), [archetype])
  // A4-3 (full-marks Wave A): on an event day the greeting becomes concrete
  // (time + district) and replaces the daily rotation — one greeting concept
  // shared by the identity card and the large-title sub-line.
  const eventDayGreeting = useMemo(
    () => getEventDayGreeting(registrationsQuery.data),
    [registrationsQuery.data],
  )
  const greetingLine = eventDayGreeting ?? dailyGreeting

  const lifeStage = authUser?.lifeStage
  const bio = typeof authUser?.bio === 'string' ? authUser.bio.trim() : null
  const genderLabel = getGenderLabel(authUser?.gender)
  // P2-5: large-title sub-line — date + weekday; the daily greeting joins
  // ONLY when a real user bio occupies the identity card's bio slot (the
  // greeting never renders twice — UIUX memo §3).
  const largeTitleSub = useMemo(() => {
    const now = new Date()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dateLine = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
    return bio && greetingLine ? `${dateLine} · ${greetingLine}` : dateLine
  }, [bio, greetingLine])
  const profileCompletion = getProfileCompletion(authUser)
  const growth = getProfileGrowthSummary(
    gamificationQuery.data ?? {
      experiencePoints: authUser?.experiencePoints ?? 0,
      nextLevelInfo: null,
    },
  )
  const growthLevelLabel = gamificationQuery.data
    ? `Lv.${gamificationQuery.data.currentLevel} ${gamificationQuery.data.levelConfig?.nameCn ?? ''}`.trim()
    : '成长进度'
  const visibleGrowthProgress = gamificationQuery.data ? growth.progress : 0
  // P0-4 streak flame (UIUX memo §8): capsule joins the level-plate foot
  // row; hidden at streak 0 (no shaming). Teaser only when streak+1 hits a
  // real ladder rung (3/6/12 weeks → +200/+500/+1000, server-authoritative).
  const activityStreak = gamificationQuery.data?.activityStreak ?? 0
  const streakTeaser = useMemo(() => getStreakMilestoneTeaser(activityStreak), [activityStreak])
  // A5-1 (full-marks Wave A): continuation warning when the flame dies unless
  // the user attends THIS week — UTC-mirrored against the server week math,
  // so the line is never a lie. Wins the single sub-line slot over the
  // milestone teaser (urgency > aspiration).
  const streakContinuationTarget = useMemo(
    () => getStreakContinuationTarget(
      activityStreak,
      gamificationQuery.data?.lastActivityDate,
      gamificationQuery.data?.streakFreezeAvailable ?? false,
    ),
    [activityStreak, gamificationQuery.data],
  )

  // P1-5 quest line (PM memo §2): 4 steps live until the first 成行
  // (matched/completed registration), then hide forever — no dismiss button,
  // no storage. Signals: archetype set / bio non-empty / any registration /
  // matched-or-completed registration. Fail-closed while registrations load.
  const quest = useMemo(() => {
    if (!profileV17Enabled || !registrationsQuery.data) return null
    const registrations = registrationsQuery.data
    const registerDone = registrations.length > 0
    const matchedDone = registrations.some(
      (r) => r.matchStatus === 'matched' || r.matchStatus === 'completed',
    )
    if (matchedDone) return null
    return {
      registerDone,
      steps: [
        { key: 'assessment' as const, title: '完成氛围测试', done: archetype != null, cta: '去测试' },
        { key: 'bio' as const, title: '写一句聚会签名', done: !!bio && bio.trim().length > 0, cta: '去写一句' },
        { key: 'register' as const, title: '报名第一场局', done: registerDone, cta: '去挑一场' },
        { key: 'matched' as const, title: '首场成行', done: false, cta: null },
      ],
    }
  }, [profileV17Enabled, registrationsQuery.data, archetype, bio])

  // A5-2 (full-marks Wave A): next upcoming event — pending or matched with
  // the time still ahead — for the Act-2 one-line row.
  const nextRegistration = useMemo(
    () => getNextUpcomingRegistration(registrationsQuery.data),
    [registrationsQuery.data],
  )

  const handleQuestStepTap = useCallback((key: 'assessment' | 'bio' | 'register' | 'matched') => {
    haptics('light')
    if (key === 'assessment') {
      void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTest })
    } else if (key === 'bio') {
      void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
    } else if (key === 'register') {
      void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
    } else {
      void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
    }
  }, [])
  const equipmentInventory = equipmentQuery.data?.inventory ?? []
  const equipmentItemsById = new Map(equipmentInventory.map((entry) => [entry.item.id, entry.item]))
  const outfit = equipmentQuery.data?.outfit
  const equipmentState: 'ready' | 'loading' | 'error' = outfit
    ? 'ready'
    : equipmentQuery.isError || equipmentSyncExpired || (!!equipmentQuery.data && !equipmentQuery.isLoading)
      ? 'error'
      : 'loading'
  const equippedCount = outfit
    ? [outfit.topItemId, outfit.bottomItemId, outfit.shoesItemId, outfit.accessoryItemId].filter(Boolean).length
    : 0

  // W3 (2026-10-15, equipment guidance V1): open-claim signal driven by the
  // equipment/me entitlements. `equipmentGuidanceEligible` is the Q5 umbrella
  // gate — pixel avatar on AND equipment rewards on; every guidance surface
  // below (breathing dot, claim chip, C4 first-entitlement tip) stays dark
  // unless it is true. No per-item flags (Q5: one narrative, one switch).
  const pendingEntitlementCount = equipmentQuery.data?.pendingEntitlements?.length ?? 0
  const equipmentRewardsEnabled = authUser?.features?.equipmentRewardsEnabled === true
  const equipmentGuidanceEligible = pixelAvatarEnabled && equipmentRewardsEnabled
  const equipmentClaimPending = equipmentState === 'ready'
    && equipmentGuidanceEligible
    && pendingEntitlementCount > 0
  const equipmentClaimChipCopy = pendingEntitlementCount <= 3
    ? `${pendingEntitlementCount} 份装备待领`
    : '可领取'

  // P1-6 (PM memo §4 / UIUX memo §5): honest next-draw teasers inside the
  // frozen 112rpx bar — mode swaps, never new lines. Teaser = zero-inventory
  // users only (empty slots swap for the stepper); pity chip = collectors
  // with a partial guarantee. No rarity-progress, no weight leaks.
  const pityMisses = equipmentQuery.data?.wallet?.pityMisses ?? 0
  const showEquipmentTeaser = equipmentState === 'ready'
    && equipmentGuidanceEligible
    && !equipmentClaimPending
    && equipmentInventory.length === 0
  const showPityChip = equipmentState === 'ready'
    && equipmentGuidanceEligible
    && !equipmentClaimPending
    && equipmentInventory.length > 0
    && pityMisses > 0
  // Stepper stage: 1 = has an active registration (from the shared cache).
  // 赴约/反馈 segments need per-event dateTime + feedback state the client
  // does not reliably carry today → stage-1-only (memo §5 risk b fallback).
  const equipmentTeaserStage = (registrationsQuery.data?.length ?? 0) > 0 ? 1 : 0
  const equipmentTeaserCopy = equipmentTeaserStage >= 1
    ? '赴约并完成反馈，即可抽一件'
    : '报名一场局，结束后可抽一件'

  // P2-4 Duo 同桌卡 (PM memo §7 / UIUX memo §4): show only when the duo flag
  // is on AND the user holds a pending registration AND that pool is not
  // already duo-bound. Status fetch is lazy (earliest pending pool only);
  // dismissal = 72h per-pool storage snooze. Never mint codes here — the CTA
  // navigates to the invite page's duo lane (resolveInviteShareMode).
  const duoEnabled = authUser?.features?.duoRegistrationEnabled === true
  const duoPendingRegistration = useMemo(() => {
    if (!duoEnabled || !registrationsQuery.data) return null
    return registrationsQuery.data.find((r) => r.matchStatus === 'pending') ?? null
  }, [duoEnabled, registrationsQuery.data])
  const duoCardPoolId = duoPendingRegistration?.poolId ?? null
  const [duoDismissNonce, setDuoDismissNonce] = useState(0)
  const duoCardSnoozed = useMemo(
    () => (duoCardPoolId ? isDuoCardSnoozed(duoCardPoolId) : false),
    // duoDismissNonce re-reads storage right after a dismiss writes it.
    [duoCardPoolId, duoDismissNonce],
  )
  const duoStatusQuery = useQuery({
    queryKey: ['mini-program', 'duo-status', duoCardPoolId],
    queryFn: () => getDuoStatus(apiRequest, duoCardPoolId!),
    enabled: !!duoCardPoolId && !duoCardSnoozed && !authLoading && !!authUser,
    staleTime: 60_000,
    retry: 1,
  })
  const duoBound = duoStatusQuery.data?.state === 'bound'
  const [duoDismissing, setDuoDismissing] = useState(false)
  const showDuoCard = !!duoCardPoolId && !duoCardSnoozed && !duoBound

  const handleDuoInvite = useCallback(() => {
    haptics('medium')
    if (duoCardPoolId) {
      void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.invite}?poolId=${encodeURIComponent(duoCardPoolId)}` })
    }
  }, [duoCardPoolId])

  const handleDuoDismiss = useCallback(() => {
    haptics('light')
    setDuoDismissing(true)
    setTimeout(() => {
      if (duoCardPoolId) snoozeDuoCard(duoCardPoolId)
      setDuoDismissing(false)
      setDuoDismissNonce((nonce) => nonce + 1)
    }, 160) // exit fade duration
  }, [duoCardPoolId])

  const personalityActionLabel = getProfilePersonalityActionLabel(archetype)
  // P2-2 (PM memo §6): serialized story entry — title carries the latest
  // chapter's real title (chapters are ascending by chapterNumber, repo
  // verified), plus a badge for pending unwritten experiences.
  const storyChapters = personalStoryTeaserQuery.data?.story?.chapters ?? []
  const storyChapterCount = storyChapters.length
  const latestStoryChapterTitle = storyChapterCount > 0
    ? stripChapterDatePrefix(storyChapters[storyChapterCount - 1]?.title)
    : null
  // A2-3 (full-marks Wave A): the title also carries WHEN the latest chapter
  // was written — 「第 N 章 · {title} · M月D日写下」 (memo §6 spec).
  const latestStoryChapterOccurredAt = storyChapterCount > 0
    ? storyChapters[storyChapterCount - 1]?.occurredAt ?? null
    : null
  const latestChapterDateLabel = formatChapterDate(latestStoryChapterOccurredAt)
  const pendingStoryCount = personalStoryTeaserQuery.data?.pendingExperienceCount ?? 0

  // P0-5: 我的 tab dot = live pending-equipment-draw count. Passed live to
  // the tab-bar sync AND persisted so sibling tabs render the dot before
  // this page ever mounts (storage fallback, no extra fetches elsewhere).
  // The count drops to 0 when the draws are claimed (equipment query
  // invalidates on claim) — the dot clears itself.
  useCustomTabBarSync({
    enabled: !authLoading,
    profileBadgeCount: pendingEntitlementCount,
  })

  useEffect(() => {
    writeProfileTabDotCount(pendingEntitlementCount)
  }, [pendingEntitlementCount])

  // P0-1 entitlement strip (PM memo 2026-10-22 §1): factual readout pills —
  // pass (subscription days / 局票 credits) → coupons → 悦币. All three data
  // sources are already on-device (shell entitlement/coupons + gamification
  // joyCoins). Zero-asset state (null mode + 0券 + 0币) hides the whole
  // strip — no empty-wallet CTA pill (deleted alternative, memo §1c).
  const shellEntitlement = profileShellQuery.data?.entitlement ?? null
  const availableCouponCount = profileShellQuery.data?.coupons?.availableCount ?? 0
  const joyCoinCount = gamificationQuery.data?.joyCoins ?? 0
  const entitlementPills = useMemo(() => {
    const pills: Array<{ key: 'pass' | 'coupon' | 'coins'; label: string; value: string }> = []
    const mode = shellEntitlement?.mode ?? null
    if (mode === 'subscription' && shellEntitlement?.subscription) {
      const sub = shellEntitlement.subscription
      pills.push({
        key: 'pass',
        label: sub.planType === 'quarterly' ? '悦聚季卡' : '悦聚月卡',
        value: sub.daysRemaining === 0 ? '今天到期' : `剩 ${sub.daysRemaining} 天`,
      })
    } else if (mode === 'event_pack' && (shellEntitlement?.eventCredits ?? 0) > 0) {
      pills.push({ key: 'pass', label: '局票', value: `剩 ${shellEntitlement!.eventCredits} 张` })
    }
    if (availableCouponCount > 0) {
      pills.push({ key: 'coupon', label: '优惠券', value: `${availableCouponCount} 张可用` })
    }
    if (joyCoinCount > 0) {
      pills.push({ key: 'coins', label: '悦币', value: `${joyCoinCount}` })
    }
    return pills
  }, [shellEntitlement, availableCouponCount, joyCoinCount])

  const handleEntitlementPillTap = useCallback((pill: 'pass' | 'coupon' | 'coins') => {
    haptics('light')
    profileAnalytics.track('profile_entitlement_pill_tap', { pill })
    if (pill === 'pass') {
      void openMiniProgramPaymentPage({ currentUserId: authUser?.id })
      return
    }
    void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.rewards })
  }, [authUser?.id])

  // P6b milestones collapse (2026-09-14): the badge grid folds into a single
  // entry row; no dedicated milestones route exists in the app, so the row
  // expands the unlocked badges inline (accordion) instead of navigating.
  const [milestonesOpen, setMilestonesOpen] = useState(false)
  // P1-4: keys that unlocked since the ledger's last write — they get a
  // one-shot ring overlay in the expanded wall (cleared after 950ms).
  const [justUnlockedKeys, setJustUnlockedKeys] = useState<string[]>([])
  const unlockedMilestones = useMemo(
    () => MILESTONES.filter((milestone) => joinedEventsCount >= milestone.threshold),
    [joinedEventsCount],
  )
  // A5-3 (full-marks Wave A): proximity line in the entry summary — surfaces
  // only when the next badge is ≤ 3 events away (no far-away nagging).
  const badgeProximity = useMemo(() => getBadgeProximity(joinedEventsCount), [joinedEventsCount])
  // A4-4 + A6-2 (full-marks Wave A): a fresh unlock auto-expands the wall
  // once AND latches the poster glow until tapped. Ref-gated so the user can
  // still collapse the wall while the ring shows; the ref re-arms when the
  // unlock batch clears so the NEXT batch celebrates again.
  const badgeAutoExpandRef = useRef(false)
  const [posterGlow, setPosterGlow] = useState(false)
  useEffect(() => {
    if (justUnlockedKeys.length > 0 && !badgeAutoExpandRef.current) {
      badgeAutoExpandRef.current = true
      setMilestonesOpen(true)
      setPosterGlow(true)
    } else if (justUnlockedKeys.length === 0) {
      badgeAutoExpandRef.current = false
    }
  }, [justUnlockedKeys])

  // P1-4 badge ledger: baseline on the first READY read (never ring for
  // unlocks that predate the ledger); ring fresh unlocks as soon as data is
  // ready. Effect-keyed (not useDidShow-keyed) so a cold show whose stats
  // arrive after the show still celebrates — the ledger write makes this
  // idempotent, and re-reads after invalidation see fresh=[] and stay quiet.
  useEffect(() => {
    if (!authUser?.id || isLoadingStats) return
    const unlockedKeys = unlockedMilestones.map((milestone) => milestone.key)
    const seen = readSeenBadges(authUser.id)
    if (seen === null) {
      writeSeenBadges(authUser.id, unlockedKeys)
      return
    }
    const fresh = unlockedKeys.filter((key) => !seen.includes(key))
    if (fresh.length === 0) return
    haptics('success')
    setJustUnlockedKeys(fresh)
    writeSeenBadges(authUser.id, [...seen, ...fresh])
    const timer = setTimeout(() => setJustUnlockedKeys([]), 1000)
    return () => clearTimeout(timer)
  }, [authUser?.id, isLoadingStats, unlockedMilestones])

  const archetypeTagline = useMemo(() => {
    if (!archetype || !(archetype in archetypeRegistry)) return null
    return archetypeRegistry[archetype as keyof typeof archetypeRegistry]?.narrative.tagline ?? null
  }, [archetype])
  // P0-3: user's own bio always wins; the greeting (event-day concrete, else
  // daily rotation) beats the static tagline so the card says something fresh.
  const displayBio = bio || greetingLine || archetypeTagline || null

  // P2-3 形象名片 (PM memo §8): rebuilt on the compliant canvas pipeline —
  // pixel-avatar composite (archetype art fallback) + displayName + 家族名 +
  // 潮流值 + QR. City/age/interests/bio/referral are structurally excluded
  // from ProfileCardPosterInput; no incentive wording (诱导分享 ban).
  const profileCardShare = useProfileCardShare({
    enabled: !!archetype,
    card: {
      displayName,
      archetypeName,
      familyName: archetypeFamilyName,
      growthValue: gamificationQuery.data?.experiencePoints ?? null,
      tagline: archetypeTagline,
      pixelArchetypeId: pixelAvatarEnabled ? archetype : null,
      outfit,
      itemsById: equipmentItemsById,
      archetypeAsset: archetype ? (ARCHETYPE_ASSET_MAP[archetype]?.webp ?? null) : null,
    },
  })

  // Entrance stagger: the `--entered` modifiers are driven by mounted state so
  // the CSS transitions actually play. Delays live in SCSS (stage 0ms → stats
  // 80ms → story 160ms) and are suppressed under prefers-reduced-motion.
  const [hasEntered, setHasEntered] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), 16)
    return () => clearTimeout(timer)
  }, [])

  // Archetype foil frame (TeammateCard / PhaseHeroCard pattern): quiet tinted
  // border + soft ambient shadow, rgba only — WeChat WXSS drops hsla().
  const identityStageFoilStyle = useMemo(() => {
    if (!archetype) return undefined
    const hsl = getArchetypeHSL(archetype)
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.55),
      boxShadow: `0 16rpx 38rpx ${formatHSLAsRGBA(hsl, 0.24)}, inset 0 0 0 1rpx ${formatHSLAsRGBA(hsl, 0.14)}`,
    }
  }, [archetype])

  // P1-2 foil sweep (UIUX memo §11): one -45° band in the archetype hue
  // sweeps the identity stage once per page instance — the CSS animation
  // plays on mount and tab pages never remount on tab switch, so no replay.
  // Gradient is inline (hue is runtime); opacity edges hold it invisible at
  // rest/end. RM + degradation tier remove it entirely.
  const identityStageSweepStyle = useMemo(() => {
    if (!archetype) return undefined
    const hsl = getArchetypeHSL(archetype)
    return {
      background: `linear-gradient(-45deg, rgba(255, 255, 255, 0) 0%, ${formatHSLAsRGBA(hsl, 0.5)} 50%, rgba(255, 255, 255, 0) 100%)`,
    }
  }, [archetype])

  // Same accent family on the archetype tag (contrast-safe text on a soft tint).
  const archetypeTagStyle = useMemo(() => {
    if (!archetype) return undefined
    const hsl = getArchetypeHSL(archetype)
    return {
      color: getContrastSafeArchetypeColor(archetype),
      background: formatHSLAsRGBA(hsl, 0.12),
      borderColor: formatHSLAsRGBA(hsl, 0.2),
    }
  }, [archetype])

  // Archetype-tinted ring on the circle icon (falls back to the SCSS
  // secondary-pink ring when no archetype is resolved yet). rgba only —
  // WeChat WXSS drops hsla().
  const archetypeRingStyle = useMemo(() => {
    if (!archetype) return undefined
    const hsl = getArchetypeHSL(archetype)
    return { borderColor: formatHSLAsRGBA(hsl, 0.9) }
  }, [archetype])

  const handleOpenPersonalityType = async (source: 'v17_card' | 'fallback_row') => {
    haptics('light')
    profileAnalytics.track('profile_personality_action_tap', { source })

    const url = archetype
      ? `${MINI_PROGRAM_ROUTES.personalityTestResults}?source=profile`
      : `${MINI_PROGRAM_ROUTES.personalityTest}?source=profile`
    try {
      await Taro.navigateTo({ url })
    } catch (error) {
      logError('profile:open_personality_fail', { source, error: String(error) })
      void Taro.showToast({
        title: archetype ? '报告没有打开，请稍后再试' : '测评没有打开，请稍后再试',
        icon: 'none',
      })
    }
  }

  const handleOpenSettings = async () => {
    try {
      haptics('light')
    } catch {
      // Optional device feedback must never block the settings workflow.
    }
    try {
      await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.profileSettings })
    } catch {
      try {
        await Taro.showToast({
          title: '设置没有打开，请稍后再试',
          icon: 'none',
        })
      } catch {
        // Keep Profile usable if the platform toast is unavailable.
      }
    }
  }

  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  // Post-onboarding bio nudge (2026-08-18, R2-6): profile-review no longer
  // collects the 社交签名, so the profile tab gently prompts while the bio is
  // empty. Dismissal persists per user in local storage.
  const bioPromptStorageKey = authUser?.id
    ? `${BIO_PROMPT_DISMISS_STORAGE_PREFIX}:${authUser.id}`
    : null
  const [bioPromptDismissed, setBioPromptDismissed] = useState(false)
  useEffect(() => {
    if (!bioPromptStorageKey) return
    try {
      setBioPromptDismissed(Taro.getStorageSync(bioPromptStorageKey) === true)
    } catch {
      // Storage unavailable — leave the prompt visible for this session.
    }
  }, [bioPromptStorageKey])

  // A2-2 (full-marks Wave A): one ask per screen — while the quest line
  // renders, its bio step already carries the same ask, so the nudge hides.
  const showBioPrompt = !authLoading
    && authUser?.hasSeenProfileReview === true
    && !bio
    && !bioPromptDismissed
    && !quest

  const handleBioPromptTap = () => {
    haptics('light')
    void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
  }

  const handleBioPromptDismiss = () => {
    haptics('light')
    setBioPromptDismissed(true)
    if (bioPromptStorageKey) {
      try {
        Taro.setStorageSync(bioPromptStorageKey, true)
      } catch {
        // Non-fatal — the prompt simply reappears next session.
      }
    }
  }

  // ── Guidance queue dock (C4 queue, profile surface) ──
  // P6 (2026-09-11): first-visit explainer — 专属形象 / 当前装备 / 潮流值.
  // W3 (2026-10-15): first-entitlement nudge — fires ONCE on the first open
  // claim (priority 15, preempts P6 by ordering; P6 then runs next session),
  // profile-surface only; recurring claims ride the breathing dot instead.
  // The queue hook owns the flag gate (features.guidanceQueueEnabled),
  // arbitration, 6s dwell, and the server-persisted seen-write; the card is
  // docked above the tab bar as an overlay so it never pushes page content
  // down (zero-scroll policy). Entitlement data re-arrives async with the
  // equipment query, so the trigger context is re-evaluated when it lands.
  const {
    activeTip: profileGuidanceTip,
    exiting: profileGuidanceTipExiting,
    dismiss: dismissProfileGuidanceTip,
  } = useGuidanceQueue({
    surface: 'profile',
    user: authUser,
    pendingEntitlements: pendingEntitlementCount,
    equipmentGuidanceEligible: equipmentGuidanceEligible,
  })
  // Copy derives from the ACTIVE tip so both queue tips share one dock with
  // their own copy blocks (the fixed P6 key was the single-tip era).
  const profileGuidanceCopy = useMemo(
    () => getGuidanceTipCopy(profileGuidanceTip?.copyKey ?? 'profile_first_visit'),
    [profileGuidanceTip?.copyKey],
  )
  const profileTipShowing = profileGuidanceTip != null
  const profileTipMascot = useMemo(() => getXiaoyueExpressionAsset('homeWelcome'), [])
  const profileTipMascotFallback = useMemo(
    () => localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp'),
    [],
  )
  const [profileTipMascotError, setProfileTipMascotError] = useState(false)

  // W3 funnel (Q6): the claim signal re-applies across sessions, so 'shown'
  // fires once per session per pending-count value (ref-deduped); enter and
  // tap analytics are attached at the claim chip + card wiring below.
  const shownEntitlementCountsRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (!equipmentGuidanceEligible || pendingEntitlementCount <= 0) return
    if (shownEntitlementCountsRef.current.has(pendingEntitlementCount)) return
    shownEntitlementCountsRef.current.add(pendingEntitlementCount)
    discoverAnalytics.track('equipment_entitlement_prompt_shown', undefined, {
      pendingEntitlements: pendingEntitlementCount,
    })
  }, [equipmentGuidanceEligible, pendingEntitlementCount])

  return renderGate(
    <View className={`profile-page ${tabEntranceClass}${navCondensed ? ' profile-page--scrolled' : ''}`}>
      <View
        className='profile-page__nav'
        data-testid='profile-top-navigation'
      >
        <Text className='profile-page__nav-title'>我的</Text>
        {/* P0-2 notification bell — mirrors Discover's anatomy (72rpx circle,
            primary badge pill, 9+ cap); absolute so the centered title is
            untouched. Badge hidden at 0 unread. */}
        <View
          className='profile-page__nav-bell'
          hoverClass='profile-page__nav-bell--active'
          onClick={() => {
            haptics('light')
            Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.notifications }).catch(() => {})
          }}
          role='button'
          aria-label={notificationUnread > 0 ? `通知，${notificationUnread} 条未读` : '通知'}
          data-testid='profile-notification-bell'
        >
          <JoyJoinIcon emoji='🔔' tier='semantic' size={22} />
          {/* UIUX memo §7: cap is deliberately 「9+」 (>9), NOT Discover's
              99+ — pre-flagged divergence, do not "fix" back. */}
          {notificationUnread > 0 ? (
            <View className='profile-page__nav-bell-badge' aria-hidden='true'>
              <Text className='profile-page__nav-bell-badge-text'>
                {notificationUnread > 9 ? '9+' : notificationUnread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <ScrollView
        className='profile-page__scroll'
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={handleScroll}
      >
        {/* P2-5 iOS large title: scrolls away under the condensing nav; the
            sub-line is date + weekday, plus the daily greeting ONLY when a
            real bio occupies the identity card (greeting never renders twice
            — UIUX memo §3 dedupe rule). */}
        <View className='profile-page__large-title' data-testid='profile-large-title'>
          <Text className='profile-page__large-title-text'>我的</Text>
          <Text className='profile-page__large-title-sub'>{largeTitleSub}</Text>
        </View>
        {profileV17Enabled ? (
          <View
            className={`profile-page__identity-stage${hasEntered ? ' profile-page__identity-stage--entered' : ''}`}
            style={identityStageFoilStyle}
            data-testid='profile-v4'
          >
            {/* aspectFill: the stage is near-square since 2026-08-01 (728rpx
                tall) — crop the wide street art instead of stretching it. */}
            <IdentityStageScene absoluteAvatar={false} layerImageMode='aspectFill'>
              {/* Left rail owns the vertical layout of both glass cards, so a
                  tall identity card can never paint over the growth card. */}
              <View
                className={`profile-page__identity-rail${pixelAvatarEnabled ? '' : ' profile-page__identity-rail--no-entry'}`}
              >
              {/* Readable glass card for the identity copy (top-left).
                  Whole card is the basic-profile hub: tap → 回看氛围报告. */}
              <View
                className='profile-page__identity-copy-card'
                hoverClass='profile-page__identity-copy-card--pressed'
                onClick={() => { void handleOpenPersonalityType('v17_card') }}
                role='button'
                aria-label={archetypeName ? `回看 ${archetypeName} 的氛围报告` : '测测你的氛围原型'}
                data-testid='profile-identity-copy-card'
              >
                <View className='profile-page__identity-copy'>
                  {/* Archetype circle icon is always rendered as the user's
                      class mark, independent of the pixel avatar. */}
                  <View className='profile-page__identity-avatar' style={archetypeRingStyle}>
                    <ArchetypeHead
                      archetype={archetype}
                      size={92}
                      fallbackText={displayName}
                    />
                  </View>
                  <View className='profile-page__identity-text'>
                    <Text className='profile-page__identity-name'>{displayName}</Text>
                    <View className='profile-page__identity-tags'>
                      {archetypeName && (
                        <Text
                          className='profile-page__identity-tag profile-page__identity-tag--primary'
                          style={archetypeTagStyle}
                        >
                          {archetypeName}
                        </Text>
                      )}
                      {archetypeFamilyName && (
                        <Text className='profile-page__identity-tag profile-page__identity-tag--family'>
                          {archetypeFamilyName}
                        </Text>
                      )}
                      {lifeStage && (
                        <Text className='profile-page__identity-tag'>{lifeStage}</Text>
                      )}
                      {genderLabel && (
                        <Text className='profile-page__identity-tag'>{genderLabel}</Text>
                      )}
                    </View>
                    {displayBio && (
                      <Text className={`profile-page__identity-bio${!bio && dailyGreeting ? ' profile-page__identity-bio--daily' : ''}`}>
                        {displayBio}
                      </Text>
                    )}
                    {!showBioPrompt && (
                      <View className='profile-page__identity-affordance' aria-hidden='true'>
                        <Text className='profile-page__identity-affordance-text'>
                          {archetypeName ? '回看报告' : '测测你的氛围原型'}
                        </Text>
                        <View className='profile-page__identity-affordance-chevron' />
                      </View>
                    )}
                  </View>
                </View>

                {/* P6b density redesign (2026-09-14): the bio nudge is merged
                    into the identity card as a full-width footer action strip,
                    replacing the 回看报告 affordance line while active — no
                    standalone banner section below the stats. Full-width (not
                    inside the narrow text column) so the pill and the dismiss
                    × both fit without truncation. stopPropagation keeps the
                    card's own report navigation from firing on nudge taps. */}
                {showBioPrompt && (
                  <View
                    className='profile-page__identity-nudge'
                    data-testid='profile-bio-prompt'
                  >
                    <View
                      className='profile-page__identity-nudge-action'
                      hoverClass='profile-page__identity-nudge-action--pressed'
                      onClick={(event) => {
                        event.stopPropagation()
                        handleBioPromptTap()
                      }}
                      role='button'
                      aria-label='去写一句聚会签名'
                      data-testid='profile-bio-prompt-cta'
                    >
                      <Text className='profile-page__identity-nudge-text'>写一句聚会签名</Text>
                      <View className='profile-page__identity-nudge-chevron' aria-hidden='true' />
                    </View>
                    <View
                      className='profile-page__identity-nudge-dismiss'
                      hoverClass='profile-page__identity-nudge-dismiss--pressed'
                      onClick={(event) => {
                        event.stopPropagation()
                        handleBioPromptDismiss()
                      }}
                      role='button'
                      aria-label='暂时不用，关闭提示'
                      data-testid='profile-bio-prompt-dismiss'
                    >
                      <View className='profile-page__identity-nudge-dismiss-icon' aria-hidden='true' />
                    </View>
                  </View>
                )}
              </View>

              {/* Readable glass card for growth stats (bottom-left) */}
              <View className='profile-page__growth-card'>
                <View
                  className='profile-page__growth'
                  aria-label={gamificationQuery.isLoading
                    ? '潮流值正在加载'
                    : `潮流值 ${growth.current}，${visibleGrowthProgress}%`}
                >
                  <View className='profile-page__growth-heading'>
                    <Text className='profile-page__growth-label'>潮流值</Text>
                    {gamificationQuery.isLoading ? (
                      <Text className='profile-page__growth-value'>—</Text>
                    ) : (
                      <CountUpText
                        className='profile-page__growth-value'
                        value={growth.current}
                        {...PROFILE_COUNT_UP_OPTS}
                      />
                    )}
                    {!gamificationQuery.isLoading && growth.nextTarget !== null && (
                      <Text className='profile-page__growth-target'>/{growth.nextTarget}</Text>
                    )}
                  </View>
                  <View className='profile-page__growth-progress'>
                    <View
                      className='profile-page__growth-progress-bar'
                      style={{
                        transform: `scaleX(${visibleGrowthProgress / 100})`,
                      }}
                    >
                      <View className='profile-page__growth-progress-sheen' aria-hidden='true' />
                    </View>
                  </View>
                  {/* Level plate doubles as the gamification error surface:
                      error copy stays a plain text line, never on the plate. */}
                  {gamificationQuery.isError ? (
                    <Text className='profile-page__growth-level'>成长记录稍后会自动刷新</Text>
                  ) : (
                    <View className='profile-page__growth-foot'>
                      <View className='profile-page__level-plate'>
                        <View className='profile-page__level-plate-spark' aria-hidden='true' />
                        <Text className='profile-page__level-plate-text'>{growthLevelLabel}</Text>
                      </View>
                      {activityStreak > 0 && (
                        <View
                          className={`profile-page__streak-capsule${streakTeaser || streakContinuationTarget != null ? ' profile-page__streak-capsule--near-milestone' : ''}`}
                          data-testid='profile-streak-capsule'
                          hoverClass='profile-page__streak-capsule--pressed'
                          onClick={() => {
                            haptics('light')
                            profileAnalytics.track('profile_streak_capsule_tap', { streakWeeks: activityStreak })
                            void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
                          }}
                          role='button'
                          aria-label={`连续 ${activityStreak} 周，去活动页保持连击`}
                        >
                          <View className='profile-page__streak-main'>
                            <JoyJoinIcon emoji='🔥' tier='chemistry' size={28} className='profile-page__streak-icon' />
                            <Text className='profile-page__streak-text'>连续 {activityStreak} 周</Text>
                          </View>
                          {streakContinuationTarget != null ? (
                            <Text className='profile-page__streak-hint'>再 1 场续到 {streakContinuationTarget} 周</Text>
                          ) : streakTeaser ? (
                            <Text className='profile-page__streak-hint'>再 1 周，潮流值 +{streakTeaser.xp}</Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              </View>

              {/* Avatar anchored on the plaza with a warm platform shadow.
                  P1-1: tap it — squash&stretch bounce + halo + one haptic. */}
              <View
                className={`profile-page__partner-visual${pixelAvatarEnabled ? '' : ' profile-page__partner-visual--no-entry'}${avatarBouncing ? ' profile-page__partner-visual--tapped' : ''}`}
              >
                <View
                  className={`profile-page__partner-platform${deviceTier.isDegradation ? ' profile-page__partner-platform--no-pulse' : ''}`}
                  aria-hidden='true'
                />
              <View
                className='profile-page__partner-touch'
                onClick={handlePartnerTap}
                role='button'
                aria-label='和搭子打个招呼'
                data-testid='profile-partner-touch'
              >
                <View className='profile-page__partner-halo' aria-hidden='true' />
              <View
                className={`profile-page__partner-breath${deviceTier.isDegradation ? ' profile-page__partner-breath--no-breath' : ''}`}
                data-testid='profile-partner-breath'
              >
                <ProfilePartnerVisual
                  key={archetype ?? 'profile-partner-fallback'}
                  archetype={archetype}
                  archetypeName={archetypeName}
                  displayName={displayName}
                  pixelEnabled={pixelAvatarEnabled}
                  equipmentState={equipmentState}
                  outfit={outfit}
                  itemsById={equipmentItemsById}
                  onRetryEquipment={() => {
                    setEquipmentRetryNonce((nonce) => nonce + 1)
                    void equipmentQuery.refetch()
                  }}
                />
              </View>
              </View>
              </View>

              {pixelAvatarEnabled && (
                <View
                  className={`profile-page__partner-entry${equipmentClaimPending ? ' profile-page__partner-entry--claimable' : ''}`}
                  hoverClass='profile-page__partner-entry--pressed'
                  onClick={() => {
                    haptics('light')
                    if (equipmentClaimPending) {
                      discoverAnalytics.track('equipment_entitlement_prompt_tap', undefined, {
                        pendingEntitlements: pendingEntitlementCount,
                      })
                    }
                    Taro.navigateTo({
                      url: MINI_PROGRAM_ROUTES.myImage,
                      success: () => {
                        logInfo('profile:open_my_image_success')
                      },
                      fail: (error) => {
                        logError('profile:open_my_image_fail', { error: String(error) })
                        void Taro.showToast({
                          title: '形象加载失败，请稍后重试',
                          icon: 'none',
                        })
                      },
                    })
                  }}
                  role='button'
                  aria-label='进入我的形象与装备'
                  data-testid='profile-partner-equipment-entry'
                >
                  <View
                    className='profile-page__equipment-preview'
                    aria-label={equipmentState === 'ready'
                      ? `当前装备 ${equippedCount} 件`
                      : equipmentState === 'error'
                        ? '当前装备同步失败'
                        : '当前装备正在同步'}
                  >
                    {/* 2026-10-24 render pass: the strip has ~606rpx of inner
                        width. A status chip (claim or pity) replaces the
                        decorative label so slots + action never collide. */}
                    {!equipmentClaimPending && !showPityChip && (
                      <Text className='profile-page__equipment-label'>当前装备</Text>
                    )}
                    {equipmentClaimPending ? (
                      // W3 claim signal (warm-gold dot + chip) temporarily
                      // swaps the plain inventory count — the pending claim
                      // is the more actionable fact at this moment; the count
                      // returns inside my-image and after claiming.
                      <View className='profile-page__equipment-claim-signal' role='presentation'>
                        <View
                          className='profile-page__equipment-wait-dot'
                          aria-hidden='true'
                          data-testid='profile-equipment-wait-dot'
                        />
                        <Text
                          className='profile-page__equipment-wait-chip'
                          data-testid='profile-equipment-wait-chip'
                          aria-label={`${equipmentClaimChipCopy}，进入我的形象与装备开启`}
                        >
                          {equipmentClaimChipCopy}
                        </Text>
                      </View>
                    ) : equipmentState === 'ready' && (
                      <>
                        {!showPityChip && (
                          <Text className='profile-page__partner-entry-count'>
                            {`${equipmentInventory.length} 件`}
                          </Text>
                        )}
                        {showPityChip && (
                          <Text
                            className={`profile-page__equipment-pity-chip${pityMisses >= 3 ? ' profile-page__equipment-pity-chip--guaranteed' : ''}`}
                            data-testid='profile-equipment-pity-chip'
                          >
                            {pityMisses >= 3 ? '下一抽必得新装备' : `新装备保底 ${pityMisses}/3`}
                          </Text>
                        )}
                      </>
                    )}
                    {equipmentState === 'ready' && equipmentQuery.isError && (
                      <Text className='profile-page__equipment-cache-badge'>上次同步</Text>
                    )}
                    {equipmentState === 'ready' ? (
                      showEquipmentTeaser ? (
                        <View className='profile-page__equipment-teaser' data-testid='profile-equipment-teaser'>
                          <Text className='profile-page__equipment-teaser-copy'>{equipmentTeaserCopy}</Text>
                          <View className='profile-page__equipment-teaser-track' aria-hidden='true'>
                            {[0, 1, 2].map((segment) => (
                              <View
                                key={segment}
                                className={`profile-page__equipment-teaser-segment${segment < equipmentTeaserStage ? ' profile-page__equipment-teaser-segment--lit' : ''}`}
                              />
                            ))}
                          </View>
                        </View>
                      ) : (
                      <View className='profile-page__equipment-slots'>
                        {(['top', 'bottom', 'shoes', 'accessory'] as const).map((slot) => {
                          const itemId = outfit?.[`${slot}ItemId`]
                          const item = itemId ? equipmentItemsById.get(itemId) : undefined
                          const artworkUrl = item && archetype
                            ? getPixelEquipmentThumbnailUrl(item.assetKey, archetype)
                            : null
                            return (
                            <View
                              key={slot}
                              className={`profile-page__equipment-slot${item ? ' profile-page__equipment-slot--filled' : ''}${item?.rarity === 'rare' ? ` profile-page__equipment-slot--rare${deviceTier.isDegradation ? ' profile-page__equipment-slot--rare-static' : ''}` : ''}`}
                              aria-label={item ? item.name : `空${slot}装备槽`}
                            >
                                {item
                                  ? (
                                    <EquipmentPreviewArtwork
                                      item={item}
                                      artworkUrl={artworkUrl}
                                    />
                                  )
                                  : <View className='profile-page__equipment-slot-mark' />}
                            </View>
                          )
                        })}
                      </View>
                      )
                    ) : (
                      <Text className={`profile-page__equipment-state-copy profile-page__equipment-state-copy--${equipmentState}`}>
                        {equipmentState === 'error' ? '待重试' : '同步中…'}
                      </Text>
                    )}
                  </View>
                  <View className='profile-page__partner-entry-action'>
                    <Text className='profile-page__partner-entry-action-text'>我的形象</Text>
                    <View className='profile-page__partner-entry-chevron' />
                  </View>
                </View>
              )}
            </IdentityStageScene>

            {/* P1-2 foil sweep (UIUX memo §11): one -45° band in the
                archetype hue crosses the stage once per page instance
                (mount-only; no tab-switch replay). Overlay sibling above all
                stage content (z-8), pointer-events none, RM/degradation off. */}
            {archetype && !deviceTier.isDegradation && (
              <View
                className='profile-page__identity-foil-sweep'
                style={identityStageSweepStyle}
                aria-hidden='true'
                data-testid='profile-foil-sweep'
              />
            )}
          </View>
        ) : (
          <View
            className='profile-page__fallback-hero'
            role='region'
            aria-label='个人资料简洁模式'
          >
            <View className='profile-page__fallback-avatar'>
              <ArchetypeHead
                archetype={archetype}
                size={136}
                fallbackText={displayName}
              />
            </View>
            <View className='profile-page__fallback-copy'>
              <Text className='profile-page__fallback-name'>{displayName}</Text>
              <Text className='profile-page__fallback-subtitle'>
                {archetypeName ?? '氛围原型等待解锁'}
              </Text>
              {bio && <Text className='profile-page__fallback-bio'>{bio}</Text>}
              <View
                className='profile-page__fallback-personality'
                hoverClass='profile-page__fallback-personality--pressed'
                onClick={() => { void handleOpenPersonalityType('fallback_row') }}
                role='button'
                aria-label={personalityActionLabel}
              >
                <Text className='profile-page__fallback-personality-text'>
                  {personalityActionLabel}
                </Text>
                <View className='profile-page__fallback-personality-chevron' aria-hidden='true' />
              </View>
            </View>
          </View>
        )}

        {/* Act 2 我有什么 — structural wrapper (craft pass 2026-10-24):
            owns the 24rpx intra-act gaps and the 40rpx Act-2 → Act-3 gap, so
            the rhythm survives EVERY optional-module combination (previously
            the act gap lived on conditional milestones and vanished for new
            users). Children carry horizontal margins only. */}
        <View className='profile-page__act-two'>
        {/* P0-1 entitlement strip: factual readout pills; hidden when the
            user holds zero assets (no empty-wallet CTA — PM memo §1c). */}
        {entitlementPills.length > 0 && (
          <View className='profile-page__entitlement-strip' data-testid='profile-entitlement-strip'>
            {entitlementPills.map((pill) => (
              <View
                key={pill.key}
                className='profile-page__entitlement-pill'
                hoverClass='profile-page__entitlement-pill--pressed'
                onClick={() => handleEntitlementPillTap(pill.key)}
                role='button'
                aria-label={`${pill.label} ${pill.value}`}
                data-testid={`profile-entitlement-pill-${pill.key}`}
              >
                {pill.key === 'coins' ? (
                  <View className='profile-page__entitlement-pill-icon profile-page__entitlement-pill-icon--coin' aria-hidden='true'>
                    <View className='profile-page__entitlement-pill-coin-dot' />
                  </View>
                ) : (
                  <JoyJoinIcon
                    emoji={pill.key === 'pass' ? '🎫' : '🎟️'}
                    tier='ui'
                    size={36}
                    className='profile-page__entitlement-pill-icon'
                  />
                )}
                <View className='profile-page__entitlement-pill-text'>
                  <Text className='profile-page__entitlement-pill-label'>{pill.label}</Text>
                  <Text className='profile-page__entitlement-pill-value'>{pill.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* P2-1 (UIUX memo §2): the three tinted stat cards demote to ONE
            compact data band — Act 2 我有什么: entitlement strip → band →
            badge wall. Numbers still count up (memo §9); taps unchanged. */}
        <View className='profile-page__data-band' data-testid='profile-data-band'>
          <View
            className='profile-page__data-band-cell'
            hoverClass='profile-page__data-band-cell--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
            role='button'
            aria-label={`已参加 ${joinedEventsCount} 场活动，去浏览足迹`}
          >
            {isLoadingStats ? (
              <Text className='profile-page__data-band-value'>—</Text>
            ) : (
              <CountUpText
                className='profile-page__data-band-value'
                value={joinedEventsCount}
                {...PROFILE_COUNT_UP_OPTS}
              />
            )}
            <Text className='profile-page__data-band-label'>已参加活动</Text>
          </View>
          <View className='profile-page__data-band-divider' aria-hidden='true' />
          <View
            className='profile-page__data-band-cell'
            hoverClass='profile-page__data-band-cell--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.connections }) }}
            role='button'
            aria-label={connectionsCount == null ? '连接数正在加载' : `已有 ${connectionsCount} 个连接，去查看`}
          >
            {profileShellQuery.isLoading || connectionsCount == null ? (
              <Text className='profile-page__data-band-value'>—</Text>
            ) : (
              <CountUpText
                className='profile-page__data-band-value'
                value={connectionsCount}
                {...PROFILE_COUNT_UP_OPTS}
              />
            )}
            <Text className='profile-page__data-band-label'>我的连接</Text>
          </View>
          <View className='profile-page__data-band-divider' aria-hidden='true' />
          <View
            className='profile-page__data-band-cell'
            hoverClass='profile-page__data-band-cell--pressed'
            onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile }) }}
            role='button'
            aria-label={`资料完成度 ${profileCompletion}%，${profileCompletion >= 100 ? '查看资料' : '去完善资料'}`}
          >
            <View className='profile-page__data-band-value-row'>
              <CountUpText
                className='profile-page__data-band-value'
                value={profileCompletion}
                {...PROFILE_COUNT_UP_OPTS}
              />
              <Text className='profile-page__data-band-suffix'>%</Text>
            </View>
            <Text className='profile-page__data-band-label'>资料完成度</Text>
            <View className='profile-page__data-band-mini-progress' aria-hidden='true'>
              <View
                className='profile-page__data-band-mini-progress-bar'
                style={{ transform: `scaleX(${profileCompletion / 100})` }}
              />
            </View>
          </View>
        </View>

        {/* A5-2 (full-marks Wave A): next-event one-line row — concrete
            forward motion in Act 2. Pending → matching-status (live status);
            matched → events tab. No entrance animation: the row appears with
            late-arriving registration data and must not flash. */}
        {profileV17Enabled && nextRegistration && (
          <View
            className='profile-page__next-event'
            hoverClass='profile-page__next-event--pressed'
            onClick={() => {
              haptics('light')
              profileAnalytics.track('profile_next_event_tap', {
                matchStatus: nextRegistration.matchStatus ?? 'pending',
              })
              if (nextRegistration.matchStatus === 'pending') {
                void Taro.navigateTo({
                  url: `${MINI_PROGRAM_ROUTES.matchingStatus}?registrationId=${encodeURIComponent(nextRegistration.id)}`,
                })
              } else {
                void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
              }
            }}
            role='button'
            aria-label={`下一场活动，${formatEventDateShort(nextRegistration.finalDateTime ?? nextRegistration.poolDateTime)}`}
            data-testid='profile-next-event'
          >
            <View className='profile-page__next-event-dot' aria-hidden='true' />
            <Text className='profile-page__next-event-text'>
              {`下一场 · ${formatEventDateShort(nextRegistration.finalDateTime ?? nextRegistration.poolDateTime)}${nextRegistration.poolDistrict ? ` · ${nextRegistration.poolDistrict}` : ''}`}
            </Text>
            <View className='profile-page__next-event-chevron' aria-hidden='true' />
          </View>
        )}

        {profileV17Enabled && !isLoadingStats && joinedEventsCount >= 1 && (
          <View className='profile-page__milestones'>
            {/* P6b density redesign: badge grid collapsed to a single entry
                row (icon + title + unlock summary + chevron). No dedicated
                milestones route exists in the app, so the row expands the
                unlocked badge cards inline as an accordion. */}
            <View
              className='profile-page__milestones-entry'
              hoverClass='profile-page__milestones-entry--pressed'
              onClick={() => {
                haptics('light')
                const nextOpen = !milestonesOpen
                profileAnalytics.track('profile_milestone_tap', {
                  action: nextOpen ? 'expand' : 'collapse',
                })
                setMilestonesOpen(nextOpen)
              }}
              role='button'
              aria-expanded={milestonesOpen}
              aria-label={`成就徽章，已点亮 ${unlockedMilestones.length} 枚，共 ${MILESTONES.length} 枚`}
              data-testid='profile-milestones-entry'
            >
              <Image
                className='profile-page__milestones-entry-icon'
                src={MILESTONE_BADGES.firstEvent}
                mode='aspectFit'
                lazyLoad
                aria-hidden='true'
              />
              <View className='profile-page__milestones-entry-text'>
                <Text className='profile-page__milestones-entry-title'>成就徽章</Text>
                <Text className='profile-page__milestones-entry-summary'>
                  {`已点亮 ${unlockedMilestones.length}/${MILESTONES.length} 枚${badgeProximity ? ` · 再 ${badgeProximity.remaining} 场点亮${badgeProximity.label}` : ''}`}
                </Text>
              </View>
              <View
                className={`profile-page__milestones-entry-chevron${milestonesOpen ? ' profile-page__milestones-entry-chevron--open' : ''}`}
                aria-hidden='true'
              />
            </View>
            {milestonesOpen && (
              <View className='profile-page__milestones-row profile-page__milestones-row--five-up'>
                {MILESTONES.map((milestone) => {
                  const unlocked = joinedEventsCount >= milestone.threshold
                  const justUnlocked = justUnlockedKeys.includes(milestone.key)
                  const remaining = milestone.threshold - joinedEventsCount
                  return (
                    <View
                      key={milestone.key}
                      className={[
                        'profile-page__milestone',
                        unlocked ? '' : 'profile-page__milestone--locked',
                        justUnlocked ? 'profile-page__milestone--just-unlocked' : '',
                      ].filter(Boolean).join(' ')}
                      hoverClass={unlocked ? 'profile-page__milestone--pressed' : undefined}
                      onClick={unlocked ? () => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) } : undefined}
                      role={unlocked ? 'button' : undefined}
                      aria-label={unlocked
                        ? `${milestone.label}，已点亮，去浏览足迹`
                        : `${milestone.label}，未点亮，还差 ${remaining} 场`}
                      data-testid={`profile-milestone-${milestone.key}`}
                    >
                      <View className='profile-page__milestone-badge-wrap'>
                        {milestone.badge ? (
                          <Image
                            className={`profile-page__milestone-img${unlocked ? '' : ' profile-page__milestone-img--locked'}`}
                            mode='aspectFit'
                            src={milestone.badge}
                            lazyLoad
                          />
                        ) : (
                          // Batch-D2 art pending → CSS medallion (locked:
                          // dashed + lock glyph; unlocked: solid gold fill).
                          <View
                            className={`profile-page__milestone-medallion${unlocked ? ' profile-page__milestone-medallion--unlocked' : ''}`}
                            aria-hidden='true'
                          >
                            {!unlocked && <JoyJoinIcon emoji='🔒' tier='ui' size={20} />}
                          </View>
                        )}
                        {!unlocked && milestone.badge && (
                          <View className='profile-page__milestone-lock' aria-hidden='true'>
                            <JoyJoinIcon emoji='🔒' tier='ui' size={16} />
                          </View>
                        )}
                        {justUnlocked && (
                          <View className='profile-page__milestone-unlock-ring' aria-hidden='true' />
                        )}
                      </View>
                      <Text className='profile-page__milestone-label'>{milestone.label}</Text>
                      {!unlocked && (
                        <Text className='profile-page__milestone-hint'>还差 {remaining} 场</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
        </View>

        {/* P2-4 Duo 同桌卡 (PM memo §7 copy, UIUX memo §4 Act-3 top):
            stage-glass material family, contextual — renders only while a
            pending registration exists and the pool is not duo-bound. */}
        {showDuoCard && (
          <View
            className={`profile-page__duo-card${duoDismissing ? ' profile-page__duo-card--dismissing' : ''}`}
            data-testid='profile-duo-card'
          >
            <View className='profile-page__duo-card-icon' aria-hidden='true'>
              <JoyJoinIcon emoji='👥' tier='ui' size={40} />
            </View>
            <View className='profile-page__duo-card-text'>
              <Text className='profile-page__duo-card-headline'>你报名的那场局，还差一位同桌</Text>
              <Text className='profile-page__duo-card-sub'>邀个朋友一起报名，就能排进同一桌</Text>
            </View>
            <View
              className='profile-page__duo-card-cta'
              hoverClass='profile-page__duo-card-cta--pressed'
              onClick={handleDuoInvite}
              role='button'
              aria-label='邀请同桌'
              data-testid='profile-duo-card-cta'
            >
              <Text className='profile-page__duo-card-cta-text'>邀请同桌</Text>
            </View>
            <View
              className='profile-page__duo-card-dismiss'
              hoverClass='profile-page__duo-card-dismiss--pressed'
              onClick={(event) => {
                event.stopPropagation()
                handleDuoDismiss()
              }}
              role='button'
              aria-label='暂时收起'
              data-testid='profile-duo-card-dismiss'
            >
              <View className='profile-page__duo-card-dismiss-icon' aria-hidden='true' />
            </View>
          </View>
        )}

        {profileV17DataPolicy.personalStoryEnabled && (
          <View
            className={`profile-page__archive${hasEntered ? ' profile-page__archive--entered' : ''}`}
            data-testid='profile-growth-archive'
          >
            <View className='profile-page__archive-heading'>
              <View className='profile-page__archive-title-wrap'>
                <View className='profile-page__archive-spark' aria-hidden='true' />
                <Text className='profile-page__archive-title'>我的故事</Text>
              </View>
              {/* Non-interactive privacy badge — the story card itself is the only entry. */}
              <View className='profile-page__archive-link'>
                <Text className='profile-page__archive-link-text'>仅自己可见</Text>
              </View>
            </View>
            <View
              className='profile-page__story-card'
              hoverClass='profile-page__story-card--pressed'
              onClick={() => {
                haptics('light')
                void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalStory })
              }}
              role='button'
              data-testid='profile-story-entry'
              aria-label='进入我的连续故事'
            >
              <ProfileStoryArtwork paused={!pageVisible} noDrift={deviceTier.isDegradation} />
              <View className='profile-page__story-content'>
                {/* P2-2: serialization badge — pending experiences (gold) or
                    连载中 (quiet); hidden at 0 chapters with 0 pending. */}
                {(pendingStoryCount > 0 || storyChapterCount > 0) && (
                  <View
                    className={`profile-page__story-badge${pendingStoryCount > 0 ? ' profile-page__story-badge--pending' : ''}`}
                    data-testid='profile-story-badge'
                  >
                    <Text className='profile-page__story-badge-text'>
                      {pendingStoryCount > 0 ? `${pendingStoryCount} 段新经历待写成` : '连载中'}
                    </Text>
                  </View>
                )}
                <Text className='profile-page__story-title'>
                  {storyChapterCount > 0 && latestStoryChapterTitle
                    ? `第 ${storyChapterCount} 章 · ${latestStoryChapterTitle}`
                    : '开始你的第一章'}
                </Text>
                <Text className='profile-page__story-summary'>
                  只根据你真实参加过的相遇，一章一章继续写下去。
                </Text>
                <Text className='profile-page__story-status'>
                  不使用姓名、定位或未发生的情节
                </Text>
                {/* Craft pass (2026-10-24): the write-date moved off the title
                    (one 390rpx line ellipsized the chapter title AND hid the
                    date) into the roomier CTA line. */}
                <Text className='profile-page__story-cta'>
                  {latestChapterDateLabel ? `${latestChapterDateLabel}写下 · 进入我的故事` : '进入我的故事'}
                </Text>
                <View className='profile-page__story-action'>
                  <View
                    className={`profile-page__story-action-ring${!pageVisible || deviceTier.isDegradation ? ' profile-page__story-action-ring--paused' : ''}`}
                    aria-hidden='true'
                  />
                  <View className='profile-page__story-action-chevron' />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* P2-3 形象名片 entry — quiet text-pill directly under the story
            card (PM memo §8). A6-1 (full-marks Wave A): gate is archetype
            only — decoupled from personalStoryEnabled so story-off users
            keep the share surface. A6-2: a fresh badge latches a one-shot
            gold glow + celebratory copy until the tap. */}
        {archetype && (
          <View className='profile-page__poster-entry'>
            <View
              className={`profile-page__poster-pill${profileCardShare.isGenerating ? ' profile-page__poster-pill--busy' : ''}${posterGlow && !deviceTier.isDegradation ? ' profile-page__poster-pill--glow' : ''}`}
              hoverClass={profileCardShare.isGenerating ? undefined : 'profile-page__poster-pill--pressed'}
              onClick={() => {
                if (profileCardShare.isGenerating) return
                if (posterGlow) {
                  profileAnalytics.track('profile_poster_glow_tap')
                  setPosterGlow(false)
                }
                void profileCardShare.handleShare(posterGlow ? 'badge_glow' : 'default')
              }}
              role='button'
              aria-disabled={profileCardShare.isGenerating}
              aria-label={profileCardShare.isGenerating ? '正在生成卡片' : posterGlow ? '新徽章到手，存下这张卡' : '存下这张卡'}
              data-testid='profile-poster-entry'
            >
              <Text className='profile-page__poster-pill-text'>
                {profileCardShare.isGenerating ? '正在生成…' : posterGlow ? '新徽章到手，存下这张卡' : '存下这张卡'}
              </Text>
            </View>
          </View>
        )}

        {/* P1-5 quest line (PM memo §2): 4 steps until first 成行; hidden
            forever once any registration is matched/completed. No dismiss. */}
        {quest && (
          <View className='profile-page__quest' data-testid='profile-quest'>
            <View className='profile-page__quest-header'>
              <Text className='profile-page__quest-title'>启程任务</Text>
              <Text className='profile-page__quest-subtitle'>走完 4 步，迎来你的第一场局</Text>
            </View>
            {quest.steps.map((step) => {
              const isMatchedStep = step.key === 'matched'
              const showMatchedCta = isMatchedStep && quest.registerDone
              const showCta = (!isMatchedStep && !step.done) || showMatchedCta
              return (
                <View
                  key={step.key}
                  className='profile-page__quest-step'
                  data-testid={`profile-quest-step-${step.key}`}
                >
                  <View
                    className={`profile-page__quest-check${step.done ? ' profile-page__quest-check--done' : ''}`}
                    aria-hidden='true'
                  >
                    {step.done && <JoyJoinIcon emoji='✅' tier='ui' size={20} />}
                  </View>
                  <View className='profile-page__quest-step-text'>
                    <Text className={`profile-page__quest-step-title${step.done ? ' profile-page__quest-step-title--done' : ''}`}>
                      {step.title}
                    </Text>
                    {isMatchedStep && quest.registerDone && (
                      <Text className='profile-page__quest-step-sub'>排桌完成后，这里自动打勾</Text>
                    )}
                  </View>
                  {showCta && (
                    <View
                      className='profile-page__quest-cta'
                      hoverClass='profile-page__quest-cta--pressed'
                      onClick={() => handleQuestStepTap(step.key)}
                      role='button'
                      aria-label={isMatchedStep ? '查看进度' : step.cta}
                      data-testid={`profile-quest-cta-${step.key}`}
                    >
                      <Text className='profile-page__quest-cta-text'>
                        {isMatchedStep ? '查看进度' : step.cta}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        <View
          className='profile-page__settings-entry'
          hoverClass='profile-page__settings-entry--pressed'
          onClick={handleOpenSettings}
          role='button'
          aria-label='打开个人设置'
          data-testid='profile-settings-entry'
        >
          <View className='profile-page__settings-entry-icon' aria-hidden='true'>
            <JoyJoinIcon emoji='⚙️' tier='ui' size={36} />
          </View>
          <Text className='profile-page__settings-entry-label'>设置与服务</Text>
          <View className='profile-page__settings-entry-chevron' aria-hidden='true' />
        </View>

        <View className='profile-page__spacer' />
      </ScrollView>

      {/* P2-3: offscreen canvas for the profile card poster. Off-screen but
          full internal bitmap size — canvasToTempFilePath exports blank when
          the bitmap dimensions don't match (results-page convention). */}
      <Canvas
        canvasId={PROFILE_CARD_CANVAS_ID}
        className='profile-page__poster-canvas'
        style={{ width: '1080px', height: '1560px' }}
        aria-hidden='true'
      />

      {/* P6 first-visit guidance tip (C4 queue): docked overlay above the
          tab bar — fixed-positioned so it never pushes page content down.
          Dismissal (× / row tap / 6s dwell) is owned by useGuidanceQueue;
          the seen-write persists server-side so the tip fires once per user. */}
      {profileTipShowing ? (
        <View className='profile-page__guidance-dock'>
          <GuidanceTipCard
            kicker={profileGuidanceCopy.kicker}
            title={profileGuidanceCopy.title ?? ''}
            rows={profileGuidanceCopy.rows}
            mascotSrc={profileTipMascotError ? profileTipMascotFallback : profileTipMascot}
            onMascotError={() => setProfileTipMascotError(true)}
            exiting={profileGuidanceTipExiting}
            ariaLabel={`${profileGuidanceCopy.kicker}：${profileGuidanceCopy.title ?? ''}。${profileGuidanceCopy.rows.map((row) => `${row.title}，${row.caption}`).join('。')}。${profileGuidanceCopy.dismissHint}`}
            onDismiss={(reason) => {
              // W3 funnel (Q6): entitlement-tip dismissals carry the card
              // reason (× button vs tap-through); the 6s auto-dwell never
              // reaches this wrapper — the card fires only button/tap_through.
              if (profileGuidanceTip?.id === 'profile_equipment_first_entitlement') {
                discoverAnalytics.track('equipment_guidance_dismiss', undefined, { reason })
              }
              dismissProfileGuidanceTip(reason)
            }}
            onRowTap={(key) => {
              // W3: the claim row routes to the my-image claim surface.
              // P6 rows keep the built-in plain tap-through (dismiss below).
              if (profileGuidanceTip?.id === 'profile_equipment_first_entitlement') {
                Taro.navigateTo({
                  url: MINI_PROGRAM_ROUTES.myImage,
                  success: () => {
                    logInfo('profile:open_my_image_success')
                  },
                  fail: (error) => {
                    logError('profile:open_my_image_fail', { error: String(error) })
                  },
                })
              }
              dismissProfileGuidanceTip('tap_through')
            }}
          />
        </View>
      ) : null}
    </View>
  )
}
