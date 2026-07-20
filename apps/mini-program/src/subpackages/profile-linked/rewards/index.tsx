import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getRedeemableItems,
  getUserCoupons,
  getUserGamificationHistory,
  getUserGamificationInfo,
  redeemGamificationItem,
  type GamificationTransaction,
  type UserCouponSummary,
  type UserCouponStatus,
  type UserGamificationSummary,
} from '@shared/api'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { apiRequest } from '../../../lib/api/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { COLOR_ACCENT_PINK, TOAST_MEDIUM_MS, TOAST_ERROR_MS } from '../../../lib/utils/uiConstants'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import StatusCard from '../../../components/ui/StatusCard'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { usePageTTI } from '../../../hooks/usePageTTI'
import './index.scss'

const HISTORY_LIMIT = 6

const STATUS_LABELS: Record<UserCouponStatus, string> = {
  available: '可使用',
  used: '已使用',
  expired: '已过期',
}

const STATUS_RANK: Record<UserCouponStatus, number> = {
  available: 0,
  expired: 1,
  used: 2,
}

function formatDateLabel(value?: string | null): string {
  if (!value) {
    return '长期有效'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '有效期未定'
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  })
}

function formatDateTimeLabel(value?: string): string {
  if (!value) {
    return '刚刚'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未定'
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  })
}

function formatCouponValue(coupon: UserCouponSummary): string {
  if (coupon.discountType === 'percentage' && typeof coupon.discountValue === 'number') {
    return `-${coupon.discountValue}%`
  }

  if (coupon.discountType === 'fixed_amount' && typeof coupon.discountValue === 'number') {
    return `¥${coupon.discountValue}`
  }

  return coupon.code ?? '奖励'
}

function formatSourceLabel(source?: string | null): string {
  switch (source) {
    case 'joy_coins_redemption':
      return '悦币兑换'
    case 'invitation_reward':
      return '邀请奖励'
    case 'promotion':
      return '活动赠送'
    case 'admin_grant':
      return '官方发放'
    default:
      return '悦聚奖励'
  }
}

function formatTransactionDelta(value?: number, suffix = ''): string | null {
  if (!value) {
    return null
  }

  return `${value > 0 ? '+' : ''}${value}${suffix}`
}

function getErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  return fallback
}

function getRedeemableTypeLabel(type?: string): string {
  switch (type) {
    case 'discount_coupon':
      return '折扣券'
    case 'free_event':
      return '免费名额'
    case 'priority_access':
      return '优先权'
    default:
      return '奖励'
  }
}

