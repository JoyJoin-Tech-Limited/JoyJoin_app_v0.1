import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getUserCoupons,
  getUserGamificationHistory,
  getUserGamificationInfo,
  type GamificationTransaction,
  type UserCouponSummary,
  type UserGamificationSummary,
} from '@shared/api'
import { LEVELS, getLevelDiscount } from '@shared/gamification'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { getCouponDisplayName } from '../../../lib/payment/couponDisplay'
import { apiRequest } from '../../../lib/api/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { haptics } from '../../../lib/utils/haptics'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import Button from '../../../components/ui/Button'
import { usePageTTI } from '../../../hooks/usePageTTI'
import './index.scss'

const HISTORY_LIMIT = 5
const DAY_MS = 24 * 60 * 60 * 1000
/** Any all-caps token is an internal coupon code, never user-facing copy. */
const RAW_CODE_PATTERN = /^[A-Z0-9_]+$/

type CouponStatus = 'available' | 'used' | 'expired'

interface CouponValue {
  prefix?: string
  main: string
  suffix?: string
}

interface CouponView {
  id: string
  status: CouponStatus
  name: string
  value: CouponValue
  meta: string
  urgent: boolean
  historyMeta: string
  /** validUntil as epoch ms (0 when absent) — sort key for available rows. */
  expiryTime: number
  /** usedAt || validUntil || createdAt as epoch ms — sort key for history rows. */
  historyTime: number
}

interface GrowthRow {
  id: string
  date: string
  label: string
  delta: string
}

function resolveCouponStatus(coupon: UserCouponSummary): CouponStatus {
  if (coupon.isUsed || coupon.status === 'used') {
    return 'used'
  }
  if (coupon.status === 'expired') {
    return 'expired'
  }
  if (coupon.validUntil) {
    const end = new Date(coupon.validUntil).getTime()
    if (!Number.isNaN(end) && end < Date.now()) {
      return 'expired'
    }
  }
  return 'available'
}

function resolveCouponName(coupon: UserCouponSummary): string {
  const name = getCouponDisplayName(coupon.code).trim()
  if (!name || RAW_CODE_PATTERN.test(name)) {
    return '活动优惠券'
  }
  return name
}

function resolveCouponValue(coupon: UserCouponSummary): CouponValue {
  const value = typeof coupon.discountValue === 'number' ? coupon.discountValue : null
  if (value === null) {
    return { main: '优惠' }
  }
  if (coupon.discountType === 'fixed_amount') {
    return { prefix: '¥', main: `${Math.floor(value / 100)}` }
  }
  if (coupon.discountType === 'percentage') {
    if (value >= 100) {
      return { main: '免单' }
    }
    if (value > 0 && value % 10 === 0) {
      return { main: `${Math.round((100 - value) / 10)}`, suffix: '折' }
    }
    if (value > 0) {
      return { prefix: '减', main: `${Math.round(100 - value)}%` }
    }
  }
  return { main: '优惠' }
}

function resolveExpiry(validUntil?: string | null): { text: string; urgent: boolean } {
  if (!validUntil) {
    return { text: '长期有效', urgent: false }
  }
  const end = new Date(validUntil).getTime()
  if (Number.isNaN(end)) {
    return { text: '有效期未定', urgent: false }
  }
  const remaining = end - Date.now()
  if (remaining <= 0) {
    return { text: '已过期', urgent: false }
  }
  if (remaining <= DAY_MS) {
    return { text: '今天到期', urgent: true }
  }
  if (remaining <= 7 * DAY_MS) {
    return { text: `还剩 ${Math.ceil(remaining / DAY_MS)} 天`, urgent: true }
  }
  const date = new Date(end)
  return { text: `${date.getMonth() + 1}月${date.getDate()}日到期`, urgent: false }
}

function resolveSourceLabel(source?: string | null): string | null {
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
      return null
  }
}

function toCouponView(coupon: UserCouponSummary): CouponView {
  const status = resolveCouponStatus(coupon)
  const expiry = resolveExpiry(coupon.validUntil)
  const source = resolveSourceLabel(coupon.source)
  const historyDate = formatHistoryDate(
    status === 'used' ? coupon.usedAt : coupon.validUntil ?? coupon.createdAt,
  )
  return {
    id: coupon.id,
    status,
    name: resolveCouponName(coupon),
    value: resolveCouponValue(coupon),
    meta: source ? `${source} · ${expiry.text}` : expiry.text,
    urgent: expiry.urgent,
    historyMeta: `${status === 'used' ? '已使用' : '已过期'} · ${historyDate}`,
    expiryTime: toTimestamp(coupon.validUntil),
    historyTime:
      toTimestamp(coupon.usedAt) ||
      toTimestamp(coupon.validUntil) ||
      toTimestamp(coupon.createdAt),
  }
}

