import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registerForPoolWithPayment, getEventPool, getUserCoupons, reconcilePayment } from '@shared/api'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { logInfo, logError } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import {
  readStoredPaymentReturnContext,
  persistPaymentReturnContext,
  clearPaymentReturnContextStorage,
} from '../../../lib/payment/paymentPendingOrderStorage'
import {
  markPaymentReturnContextPaid,
} from '../../../lib/payment/paymentPendingOrder'
import type { MiniProgramPoolRegistrationReturnContext } from '../../../lib/payment/paymentPendingOrder'
import { bustRegistrationCaches } from '../../../lib/api/registrationCacheBust'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import { getEventTicketTailAsset } from '../../../lib/eventTicketTailAssets'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { useLoadingDeadline } from '../../../hooks/useLoadingDeadline'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import { interactionLatency } from '../../../lib/analytics/interactionLatency'
import StatusCard from '../../../components/ui/StatusCard'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import TicketSuccessView from './components/TicketSuccessView'
import IcebreakerInclusionSheet from '../../../components/event-ticket-payment/IcebreakerInclusionSheet'
import TicketOrderSkeleton, { getTicketCtaLabel } from '../../../components/payments/TicketOrderSkeleton'
import {
  calculateDiscount,
  calculateSavings,
  findWelcomeCoupon,
  formatBudgetLabel,
  formatDateTimeLabel,
  formatPrice,
  getBestCoupon,
  getDisplayLabel,
  type PricingPlan,
} from './ticketHelpers'
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

