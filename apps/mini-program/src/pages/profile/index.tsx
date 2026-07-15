import {
  getJoinedEvents,
  getProfileShell,
  getUserCoupons,
  getUserGamificationInfo,
} from '@shared/api'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { useQuery } from '@tanstack/react-query'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { apiRequest } from '../../lib/api/api'
import {
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../lib/api/authSession'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { shouldShowAlangEntry } from '../../lib/alang/alangAccess'
import { useAlangAssetSource } from '../../lib/alang/alangAssets'
import { useStoryArchives } from '../../lib/alang/useAlangMission'
import { queryClient } from '../../lib/api/queryClient'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { haptics } from '../../lib/utils/haptics'
import { logError, logInfo } from '../../lib/utils/logger'
import './index.scss'
import {
  getProfileCompletion,
  getProfileGrowthSummary,
  getProfilePersonalityActionLabel,
  getProfileV17DataPolicy,
  isProfileV17Enabled,
} from './profileConstants'

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
}: {
  archetype: string | null
  archetypeName: string | null
  displayName: string
}) {
  const asset = archetype ? ARCHETYPE_ASSET_MAP[archetype] : undefined
  const [sourceKind, setSourceKind] = useState<'webp' | 'png' | 'fallback'>('webp')

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
  const artwork = useAlangAssetSource('resultHero')

  return (
    <>
      <Image
        className='profile-page__story-image'
        src={artwork.src}
        mode='aspectFill'
        lazyLoad
        aria-hidden='true'
        onError={artwork.onError}
      />
      <View className='profile-page__story-wash' />
      {artwork.usingFallback && (
        <Text className='profile-page__story-placeholder'>场景示意</Text>
      )}
    </>
  )
}