function formatHistoryDate(value?: string | null): string {
  if (!value) {
    return '时间未定'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未定'
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function buildGrowthRows(transactions: GamificationTransaction[]): GrowthRow[] {
  return transactions
    .filter((transaction) => (transaction.xpAmount ?? 0) > 0)
    .slice(0, HISTORY_LIMIT)
    .map((transaction) => ({
      id: transaction.id,
      date: formatHistoryDate(transaction.createdAt),
      label: transaction.descriptionCn ?? transaction.description ?? '成长值',
      delta: `+${transaction.xpAmount ?? 0} 成长值`,
    }))
}

export default function RewardsPage() {
  const { isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()
  const [historyOpen, setHistoryOpen] = useState(false)

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

  usePageTTI({
    pageName: 'rewards',
    ready: !authLoading && !couponsQuery.isLoading,
  })

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'gamification-history'] })
  }, [queryClient])

  // Pull-to-refresh is silent (the gesture is its own feedback); the retry
  // button needs the tap acknowledgement.
  const handleRetry = useCallback(() => {
    haptics('light')
    handleRefresh()
  }, [handleRefresh])

  const handleDiscover = useCallback(() => {
    haptics('medium')
    void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
  }, [])

  const handleToggleHistory = useCallback(() => {
    haptics('light')
    setHistoryOpen((open) => !open)
  }, [])

  const isRefreshing =
    couponsQuery.isRefetching || gamificationQuery.isRefetching || historyQuery.isRefetching

  const couponViews = useMemo(
    () => (couponsQuery.data?.coupons ?? []).map(toCouponView),
    [couponsQuery.data],
  )

  const availableCoupons = useMemo(
    () =>
      couponViews
        .filter((coupon) => coupon.status === 'available')
        .sort((a, b) => {
          // Soonest expiry first; coupons without a date sink to the bottom.
          if (a.expiryTime === 0 && b.expiryTime === 0) {
            return 0
          }
          if (a.expiryTime === 0) {
            return 1
          }
          if (b.expiryTime === 0) {
            return -1
          }
          return a.expiryTime - b.expiryTime
        }),
    [couponViews],
  )

  const historyCoupons = useMemo(
    () =>
      couponViews
        .filter((coupon) => coupon.status !== 'available')
        .sort((a, b) => b.historyTime - a.historyTime),
    [couponViews],
  )

  const growthRows = useMemo(
    () => buildGrowthRows(historyQuery.data ?? []),
    [historyQuery.data],
  )

  const gamification = gamificationQuery.data
  const currentLevel = gamification?.currentLevel ?? 1
  const currentXp = gamification?.experiencePoints ?? 0
  const currentDiscount = getLevelDiscount(currentLevel)
  const nextDiscountLevel = LEVELS.find(
    (entry) => entry.level > currentLevel && getLevelDiscount(entry.level) > currentDiscount,
  )
  const nextDiscount = nextDiscountLevel ? getLevelDiscount(nextDiscountLevel.level) : 0
  const growthGap = nextDiscountLevel
    ? Math.max(0, nextDiscountLevel.xpRequired - currentXp)
    : 0
  const growthHint = nextDiscountLevel
    ? `再积累 ${growthGap} 成长值，活动价可减 ${nextDiscount}%`
    : '已享最高折扣'
  const joyCoins = gamification?.joyCoins ?? 0

  if (authLoading || couponsQuery.isLoading) {
    return <LoadingScreen message='正在整理你的奖励…' />
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
      <View className='rewards-page__scroll-inner'>
        <View className='rewards-page__section'>
          <View className='rewards-page__section-head'>
            <Text className='rewards-page__section-title'>可用优惠券</Text>
            {!couponsQuery.isError && availableCoupons.length > 0 ? (
              <Text className='rewards-page__section-count'>{availableCoupons.length} 张</Text>
            ) : null}
          </View>

          {couponsQuery.isError ? (
            <View className='rewards-page__notice'>
              <Text className='rewards-page__notice-title'>优惠券加载没成功</Text>
              <Text className='rewards-page__notice-body'>下拉刷新，或点下面重新加载。</Text>
              <Button
                variant='secondary'
                size='sm'
                className='rewards-page__notice-btn'
                onClick={handleRetry}
              >
                重新加载
              </Button>
            </View>
          ) : availableCoupons.length > 0 ? (
            <View className='rewards-page__wallet'>
              {availableCoupons.map((coupon, index) => (
                <View
                  key={coupon.id}
                  className={`rewards-page__coupon${index > 0 ? ' rewards-page__coupon--divided' : ''}`}
                >
                  <View className='rewards-page__coupon-value'>
                    <Text className='rewards-page__coupon-figure'>
                      {coupon.value.prefix ? (
                        <Text className='rewards-page__coupon-unit'>{coupon.value.prefix}</Text>
                      ) : null}
                      {coupon.value.main}
                      {coupon.value.suffix ? (
                        <Text className='rewards-page__coupon-unit'>{coupon.value.suffix}</Text>
                      ) : null}
                    </Text>
                  </View>
                  <View className='rewards-page__coupon-body'>
                    <Text className='rewards-page__coupon-name'>{coupon.name}</Text>
                    <Text
                      className={`rewards-page__coupon-meta${coupon.urgent ? ' rewards-page__coupon-meta--urgent' : ''}`}
                    >
                      {coupon.meta}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className='rewards-page__empty'>
              <Image
                className='rewards-page__empty-art'
                src={cdnAsset('/assets/lovart/lovart-rewards-empty-20260423-v1.webp')}
                mode='aspectFit'
                lazyLoad
              />
              <Text className='rewards-page__empty-title'>暂时没有可用的券</Text>
              <Text className='rewards-page__empty-body'>
                {historyCoupons.length > 0
                  ? '已使用和已过期的券都收在下面。新券到账后，会出现在这里。'
                  : '新券到账后会出现在这里，报名结算时可直接抵扣。'}
              </Text>
              <Button variant='primary' className='rewards-page__empty-btn' onClick={handleDiscover}>
                去挑一场活动
              </Button>
            </View>
          )}
        </View>

        {!couponsQuery.isError && availableCoupons.length > 0 ? (
          <View
            className='rewards-page__quiet-cta'
            hoverClass='rewards-page__quiet-cta--pressed'
            onClick={handleDiscover}
          >
            <Text className='rewards-page__quiet-cta-label'>去挑一场活动</Text>
            <Text className='rewards-page__quiet-cta-chevron'>›</Text>
          </View>
        ) : null}

        {gamification ? (
          <View className='rewards-page__account'>
            <View className='rewards-page__account-row'>
              <Text className='rewards-page__account-level'>
                Lv.{currentLevel} · {currentXp} 成长值
              </Text>
              {currentDiscount > 0 ? (
                <Text className='rewards-page__account-value'>活动价减 {currentDiscount}%</Text>
              ) : null}
            </View>
            <Text className='rewards-page__account-hint'>{growthHint}</Text>
            {currentXp === 0 && currentDiscount === 0 ? (
              <Text className='rewards-page__account-hint rewards-page__account-hint--soft'>
                完成活动反馈可积累成长值
              </Text>
            ) : null}
            {joyCoins > 0 ? (
              <Text className='rewards-page__coins'>悦币 {joyCoins} · 暂不可兑换，余额长期保留</Text>
            ) : null}
          </View>
        ) : null}

        {growthRows.length > 0 ? (
          <View className='rewards-page__growth'>
            <View className='rewards-page__section-head'>
              <Text className='rewards-page__section-title'>最近成长</Text>
            </View>
            {growthRows.map((row) => (
              <View key={row.id} className='rewards-page__growth-row'>
                <Text className='rewards-page__growth-date'>{row.date}</Text>
                <Text className='rewards-page__growth-label'>{row.label}</Text>
                <Text className='rewards-page__growth-delta'>{row.delta}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {historyCoupons.length > 0 ? (
          <View className='rewards-page__history'>
            <View
              className='rewards-page__history-head'
              hoverClass='rewards-page__history-head--pressed'
              onClick={handleToggleHistory}
            >
              <Text className='rewards-page__history-title'>已使用与已过期</Text>
              <View className='rewards-page__history-summary'>
                <Text className='rewards-page__history-count'>{historyCoupons.length} 张</Text>
                <Text
                  className={`rewards-page__history-chevron${historyOpen ? ' rewards-page__history-chevron--open' : ''}`}
                >
                  ›
                </Text>
              </View>
            </View>
            {historyOpen
              ? historyCoupons.map((coupon) => (
                  <View key={coupon.id} className='rewards-page__history-row'>
                    <Text className='rewards-page__history-name'>{coupon.name}</Text>
                    <Text className='rewards-page__history-meta'>{coupon.historyMeta}</Text>
                    <Text className='rewards-page__history-value'>
                      {`${coupon.value.prefix ?? ''}${coupon.value.main}${coupon.value.suffix ?? ''}`}
                    </Text>
                  </View>
                ))
              : null}
          </View>
        ) : null}
        <View className='rewards-page__spacer' />
      </View>
    </ScrollView>
  )
}