export default function RewardsPage() {
  const { isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()

  const couponsQuery = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !authLoading,
  })

  const gamificationQuery = useQuery<UserGamificationSummary>({
    queryKey: ['mini-program', 'gamification'],
    queryFn: () => getUserGamificationInfo(apiRequest),
    enabled: !authLoading,
  })

  const historyQuery = useQuery<GamificationTransaction[]>({
    queryKey: ['mini-program', 'gamification-history', HISTORY_LIMIT],
    queryFn: () => getUserGamificationHistory(apiRequest, HISTORY_LIMIT),
    enabled: !authLoading,
  })

  const redeemableItemsQuery = useQuery({
    queryKey: ['mini-program', 'redeemable-items'],
    queryFn: () => getRedeemableItems(apiRequest),
    enabled: !authLoading,
  })

  usePageTTI({ pageName: 'rewards', ready: !authLoading && !couponsQuery.isLoading })

  const redeemMutation = useMutation({
    mutationFn: (itemId: string) => redeemGamificationItem(apiRequest, itemId),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification-history'] }),
      ])

      Taro.showToast({
        title: response.redeemedItem?.nameCn ? `已兑换${response.redeemedItem.nameCn}` : '兑换成功',
        icon: 'success',
        duration: TOAST_MEDIUM_MS,
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '兑换没成功，稍后再试'
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_ERROR_MS })
    },
  })

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification-history'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'redeemable-items'] })
  }, [queryClient])

  const handleRedeem = useCallback(
    async (itemId: string, nameCn: string, costCoins: number) => {
      if (redeemMutation.isPending) {
        return
      }

      const { confirm } = await Taro.showModal({
        title: '确认兑换',
        content: `确定使用 ${costCoins} 悦币兑换「${nameCn}」吗？`,
        confirmText: '立即兑换',
        cancelText: '再想想',
        confirmColor: COLOR_ACCENT_PINK,
      })

      if (!confirm) {
        return
      }

      redeemMutation.mutate(itemId)
    },
    [redeemMutation],
  )

  const couponsData = couponsQuery.data ?? { count: 0, availableCount: 0, coupons: [] }
  const gamification = gamificationQuery.data
  const history = historyQuery.data ?? []
  const redeemableItems = redeemableItemsQuery.data ?? []
  const isRefreshing = couponsQuery.isRefetching || gamificationQuery.isRefetching || historyQuery.isRefetching || redeemableItemsQuery.isRefetching
  const gamificationErrorText = gamificationQuery.isError
    ? getErrorText(gamificationQuery.error, '成长进度加载没成功')
    : null
  const historyErrorText = historyQuery.isError
    ? getErrorText(historyQuery.error, '奖励记录加载没成功')
    : null
  const redeemableErrorText = redeemableItemsQuery.isError
    ? getErrorText(redeemableItemsQuery.error, '兑换商城加载没成功')
    : null

  const couponCounts = useMemo(() => {
    return couponsData.coupons.reduce(
      (accumulator, coupon) => {
        accumulator[coupon.status] += 1
        return accumulator
      },
      { available: 0, used: 0, expired: 0 } as Record<UserCouponStatus, number>,
    )
  }, [couponsData.coupons])

  const displayCoupons = useMemo(() => {
    return [...couponsData.coupons].sort((left, right) => {
      const statusRank = STATUS_RANK[left.status] - STATUS_RANK[right.status]
      if (statusRank !== 0) {
        return statusRank
      }

      const leftTime = new Date(left.createdAt ?? 0).getTime()
      const rightTime = new Date(right.createdAt ?? 0).getTime()
      return rightTime - leftTime
    })
  }, [couponsData.coupons])

  if (authLoading || couponsQuery.isLoading) {
    return <LoadingScreen message='正在整理你的成长足迹…' />
  }

  if (couponsQuery.isError) {
    return (
      <View className='rewards-page rewards-page--error'>
        <View className='rewards-page__error'>
          <StatusCard
            tone='error'
            heroSrc={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            title='奖励加载没成功'
            description='稍后重试，或返回个人主页继续浏览。'
            action={{ label: '重新加载', onClick: handleRefresh }}
            footer={
              <Button
                variant='secondary'
                className='rewards-page__back-btn'
                onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })}
              >
                返回我的主页
              </Button>
            }
          />
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      className='rewards-page'
      scrollY
      enhanced
      showScrollbar={false}
      refresherEnabled
      refresherTriggered={isRefreshing}
      onRefresherRefresh={handleRefresh}
    >
      <View className='rewards-page__hero'>
        <JoyJoinIcon emoji='🎁' tier='ui' size={96} className='rewards-page__hero-icon' />
        <Text className='rewards-page__hero-title'>我的奖励</Text>
        <Text className='rewards-page__hero-subtitle'>查看当前优惠券、成长值和近期奖励记录</Text>
      </View>

      <View className='rewards-page__coach'>
        <XiaoyueChatBubble
          content='你积累的每一份成长，都会在这里发光。'
          pose='casual'
          horizontal
          showGlow
        />
      </View>

      <View className='rewards-page__stats'>
        <Card className='rewards-page__stat'>
          <Text className='rewards-page__stat-value'>{couponsData.availableCount}</Text>
          <Text className='rewards-page__stat-label'>可用奖励</Text>
        </Card>
        <Card className='rewards-page__stat'>
          <Text className='rewards-page__stat-value'>
            {gamificationQuery.isError ? '--' : gamificationQuery.isLoading ? '...' : (gamification?.joyCoins ?? 0)}
          </Text>
          <Text className='rewards-page__stat-label'>悦币余额</Text>
        </Card>
      </View>

      {gamificationQuery.isError ? (
        <Card className='rewards-page__level-card'>
          <View className='rewards-page__level-header'>
            <View>
              <Text className='rewards-page__level-title'>成长进度暂时不可用</Text>
              <Text className='rewards-page__level-name'>{gamificationErrorText}</Text>
            </View>
          </View>

          <View className='rewards-page__chips'>
            <Text className='rewards-page__chip'>已使用 {couponCounts.used}</Text>
            <Text className='rewards-page__chip'>已过期 {couponCounts.expired}</Text>
          </View>

          <Button className='rewards-page__invite-btn' onClick={() => void gamificationQuery.refetch()}>
            重新加载成长进度
          </Button>
        </Card>
      ) : (
        <Card className='rewards-page__level-card'>
          <View className='rewards-page__level-header'>
            <View>
              <Text className='rewards-page__level-title'>
                {gamificationQuery.isLoading ? '成长进度加载中…' : `Lv.${gamification?.currentLevel ?? 1}`}
              </Text>
              <Text className='rewards-page__level-name'>
                {gamificationQuery.isLoading ? '加载中' : (gamification?.levelConfig?.nameCn ?? '新芽')}
              </Text>
            </View>
            <View className='rewards-page__level-summary'>
              <Text className='rewards-page__level-xp'>
                {gamificationQuery.isLoading ? '...' : `${gamification?.experiencePoints ?? 0} XP`}
              </Text>
              {typeof gamification?.nextLevelInfo?.xpNeeded === 'number' ? (
                <Text className='rewards-page__level-hint'>距离下一级还需 {gamification.nextLevelInfo.xpNeeded} XP</Text>
              ) : null}
            </View>
          </View>

          <View className='rewards-page__chips'>
            <Text className='rewards-page__chip'>已使用 {couponCounts.used}</Text>
            <Text className='rewards-page__chip'>已过期 {couponCounts.expired}</Text>
            <Text className='rewards-page__chip'>
              已参加 {gamificationQuery.isLoading ? '...' : (gamification?.eventsAttended ?? 0)} 场
            </Text>
          </View>
        </Card>
      )}

      <View className='rewards-page__section'>
        <Text className='rewards-page__section-title'>奖励资产</Text>

        {displayCoupons.length > 0 ? (
          displayCoupons.map((coupon) => (
            <Card key={coupon.id} className='rewards-page__coupon-card'>
              <View className='rewards-page__coupon-top'>
                <View>
                  <Text className='rewards-page__coupon-title'>{coupon.code ?? '专属奖励'}</Text>
                  <Text className='rewards-page__coupon-source'>{formatSourceLabel(coupon.source)}</Text>
                </View>
                <View className={`rewards-page__coupon-status rewards-page__coupon-status--${coupon.status}`}>
                  <Text className='rewards-page__coupon-status-text'>{STATUS_LABELS[coupon.status]}</Text>
                </View>
              </View>

              <View className='rewards-page__coupon-body'>
                <Text className='rewards-page__coupon-value'>{formatCouponValue(coupon)}</Text>
                <Text className='rewards-page__coupon-expiry'>有效期至 {formatDateLabel(coupon.validUntil)}</Text>
              </View>
            </Card>
          ))
        ) : (
          <Card className='rewards-page__empty-card'>
            <Image
              className='rewards-page__empty-hero'
              src={cdnAsset('/assets/lovart/lovart-rewards-empty-20260423-v1.webp')}
              mode='widthFix'
              lazyLoad
            />
            <Text className='rewards-page__empty-title'>还没有奖励资产</Text>
            <Text className='rewards-page__empty-text'>参加活动、完善资料或邀请好友后，奖励会显示在这里。</Text>
          </Card>
        )}
      </View>

      <View className='rewards-page__section'>
        <Text className='rewards-page__section-title'>悦币兑换</Text>

        {redeemableItemsQuery.isError ? (
          <Card className='rewards-page__empty-card rewards-page__empty-card--compact'>
            <Text className='rewards-page__empty-title'>兑换商城暂时不可用</Text>
            <Text className='rewards-page__empty-text'>{redeemableErrorText}</Text>
            <Button className='rewards-page__invite-btn' onClick={() => void redeemableItemsQuery.refetch()}>
              重新加载商城
            </Button>
          </Card>
        ) : redeemableItems.length > 0 ? (
          redeemableItems.map((item) => {
            const canAfford = (gamification?.joyCoins ?? 0) >= item.costCoins
            const isRedeeming = redeemMutation.isPending && redeemMutation.variables === item.id

            return (
              <Card key={item.id} className='rewards-page__catalog-card'>
                <View className='rewards-page__catalog-top'>
                  <View className='rewards-page__catalog-copy'>
                    <Text className='rewards-page__catalog-title'>{item.nameCn}</Text>
                    <Text className='rewards-page__catalog-desc'>{item.descriptionCn}</Text>
                  </View>
                  <View className='rewards-page__catalog-tag'>
                    <Text className='rewards-page__catalog-tag-text'>{getRedeemableTypeLabel(item.type)}</Text>
                  </View>
                </View>

                <View className='rewards-page__catalog-footer'>
                  <View>
                    <Text className='rewards-page__catalog-price'>{item.costCoins} 悦币</Text>
                    <Text className='rewards-page__catalog-meta'>有效期 {item.validDays} 天</Text>
                  </View>
                  <Button
                    className={`rewards-page__catalog-btn${canAfford ? '' : ' rewards-page__catalog-btn--disabled'}`}
                    variant={canAfford ? 'primary' : 'secondary'}
                    disabled={!canAfford || redeemMutation.isPending}
                    loading={isRedeeming}
                    onClick={() => handleRedeem(item.id, item.nameCn, item.costCoins)}
                  >
                    {isRedeeming ? '兑换中…' : canAfford ? '立即兑换' : '悦币不足'}
                  </Button>
                </View>
              </Card>
            )
          })
        ) : (
          <Card className='rewards-page__empty-card rewards-page__empty-card--compact'>
            <Image
              className='rewards-page__empty-hero rewards-page__empty-hero--compact'
              src={cdnAsset('/assets/lovart/lovart-rewards-shop-20260423-v1.webp')}
              mode='widthFix'
              lazyLoad
            />
            <Text className='rewards-page__empty-text'>兑换商城正在准备中，稍后会开放更多奖励。</Text>
          </Card>
        )}
      </View>

      <View className='rewards-page__section'>
        <Text className='rewards-page__section-title'>近期记录</Text>

        {historyQuery.isError ? (
          <Card className='rewards-page__empty-card rewards-page__empty-card--compact'>
            <Text className='rewards-page__empty-title'>奖励记录暂时不可用</Text>
            <Text className='rewards-page__empty-text'>{historyErrorText}</Text>
            <Button className='rewards-page__invite-btn' onClick={() => void historyQuery.refetch()}>
              重新加载记录
            </Button>
          </Card>
        ) : history.length > 0 ? (
          <Card className='rewards-page__history-card'>
            {history.map((item) => {
              const xpDelta = formatTransactionDelta(item.xpAmount, ' XP')
              const coinDelta = formatTransactionDelta(item.coinsAmount, ' 悦币')

              return (
                <View key={item.id} className='rewards-page__history-row'>
                  <View className='rewards-page__history-copy'>
                    <Text className='rewards-page__history-title'>{item.descriptionCn ?? item.description ?? '奖励记录'}</Text>
                    <Text className='rewards-page__history-date'>{formatDateTimeLabel(item.createdAt)}</Text>
                  </View>
                  <View className='rewards-page__history-values'>
                    {xpDelta ? <Text className='rewards-page__history-delta'>{xpDelta}</Text> : null}
                    {coinDelta ? <Text className='rewards-page__history-delta rewards-page__history-delta--coins'>{coinDelta}</Text> : null}
                  </View>
                </View>
              )
            })}
          </Card>
        ) : (
          <Card className='rewards-page__empty-card rewards-page__empty-card--compact'>
            <Image
              className='rewards-page__empty-hero rewards-page__empty-hero--compact'
              src={cdnAsset('/assets/lovart/lovart-rewards-history-20260423-v1.webp')}
              mode='widthFix'
              lazyLoad
            />
            <Text className='rewards-page__empty-text'>还没有奖励记录，继续参与活动就会积累成长值与奖励。</Text>
          </Card>
        )}
      </View>

      <View className='rewards-page__section'>
        <Card className='rewards-page__invite-card'>
          <Text className='rewards-page__invite-title'>想拿更多奖励？</Text>
          <Text className='rewards-page__invite-text'>邀请好友加入悦聚，奖励会直接累积到你的奖励账户里。</Text>
          <Button className='rewards-page__invite-btn' onClick={() => Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })}>
            查看邀请进度
          </Button>
        </Card>
      </View>

      <View className='rewards-page__spacer' />
    </ScrollView>
  )
}