export default function EventTicketPaymentPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const deviceTier = useDeviceTier()
  const { shouldReduceMotion } = useMiniRevealMotion()

  const motionEnabled = useMemo(() => !shouldReduceMotion && !deviceTier.isDegradation, [shouldReduceMotion, deviceTier.isDegradation])

  const [poolId, setPoolId] = useState<string>('')
  const [returnContext, setReturnContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  const [payment, setPayment] = useState<PaymentState>({ status: 'idle' })
  // Cancel-retention (Wave 1, 2026-08-05): first cancel shows a soft inline
  // note; the second cancel surfaces the retention sheet. Anti-nag — the
  // sheet dismisses once and stays dismissed for the session, and the counter
  // intentionally survives useResetOnShow re-shows (one-shot per page visit).
  const [cancelCount, setCancelCount] = useState(0)
  const [cancelSheetDismissed, setCancelSheetDismissed] = useState(false)
  const cancelRetentionShownRef = useRef(false)

  // Fire the retention-sheet impression once, when it first becomes visible.
  useEffect(() => {
    if (cancelCount < 2 || cancelSheetDismissed || cancelRetentionShownRef.current) return
    cancelRetentionShownRef.current = true
    discoverAnalytics.track('pay_cancel_retention_shown', undefined, { poolId })
  }, [cancelCount, cancelSheetDismissed, poolId])
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'pack_3' | 'pack_6'>('single')
  const [showCouponDetail, setShowCouponDetail] = useState(false)
  const [isPageReady, setIsPageReady] = useState(false)
  const [pageError, setPageError] = useState<string>('')
  const [selectedCouponCode, setSelectedCouponCode] = useState<string>('')
  const [couponAppliedAt, setCouponAppliedAt] = useState<number>(0)
  const [pageEnteredAt, setPageEnteredAt] = useState<number>(0)
  const [showInclusionSheet, setShowInclusionSheet] = useState(false)
  const [tailImageError, setTailImageError] = useState(false)
  const [tailImageLoaded, setTailImageLoaded] = useState(false)
  const [tailLoadTimedOut, setTailLoadTimedOut] = useState(false)

  const paymentInFlightRef = useRef(false)
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const returnContextRef = useRef<MiniProgramPoolRegistrationReturnContext | null>(null)
  const tailErrorHandledRef = useRef(false)
  const tailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // If the selected/auto-selected coupon yields zero discount for the current price,
  // don't send it to the server. This prevents the server from rejecting the order
  // with "此优惠码不可用或已过期" when the test price is below the coupon's effective
  // minimum (e.g. 1 cent with a percentage coupon).
  const effectiveCouponCode = useMemo(() => {
    if (discountAmount > 0) return bestCoupon?.code
    return undefined
  }, [discountAmount, bestCoupon?.code])

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

  // Derived event-type label used for event-type-aware UI and analytics.
  const eventType = pool?.eventType === '酒局' ? '酒局' : '饭局'

  // Tail image load timeout: if the CDN asset has not loaded within 4s,
  // fall back to the barcode decoration so users never see a blank band.
  useEffect(() => {
    if (deviceTier.isDegradation || tailImageLoaded || tailImageError || tailLoadTimedOut) return
    tailTimeoutRef.current = setTimeout(() => {
      setTailLoadTimedOut(true)
      logInfo('[EventTicketPayment] Tail image load timed out, falling back to barcode', { eventType, poolId })
    }, 4000)
    return () => {
      if (tailTimeoutRef.current) {
        clearTimeout(tailTimeoutRef.current)
        tailTimeoutRef.current = null
      }
    }
  }, [deviceTier.isDegradation, tailImageLoaded, tailImageError, tailLoadTimedOut, eventType, poolId])

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
    // Responsive fallback polling: 20 attempts × 1 second = 20 seconds total.
    // The primary confirmation path is the WeChat Pay webhook, which typically
    // arrives in under 5 seconds. Polling only covers delayed webhook delivery.
    const maxAttempts = 20
    const pollIntervalMs = 1000

    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current)

    const finish = (status: 'success' | 'failed', error?: string) => {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current)
        verifyTimerRef.current = null
      }
      if (status === 'success') {
        setPayment({ status: 'success', paymentId, wechatOrderId: orderId })
        haptics('success')
      } else {
        setPayment({ status: 'failed', error: error || '支付未成功，请重试' })
      }
    }

    verifyTimerRef.current = setInterval(async () => {
      attempts++
      try {
        const statusResp = await apiRequest<{ status: string }>({
          path: `/api/payments/status/${encodeURIComponent(orderId)}`,
        })

        logInfo('[EventTicketPayment] Poll status', {
          orderId,
          paymentId,
          attempt: attempts,
          status: statusResp.status,
        })

        if (statusResp.status === 'completed') {
          finish('success')
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
          void bustRegistrationCaches(queryClient, { poolId })
          clearPaymentReturnContextStorage()

          logInfo('[EventTicketPayment] Payment confirmed, registration created', { orderId, paymentId })
          return
        }

        if (statusResp.status === 'failed' || statusResp.status === 'closed') {
          finish('failed', '支付未成功，请重试')
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
      } catch (err) {
        logError('[EventTicketPayment] Poll status error', {
          message: err instanceof Error ? err.message : String(err),
        })
        // Continue polling on transient errors
      }

      if (attempts >= maxAttempts) {
        // Last-resort server-side reconciliation before giving up.
        try {
          logInfo('[EventTicketPayment] Polling window exhausted, requesting server reconciliation', {
            orderId,
            paymentId,
            attempts,
          })
          const reconcileResp = await reconcilePayment(apiRequest, orderId)
          logInfo('[EventTicketPayment] Reconcile response', {
            orderId,
            paymentId,
            status: reconcileResp.status,
            fulfilled: reconcileResp.fulfilled,
          })

          if (reconcileResp.status === 'completed') {
            finish('success')
            discoverAnalytics.track('pay_success', undefined, {
              poolId,
              plan: selectedPlan,
              couponCode: bestCoupon?.code ?? null,
              originalAmount: currentPrice,
              finalAmount: finalPrice,
              paymentId,
              wechatOrderId: orderId,
              via: 'reconcile',
            })

            const ctx = returnContextRef.current
            if (ctx) {
              const paid = markPaymentReturnContextPaid(ctx)
              await persistPaymentReturnContext(paid)
              setReturnContext(paid)
              returnContextRef.current = paid
            }

            void bustRegistrationCaches(queryClient, { poolId })
            clearPaymentReturnContextStorage()
            return
          }
        } catch (reconcileErr) {
          logError('[EventTicketPayment] Reconcile request failed', { error: String(reconcileErr) })
        }

        finish('failed', '支付确认超时，请稍后查看活动列表')
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
    }, pollIntervalMs)
  }, [queryClient, poolId, selectedPlan, currentPrice, finalPrice, bestCoupon?.code])

  const handlePay = useCallback(async () => {
    if (paymentInFlightRef.current) return
    paymentInFlightRef.current = true

    if (!returnContext) {
      Taro.showToast({ title: '缺少报名信息，请返回重新选择', icon: 'none', duration: TOAST_DURATION })
      return
    }

    const t0 = interactionLatency.startInteraction()

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
      const couponCode = effectiveCouponCode

      const result = await registerForPoolWithPayment(apiRequest, poolId, {
        ...payload,
        couponCode,
      })

      logInfo('[EventTicketPayment] Payment intent created', {
        paymentId: result.paymentId,
        wechatOrderId: result.wechatOrderId,
      })

      // Interaction-latency baseline: order created, UI transitions to paying.
      interactionLatency.trackInteraction('payment_order_create', t0)
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
          setCancelCount((count) => count + 1)
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

  const [isNavigating, setIsNavigating] = useState(false)
  useResetOnShow(setIsNavigating)

  const handleBackToEvents = useCallback(() => {
    if (isNavigating) return
    setIsNavigating(true)
    haptics('medium')
    discoverAnalytics.track('event_ticket_payment_success_cta_tap', undefined, { poolId })
    Taro.switchTab({
      url: MINI_PROGRAM_ROUTES.events,
      fail: () => {
        setIsNavigating(false)
        Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
      },
    })
  }, [isNavigating, poolId])

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
      <View className='ticket-loading' role='status' aria-live='polite' aria-busy='true'>
        <Image
          className='ticket-loading__mascot'
          src={getXiaoyueExpressionAsset('loadingSystem')}
          mode='aspectFit'
          ariaLabel='加载中'
        />
        <Text className='ticket-loading__text'>正在准备你的票…</Text>
        <View className='ticket-loading__dots'>
          <View className='ticket-loading__dot' />
          <View className='ticket-loading__dot' />
          <View className='ticket-loading__dot' />
        </View>
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
      <TicketSuccessView
        pool={pool}
        eventType={eventType}
        motionEnabled={motionEnabled}
        onCtaClick={handleBackToEvents}
        ctaDisabled={isNavigating}
        poolId={poolId}
      />
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
  const dateLabel = formatDateTimeLabel(pool.dateTime)
  const areaLabel = pool.district || pool.city || ''

  // Build choice chips from return context draft
  const draft = returnContext?.draft
  const choiceChips: Array<{ label: string; category: 'budget' | 'intent' | 'language' | 'theme' | 'dietary' | 'alcohol' | 'other' }> = []
  if (draft && Object.keys(draft).length > 0) {
    const budgets = eventType === '酒局' ? draft.barBudgetRange : draft.budgetRange
    budgets?.forEach((b: string) => choiceChips.push({ label: formatBudgetLabel(b), category: 'budget' }))
    draft.eventIntent?.forEach((i: string) => choiceChips.push({ label: getDisplayLabel(i, 'intent'), category: 'intent' }))
    draft.preferredLanguages?.forEach((l: string) => choiceChips.push({ label: getDisplayLabel(l, 'language'), category: 'language' }))
    draft.barThemes?.forEach((t: string) => choiceChips.push({ label: t, category: 'theme' }))
    draft.dietaryRestrictions?.forEach((d: string) => choiceChips.push({ label: getDisplayLabel(d, 'dietary'), category: 'dietary' }))
    const alcohol = Array.isArray(draft.alcoholComfort) ? draft.alcoholComfort[0] : draft.alcoholComfort
    if (alcohol) choiceChips.push({ label: getDisplayLabel(alcohol, 'alcohol'), category: 'alcohol' })
  }

  const showCouponStamp = Boolean(bestCoupon && discountAmount > 0 && couponAppliedAt > 0)
  const couponStampAnimated = showCouponStamp && !shouldReduceMotion && !deviceTier.isDegradation

  // Quiet factual seat signal (Wave 1, 2026-08-05) — mirrors the OracleCard
  // corner badge data source; deliberately unstyled/urgency-free.
  const seatCount = pool.registrationCount ?? pool.currentParticipants ?? 0

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
              <View className='ticket-card__type-badge-icon'>
                <JoyJoinIcon emoji={eventType === '饭局' ? '🍜' : '🍷'} tier='category' size={40} />
              </View>
              <Text className='ticket-card__type-badge-text'>{eventType}</Text>
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

            {/* Quiet factual seat signal — no urgency styling (Wave 1) */}
            {seatCount > 0 ? (
              <Text className='ticket-card__seat-line'>已有 {seatCount} 人入座</Text>
            ) : null}

            {/* Choices */}
            {choiceChips.length > 0 && (
              <View className='ticket-card__section ticket-card__section--choices'>
                <View className='ticket-card__section-header'>
                  <View className='ticket-card__section-accent' />
                  <Text className='ticket-card__section-label'>这次想怎么聚</Text>
                </View>
                <Text className='ticket-card__section-sub'>悦仔把你的预算、期待和细节都备好了</Text>
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

          {/* Event-type full-bleed footer vignette or barcode fallback */}
          {deviceTier.isDegradation || tailImageError || tailLoadTimedOut ? (
            <View className='ticket-card__barcode' aria-hidden='true'>
              {Array.from({ length: 28 }).map((_, i) => (
                <View
                  key={i}
                  className='ticket-card__barcode-line'
                  style={{ width: `${2 + (i % 3) * 2}rpx` }}
                />
              ))}
            </View>
          ) : (
            <View className='ticket-card__tail-wrap' aria-hidden='true'>
              <Image
                className={`ticket-card__tail-image ${tailImageLoaded ? 'ticket-card__tail-image--loaded' : ''}`}
                src={getEventTicketTailAsset(eventType)}
                mode='aspectFill'
                lazyLoad={false}
                aria-hidden='true'
                onLoad={() => {
                  if (tailImageLoaded) return
                  setTailImageLoaded(true)
                  if (tailTimeoutRef.current) {
                    clearTimeout(tailTimeoutRef.current)
                    tailTimeoutRef.current = null
                  }
                  discoverAnalytics.track('ticket_tail_image_impression', undefined, {
                    poolId,
                    eventType,
                  })
                }}
                onError={() => {
                  if (tailErrorHandledRef.current) return
                  tailErrorHandledRef.current = true
                  if (tailTimeoutRef.current) {
                    clearTimeout(tailTimeoutRef.current)
                    tailTimeoutRef.current = null
                  }
                  logError('[EventTicketPayment] Tail image failed to load', { eventType, poolId })
                  discoverAnalytics.track('ticket_tail_image_load_error', undefined, {
                    poolId,
                    eventType,
                    error: 'image_load_failed',
                  })
                  setTailImageError(true)
                }}
              />
              <View className='ticket-card__tail-fade' aria-hidden='true' />
            </View>
          )}
        </View>

        {/* ── Plan Selector ── */}
        {/* Tier-M wait (M1): while the order is being created, replace the
            interactive plan/price block with a branded skeleton mirroring
            the real card — opacity-pulse shapes + honest staged copy. */}
        {payment.status === 'creating' ? (
          <TicketOrderSkeleton />
        ) : (
        <>
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
                  <Text className='ticket-plan-card__title'>单场局票</Text>
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
        </>
        )}

        {/* ── Trust & Policy ── */}
        <View className='ticket-trust-row'>
          <Image
            className='ticket-trust-row__mascot'
            src={getXiaoyueExpressionAsset('paymentTrust')}
            mode='aspectFit'
            aria-hidden='true'
          />
          <View className='ticket-trust-row__copy'>
            <Text className='ticket-trust-row__line'>有悦仔在，这场局会好好办</Text>
            <Text className='ticket-trust-row__text'>微信支付 · 安全加密</Text>
          </View>
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
          <Text>稍后再报名</Text>
        </View>

        {/* Spacer for sticky CTA */}
        <View className='ticket-bottom-spacer' />
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View className='ticket-footer'>
        {/* Soft inline note after the first cancel — in the sticky footer so
            it is never below the fold (2026-08-05 audit NIT-5). */}
        {cancelCount >= 1 && cancelCount < 2 ? (
          <View className='ticket-cancel-note' role='status' aria-live='polite'>
            <Text className='ticket-cancel-note__text'>你的选择已保存，随时回来继续</Text>
          </View>
        ) : null}
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
                {getTicketCtaLabel(isPaying, payment.status === 'creating', formatPrice(finalPrice))}
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

      {/* ── Cancel retention sheet (second cancel, once per session) ── */}
      {cancelCount >= 2 && !cancelSheetDismissed ? (
        <View className='ticket-cancel-sheet'>
          <View
            className='ticket-cancel-sheet__mask'
            role='button'
            aria-label='关闭'
            onClick={() => {
              setCancelSheetDismissed(true)
              discoverAnalytics.track('pay_cancel_retention_dismiss', undefined, { poolId })
            }}
          />
          <View className='ticket-cancel-sheet__panel' role='dialog' aria-modal='true' aria-label='报名信息已保存'>
            <Image
              className='ticket-cancel-sheet__mascot'
              src={getXiaoyueExpressionAsset('paymentTrust')}
              mode='aspectFit'
              aria-hidden='true'
            />
            <Text className='ticket-cancel-sheet__title'>报名信息已保存</Text>
            <Text className='ticket-cancel-sheet__body'>你的预算、期待和细节都在，回来就能继续。</Text>
            <View className='ticket-cancel-sheet__actions'>
              <View
                className='ticket-cancel-sheet__btn ticket-cancel-sheet__btn--primary'
                hoverClass='ticket-cancel-sheet__btn--pressed'
                onClick={() => {
                  setCancelSheetDismissed(true)
                  discoverAnalytics.track('pay_cancel_retention_tap', undefined, { poolId })
                  haptics('light')
                  void handlePay()
                }}
              >
                <Text className='ticket-cancel-sheet__btn-text'>去支付</Text>
              </View>
              <View
                className='ticket-cancel-sheet__btn ticket-cancel-sheet__btn--ghost'
                hoverClass='ticket-cancel-sheet__btn--pressed'
                onClick={() => {
                  setCancelSheetDismissed(true)
                  discoverAnalytics.track('pay_cancel_retention_dismiss', undefined, { poolId })
                }}
              >
                <Text className='ticket-cancel-sheet__btn-text'>稍后再说</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
