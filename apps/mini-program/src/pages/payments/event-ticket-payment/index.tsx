import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registerForPoolWithPayment, getEventPool, getUserCoupons, reconcilePayment } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
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
import ReservationTicket from '../../../components/reservation/ReservationTicket'
import RegistrationSuccessCeremony from '../../../components/reservation/RegistrationSuccessCeremony'
import TicketPlanSelection, { type SelectedPlan } from './components/TicketPlanSelection'
import IcebreakerInclusionSheet from '../../../components/event-ticket-payment/IcebreakerInclusionSheet'
import TicketOrderSkeleton, { getTicketCtaLabel } from '../../../components/payments/TicketOrderSkeleton'
import {
  calculateDiscount,
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
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>('single')
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
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  }, [isPageReady, poolId, selectedPlan, couponsData?.coupons, deviceTier.tier])

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

  // Success surface (Phase 4 「订座」): nav title + view tracking are page-level
  // effects keyed on the payment status, not owned by the shared ceremony
  // component (spec: docs/design/registration-ceremony-spec-20260817.md).
  useEffect(() => {
    if (payment.status !== 'success') return
    Taro.setNavigationBarTitle({ title: '报名成功' })
    discoverAnalytics.track('event_ticket_payment_success_view', undefined, { poolId: poolId ?? pool?.id })
  }, [payment.status, poolId, pool?.id])

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
        clearTimeout(verifyTimerRef.current)
        verifyTimerRef.current = null
      }
    }
  }, [])

  const pollVerification = useCallback((orderId: string, paymentId: string) => {
    setPayment({ status: 'verifying', paymentId, wechatOrderId: orderId })
    let attempts = 0
    // Capped exponential-backoff polling: webhooks usually arrive in <5s; polling
    // covers delayed delivery without hammering the status endpoint on fixed 1s
    // intervals. Delays: 500ms → 1s → 2s → 4s cap, ~23.5s total across 8
    // attempts before the final server-side reconcile fallback.
    const maxAttempts = 8
    const getPollDelay = (attempt: number) => Math.min(4000, 500 * 2 ** (attempt - 1))

    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current)

    const finish = (status: 'success' | 'failed', error?: string) => {
      if (verifyTimerRef.current) {
        clearTimeout(verifyTimerRef.current)
        verifyTimerRef.current = null
      }
      if (status === 'success') {
        setPayment({ status: 'success', paymentId, wechatOrderId: orderId })
        // No haptic here (spec §2): the celebration haptic fires on the visual
        // beat — the 「已留座」 seal landing in RegistrationSuccessCeremony —
        // not on the network response.
      } else {
        setPayment({ status: 'failed', error: error || '支付未成功，请重试' })
      }
    }

    const completeSuccess = (via: 'poll' | 'reconcile') => {
      finish('success')
      discoverAnalytics.track('pay_success', undefined, {
        poolId,
        plan: selectedPlan,
        couponCode: bestCoupon?.code ?? null,
        originalAmount: currentPrice,
        finalAmount: finalPrice,
        paymentId,
        wechatOrderId: orderId,
        via,
      })

      // Update return context to paid (use ref for fresh value)
      const ctx = returnContextRef.current
      if (ctx) {
        const paid = markPaymentReturnContextPaid(ctx)
        void persistPaymentReturnContext(paid)
        setReturnContext(paid)
        returnContextRef.current = paid
      }

      // Invalidate caches
      void bustRegistrationCaches(queryClient, { poolId })
      clearPaymentReturnContextStorage()

      logInfo('[EventTicketPayment] Payment confirmed, registration created', { orderId, paymentId, via })
    }

    const runReconcile = async () => {
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
          completeSuccess('reconcile')
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

    const scheduleNextPoll = () => {
      const delay = getPollDelay(attempts + 1)
      verifyTimerRef.current = setTimeout(async () => {
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
            completeSuccess('poll')
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
          void runReconcile()
          return
        }
        scheduleNextPoll()
      }, delay)
    }

    scheduleNextPoll()
  }, [queryClient, poolId, selectedPlan, currentPrice, finalPrice, bestCoupon?.code])

  const handlePay = useCallback(async () => {
    if (paymentInFlightRef.current) return
    paymentInFlightRef.current = true

    if (!returnContext) {
      paymentInFlightRef.current = false
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
  }, [returnContext, bestCoupon, poolId, pollVerification, currentPrice, finalPrice, selectedPlan, effectiveCouponCode])

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
        <StatusCard
          tone='error'
          heroSrc={getXiaoyueExpressionAsset('actionFailure')}
          title={pageError || '活动信息加载失败'}
          description={pageError ? '加载失败，请重试或返回' : '网络或服务器响应超时，刷新一下再试试'}
          action={{
            label: '重新加载',
            onClick: () => void refetchPool(),
            variant: 'primary',
          }}
          footer={
            <View className='ticket-loading__back' onClick={handleBack}>
              <Text>返回上一步</Text>
            </View>
          }
        />
      </View>
    )
  }

  // Success state — unified 「订座」 ceremony (Phase 4, 2026-08-17; spec §3/§4):
  // paid variant adds the 票根 tear-off; seal + celebration haptic fire here too
  // (no more toast-only success for entitlement users).
  if (payment.status === 'success') {
    // 'active' means the pool is still recruiting/collecting registrations.
    // Only 'matching' means the matching engine is actually running.
    const isMatchingInProgress = pool.status === 'matching'
    const successSubtitle = isMatchingInProgress
      ? `${DEFAULT_MASCOT_DISPLAY_NAME}已收到你的入场券，正在为你安排合适的同桌伙伴。`
      : `报名成功！${DEFAULT_MASCOT_DISPLAY_NAME}拿着你的入场券，排桌开始前会第一时间通知你。`
    const successAreaLabel = pool.district || pool.city || ''
    const successDateLabel = formatDateTimeLabel(pool.dateTime)

    return (
      <View className='ticket-page'>
        <ScrollView className='ticket-scroll' scrollY>
          <RegistrationSuccessCeremony
            variant='paid'
            title={`已加入这场${eventType}`}
            banner={{
              imageSrc: CEREMONY_HEROES.eventTicketSuccessV2.webp,
              badgeEmoji: eventType === '饭局' ? '🍜' : '🍷',
              badgeText: eventType,
              title: pool.title,
            }}
            bannerImageFallbackSrc={CEREMONY_HEROES.eventTicketSuccessV2.png}
            meta={[
              {
                key: 'venue',
                label: '地点',
                value: successAreaLabel || '待定',
                hint: successAreaLabel ? undefined : '排桌完成后 24 小时内公布',
              },
              {
                key: 'time',
                label: '时间',
                value: successDateLabel || '待定',
                hint: successDateLabel ? undefined : '确认后推送具体时段',
                align: 'right',
              },
            ]}
            seatOrdinal={pool.registrationCount ?? pool.currentParticipants}
            motionEnabled={motionEnabled}
            onCtaClick={handleBackToEvents}
            ctaDisabled={isNavigating}
          >
            <Text className='registration-ceremony__text'>{successSubtitle}</Text>
          </RegistrationSuccessCeremony>
        </ScrollView>
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
  const dateLabel = formatDateTimeLabel(pool.dateTime)
  const areaLabel = pool.district || pool.city || ''

  // Build choice chips from return context draft
  const draft = returnContext?.draft
  const choiceChips: Array<{ label: string; category: 'budget' | 'intent' | 'language' | 'theme' | 'alcohol' | 'other' }> = []
  if (draft && Object.keys(draft).length > 0) {
    const budgets = eventType === '酒局' ? draft.barBudgetRange : draft.budgetRange
    budgets?.forEach((b: string) => choiceChips.push({ label: formatBudgetLabel(b), category: 'budget' }))
    draft.eventIntent?.forEach((i: string) => choiceChips.push({ label: getDisplayLabel(i, 'intent'), category: 'intent' }))
    draft.preferredLanguages?.forEach((l: string) => choiceChips.push({ label: getDisplayLabel(l, 'language'), category: 'language' }))
    draft.barThemes?.forEach((t: string) => choiceChips.push({ label: t, category: 'theme' }))
    const alcohol = Array.isArray(draft.alcoholComfort) ? draft.alcoholComfort[0] : draft.alcoholComfort
    if (alcohol) choiceChips.push({ label: getDisplayLabel(alcohol, 'alcohol'), category: 'alcohol' })
  }

  const showCouponStamp = Boolean(bestCoupon && discountAmount > 0 && couponAppliedAt > 0)
  const couponStampAnimated = showCouponStamp && !shouldReduceMotion && !deviceTier.isDegradation

  // Quiet factual seat signal (Wave 1, 2026-08-05) — mirrors the OracleCard
  // corner badge data source; deliberately unstyled/urgency-free.
  const seatCount = pool.registrationCount ?? pool.currentParticipants ?? 0

  // Coupon stub + tail vignette/barcode render inside the ticket chrome via
  // the ReservationTicket footer slot (Phase 3 「订座」, 2026-08-17).
  const ticketFooter = useMemo(
    () => (
      <>
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
      </>
    ),
    [
      bestCoupon,
      discountAmount,
      showCouponDetail,
      couponStampAnimated,
      showCouponStamp,
      deviceTier.isDegradation,
      tailImageError,
      tailImageLoaded,
      tailLoadTimedOut,
      eventType,
      poolId,
    ],
  )

  return (
    <View className='ticket-page'>
      <ScrollView className='ticket-scroll' scrollY>
        {/* ── Ticket Card: shared ReservationTicket (Phase 3 「订座」, 2026-08-17) ── */}
        <ReservationTicket
          banner={{
            imageSrc: TICKET_HERO,
            badgeEmoji: eventType === '饭局' ? '🍜' : '🍷',
            badgeText: eventType,
            title: pool.title,
          }}
          meta={[
            {
              key: 'venue',
              label: '地点',
              value: areaLabel || '待定',
              hint: areaLabel ? undefined : '排桌完成后 24 小时内公布',
            },
            {
              key: 'time',
              label: '时间',
              value: dateLabel || '待定',
              hint: dateLabel ? undefined : '确认后推送具体时段',
              align: 'right',
            },
          ]}
          motionEnabled={!shouldReduceMotion && !deviceTier.isDegradation}
          footer={ticketFooter}
        >

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
                <Text className='ticket-card__terms-chip-text'>报名费含组织与排桌</Text>
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
        </ReservationTicket>

        {/* ── Plan Selector ── */}
        {/* Tier-M wait (M1): while the order is being created, replace the
            interactive plan/price block with a branded skeleton mirroring
            the real card — opacity-pulse shapes + honest staged copy. */}
        {payment.status === 'creating' ? (
          <TicketOrderSkeleton />
        ) : (
          <TicketPlanSelection
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            singlePrice={singlePrice}
            pack3Price={pack3Price}
            pack6Price={pack6Price}
            currentPrice={currentPrice}
            discountAmount={discountAmount}
            finalPrice={finalPrice}
            bestCoupon={bestCoupon}
            poolId={poolId}
          />
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
