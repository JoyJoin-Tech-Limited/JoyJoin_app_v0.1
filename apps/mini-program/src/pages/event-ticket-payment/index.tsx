import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registerForPoolWithPayment, getEventPool, getUserCoupons, type UserCouponSummary } from '@shared/api'
import { getIntentLabel } from '@shared/constants'
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
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import StatusCard from '../../components/ui/StatusCard'
import IcebreakerInclusionSheet from '../../components/event-ticket-payment/IcebreakerInclusionSheet'
import './index.scss'

const TOAST_DURATION = 2000

// Ticket hero banner (Lovart asset)
// Source PNG: apps/mini-program/assets-source/lovart/registration flow/lovart-event-ticket-payment-hero-20260617-v1.png
// Built WebP: apps/mini-program/src/assets/ceremony/lovart-event-ticket-payment-hero-20260617-v1.webp
const TICKET_HERO = CEREMONY_HEROES.eventTicketHero

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

function getBestCoupon(coupons: UserCouponSummary[], originalAmount: number): UserCouponSummary | null {
  const available = coupons.filter((c) => c.status === 'available' && !c.isUsed)
  if (!available.length) return null
  let best: UserCouponSummary | null = null
  let bestDiscount = 0
  for (const c of available) {
    const discountType = c.discountType
    const discountValue = c.discountValue ?? 0
    let d = 0
    if (discountType === 'percentage') {
      d = Math.floor(originalAmount * (discountValue / 100))
    } else if (discountType === 'fixed_amount') {
      d = Math.min(originalAmount, discountValue)
    }
    if (d > bestDiscount) {
      best = c
      bestDiscount = d
    }
  }
  return best
}

function findWelcomeCoupon(coupons: UserCouponSummary[]): UserCouponSummary | null {
  const welcomes = coupons.filter((c) => {
    const code = c.code?.toUpperCase?.() ?? ''
    return code.startsWith('WELCOME') && c.status === 'available' && !c.isUsed
  })
  if (!welcomes.length) return null
  // Prefer the highest-value welcome coupon (e.g. WELCOME50 > WELCOME40).
  return welcomes.reduce((best, c) => {
    const bestValue = best.discountValue ?? 0
    const currentValue = c.discountValue ?? 0
    return currentValue > bestValue ? c : best
  }, welcomes[0])
}

function calculateDiscount(coupon: UserCouponSummary | null, originalAmount: number): number {
  if (!coupon) return 0
  const discountType = coupon.discountType
  const discountValue = coupon.discountValue ?? 0
  if (discountType === 'percentage') {
    return Math.floor(originalAmount * (discountValue / 100))
  }
  if (discountType === 'fixed_amount') {
    return Math.min(originalAmount, discountValue)
  }
  return 0
}

// Localized display labels for registration draft values.
// Mirrors the most common option sets without importing across app boundaries.
const DIETARY_LABELS: Record<string, string> = {
  none: '无限制',
  vegetarian: '素食',
  halal: '清真',
  seafood_allergy: '海鲜过敏',
}

const LANGUAGE_LABELS: Record<string, string> = {
  粤语: '粤语',
  普通话: '普通话',
  英语: '英文交流',
  English: '英文交流',
}

const ALCOHOL_LABELS: Record<string, string> = {
  可以喝酒: '可以喝酒',
  微醺就好: '微醺就好',
  无酒精: '无酒精',
}

function getDisplayLabel(value: string, category: 'intent' | 'language' | 'dietary' | 'alcohol' | 'other'): string {
  if (!value) return value
  if (category === 'intent') {
    return getIntentLabel(value)
  }
  if (category === 'language') {
    return LANGUAGE_LABELS[value] ?? value
  }
  if (category === 'dietary') {
    return DIETARY_LABELS[value] ?? value
  }
  if (category === 'alcohol') {
    return ALCOHOL_LABELS[value] ?? value
  }
  return value
}

