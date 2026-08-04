import {
  getJoinedEvents,
  getProfileShell,
  getUserGamificationInfo,
} from '@shared/api'
import {
  ARCHETYPE_BY_ID,
} from '@shared/personality/archetypeNames'
import { archetypeRegistry } from '@shared/personality'
import { formatHSLAsRGBA, getArchetypeHSL, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { PersonalStoryResponse } from '@joyjoin/shared/schema'
import { useQuery } from '@tanstack/react-query'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import IdentityStageScene from '../../components/profile/IdentityStageScene'
import PixelAvatarComposite from '../../components/profile/PixelAvatarComposite'
import Card from '../../components/ui/Card'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { useSyncDeadline } from '../../hooks/useSyncDeadline'
import { apiRequest } from '../../lib/api/api'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { queryClient } from '../../lib/api/queryClient'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { fetchMyEquipment, type EquipmentItem, type EquipmentOutfit } from '../../lib/profile/equipmentApi'
import { EQUIPMENT_ME_QUERY_KEY } from '../../lib/profile/equipmentQueryKeys'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { getPixelEquipmentThumbnailUrl } from '../../lib/profile/pixelAvatarAssets'
import { haptics } from '../../lib/utils/haptics'
import { localAsset } from '../../lib/utils/cdnAssets'
import { logError, logInfo } from '../../lib/utils/logger'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { shouldRefreshOnShow } from '../../lib/utils/showRefreshGate'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import './index.scss'
import {
  getProfileCompletion,
  getProfileGrowthSummary,
  getProfilePersonalityActionLabel,
  getProfileV17DataPolicy,
  isProfileV17Enabled,
  PROFILE_STORY_ARTWORK_PATH,
} from './profileConstants'

const EMPTY_EQUIPMENT_OUTFIT: EquipmentOutfit = {
  topItemId: null,
  bottomItemId: null,
  shoesItemId: null,
  accessoryItemId: null,
  version: 0,
}

const DEFAULT_EQUIPMENT_PLACEHOLDER_URL = localAsset('/assets/joyjoin-logo-tab.png')

function EquipmentPreviewArtwork({
  item,
  artworkUrl,
}: {
  item: EquipmentItem
  artworkUrl: string | null
}) {
  const [source, setSource] = useState<'artwork' | 'default' | 'empty'>(
    artworkUrl ? 'artwork' : 'default',
  )

  useEffect(() => {
    setSource(artworkUrl ? 'artwork' : 'default')
  }, [artworkUrl, item.id])

  const image = source === 'artwork' ? artworkUrl : DEFAULT_EQUIPMENT_PLACEHOLDER_URL

  if (source === 'empty' || !image) {
    return <View className='profile-page__equipment-slot-mark' aria-hidden='true' />
  }

  return (
    <Image
      className={`profile-page__equipment-slot-art${source === 'default' ? ' profile-page__equipment-slot-art--placeholder' : ''}`}
      src={image}
      mode='aspectFit'
      lazyLoad={false}
      aria-hidden='true'
      onError={() => {
        logError('profile:equipment_asset_error', {
          itemId: item.id,
          image,
        })
        setSource((current) => current === 'artwork' ? 'default' : 'empty')
      }}
    />
  )
}

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

function ProfilePartnerVisual({
  archetype,
  archetypeName,
  displayName,
  pixelEnabled,
  equipmentState,
  outfit,
  itemsById,
  onRetryEquipment,
}: {
  archetype: string | null
  archetypeName: string | null
  displayName: string
  pixelEnabled: boolean
  equipmentState: 'ready' | 'loading' | 'error'
  outfit?: EquipmentOutfit
  itemsById: Map<string, EquipmentItem>
  onRetryEquipment: () => void
}) {
  const asset = archetype ? ARCHETYPE_ASSET_MAP[archetype] : undefined
  const [sourceKind, setSourceKind] = useState<'webp' | 'png' | 'fallback'>('webp')

  if (pixelEnabled && archetype) {
    if (equipmentState !== 'ready' || !outfit) {
      const isError = equipmentState === 'error'
      return (
        <View
          className={`profile-page__partner-equipment-state${isError ? ' profile-page__partner-equipment-state--error' : ''}`}
          role='status'
          aria-live='polite'
        >
          <View className='profile-page__partner-equipment-placeholder' aria-hidden='true'>
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--short' />
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--tall' />
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--medium' />
          </View>
          <Text className='profile-page__partner-equipment-state-title'>
            {isError ? '装备暂未同步' : '装备同步中…'}
          </Text>
          <Text className='profile-page__partner-equipment-state-copy'>
            {isError ? '已保存的搭配不会丢失' : '正在取回你已保存的搭配'}
          </Text>
          {isError && (
            <View
              className='profile-page__partner-equipment-retry'
              onClick={onRetryEquipment}
              role='button'
              aria-label='重新同步装备'
            >
              <Text>重试</Text>
            </View>
          )}
        </View>
      )
    }

    return (
      <View className='profile-page__partner-pixel'>
        <PixelAvatarComposite
          archetypeId={archetype}
          outfit={outfit ?? EMPTY_EQUIPMENT_OUTFIT}
          itemsById={itemsById}
          variant='compact'
          className='profile-page__partner-pixel-composite'
        />
      </View>
    )
  }

  if (!asset || sourceKind === 'fallback') {
    return (
      <View
        className='profile-page__partner-fallback'
        role='img'
        aria-label={archetypeName ? `${archetypeName}伙伴形象` : `${displayName}的伙伴形象待解锁`}
      >
        <ArchetypeHead archetype={archetype} size={248} fallbackText={displayName} />
      </View>
    )
  }

  return (
    <Image
      className='profile-page__partner-image'
      src={sourceKind === 'webp' ? asset.webp : asset.png}
      mode='aspectFit'
      lazyLoad={false}
      aria-label={archetypeName ? `${archetypeName}伙伴形象` : '伙伴形象'}
      onError={() => setSourceKind(sourceKind === 'webp' ? 'png' : 'fallback')}
    />
  )
}

function ProfileStoryArtwork() {
  return (
    <>
      <Image
        className='profile-page__story-image'
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

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  // Warm own first-viewport assets + adjacent tabs' assets during idle so
  // the next tab switch paints instantly.
  useEffect(() => {
    preloadRouteAssets('pages/profile/index')
    preloadPredictiveAssets('pages/profile/index')
  }, [])

  const hasDidShowRef = useRef(false)
  useDidShow(() => {
    if (!hasDidShowRef.current) {
      hasDidShowRef.current = true
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
    if (profileV17DataPolicy.gamificationEnabled) {
      void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] })
    }
    if (profileV17DataPolicy.equipmentEnabled) {
      void queryClient.invalidateQueries({ queryKey: EQUIPMENT_ME_QUERY_KEY })
    }
  })

  const { data: joinedEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading && !!authUser,
  })

  const profileShellQuery = useQuery({
    queryKey: ['mini-program', 'shell/profile'],
    queryFn: () => getProfileShell(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 30_000,
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
  const lifeStage = authUser?.lifeStage
  const bio = typeof authUser?.bio === 'string' ? authUser.bio.trim() : null
  const genderLabel = getGenderLabel(authUser?.gender)
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
  const personalityActionLabel = getProfilePersonalityActionLabel(archetype)
  const storyChapterCount = personalStoryTeaserQuery.data?.story?.chapters?.length ?? 0

  const archetypeTagline = useMemo(() => {
    if (!archetype || !(archetype in archetypeRegistry)) return null
    return archetypeRegistry[archetype as keyof typeof archetypeRegistry]?.narrative.tagline ?? null
  }, [archetype])
  const displayBio = bio || archetypeTagline || null

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

  return renderGate(
    <View className={`profile-page ${tabEntranceClass}`}>
      <View className='profile-page__nav' data-testid='profile-top-navigation'>
        <Text className='profile-page__nav-title'>我的</Text>
      </View>
      <ScrollView className='profile-page__scroll' scrollY enhanced showScrollbar={false}>
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
                  Whole card is the basic-profile hub: tap → 回看人格报告. */}
              <View
                className='profile-page__identity-copy-card'
                hoverClass='profile-page__identity-copy-card--pressed'
                onClick={() => { void handleOpenPersonalityType('v17_card') }}
                role='button'
                aria-label={archetypeName ? `回看 ${archetypeName} 的人格测评报告` : '测测你的社交原型'}
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
                      {lifeStage && (
                        <Text className='profile-page__identity-tag'>{lifeStage}</Text>
                      )}
                      {genderLabel && (
                        <Text className='profile-page__identity-tag'>{genderLabel}</Text>
                      )}
                    </View>
                    {displayBio && <Text className='profile-page__identity-bio'>{displayBio}</Text>}
                    <View className='profile-page__identity-affordance' aria-hidden='true'>
                      <Text className='profile-page__identity-affordance-text'>
                        {archetypeName ? '回看报告' : '测测你的社交原型'}
                      </Text>
                      <View className='profile-page__identity-affordance-chevron' />
                    </View>
                  </View>
                </View>
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
                    <Text className='profile-page__growth-value'>
                      {gamificationQuery.isLoading ? '—' : growth.current}
                    </Text>
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
                    <View className='profile-page__level-plate'>
                      <View className='profile-page__level-plate-spark' aria-hidden='true' />
                      <Text className='profile-page__level-plate-text'>{growthLevelLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
              </View>

              {/* Avatar anchored on the plaza with a warm platform shadow */}
              <View
                className={`profile-page__partner-visual${pixelAvatarEnabled ? '' : ' profile-page__partner-visual--no-entry'}`}
              >
                <View
                  className={`profile-page__partner-platform${deviceTier.isDegradation ? ' profile-page__partner-platform--no-pulse' : ''}`}
                  aria-hidden='true'
                />
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

              {pixelAvatarEnabled && (
                <View
                  className='profile-page__partner-entry'
                  hoverClass='profile-page__partner-entry--pressed'
                  onClick={() => {
                    haptics('light')
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
                    <Text className='profile-page__equipment-label'>当前装备</Text>
                    {equipmentState === 'ready' && (
                      <Text className='profile-page__partner-entry-count'>
                        {`${equipmentInventory.length} 件`}
                      </Text>
                    )}
                    {equipmentState === 'ready' && equipmentQuery.isError && (
                      <Text className='profile-page__equipment-cache-badge'>上次同步</Text>
                    )}
                    {equipmentState === 'ready' ? (
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
                              className={`profile-page__equipment-slot${item ? ' profile-page__equipment-slot--filled' : ''}`}
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
                {archetypeName ?? '社交原型等待解锁'}
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

        <View className={`profile-page__stats${hasEntered ? ' profile-page__stats--entered' : ''}`}>
          <Card
            className='profile-page__stat profile-page__stat--tint-cream'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
            role='button'
            aria-label={`已参加 ${joinedEventsCount} 场活动，去浏览足迹`}
          >
            <JoyJoinIcon emoji='👣' tier='ui' size={40} className='profile-page__stat-icon' />
            <Text className='profile-page__stat-value'>
              {isLoadingStats ? '—' : joinedEventsCount}
            </Text>
            <Text className='profile-page__stat-label'>已参加活动</Text>
            <Text className='profile-page__stat-caption'>去浏览</Text>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>

          <Card
            className='profile-page__stat profile-page__stat--tint-pink'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.connections }) }}
            role='button'
            aria-label={connectionsCount == null ? '连接数正在加载' : `已有 ${connectionsCount} 个连接，去查看`}
          >
            <JoyJoinIcon emoji='👥' tier='ui' size={40} className='profile-page__stat-icon' />
            <Text className='profile-page__stat-value'>
              {profileShellQuery.isLoading || connectionsCount == null ? '—' : connectionsCount}
            </Text>
            <Text className='profile-page__stat-label'>我的连接</Text>
            <Text className='profile-page__stat-caption'>去看看</Text>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>

          <Card
            className='profile-page__stat profile-page__stat--tint-purple'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile }) }}
            role='button'
            aria-label={`资料完成度 ${profileCompletion}%，${profileCompletion >= 100 ? '查看资料' : '去完善资料'}`}
          >
            <JoyJoinIcon emoji='📄' tier='ui' size={40} className='profile-page__stat-icon' />
            <Text className='profile-page__stat-value'>{profileCompletion}%</Text>
            <Text className='profile-page__stat-label'>资料完成度</Text>
            <Text className='profile-page__stat-caption'>{profileCompletion >= 100 ? '查看资料' : '去完善'}</Text>
            <View className='profile-page__stat-progress'>
              <View
                className='profile-page__stat-progress-bar'
                style={{ transform: `scaleX(${profileCompletion / 100})` }}
              />
            </View>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>
        </View>

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
              <ProfileStoryArtwork />
              <View className='profile-page__story-content'>
                <Text className='profile-page__story-title'>
                  {storyChapterCount > 0 ? `第 ${storyChapterCount} 章 · 继续书写` : '开始你的第一章'}
                </Text>
                <Text className='profile-page__story-summary'>
                  只根据你真实参加过的相遇，一章一章继续写下去。
                </Text>
                <Text className='profile-page__story-status'>
                  不使用姓名、定位或未发生的情节
                </Text>
                <Text className='profile-page__story-cta'>进入我的故事</Text>
                <View className='profile-page__story-action'>
                  <View className='profile-page__story-action-chevron' />
                </View>
              </View>
            </View>
          </View>
        )}

        {profileV17Enabled && !isLoadingStats && joinedEventsCount >= 1 && (
          <View className='profile-page__milestones'>
            <Text className='profile-page__milestones-title'>成就徽章</Text>
            <View className='profile-page__milestones-row'>
              {joinedEventsCount >= 1 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => { haptics('light'); Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
                  role='button'
                  aria-label='已参加 1 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={MILESTONE_BADGES.firstEvent}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>初次见面</Text>
                </View>
              )}
              {joinedEventsCount >= 3 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => { haptics('light'); Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
                  role='button'
                  aria-label='已参加 3 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={MILESTONE_BADGES.streak3}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>三场连击</Text>
                </View>
              )}
            </View>
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
    </View>
  )
}