export default function ProfilePage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const logoutLockRef = useRef(false)
  const profileV17Enabled = isProfileV17Enabled(authUser)
  const profileV17DataPolicy = getProfileV17DataPolicy(
    authUser,
    shouldShowAlangEntry(authUser),
  )

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  const hasDidShowRef = useRef(false)
  useDidShow(() => {
    if (!hasDidShowRef.current) {
      hasDidShowRef.current = true
      return
    }
    if (authLoading || !authUser) return
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/profile'] })
    if (profileV17DataPolicy.gamificationEnabled) {
      void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] })
    }
    if (profileV17DataPolicy.storyArchivesEnabled) {
      void queryClient.invalidateQueries({ queryKey: ['alang', 'archives'] })
    }
  })

  const { data: coupons = { count: 0, availableCount: 0, coupons: [] }, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !authLoading && !!authUser,
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

  const showAlangStoryEntry = profileV17DataPolicy.storyArchivesEnabled
  const storyArchivesQuery = useStoryArchives(
    !authLoading && !!authUser && showAlangStoryEntry,
  )

  const joinedEventsCount = profileShellQuery.data?.stats.eventsJoined ?? joinedEvents.length
  const connectionsCount = profileShellQuery.data?.stats.connectionsCount
  const isLoadingStats = isLoadingEvents || profileShellQuery.isLoading

  const handleOpenPayment = () => {
    haptics('light')
    void openMiniProgramPaymentPage({
      currentUserId: authUser?.id,
    })
  }
  const handleLogout = async () => {
    if (logoutLockRef.current) {
      return
    }

    haptics('medium')
    logoutLockRef.current = true
    logInfo('[Profile] User initiated logout')

    try {
      await apiRequest<{ message: string }>({
        path: '/api/auth/logout',
        method: 'POST',
        handleUnauthorized: false,
      })

      clearMiniProgramAuthSession({ mode: 'hard' })
      Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
    } catch (error) {
      if (isUnauthorizedApiError(error)) {
        clearMiniProgramAuthSession({ mode: 'hard' })
        Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
        return
      }

      logError('[Profile] Logout failed', {
        statusCode: getApiErrorStatusCode(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      })

      Taro.showToast({
        title: getErrorMessage('logout-failed'),
        icon: 'none',
        duration: 3000,
      })
    } finally {
      logoutLockRef.current = false
    }
  }
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
  const storyCount = storyArchivesQuery.data?.length ?? 0
  const latestStory = storyArchivesQuery.data?.[0]
  const personalityActionLabel = getProfilePersonalityActionLabel(archetype)

  const handleOpenPersonalityType = () => {
    haptics('light')
  
    if (archetype) {
      void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
      return
    }
  
    void Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.personalityTest}?source=profile`,
    })
  }

  const handleOpenSettings = async () => {
    haptics('light')
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: ['编辑资料', '服务条款', '退出登录'],
      })
      if (tapIndex === 0) {
        haptics('light')
        void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
      } else if (tapIndex === 1) {
        haptics('light')
        void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.terms })
      } else if (tapIndex === 2) {
        void handleLogout()
      }
    } catch {
      // Cancelling the action sheet is an intentional no-op.
    }
  }

  return renderGate(
    <View className='profile-page tab-page-enter'>
      <View className='profile-page__nav' data-testid='profile-top-navigation'>
        <Text className='profile-page__nav-title'>我的</Text>
        <View
          className='profile-page__nav-settings'
          hoverClass='profile-page__nav-settings--pressed'
          onClick={handleOpenSettings}
          role='button'
          aria-label='打开个人设置'
          data-testid='profile-top-settings'
        >
          <JoyJoinIcon emoji='⚙️' tier='ui' size={40} />
        </View>
      </View>
      <ScrollView className='profile-page__scroll' scrollY enhanced showScrollbar={false}>
        {profileV17Enabled ? (
          <View className='profile-page__identity-stage profile-page__identity-stage--entered' data-testid='profile-v4'>
          <View className='profile-page__identity-glow' aria-hidden='true' />

          <View className='profile-page__identity-copy'>
            <View className='profile-page__identity-avatar'>
              <ArchetypeHead
                archetype={archetype}
                size={112}
                fallbackText={displayName}
              />
            </View>
            <View className='profile-page__identity-text'>
              <Text className='profile-page__identity-name'>{displayName}</Text>
              <View className='profile-page__identity-tags'>
                {archetypeName && (
                  <Text className='profile-page__identity-tag profile-page__identity-tag--primary'>
                    {archetypeName}
                  </Text>
                )}
                {lifeStage && (
                  <Text className='profile-page__identity-tag'>{lifeStage}</Text>
                )}
                {genderLabel && (
                  <Text className='profile-page__identity-tag profile-page__identity-tag--blue'>
                    {genderLabel}
                  </Text>
                )}
              </View>
              {bio && <Text className='profile-page__identity-bio'>{bio}</Text>}
            </View>
          </View>

          <View className='profile-page__partner-visual'>
            <ProfilePartnerVisual
              key={archetype ?? 'profile-partner-fallback'}
              archetype={archetype}
              archetypeName={archetypeName}
              displayName={displayName}
            />
          </View>

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
              />
            </View>
            <Text className='profile-page__growth-level'>
              {gamificationQuery.isError ? '成长记录稍后会自动刷新' : growthLevelLabel}
            </Text>
          </View>

          <View
            className='profile-page__partner-entry'
            hoverClass='profile-page__partner-entry--pressed'
            onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile }) }}
            role='button'
            aria-label='进入我的伙伴与装备'
            data-testid='profile-partner-equipment-entry'
          >
            <View className='profile-page__equipment-preview' aria-label='当前装备，0 件，4 个空槽'>
              <Text className='profile-page__equipment-label'>当前装备</Text>
              <View className='profile-page__equipment-slots'>
                {[0, 1, 2, 3].map((slot) => (
                  <View key={slot} className='profile-page__equipment-slot' aria-label={`空装备槽 ${slot + 1}`}>
                    <View className='profile-page__equipment-slot-mark' />
                  </View>
                ))}
              </View>
            </View>
            <View className='profile-page__partner-entry-action'>
              <Text className='profile-page__partner-entry-count'>0 件</Text>
              <Text className='profile-page__partner-entry-action-text'>我的伙伴与装备</Text>
              <View className='profile-page__partner-entry-chevron' />
            </View>
          </View>
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
                onClick={handleOpenPersonalityType}
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

        <View className='profile-page__stats profile-page__stats--entered'>
          <Card
            className='profile-page__stat'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
            role='button'
            aria-label={`已参加 ${joinedEventsCount} 场活动，去浏览足迹`}
          >
            <Text className='profile-page__stat-value'>
              {isLoadingStats ? '—' : joinedEventsCount}
            </Text>
            <Text className='profile-page__stat-label'>已参加活动</Text>
            <Text className='profile-page__stat-caption'>去浏览</Text>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>

          <Card
            className='profile-page__stat'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.connections }) }}
            role='button'
            aria-label={connectionsCount == null ? '连接数正在加载' : `已有 ${connectionsCount} 个连接，去查看`}
          >
            <Text className='profile-page__stat-value'>
              {profileShellQuery.isLoading || connectionsCount == null ? '—' : connectionsCount}
            </Text>
            <Text className='profile-page__stat-label'>我的连接</Text>
            <Text className='profile-page__stat-caption'>去看看</Text>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>

          <Card
            className='profile-page__stat'
            hoverClass='profile-page__stat--pressed'
            onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile }) }}
            role='button'
            aria-label={`形象完成度 ${profileCompletion}%，去完善资料`}
          >
            <Text className='profile-page__stat-value'>{profileCompletion}%</Text>
            <Text className='profile-page__stat-label'>形象完成度</Text>
            <Text className='profile-page__stat-caption'>去完善</Text>
            <View className='profile-page__stat-progress'>
              <View
                className='profile-page__stat-progress-bar'
                style={{ transform: `scaleX(${profileCompletion / 100})` }}
              />
            </View>
            <View className='profile-page__chevron profile-page__chevron--stat' />
          </Card>
        </View>

        {profileV17Enabled && (
          <View className='profile-page__archive' data-testid='profile-growth-archive'>
            <View className='profile-page__archive-heading'>
              <View className='profile-page__archive-title-wrap'>
                <Text className='profile-page__archive-spark'>✦</Text>
                <Text className='profile-page__archive-title'>成长档案</Text>
              </View>
              <View
                className='profile-page__archive-link'
                hoverClass='profile-page__archive-link--pressed'
                onClick={() => {
                  haptics('light')
                  void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangEvent}?view=stories` })
                }}
                role='button'
                aria-label='查看全部故事档案'
              >
                <Text className='profile-page__archive-link-text'>全部档案</Text>
                <View className='profile-page__archive-link-chevron' />
              </View>
            </View>
            <View
              className='profile-page__story-card'
              hoverClass='profile-page__story-card--pressed'
              onClick={() => {
                haptics('light')
                void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangEvent}?view=stories` })
              }}
              role='button'
              data-testid='profile-story-entry'
              aria-label={storyArchivesQuery.isLoading
                ? '我的故事正在加载'
                : `我的故事，共 ${storyCount} 段已收录故事`}
            >
              <ProfileStoryArtwork />
              <View className='profile-page__story-content'>
                <Text className='profile-page__story-title'>我的故事</Text>
                <Text className='profile-page__story-summary'>
                  {storyArchivesQuery.isLoading
                    ? '正在整理走过的城市章节…'
                    : storyArchivesQuery.isError
                      ? '故事档案稍后会自动刷新'
                      : storyCount > 0
                        ? `${storyCount} 段故事收藏 · 最近：${latestStory?.title ?? '城市相遇'}`
                        : '0 段故事收藏 · 第一章还在等你出发'}
                </Text>
                <Text className='profile-page__story-status'>
                  {storyArchivesQuery.isError
                    ? '局部加载失败 · 点按仍可进入'
                    : storyCount > 0
                      ? '继续中的故事：等待下一次相遇'
                      : '继续中的故事：暂时没有'}
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

        <View className='profile-page__menu-section profile-page__menu-section--entered' data-testid='profile-more-services'>
          <Text className='profile-page__menu-title'>更多服务</Text>
          <View className='profile-page__service-grid'>
            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile }) }}
              role='button'
              aria-label='编辑资料'
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='✏️' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>编辑资料</Text>
            </View>

            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.rewards }) }}
              role='button'
              aria-label={`奖励福利，${isLoadingCoupons ? '正在加载' : `${coupons.count ?? 0} 项`}`}
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='🏆' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>奖励福利</Text>
              {!isLoadingCoupons && (coupons.count ?? 0) > 0 && (
                <Text className='profile-page__service-meta'>{coupons.count}</Text>
              )}
            </View>

            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite }) }}
              role='button'
              aria-label='邀请好友'
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='🤝' tier='semantic' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>邀请好友</Text>
            </View>

            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={handleOpenPayment}
              role='button'
              aria-label='我的权益'
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='🎁' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>我的权益</Text>
            </View>

            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={() => { haptics('light'); void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
              role='button'
              aria-label='我的足迹'
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='👣' tier='ui' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>我的足迹</Text>
            </View>

            <View
              className='profile-page__service-item'
              hoverClass='profile-page__service-item--pressed'
              onClick={() => { haptics('light'); void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.terms }) }}
              role='button'
              aria-label='服务条款'
            >
              <View className='profile-page__service-icon-well'>
                <JoyJoinIcon emoji='📄' size={36} className='profile-page__service-icon' />
              </View>
              <Text className='profile-page__service-label'>服务条款</Text>
            </View>
          </View>
        </View>

        <View className='profile-page__logout'>
          <Button
            variant='secondary'
            className='profile-page__logout-btn'
            hoverClass='profile-page__logout-btn--pressed'
            onClick={handleLogout}
          >
            <Text className='profile-page__logout-text'>退出登录</Text>
          </Button>
        </View>

        <View className='profile-page__spacer' />
      </ScrollView>
    </View>
  )
}
