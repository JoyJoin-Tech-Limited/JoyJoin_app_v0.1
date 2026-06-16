import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registerForPoolWithPayment, getEventPool } from '@shared/api'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api/api'
import { logInfo, logError } from '../../lib/utils/logger'
import { haptics } from '../../lib/utils/haptics'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import {
  readStoredPaymentReturnContext,
  persistPaymentReturnContext,
  clearPaymentReturnContextStorage,
} from '../../lib/payment/paymentPendingOrderStorage'
import {
  markPaymentReturnContextPaid,
} from '../../lib/payment/paymentPendingOrder'
import type { MiniProgramPoolRegistrationReturnContext } from '../../lib/payment/paymentPendingOrder'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { POOLS_QUERY_KEY, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { CEREMONY_HEROES } from '../../lib/ceremonyHeroes'
import { useLoadingDeadline } from '../../hooks/useLoadingDeadline'
import StatusCard from '../../components/ui/StatusCard'
import Button from '../../components/ui/Button'
import './index.scss'

const TOAST_DURATION = 2000

interface CouponInfo {
  id: string
  code: string
  discountType: string | null
  discountValue: number | null
}

interface PaymentState {
  status: 'idle' | 'creating' | 'paying' | 'verifying' | 'success' | 'failed'
  paymentId?: string
  wechatOrderId?: string
  error?: string
}

interface PricingPlan {
  planType: string
  priceInCents: number
  originalPriceInCents?: number | null
}

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`
}

function calculateSavings(singlePrice: number, packPrice: number, count: number): number {
  return singlePrice * count - packPrice
}

function getBestCoupon(coupons: CouponInfo[], originalAmount: number): { coupon: CouponInfo; discountAmount: number } | null {
  if (!coupons.length) return null
  let best: { coupon: CouponInfo; discountAmount: number } | null = null
  for (const c of coupons) {
    if (c.discountType === 'percentage' && c.discountValue) {
      const d = Math.floor(originalAmount * (c.discountValue / 100))
      if (!best || d > best.discountAmount) best = { coupon: c, discountAmount: d }
    } else if (c.discountType === 'fixed_amount' && c.discountValue) {
      const d = Math.min(originalAmount, c.discountValue)
      if (!best || d > best.discountAmount) best = { coupon: c, discountAmount: d }
    }
  }
  return best
}

export default function EventTicketPaymentPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const deviceTier = useDeviceTier()

  const [poolId, setPoolId] = useState<string>('')
  const [returnContext, setReturnContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  const [payment, setPayment] = useState<PaymentState>({ status: 'idle' })
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'pack_3' | 'pack_6'>('single')
  const [showUpsell, setShowUpsell] = useState(false)
  const [showCouponDetail, setShowCouponDetail] = useState(false)
  const [isPageReady, setIsPageReady] = useState(false)
  const [pageError, setPageError] = useState<string>('')

  const paymentInFlightRef = useRef(false)
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const returnContextRef = useRef<MiniProgramPoolRegistrationReturnContext | null>(null)

  // Keep ref in sync with state for pollVerification closure safety
  useEffect(() => {
    returnContextRef.current = returnContext
  }, [returnContext])

  // Read poolId and return context on mount
  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params ?? {}
    const pid = params.id || params.poolId || ''
    if (!pid) {
      setPageError('缺少活动信息')
      setIsPageReady(true)
      return
    }
    setPoolId(pid)

    const ctx = readStoredPaymentReturnContext({ currentUserId: user?.id })
    if (ctx.status === 'ready') {
      setReturnContext(ctx.context)
      returnContextRef.current = ctx.context
    }
    setIsPageReady(true)
  }, [user?.id])

  // Fetch pool data
  const {
    data: pool,
    isLoading: poolLoading,
    isError: poolError,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => getEventPool(apiRequest, poolId),
    enabled: !!poolId && isPageReady,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch coupons
  const { data: couponsData } = useQuery<{ coupons: CouponInfo[] }>({
    queryKey: ['mini-program', 'user-coupons'],
    queryFn: () => apiRequest<{ coupons: CouponInfo[] }>({ path: '/api/user/coupons' }),
    enabled: !!user?.id && isPageReady,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch pricing plans from ritual context for dynamic pack prices
  const { data: pricingData } = useQuery<{ plans: PricingPlan[] }>({
    queryKey: ['mini-program', 'pricing-plans'],
    queryFn: () => apiRequest<{ plans: PricingPlan[] }>({ path: '/api/payments/ritual-context' }).then(r => ({ plans: r.plans ?? [] })),
    enabled: !!user?.id && isPageReady,
    staleTime: 10 * 60 * 1000,
  })

  // Derived pricing — prefer pool.price, fallback to ritual-context, then hardcoded
  const pricingPlans = pricingData?.plans ?? []
  const eventSinglePlan = pricingPlans.find((p: PricingPlan) => p.planType === 'event_single')
  const pack3Plan = pricingPlans.find((p: PricingPlan) => p.planType === 'pack_3')
  const pack6Plan = pricingPlans.find((p: PricingPlan) => p.planType === 'pack_6')

  const singlePrice = eventSinglePlan?.priceInCents ?? 8800
  const pack3Price = pack3Plan?.priceInCents ?? 21100
  const pack6Price = pack6Plan?.priceInCents ?? 37000
  const currentPrice = selectedPlan === 'pack_3' ? pack3Price : selectedPlan === 'pack_6' ? pack6Price : singlePrice
  const savings3 = calculateSavings(singlePrice, pack3Price, 3)
  const savings6 = calculateSavings(singlePrice, pack6Price, 6)
  const bestCoupon = getBestCoupon(couponsData?.coupons ?? [], currentPrice)
  const discountAmount = bestCoupon?.discountAmount ?? 0
  const finalPrice = Math.max(0, currentPrice - discountAmount)

  // Reset transient flags on show (swipe-back safety)
  useDidShow(() => {
    if (payment.status === 'failed') {
      setPayment({ status: 'idle' })
    }
  })

  // Cleanup verification timer on unmount
  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current)
        verifyTimerRef.current = null
      }
    }
  }, [])

  const pollVerification = useCallback((orderId: string, paymentId: string) => {
    setPayment({ status: 'verifying', paymentId, wechatOrderId: orderId })
    let attempts = 0
    const maxAttempts = 20

    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)

    verifyTimerRef.current = setInterval(async () => {
      attempts++
      try {
        const statusResp = await apiRequest<{ status: string }>({
          path: `/api/payments/status/${encodeURIComponent(orderId)}`,
        })

        if (statusResp.status === 'completed') {
          if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)
          verifyTimerRef.current = null
          setPayment({ status: 'success', paymentId, wechatOrderId: orderId })
          haptics('success')

          // Update return context to paid (use ref for fresh value)
          const ctx = returnContextRef.current
          if (ctx) {
            const paid = markPaymentReturnContextPaid(ctx)
            await persistPaymentReturnContext(paid)
            setReturnContext(paid)
            returnContextRef.current = paid
          }

          // Invalidate caches
          Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] }),
            queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] }),
            queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pool', poolId] }),
            queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/discover'] }),
          ]).catch(() => {})
          evictPersistedQuery(POOLS_QUERY_KEY)
          evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
          clearPaymentReturnContextStorage()

          logInfo('[EventTicketPayment] Payment confirmed, registration created', { orderId, paymentId })
          return
        }

        if (statusResp.status === 'failed' || statusResp.status === 'closed') {
          if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)
          verifyTimerRef.current = null
          setPayment({ status: 'failed', error: '支付未成功，请重试' })
          return
        }
      } catch {
        // Continue polling on transient errors
      }

      if (attempts >= maxAttempts) {
        if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)
        verifyTimerRef.current = null
        setPayment({ status: 'failed', error: '支付确认超时，请稍后查看活动列表' })
      }
    }, 1500)
  }, [queryClient, poolId])

  const handlePay = useCallback(async () => {
    if (paymentInFlightRef.current) return
    paymentInFlightRef.current = true

    try {
      haptics('medium')
      setPayment({ status: 'creating' })

      const payload = returnContext?.draft ?? {}
      const couponCode = bestCoupon?.coupon?.code

      const result = await registerForPoolWithPayment(apiRequest, poolId, {
        ...payload,
        couponCode,
      })

      logInfo('[EventTicketPayment] Payment intent created', {
        paymentId: result.paymentId,
        wechatOrderId: result.wechatOrderId,
      })

      setPayment({ status: 'paying', paymentId: result.paymentId, wechatOrderId: result.wechatOrderId })

      try {
        await Taro.requestPayment({
          timeStamp: result.timeStamp,
          nonceStr: result.nonceStr,
          package: result.package,
          signType: result.signType as 'RSA',
          paySign: result.paySign,
        })
        pollVerification(result.wechatOrderId, result.paymentId)
      } catch (payErr: any) {
        if (payErr?.errMsg?.includes('cancel')) {
          logInfo('[EventTicketPayment] WeChat Pay cancelled by user')
          setPayment({ status: 'idle' })
        } else {
          logError('[EventTicketPayment] WeChat Pay failed', payErr)
          setPayment({ status: 'failed', error: '支付未成功，请重试' })
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? err?.error ?? '支付创建失败，请稍后重试'
      logError('[EventTicketPayment] Payment creation failed', err)
      setPayment({ status: 'failed', error: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: TOAST_DURATION })
    } finally {
      paymentInFlightRef.current = false
    }
  }, [returnContext, bestCoupon, poolId, pollVerification])

  const handleRetry = useCallback(() => {
    haptics('light')
    setPayment({ status: 'idle' })
  }, [])

  const handleBackToEvents = useCallback(() => {
    haptics('medium')
    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
  }, [])

  const handleBack = useCallback(() => {
    clearPaymentReturnContextStorage()
    Taro.navigateBack()
  }, [])

  // Loading state with deadline safeguard
  const isPageLoading = !isPageReady || poolLoading
  const { isStale: isPageLoadingStale } = useLoadingDeadline(isPageLoading, 8000)

  if (isPageLoading) {
    if (isPageLoadingStale) {
      return (
        <View className='ticket-loading ticket-loading--stale'>
          <StatusCard
            tone='error'
            title='加载有点慢'
            description='活动信息加载超时，刷新一下再试试'
            action={{
              label: '重新加载',
              onClick: () => void refetchPool(),
              variant: 'primary',
            }}
            footer={
              <Button variant='secondary' onClick={() => Taro.navigateBack()}>
                返回上一页
              </Button>
            }
          />
        </View>
      )
    }

    return (
      <View className='ticket-loading'>
        <Text className='ticket-loading__text'>加载中…</Text>
      </View>
    )
  }

  // Error state
  if (pageError || poolError || !pool) {
    return (
      <View className='ticket-error' role='alert'>
        <View className='ticket-error__icon'>
          <Text>!</Text>
        </View>
        <Text className='ticket-error__title'>{pageError || '活动信息加载失败'}</Text>
        <View className='ticket-error__actions'>
          <View className='ticket-error__btn ticket-error__btn--back' hoverClass='ticket-error__btn--pressed' onClick={handleBack}>
            <Text>返回上一步</Text>
          </View>
        </View>
      </View>
    )
  }

  // Success state
  if (payment.status === 'success') {
    return (
      <View className='ticket-success' role='status' aria-live='polite'>
        <Image
          className='ticket-success__hero'
          src={CEREMONY_HEROES.eventTicketSuccess}
          mode='aspectFit'
          ariaLabel='报名成功'
        />
        <Text className='ticket-success__title'>报名成功！</Text>
        <Text className='ticket-success__subtitle'>你已成功报名 {pool.title}</Text>
        <View className='ticket-success__cta' hoverClass='ticket-success__cta--pressed' onClick={handleBackToEvents}>
          <Text className='ticket-success__cta-text'>查看我的活动</Text>
        </View>
      </View>
    )
  }

  // Verifying state
  if (payment.status === 'verifying') {
    return (
      <View className='ticket-verifying' role='status' aria-live='polite' aria-busy='true'>
        <Image
          className='ticket-verifying__hero'
          src={CEREMONY_HEROES.paymentVerifying}
          mode='aspectFit'
          ariaLabel='支付确认中'
        />
        <Text className='ticket-verifying__text'>悦仔正在确认你的支付…</Text>
        <View className='ticket-verifying__dots'>
          <View className='ticket-verifying__dot' />
          <View className='ticket-verifying__dot' />
          <View className='ticket-verifying__dot' />
        </View>
      </View>
    )
  }

  const isPaying = payment.status === 'creating' || payment.status === 'paying'

  return (
    <View className='ticket-page'>
      <ScrollView className='ticket-scroll' scrollY>
        {/* Section 1: Event Identity */}
        <View className='ticket-section ticket-section--hero'>
          <View className='ticket-badge'>
            <Text>{pool.eventType === '酒局' ? '\u{1F377}' : '\u{1F35C}'} {pool.eventType || '饭局'}</Text>
          </View>
          <Text className='ticket-title'>{pool.title}</Text>
          <View className='ticket-meta'>
            <Text className='ticket-meta__item'>{pool.district || pool.city}</Text>
            {pool.dateTime && (
              <Text className='ticket-meta__item'>
                {new Date(pool.dateTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })}
              </Text>
            )}
          </View>
        </View>

        {/* Section 2: Registration Summary */}
        {returnContext && Object.keys(returnContext.draft).length > 0 && (
          <View className='ticket-section ticket-section--summary'>
            <Text className='ticket-section__label'>你的选择</Text>
            <View className='ticket-chips'>
              {returnContext.draft.budgetRange?.map((b: string) => (
                <View key={b} className='ticket-chip'><Text>{b}</Text></View>
              ))}
              {returnContext.draft.eventIntent?.map((i: string) => (
                <View key={i} className='ticket-chip ticket-chip--intent'><Text>{i}</Text></View>
              ))}
              {returnContext.draft.preferredLanguages?.map((l: string) => (
                <View key={l} className='ticket-chip ticket-chip--subtle'><Text>{l}</Text></View>
              ))}
              {returnContext.draft.barThemes?.map((t: string) => (
                <View key={t} className='ticket-chip ticket-chip--intent'><Text>{t}</Text></View>
              ))}
              {returnContext.draft.dietaryRestrictions?.map((d: string) => (
                <View key={d} className='ticket-chip ticket-chip--subtle'><Text>{d}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Section 3: Price Block */}
        <View className='ticket-section ticket-section--price'>
          <Text className='ticket-section__label'>活动报名费</Text>

          {selectedPlan !== 'single' && (
            <View className='ticket-plan-indicator'>
              <Text>
                {selectedPlan === 'pack_3' ? '3次活动包' : '6次活动包'}
              </Text>
              <View className='ticket-plan-reset' hoverClass='ticket-plan-reset--pressed' onClick={() => { haptics('light'); setSelectedPlan('single') }}>
                <Text>切回单次 {formatPrice(singlePrice)}</Text>
              </View>
            </View>
          )}

          <View className='ticket-price-row'>
            <Text className='ticket-price'>{formatPrice(currentPrice)}</Text>
            {selectedPlan !== 'single' && (
              <Text className='ticket-price-note'>
                {selectedPlan === 'pack_3'
                  ? `每次约 ${formatPrice(Math.floor(pack3Price / 3))}`
                  : `每次约 ${formatPrice(Math.floor(pack6Price / 6))}`}
              </Text>
            )}
          </View>

          {bestCoupon && discountAmount > 0 && (
            <View className='ticket-coupon-area'>
              <View className='ticket-coupon-row' onClick={() => { haptics('light'); setShowCouponDetail(!showCouponDetail) }}>
                <Text className='ticket-coupon-text'>
                  已为你使用新客优惠 · 立省 {formatPrice(discountAmount)}
                </Text>
                <Text className='ticket-coupon-arrow'>{showCouponDetail ? '▲' : '▼'}</Text>
              </View>
              {showCouponDetail && (
                <View className='ticket-coupon-detail'>
                  <View className='ticket-coupon-detail__row'>
                    <Text className='ticket-coupon-detail__label'>优惠码</Text>
                    <Text className='ticket-coupon-detail__value'>{bestCoupon.coupon.code}</Text>
                  </View>
                  <View className='ticket-coupon-detail__row'>
                    <Text className='ticket-coupon-detail__label'>优惠类型</Text>
                    <Text className='ticket-coupon-detail__value'>
                      {bestCoupon.coupon.discountType === 'fixed_amount' ? '固定减免' : '百分比折扣'}
                    </Text>
                  </View>
                  <View className='ticket-coupon-detail__row'>
                    <Text className='ticket-coupon-detail__label'>减免金额</Text>
                    <Text className='ticket-coupon-detail__value ticket-coupon-detail__value--highlight'>
                      -{formatPrice(discountAmount)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {discountAmount > 0 && (
            <View className='ticket-final-row'>
              <Text className='ticket-final-label'>实际支付</Text>
              <Text className='ticket-final-price'>{formatPrice(finalPrice)}</Text>
            </View>
          )}
        </View>

        {/* Section 4: Package Upsell */}
        <View className='ticket-section ticket-section--upsell'>
          <View className='ticket-upsell-trigger' hoverClass='ticket-upsell-trigger--pressed' onClick={() => { haptics('light'); setShowUpsell(!showUpsell) }}>
            <Text className='ticket-upsell-trigger__text'>
              {showUpsell ? '收起' : `3次活动包更划算 · 每次约 ${formatPrice(Math.floor(pack3Price / 3))} · 省 ${formatPrice(savings3)}`}
            </Text>
            <Text className='ticket-upsell-trigger__arrow'>{showUpsell ? '▲' : '▼'}</Text>
          </View>

          {showUpsell && (
            <View className='ticket-upsell-cards'>
              <View
                className={`ticket-upsell-card ${selectedPlan === 'pack_3' ? 'ticket-upsell-card--selected' : ''}`}
                hoverClass='ticket-upsell-card--pressed'
                onClick={() => { haptics('light'); setSelectedPlan('pack_3') }}
              >
                <View className='ticket-upsell-card__header'>
                  <Text className='ticket-upsell-card__title'>3次活动包</Text>
                  <View className='ticket-upsell-card__badge'>
                    <Text>省 {formatPrice(savings3)}</Text>
                  </View>
                </View>
                <Text className='ticket-upsell-card__price'>{formatPrice(pack3Price)}</Text>
                <Text className='ticket-upsell-card__desc'>灵活选择任意3场活动 · 每次约 {formatPrice(Math.floor(pack3Price / 3))}</Text>
              </View>

              <View
                className={`ticket-upsell-card ${selectedPlan === 'pack_6' ? 'ticket-upsell-card--selected' : ''}`}
                hoverClass='ticket-upsell-card--pressed'
                onClick={() => { haptics('light'); setSelectedPlan('pack_6') }}
              >
                <View className='ticket-upsell-card__header'>
                  <Text className='ticket-upsell-card__title'>6次活动包</Text>
                  <View className='ticket-upsell-card__badge'>
                    <Text>省 {formatPrice(savings6)}</Text>
                  </View>
                </View>
                <Text className='ticket-upsell-card__price'>{formatPrice(pack6Price)}</Text>
                <Text className='ticket-upsell-card__desc'>畅享半年活动自由 · 每次约 {formatPrice(Math.floor(pack6Price / 6))}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Abandon link */}
        <View className='ticket-abandon' hoverClass='ticket-abandon--pressed' onClick={handleBack}>
          <Text>先不报名，再看看</Text>
        </View>

        {/* Spacer for sticky CTA */}
        <View className='ticket-bottom-spacer' />
      </ScrollView>

      {/* Sticky CTA */}
      <View className='ticket-footer'>
        {payment.status === 'failed' ? (
          <View className='ticket-cta ticket-cta--retry' hoverClass='ticket-cta--pressed' onClick={handleRetry}>
            <Text className='ticket-cta__text'>重试支付</Text>
          </View>
        ) : (
          <View
            className={`ticket-cta ${isPaying ? 'ticket-cta--loading' : ''}`}
            hoverClass={isPaying ? '' : 'ticket-cta--pressed'}
            onClick={isPaying ? undefined : handlePay}
          >
            <Text className='ticket-cta__text'>
              {isPaying
                ? payment.status === 'creating' ? '准备中…' : '支付中…'
                : selectedPlan !== 'single'
                  ? `微信支付 ${formatPrice(currentPrice)}`
                  : `微信支付 ${formatPrice(finalPrice)}`}
            </Text>
          </View>
        )}

        {payment.error && (
          <View className='ticket-footer__error' role='alert'>
            <Text>{payment.error}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