function formatDateTimeLabel(dateTime?: string | null): string {
  if (!dateTime) return ''
  const d = new Date(dateTime)
  if (Number.isNaN(d.getTime())) return dateTime
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function EventTicketPaymentPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const deviceTier = useDeviceTier()
  const { shouldReduceMotion } = useMiniRevealMotion()

  const [poolId, setPoolId] = useState<string>('')
  const [returnContext, setReturnContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  const [payment, setPayment] = useState<PaymentState>({ status: 'idle' })
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'pack_3' | 'pack_6'>('single')
  const [showCouponDetail, setShowCouponDetail] = useState(false)
  const [isPageReady, setIsPageReady] = useState(false)
  const [pageError, setPageError] = useState<string>('')
  const [selectedCouponCode, setSelectedCouponCode] = useState<string>('')
  const [couponAppliedAt, setCouponAppliedAt] = useState<number>(0)
  const [pageEnteredAt, setPageEnteredAt] = useState<number>(0)
  const [showInclusionSheet, setShowInclusionSheet] = useState(false)

  const paymentInFlightRef = useRef(false)
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const returnContextRef = useRef<MiniProgramPoolRegistrationReturnContext | null>(null)
  const hasTrackedViewRef = useRef(false)
  const hasTrackedPlanSelectorImpressionRef = useRef(false)
  const hasTrackedTermsRowImpressionRef = useRef(false)

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

  // Fetch coupons using shared API normalizer (fixes snake_case discount_type fields)
  const { data: couponsData } = useQuery({
    queryKey: ['mini-program', 'user-coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !!user?.id && isPageReady,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch pricing plans from ritual context for dynamic pack prices
  const { data: pricingData } = useQuery<{ plans: PricingPlan[] }>({
    queryKey: ['mini-program', 'pricing-plans'],
    queryFn: () => apiRequest<{ plans: PricingPlan[] }>({ path: '/api/payments/ritual-context' }).then((r) => ({ plans: r.plans ?? [] })),
    enabled: !!user?.id && isPageReady,
    staleTime: 10 * 60 * 1000,
  })

  // Auto-select welcome coupon on first load
  useEffect(() => {
    if (!couponsData?.coupons || selectedCouponCode) return
    const welcome = findWelcomeCoupon(couponsData.coupons)
    if (welcome?.code) {
      setSelectedCouponCode(welcome.code)
      setCouponAppliedAt(Date.now())
      discoverAnalytics.track('welcome_coupon_auto_applied', undefined, {
        couponCode: welcome.code,
        context: 'event-ticket-payment',
      })
    }
  }, [couponsData?.coupons, selectedCouponCode])

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

  const selectedCoupon = useMemo(() => {
    if (!selectedCouponCode || !couponsData?.coupons) return null
    return couponsData.coupons.find((c) => c.code === selectedCouponCode && c.status === 'available' && !c.isUsed) ?? null
  }, [selectedCouponCode, couponsData?.coupons])

  const bestCoupon = useMemo(() => {
    if (selectedCoupon) return selectedCoupon
    return getBestCoupon(couponsData?.coupons ?? [], currentPrice)
  }, [selectedCoupon, couponsData?.coupons, currentPrice])

  const discountAmount = calculateDiscount(bestCoupon, currentPrice)
  const finalPrice = Math.max(0, currentPrice - discountAmount)

  // Track page view once the screen is ready and pool is known.
  useEffect(() => {
    if (!isPageReady || !poolId || hasTrackedViewRef.current) return
    hasTrackedViewRef.current = true
    setPageEnteredAt(Date.now())
    discoverAnalytics.track('event_ticket_payment_view', undefined, {
      poolId,
      defaultPlan: selectedPlan,
      hasWelcomeCoupon: Boolean(findWelcomeCoupon(couponsData?.coupons ?? [])),
      hasAnyCoupon: Boolean(couponsData?.coupons?.length),
      deviceTier: deviceTier.tier,
    })
  }, [isPageReady, poolId, pool, selectedPlan, couponsData?.coupons, deviceTier.tier])

  // Track plan selector impression once it becomes visible.
  useEffect(() => {
    if (!isPageReady || !poolId || hasTrackedPlanSelectorImpressionRef.current) return
    hasTrackedPlanSelectorImpressionRef.current = true
    discoverAnalytics.track('plan_selector_impression', undefined, {
      poolId,
      plansShown: ['single', 'pack_3', 'pack_6'],
      defaultPlan: selectedPlan,
      singlePrice,
      pack3Price,
      pack6Price,
    })
  }, [isPageReady, poolId, selectedPlan, singlePrice, pack3Price, pack6Price])

  // Track terms row impression once the ticket card is actually rendered.
  useEffect(() => {
    if (!isPageReady || !poolId || poolLoading || !pool || hasTrackedTermsRowImpressionRef.current) return
    hasTrackedTermsRowImpressionRef.current = true
    discoverAnalytics.track('ticket_terms_row_impression', undefined, {
      poolId,
      hasIcebreakerChip: true,
    })
  }, [isPageReady, poolId, poolLoading, pool])

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
          discoverAnalytics.track('pay_success', undefined, {
            poolId,
            plan: selectedPlan,
            couponCode: bestCoupon?.code ?? null,
            originalAmount: currentPrice,
            finalAmount: finalPrice,
            paymentId,
            wechatOrderId: orderId,
          })

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
          discoverAnalytics.track('pay_fail', undefined, {
            poolId,
            plan: selectedPlan,
            couponCode: bestCoupon?.code ?? null,
            originalAmount: currentPrice,
            finalAmount: finalPrice,
            paymentId,
            wechatOrderId: orderId,
            reason: statusResp.status,
          })
          return
        }
      } catch {
        // Continue polling on transient errors
      }

      if (attempts >= maxAttempts) {
        if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)
        verifyTimerRef.current = null
        setPayment({ status: 'failed', error: '支付确认超时，请稍后查看活动列表' })
        discoverAnalytics.track('pay_timeout', undefined, {
          poolId,
          plan: selectedPlan,
          couponCode: bestCoupon?.code ?? null,
          originalAmount: currentPrice,
          finalAmount: finalPrice,
          paymentId,
          wechatOrderId: orderId,
          attempts,
        })
      }
    }, 1500)
  }, [queryClient, poolId, selectedPlan, currentPrice, finalPrice, bestCoupon?.code])

  const handlePay = useCallback(async () => {
    if (paymentInFlightRef.current) return
    paymentInFlightRef.current = true

    if (!returnContext) {
      Taro.showToast({ title: '缺少报名信息，请返回重新选择', icon: 'none', duration: TOAST_DURATION })
      return
    }

    try {
      haptics('medium')
      setPayment({ status: 'creating' })
      discoverAnalytics.track('pay_start', undefined, {
        poolId,
        plan: selectedPlan,
        couponCode: bestCoupon?.code ?? null,
        originalAmount: currentPrice,
        finalAmount: finalPrice,
      })

      const payload = returnContext?.draft ?? {}
      const couponCode = bestCoupon?.code

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
          discoverAnalytics.track('pay_cancel', undefined, {
            poolId,
            plan: selectedPlan,
            couponCode: bestCoupon?.code ?? null,
            originalAmount: currentPrice,
            finalAmount: finalPrice,
            paymentId: result.paymentId,
            wechatOrderId: result.wechatOrderId,
          })
          setPayment({ status: 'idle' })
        } else {
          logError('[EventTicketPayment] WeChat Pay failed', payErr)
          discoverAnalytics.track('pay_fail', undefined, {
            poolId,
            plan: selectedPlan,
            couponCode: bestCoupon?.code ?? null,
            originalAmount: currentPrice,
            finalAmount: finalPrice,
            paymentId: result.paymentId,
            wechatOrderId: result.wechatOrderId,
            reason: 'wechat_pay_error',
            error: payErr?.errMsg ?? String(payErr),
          })
          setPayment({ status: 'failed', error: '支付未成功，请重试' })
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? err?.error ?? '支付创建失败，请稍后重试'
      logError('[EventTicketPayment] Payment creation failed', err)
      discoverAnalytics.track('pay_fail', undefined, {
        poolId,
        plan: selectedPlan,
        couponCode: bestCoupon?.code ?? null,
        originalAmount: currentPrice,
        finalAmount: finalPrice,
        reason: 'payment_creation_error',
        error: msg,
      })
      setPayment({ status: 'failed', error: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: TOAST_DURATION })
    } finally {
      paymentInFlightRef.current = false
    }
  }, [returnContext, bestCoupon, poolId, pollVerification, currentPrice, finalPrice, selectedPlan])

  const handleRetry = useCallback(() => {
    haptics('light')
    setPayment({ status: 'idle' })
  }, [])

  const handleBackToEvents = useCallback(() => {
    haptics('medium')
    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
  }, [])

  const handleBack = useCallback(() => {
    const dwellTimeMs = pageEnteredAt > 0 ? Date.now() - pageEnteredAt : 0
    discoverAnalytics.track('event_ticket_payment_abandon', undefined, {
      poolId,
      selectedPlan,
      couponApplied: Boolean(bestCoupon),
      couponCode: bestCoupon?.code ?? null,
      discountAmount,
      finalAmount: finalPrice,
      dwellTimeMs,
      hasReturnContext: Boolean(returnContext),
    })
    clearPaymentReturnContextStorage()
    Taro.navigateBack()
  }, [poolId, selectedPlan, bestCoupon, discountAmount, finalPrice, pageEnteredAt, returnContext])

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
              <View className='ticket-loading__back' onClick={() => Taro.navigateBack()}>
                <Text>返回上一页</Text>
              </View>
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
  const eventType = pool.eventType === '酒局' ? '酒局' : '饭局'
  const eventEmoji = eventType === '酒局' ? '\u{1F377}' : '\u{1F35C}'
  const dateLabel = formatDateTimeLabel(pool.dateTime)
  const areaLabel = pool.district || pool.city || ''

  // Build choice chips from return context draft
  const draft = returnContext?.draft
  const choiceChips: Array<{ label: string; category: 'budget' | 'intent' | 'language' | 'theme' | 'dietary' | 'alcohol' | 'other' }> = []
  if (draft && Object.keys(draft).length > 0) {
    const budgets = eventType === '酒局' ? draft.barBudgetRange : draft.budgetRange
    budgets?.forEach((b: string) => choiceChips.push({ label: b, category: 'budget' }))
    draft.eventIntent?.forEach((i: string) => choiceChips.push({ label: getDisplayLabel(i, 'intent'), category: 'intent' }))
    draft.preferredLanguages?.forEach((l: string) => choiceChips.push({ label: getDisplayLabel(l, 'language'), category: 'language' }))
    draft.barThemes?.forEach((t: string) => choiceChips.push({ label: t, category: 'theme' }))
    draft.dietaryRestrictions?.forEach((d: string) => choiceChips.push({ label: getDisplayLabel(d, 'dietary'), category: 'dietary' }))
    const alcohol = Array.isArray(draft.alcoholComfort) ? draft.alcoholComfort[0] : draft.alcoholComfort
    if (alcohol) choiceChips.push({ label: getDisplayLabel(alcohol, 'alcohol'), category: 'alcohol' })
  }

  const showCouponStamp = Boolean(bestCoupon && discountAmount > 0 && couponAppliedAt > 0)
  const couponStampAnimated = showCouponStamp && !shouldReduceMotion && !deviceTier.isDegradation

  return (
    <View className='ticket-page'>
      <ScrollView className='ticket-scroll' scrollY>
        {/* ── Ticket Card ── */}
        <View className={`ticket-card ${!shouldReduceMotion && !deviceTier.isDegradation ? 'ticket-card--entrance' : ''}`}>
          {/* Banner */}
          <View className='ticket-card__banner'>
            <Image
              className='ticket-card__banner-image'
              src={TICKET_HERO}
              mode='aspectFill'
              lazyLoad={false}
              aria-hidden='true'
            />
            <View className='ticket-card__banner-scrim' />
            <View className='ticket-card__type-badge'>
              <Text className='ticket-card__type-badge-text'>{eventEmoji} {eventType}</Text>
            </View>
            <View className='ticket-card__banner-title-wrap'>
              <Text className='ticket-card__banner-title'>{pool.title}</Text>
            </View>
          </View>

          {/* Notched perforation divider */}
          <View className='ticket-card__perforation'>
            <View className='ticket-card__notch ticket-card__notch--left' />
            <View className='ticket-card__dash-line' />
            <View className='ticket-card__notch ticket-card__notch--right' />
          </View>

          {/* Event meta grid */}
          <View className='ticket-card__body'>
            <View className='ticket-card__meta-grid'>
              <View className='ticket-card__meta-cell'>
                <Text className='ticket-card__meta-label'>地点</Text>
                <Text className='ticket-card__meta-value'>{areaLabel || '待定'}</Text>
                {!areaLabel && (
                  <Text className='ticket-card__meta-hint'>匹配成功后 24 小时内公布</Text>
                )}
              </View>
              <View className='ticket-card__meta-cell ticket-card__meta-cell--right'>
                <Text className='ticket-card__meta-label'>时间</Text>
                <Text className='ticket-card__meta-value'>{dateLabel || '待定'}</Text>
                {!dateLabel && (
                  <Text className='ticket-card__meta-hint'>确认后推送具体时段</Text>
                )}
              </View>
            </View>

            {/* Choices */}
            {choiceChips.length > 0 && (
              <View className='ticket-card__section ticket-card__section--choices'>
                <View className='ticket-card__section-header'>
                  <View className='ticket-card__section-accent' />
                  <Text className='ticket-card__section-label'>这次想怎么聚</Text>
                </View>
                <View className='ticket-card__chips'>
                  {choiceChips.map((chip, idx) => (
                    <View
                      key={`${chip.label}-${idx}`}
                      className={`ticket-card__chip ticket-card__chip--${chip.category}`}
                    >
                      <Text>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Terms */}
            <View className='ticket-card__terms'>
              <View className='ticket-card__terms-chip'>
                <Text className='ticket-card__terms-chip-text'>报名费含组织与匹配</Text>
              </View>
              <View className='ticket-card__terms-chip'>
                <Text className='ticket-card__terms-chip-text'>含悦仔多环节破冰</Text>
              </View>
              <View className='ticket-card__terms-chip'>
                <Text className='ticket-card__terms-chip-text'>现场消费 AA</Text>
              </View>
              <View className='ticket-card__terms-chip'>
                <Text className='ticket-card__terms-chip-text'>精选场地专属折扣</Text>
              </View>
            </View>

            {/* Inclusion detail link */}
            <View
              className='ticket-card__inclusion-link'
              hoverClass='ticket-card__inclusion-link--pressed'
              onClick={() => {
                haptics('light')
                setShowInclusionSheet(true)
                discoverAnalytics.track('ticket_inclusion_sheet_open', undefined, { poolId })
              }}
            >
              <Text className='ticket-card__inclusion-link-text'>查看费用包含内容</Text>
              <Text className='ticket-card__inclusion-link-chevron'>›</Text>
            </View>
          </View>

          {/* Coupon stub */}
          {bestCoupon && discountAmount > 0 && (
            <View className='ticket-card__coupon-stub'>
              <View className='ticket-card__coupon-stub-left'>
                <View className='ticket-card__coupon-stub-notch ticket-card__coupon-stub-notch--left' />
              </View>
              <View className='ticket-card__coupon-stub-body' onClick={() => {
                haptics('light')
                const next = !showCouponDetail
                setShowCouponDetail(next)
                discoverAnalytics.track(next ? 'coupon_detail_expand' : 'coupon_detail_collapse', undefined, {
                  poolId,
                  couponCode: bestCoupon?.code ?? null,
                  context: 'event-ticket-payment',
                })
              }}
              >
                <View className='ticket-card__coupon-stub-header'>
                  <Text className='ticket-card__coupon-stub-title'>悦仔见面礼</Text>
                  {couponStampAnimated && (
                    <View className='ticket-card__stamp ticket-card__stamp--animated'>
                      <Text className='ticket-card__stamp-text'>已用</Text>
                    </View>
                  )}
                  {!couponStampAnimated && showCouponStamp && (
                    <View className='ticket-card__stamp'>
                      <Text className='ticket-card__stamp-text'>已用</Text>
                    </View>
                  )}
                </View>
                <Text className='ticket-card__coupon-stub-savings'>首单立省 {formatPrice(discountAmount)}</Text>
                <Text className='ticket-card__coupon-stub-code'>
                  优惠码 {bestCoupon.code} · {showCouponDetail ? '▲' : '▼'}
                </Text>
                {showCouponDetail && (
                  <View className='ticket-card__coupon-stub-detail'>
                    <Text>已自动为你使用，无需手动操作</Text>
                  </View>
                )}
              </View>
              <View className='ticket-card__coupon-stub-right'>
                <View className='ticket-card__coupon-stub-notch ticket-card__coupon-stub-notch--right' />
              </View>
            </View>
          )}

          {/* Barcode decoration — fixed 28-line visual, not a scrollable list */}
          <View className='ticket-card__barcode' aria-hidden='true'>
            {Array.from({ length: 28 }).map((_, i) => (
              <View
                key={i}
                className='ticket-card__barcode-line'
                style={{ width: `${2 + (i % 3) * 2}rpx` }}
              />
            ))}
          </View>
        </View>

        {/* ── Plan Selector ── */}
        <View className='ticket-plan-section'>
          <View className='ticket-plan-section__header'>
            <View className='ticket-plan-section__header-accent' />
            <Text className='ticket-plan-section__label'>选择入场方案</Text>
          </View>

          <View className='ticket-plan-cards'>
            {/* Single */}
            <View
              className={`ticket-plan-card ${selectedPlan === 'single' ? 'ticket-plan-card--selected' : ''}`}
              hoverClass='ticket-plan-card--pressed'
              onClick={() => {
                haptics('light')
                if (selectedPlan !== 'single') {
                  discoverAnalytics.track('plan_switch', undefined, {
                    fromPlan: selectedPlan,
                    toPlan: 'single',
                    poolId,
                    couponCode: bestCoupon?.code ?? null,
                  })
                }
                setSelectedPlan('single')
              }}
            >
              <View className='ticket-plan-card__radio'>
                <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'single' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
              </View>
              <View className='ticket-plan-card__body'>
                <View className='ticket-plan-card__top'>
                  <Text className='ticket-plan-card__title'>单次体验</Text>
                  <Text className='ticket-plan-card__price'>{formatPrice(singlePrice)}</Text>
                </View>
                <Text className='ticket-plan-card__desc'>先体验一场，合适再续杯</Text>
              </View>
            </View>

            {/* 3-pack */}
            <View
              className={`ticket-plan-card ${selectedPlan === 'pack_3' ? 'ticket-plan-card--selected' : ''}`}
              hoverClass='ticket-plan-card--pressed'
              onClick={() => {
                haptics('light')
                if (selectedPlan !== 'pack_3') {
                  discoverAnalytics.track('plan_switch', undefined, {
                    fromPlan: selectedPlan,
                    toPlan: 'pack_3',
                    poolId,
                    couponCode: bestCoupon?.code ?? null,
                  })
                }
                setSelectedPlan('pack_3')
              }}
            >
              <View className='ticket-plan-card__radio'>
                <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'pack_3' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
              </View>
              <View className='ticket-plan-card__body'>
                <View className='ticket-plan-card__top'>
                  <View className='ticket-plan-card__title-wrap'>
                    <Text className='ticket-plan-card__title'>3 次聚会卡</Text>
                    <View className='ticket-plan-card__badge'>
                      <Text>省 {formatPrice(savings3)}</Text>
                    </View>
                  </View>
                  <Text className='ticket-plan-card__price'>{formatPrice(pack3Price)}</Text>
                </View>
                <Text className='ticket-plan-card__desc'>灵活选择任意 3 场 · 每次约 {formatPrice(Math.floor(pack3Price / 3))}</Text>
              </View>
            </View>

            {/* 6-pack */}
            <View
              className={`ticket-plan-card ${selectedPlan === 'pack_6' ? 'ticket-plan-card--selected' : ''}`}
              hoverClass='ticket-plan-card--pressed'
              onClick={() => {
                haptics('light')
                if (selectedPlan !== 'pack_6') {
                  discoverAnalytics.track('plan_switch', undefined, {
                    fromPlan: selectedPlan,
                    toPlan: 'pack_6',
                    poolId,
                    couponCode: bestCoupon?.code ?? null,
                  })
                }
                setSelectedPlan('pack_6')
              }}
            >
              <View className='ticket-plan-card__radio'>
                <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'pack_6' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
              </View>
              <View className='ticket-plan-card__body'>
                <View className='ticket-plan-card__top'>
                  <View className='ticket-plan-card__title-wrap'>
                    <Text className='ticket-plan-card__title'>6 次聚会卡</Text>
                    <View className='ticket-plan-card__badge ticket-plan-card__badge--best'>
                      <Text>最佳价值</Text>
                    </View>
                  </View>
                  <Text className='ticket-plan-card__price'>{formatPrice(pack6Price)}</Text>
                </View>
                <Text className='ticket-plan-card__desc'>畅享半年活动自由 · 每次约 {formatPrice(Math.floor(pack6Price / 6))}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Price Summary ── */}
        <View className='ticket-price-summary'>
          <View className='ticket-price-summary__row'>
            <Text className='ticket-price-summary__label'>方案金额</Text>
            <Text className={`ticket-price-summary__value ${discountAmount > 0 ? 'ticket-price-summary__value--struck' : ''}`}>
              {formatPrice(currentPrice)}
            </Text>
          </View>
          {discountAmount > 0 && (
            <View className='ticket-price-summary__row'>
              <Text className='ticket-price-summary__label'>新人优惠</Text>
              <Text className='ticket-price-summary__value ticket-price-summary__value--discount'>
                -{formatPrice(discountAmount)}
              </Text>
            </View>
          )}
          <View className='ticket-price-summary__row ticket-price-summary__row--total'>
            <Text className='ticket-price-summary__label'>实付金额</Text>
            <Text className='ticket-price-summary__value ticket-price-summary__value--total'>{formatPrice(finalPrice)}</Text>
          </View>
        </View>

        {/* ── Trust & Policy ── */}
        <View className='ticket-trust-row'>
          <Text className='ticket-trust-row__text'>微信支付 · 安全加密</Text>
        </View>
        <View
          className='ticket-refund-link'
          hoverClass='ticket-refund-link--pressed'
          onClick={() => {
            haptics('light')
            discoverAnalytics.track('refund_policy_viewed', undefined, { poolId, context: 'event-ticket-payment' })
            Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.terms })
          }}
        >
          <Text className='ticket-refund-link__text'>查看退款与取消政策</Text>
          <Text className='ticket-refund-link__arrow'>›</Text>
        </View>

        {/* ── Abandon link ── */}
        <View className='ticket-abandon' hoverClass='ticket-abandon--pressed' onClick={handleBack}>
          <Text>稍后再报名，已保存你的选择</Text>
        </View>

        {/* Spacer for sticky CTA */}
        <View className='ticket-bottom-spacer' />
      </ScrollView>

      {/* ── Sticky CTA ── */}
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
            <View className='ticket-cta__content'>
              <Text className='ticket-cta__text'>
                {isPaying
                  ? payment.status === 'creating' ? '准备中…' : '支付中…'
                  : `立即锁定席位 · ${formatPrice(finalPrice)}`}
              </Text>
              {!isPaying && discountAmount > 0 && (
                <View className='ticket-cta__badge'>
                  <Text className='ticket-cta__badge-text'>已省 {formatPrice(discountAmount)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {payment.error && (
          <View className='ticket-footer__error' role='alert'>
            <Text>{payment.error}</Text>
          </View>
        )}
      </View>

      {/* ── Inclusion detail sheet ── */}
      <IcebreakerInclusionSheet
        visible={showInclusionSheet}
        shouldReduceMotion={shouldReduceMotion}
        onClose={() => {
          setShowInclusionSheet(false)
          discoverAnalytics.track('ticket_inclusion_sheet_close', undefined, { poolId })
        }}
      />
    </View>
  )
}
