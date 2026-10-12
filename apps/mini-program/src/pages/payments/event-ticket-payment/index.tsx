import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registerForPool, registerForPoolWithPayment, createMiniProgramPaymentIntent, getEventPool, getUserCoupons, reconcilePayment } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest, type ApiError } from '../../../lib/api/api'
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
import RefundGuaranteeLine from './components/RefundGuaranteeLine'
import IcebreakerInclusionSheet from '../../../components/event-ticket-payment/IcebreakerInclusionSheet'
import TicketOrderSkeleton, { getTicketCtaLabel } from '../../../components/payments/TicketOrderSkeleton'
import {
  buildPlansShown,
  calculateDiscount,
  findWelcomeCoupon,
  formatBudgetLabel,
  formatDateTimeLabel,
  formatPrice,
  getBestCoupon,
  getDisplayLabel,
  getTerminalRegistrationCode,
  getTerminalRegistrationCopy,
  getVipMonthlyAnchorLabel,
  isSubscriptionActive,
  isWelcomeCouponAutoApplyEligible,
  isWelcomeCouponCode,
  resolvePaymentCheckoutFlags,
  resolveSubscriptionConflictMessage,
  resolveVipMonthlyOffer,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PricingPlan,
  type RitualContextPayload,
  type SubscriptionStatusPayload,
  type TerminalRegistrationBlock,
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
  /**
   * D2 悦聚月卡 paid-but-unregistered recovery marker: the card payment is
   * CONFIRMED but the entitlement registration has not completed. The retry
   * CTA must re-attempt ONLY the registration step — never a new payment.
   */
  registrationPending?: boolean
  /**
   * HIGH-2 terminal seat-booking block (pool full/closed/cancelled/deadline):
   * retrying THIS pool can never succeed, so the page swaps to a terminal
   * surface with a 「去看看其他局」 CTA instead of the retry loop. `paid`
   * records whether the 悦聚月卡 charge already went through (post-payment
   * registration failure) or the block fired before any charge (pre-check).
   */
  registrationTerminal?: TerminalRegistrationBlock
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

  // Fetch pricing plans from ritual context for dynamic pack prices. The
  // response is additive-tolerant: the subscription upsell batch adds a
  // `subscriptionPlans` array (D2); old servers only return `plans`.
  // `isFetched` also gates the plan-selector impression (MEDIUM-1): the
  // plansShown metadata must not fire while the monthly-offer resolution is
  // still in flight.
  const { data: ritualContext, isFetched: ritualContextFetched } = useQuery<RitualContextPayload>({
    queryKey: ['mini-program', 'pricing-plans'],
    queryFn: () => apiRequest<RitualContextPayload>({ path: '/api/payments/ritual-context' }),
    enabled: !!user?.id && isPageReady,
    staleTime: 10 * 60 * 1000,
  })

  // D2/D3 checkout flags from GET /api/auth/user → features. Fail-closed:
  // absent/undefined reads as false (see resolvePaymentCheckoutFlags).
  const { checkoutSubscriptionUpsellEnabled, preRevealRefundEnabled } = resolvePaymentCheckoutFlags(user)

  // HIGH-1 subscription-status read (GET /api/subscription/status), fetched
  // only when the upsell flag is on. Suppression is fail-CLOSED on an
  // affirmative active signal and fail-OPEN on loading/error: the card keeps
  // rendering and the server-side 409 SUBSCRIPTION_ALREADY_ACTIVE guard is
  // the real backstop, so a failed status read never blocks the page. No
  // scary logging here — a missing read is a normal offline/edge outcome.
  const { data: subscriptionStatus, isFetched: subscriptionStatusFetched } =
    useQuery<SubscriptionStatusPayload>({
      queryKey: SUBSCRIPTION_STATUS_QUERY_KEY,
      queryFn: () => apiRequest<SubscriptionStatusPayload>({ path: '/api/subscription/status' }),
      enabled: checkoutSubscriptionUpsellEnabled && !!user?.id && isPageReady,
      staleTime: 60 * 1000,
    })
  const subscriptionActive = isSubscriptionActive(subscriptionStatus)

  // D2 悦聚月卡 upsell offer — fail-closed: the monthly card renders only
  // when the flag is ON, ritual-context actually carries a monthly
  // subscription plan with a server-side price, AND the user does not already
  // hold an active subscription (HIGH-1). No client price fallback.
  const vipMonthlyOffer = useMemo(
    () =>
      checkoutSubscriptionUpsellEnabled && !subscriptionActive
        ? resolveVipMonthlyOffer(ritualContext)
        : null,
    [checkoutSubscriptionUpsellEnabled, subscriptionActive, ritualContext],
  )
  const vipMonthlyPlanView = useMemo(
    () =>
      vipMonthlyOffer
        ? {
            displayName: vipMonthlyOffer.displayName,
            description: vipMonthlyOffer.description,
            priceInCents: vipMonthlyOffer.priceInCents,
            anchorLabel: getVipMonthlyAnchorLabel(vipMonthlyOffer),
          }
        : null,
    [vipMonthlyOffer],
  )

  // Selection hygiene: if the monthly offer disappears between render and
  // refetch (flag flip or a payload without subscription plans), fall back to
  // the anchor plan instead of leaving an unpayable selection on screen.
  useEffect(() => {
    if (selectedPlan === 'vip_monthly' && !vipMonthlyOffer) {
      setSelectedPlan('single')
    }
  }, [selectedPlan, vipMonthlyOffer])

  // Auto-select welcome coupon on first load — gated by plan (audit F4
  // interim): the 见面礼 never auto-applies to the anchor 单场局票 plan, so the
  // first transaction stays full-price; 连局包 (and future 悦聚卡 plans) keep
  // the existing behaviour. Server-side per-plan enforcement ships later.
  useEffect(() => {
    if (!couponsData?.coupons || selectedCouponCode) return
    if (!isWelcomeCouponAutoApplyEligible(selectedPlan)) return
    const welcome = findWelcomeCoupon(couponsData.coupons)
    if (welcome?.code) {
      setSelectedCouponCode(welcome.code)
      setCouponAppliedAt(Date.now())
      discoverAnalytics.track('welcome_coupon_auto_applied', undefined, {
        couponCode: welcome.code,
        context: 'event-ticket-payment',
      })
    }
  }, [couponsData?.coupons, selectedCouponCode, selectedPlan])

  // Derived pricing — prefer pool.price, fallback to ritual-context, then hardcoded
  const pricingPlans = ritualContext?.plans ?? []
  const eventSinglePlan = pricingPlans.find((p: PricingPlan) => p.planType === 'event_single')
  const pack3Plan = pricingPlans.find((p: PricingPlan) => p.planType === 'pack_3')
  const pack6Plan = pricingPlans.find((p: PricingPlan) => p.planType === 'pack_6')

  const singlePrice = eventSinglePlan?.priceInCents ?? 8800
  const pack3Price = pack3Plan?.priceInCents ?? 21100
  const pack6Price = pack6Plan?.priceInCents ?? 37000
  // D2: the monthly price is server-derived ONLY (no hardcoded fallback) —
  // when the offer is absent the selection-reset effect above moves the user
  // back to 'single', so the singlePrice fallback here is unreachable.
  const currentPrice =
    selectedPlan === 'vip_monthly'
      ? vipMonthlyOffer?.priceInCents ?? singlePrice
      : selectedPlan === 'pack_3'
        ? pack3Price
        : selectedPlan === 'pack_6'
          ? pack6Price
          : singlePrice

  // Audit F4: on the anchor 单场局票 plan the 见面礼 is ineligible for
  // auto-apply, so WELCOME* codes are excluded from BOTH the selected-coupon
  // honouring and the best-coupon fallback — otherwise the discount would
  // leak onto the anchor product via getBestCoupon even without auto-select.
  const welcomeAutoApplyEligible = isWelcomeCouponAutoApplyEligible(selectedPlan)
  const eligibleCoupons = useMemo(() => {
    const all = couponsData?.coupons ?? []
    if (welcomeAutoApplyEligible) return all
    return all.filter((c) => !isWelcomeCouponCode(c.code))
  }, [couponsData?.coupons, welcomeAutoApplyEligible])

  const welcomeCoupon = useMemo(
    () => findWelcomeCoupon(couponsData?.coupons ?? []),
    [couponsData?.coupons],
  )
  // Quiet eligibility note near the plan selector (F4-b): only when a
  // welcome coupon exists but the current plan can't auto-use it.
  const showWelcomeCouponHint = !welcomeAutoApplyEligible && Boolean(welcomeCoupon)

  const selectedCoupon = useMemo(() => {
    if (!selectedCouponCode || !couponsData?.coupons) return null
    return eligibleCoupons.find((c) => c.code === selectedCouponCode && c.status === 'available' && !c.isUsed) ?? null
  }, [selectedCouponCode, couponsData?.coupons, eligibleCoupons])

  const bestCoupon = useMemo(() => {
    if (selectedCoupon) return selectedCoupon
    return getBestCoupon(eligibleCoupons, currentPrice)
  }, [selectedCoupon, eligibleCoupons, currentPrice])

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

  // Track plan selector impression once it becomes visible. plansShown must
  // mirror the ACTUAL rendered list (D2 stale-metadata fix): the monthly card
  // prepends vip_monthly when the upsell offer is on the page.
  //
  // MEDIUM-1: the impression must wait until every input that decides the
  // monthly card has SETTLED — ritual-context (offer source) and, when the
  // upsell flag is on, the subscription-status read (suppression source).
  // Firing at isPageReady recorded stale three-plan metadata whenever the
  // monthly offer resolved a tick later. `isFetched` flips on error too, so
  // failed reads count as settled (fail-open renders the card either way);
  // a logged-out visitor disables both queries, which also reads as settled.
  const planSelectorMetadataReady =
    (ritualContextFetched || !user?.id) &&
    (!checkoutSubscriptionUpsellEnabled || !user?.id || subscriptionStatusFetched)

  useEffect(() => {
    if (!isPageReady || !poolId || !planSelectorMetadataReady || hasTrackedPlanSelectorImpressionRef.current) return
    hasTrackedPlanSelectorImpressionRef.current = true
    discoverAnalytics.track('plan_selector_impression', undefined, {
      poolId,
      plansShown: buildPlansShown(vipMonthlyOffer !== null),
      defaultPlan: selectedPlan,
      singlePrice,
      pack3Price,
      pack6Price,
    })
  }, [isPageReady, poolId, planSelectorMetadataReady, selectedPlan, singlePrice, pack3Price, pack6Price, vipMonthlyOffer])

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

  // Reset transient flags on show (swipe-back safety). Never reset a
  // paid-but-unregistered 悦聚月卡 state back to idle — that would hide the
  // registration-retry path and risk a duplicate purchase. The terminal
  // seat-booking block (HIGH-2) is likewise sticky: the pool does not un-fill
  // on swipe-back, and re-showing the checkout would invite a second charge
  // attempt against a pool that can never accept it.
  useDidShow(() => {
    if (payment.status === 'failed' && !payment.registrationPending && !payment.registrationTerminal) {
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

  // D2 悦聚月卡 post-payment step: the subscription payment (event_bundle via
  // /api/payments/miniprogram/create, plan id `vip_monthly`) activates the
  // card; the seat itself is then booked through the entitlement register
  // path (POST /api/event-pools/:id/register) so the success ceremony stays
  // truthful — 「已加入」 only renders after the registration actually exists.
  const finalizeVipRegistration = useCallback(
    async (orderId: string, paymentId: string | null, via: 'poll' | 'reconcile') => {
      const draft = returnContextRef.current?.draft ?? {}
      try {
        await registerForPool(apiRequest, poolId, draft)
      } catch (err) {
        const errData = (err as ApiError)?.data as { code?: string } | undefined
        if (errData?.code !== 'ALREADY_REGISTERED') {
          // HIGH-2a: terminal seat-booking rejections (pool filled during
          // payment, closed, cancelled, deadline passed) can never succeed on
          // retry — route to the terminal surface instead of the
          // paid-but-unregistered retry loop. The 悦聚月卡 itself stays
          // active and valid for other pools; no second charge ever happens.
          const terminalCode = getTerminalRegistrationCode(err)
          if (terminalCode) {
            logError('[EventTicketPayment] 悦聚月卡 active but pool registration terminally blocked', {
              orderId,
              poolId,
              terminalCode,
              via,
            })
            setPayment({
              status: 'failed',
              paymentId: paymentId ?? undefined,
              wechatOrderId: orderId,
              registrationTerminal: { code: terminalCode, paid: true },
            })
            return
          }
          logError('[EventTicketPayment] 悦聚月卡 active but pool registration failed', {
            orderId,
            poolId,
            error: String(err),
          })
          // Paid-but-unregistered (transient/network failure): keep the
          // return context so retry can complete the booking, and never
          // create a second payment here.
          setPayment({
            status: 'failed',
            paymentId: paymentId ?? undefined,
            wechatOrderId: orderId,
            registrationPending: true,
            error: '月卡已生效，这次报名没完成。点下方按钮补上报名，不会重复扣款。',
          })
          return
        }
      }

      setPayment({ status: 'success', paymentId: paymentId ?? undefined, wechatOrderId: orderId })
      discoverAnalytics.track('pay_success', undefined, {
        poolId,
        plan: 'vip_monthly',
        couponCode: bestCoupon?.code ?? null,
        originalAmount: currentPrice,
        finalAmount: finalPrice,
        paymentId,
        wechatOrderId: orderId,
        via,
      })

      const ctx = returnContextRef.current
      if (ctx) {
        const paid = markPaymentReturnContextPaid(ctx)
        void persistPaymentReturnContext(paid)
        setReturnContext(paid)
        returnContextRef.current = paid
      }

      void bustRegistrationCaches(queryClient, { poolId })
      clearPaymentReturnContextStorage()

      logInfo('[EventTicketPayment] 悦聚月卡 payment confirmed, registration created', { orderId, paymentId, via })
    },
    [poolId, queryClient, bestCoupon?.code, currentPrice, finalPrice],
  )

  const pollVerification = useCallback((orderId: string, paymentId: string | null, planAtPay: SelectedPlan) => {
    setPayment({ status: 'verifying', paymentId: paymentId ?? undefined, wechatOrderId: orderId })
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
        setPayment({ status: 'success', paymentId: paymentId ?? undefined, wechatOrderId: orderId })
        // No haptic here (spec §2): the celebration haptic fires on the visual
        // beat — the 「已留座」 seal landing in RegistrationSuccessCeremony —
        // not on the network response.
      } else {
        setPayment({ status: 'failed', error: error || '支付未成功，请重试' })
      }
    }

    const completeSuccess = (via: 'poll' | 'reconcile') => {
      // D2 悦聚月卡: payment confirmed → activate-then-register orchestration.
      // The card is already active; booking the seat completes the promise.
      if (planAtPay === 'vip_monthly') {
        void finalizeVipRegistration(orderId, paymentId, via)
        return
      }
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
  }, [queryClient, poolId, selectedPlan, currentPrice, finalPrice, bestCoupon?.code, finalizeVipRegistration])

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

      // Shared WeChat-sheet outcome handler for both create paths (event
      // register-with-payment and the D2 悦聚月卡 subscription intent).
      const handlePaySheetError = (payErr: any, ids: { paymentId: string | null; wechatOrderId: string }) => {
        if (payErr?.errMsg?.includes('cancel')) {
          logInfo('[EventTicketPayment] WeChat Pay cancelled by user')
          discoverAnalytics.track('pay_cancel', undefined, {
            poolId,
            plan: selectedPlan,
            couponCode: bestCoupon?.code ?? null,
            originalAmount: currentPrice,
            finalAmount: finalPrice,
            paymentId: ids.paymentId,
            wechatOrderId: ids.wechatOrderId,
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
            paymentId: ids.paymentId,
            wechatOrderId: ids.wechatOrderId,
            reason: 'wechat_pay_error',
            error: payErr?.errMsg ?? String(payErr),
          })
          setPayment({ status: 'failed', error: '支付未成功，请重试' })
        }
      }

      // D2 悦聚月卡: subscription purchase through the mini-program payment
      // intent endpoint. The server maps `vip_monthly` to the monthly 悦聚卡
      // (normalizeSubscriptionPlanType) and activates the subscription on
      // fulfillment; the pool seat is then booked via the entitlement
      // register path (see finalizeVipRegistration) so the success ceremony
      // only claims 「已加入」 once the registration actually exists.
      if (selectedPlan === 'vip_monthly') {
        if (!vipMonthlyOffer) {
          // Fail-closed: the offer vanished between render and tap.
          setPayment({ status: 'idle' })
          Taro.showToast({ title: '方案已更新，请重新选择', icon: 'none', duration: TOAST_DURATION })
          return
        }

        // HIGH-2b pre-charge capacity guard. The page already holds pool
        // capacity state (getEventPool carries registrationCount /
        // currentParticipants + maxParticipants / spotsLeft), so re-validate
        // fullness BEFORE creating the intent: if the pool filled while the
        // user was deciding, block with the honest terminal surface instead
        // of charging. Payloads without capacity data fail OPEN to the
        // normal pay path — the server-side POOL_FULL check stays the
        // authority; this guard only avoids a needless charge.
        const heldSeats = pool?.registrationCount ?? pool?.currentParticipants ?? 0
        const knownCapacity =
          typeof pool?.maxParticipants === 'number' && pool.maxParticipants > 0
            ? pool.maxParticipants
            : typeof pool?.spotsLeft === 'number'
              ? heldSeats + Math.max(pool.spotsLeft, 0)
              : undefined
        if (typeof knownCapacity === 'number' && heldSeats >= knownCapacity) {
          logInfo('[EventTicketPayment] 悦聚月卡 blocked before charge: pool already full', {
            poolId,
            heldSeats,
            knownCapacity,
          })
          setPayment({
            status: 'failed',
            registrationTerminal: { code: 'POOL_FULL', paid: false },
          })
          return
        }

        const intent = await createMiniProgramPaymentIntent(apiRequest, {
          type: 'vip_monthly',
          planId: 'vip_monthly',
          couponCode,
        })

        logInfo('[EventTicketPayment] 悦聚月卡 payment intent created', {
          wechatOrderId: intent.outTradeNo,
          mock: intent.mock === true,
        })

        // Interaction-latency baseline: order created, UI transitions to paying.
        interactionLatency.trackInteraction('payment_order_create', t0)

        if (intent.mock) {
          // MOCK_PAYMENTS: the order is instantly completed server-side, so
          // skip the WeChat sheet and verify immediately.
          pollVerification(intent.outTradeNo, null, 'vip_monthly')
          return
        }

        setPayment({ status: 'paying', wechatOrderId: intent.outTradeNo })
        try {
          await Taro.requestPayment({
            timeStamp: intent.timeStamp,
            nonceStr: intent.nonceStr,
            package: intent.package,
            signType: intent.signType as 'RSA',
            paySign: intent.paySign,
          })
          pollVerification(intent.outTradeNo, null, 'vip_monthly')
        } catch (payErr: any) {
          handlePaySheetError(payErr, { paymentId: null, wechatOrderId: intent.outTradeNo })
        }
        return
      }

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
        pollVerification(result.wechatOrderId, result.paymentId, selectedPlan)
      } catch (payErr: any) {
        handlePaySheetError(payErr, { paymentId: result.paymentId, wechatOrderId: result.wechatOrderId })
      }
    } catch (err: any) {
      // HIGH-1 backstop: the server rejected the 悦聚月卡 intent because the
      // subscription is already active (409 SUBSCRIPTION_ALREADY_ACTIVE).
      // Nothing was charged. Surface the server's own Chinese message through
      // the normal payment-error surface, refresh the subscription-status
      // query so the upsell card disappears, and skip the pay_fail funnel
      // noise — this is a state conflict, not a payment failure.
      const intentErrorData = (err as ApiError)?.data as { code?: string } | undefined
      if (intentErrorData?.code === 'SUBSCRIPTION_ALREADY_ACTIVE') {
        const conflictMessage = resolveSubscriptionConflictMessage(err)
        logInfo('[EventTicketPayment] 悦聚月卡 intent rejected: subscription already active', { poolId })
        void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_STATUS_QUERY_KEY })
        setPayment({ status: 'failed', error: conflictMessage })
        Taro.showToast({ title: conflictMessage, icon: 'none', duration: TOAST_DURATION })
        return
      }
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
  }, [returnContext, bestCoupon, pool, poolId, pollVerification, currentPrice, finalPrice, selectedPlan, effectiveCouponCode, vipMonthlyOffer])

  const handleRetry = useCallback(() => {
    haptics('light')
    // D2 paid-but-unregistered recovery: the 悦聚月卡 payment is already
    // confirmed — re-attempt ONLY the entitlement registration, never a
    // second payment.
    if (payment.registrationPending && payment.wechatOrderId) {
      setPayment({
        status: 'verifying',
        paymentId: payment.paymentId,
        wechatOrderId: payment.wechatOrderId,
      })
      void finalizeVipRegistration(payment.wechatOrderId, payment.paymentId ?? null, 'poll')
      return
    }
    setPayment({ status: 'idle' })
  }, [payment, finalizeVipRegistration])

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

  // HIGH-2 terminal-surface CTA: leave this (unbookable) pool for Discover.
  // The payment return context is cleared — the flow for THIS pool is over;
  // the 悦聚月卡 (when paid) stays valid and is re-usable on any other pool.
  const handleGoDiscover = useCallback(() => {
    if (isNavigating) return
    setIsNavigating(true)
    haptics('medium')
    clearPaymentReturnContextStorage()
    Taro.switchTab({
      url: MINI_PROGRAM_ROUTES.discover,
      fail: () => {
        setIsNavigating(false)
        Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
      },
    })
  }, [isNavigating])

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

  // HIGH-2 terminal seat-booking surface (悦聚月卡 flow): the pool filled /
  // closed / was cancelled / hit its deadline — either after the card payment
  // confirmed (paid: the subscription stays active, no quota consumed) or at
  // the pre-charge guard (unpaid: nothing was charged). There is NO retry CTA
  // here: retrying this pool can never succeed, and the paid retry loop was
  // the POOL_FULL dead-end this state replaces. System-UI copy leads with the
  // truthful 月卡已生效 when paid; the only way out is 「去看看其他局」.
  if (payment.status === 'failed' && payment.registrationTerminal) {
    const terminalCopy = getTerminalRegistrationCopy(payment.registrationTerminal)
    return (
      <View className='ticket-error' role='alert'>
        <StatusCard
          tone='info'
          heroSrc={getXiaoyueExpressionAsset('paymentTrust')}
          title={terminalCopy.title}
          description={terminalCopy.body}
          action={{
            label: '去看看其他局',
            onClick: handleGoDiscover,
            variant: 'primary',
            disabled: isNavigating,
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
            showWelcomeCouponHint={showWelcomeCouponHint}
            vipMonthlyPlan={vipMonthlyPlanView}
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

        {/* Spacer for sticky CTA — grows when the D3 refund-guarantee caption
            adds a line to the fixed footer (flag preRevealRefundEnabled). */}
        <View className={`ticket-bottom-spacer ${preRevealRefundEnabled ? 'ticket-bottom-spacer--with-guarantee' : ''}`} />
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
            <Text className='ticket-cta__text'>{payment.registrationPending ? '补上这次报名' : '重试支付'}</Text>
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

        {/* D3 refund-guarantee caption (flag preRevealRefundEnabled): one
            quiet System-UI line directly under the CTA; renders nothing when
            the flag is off. The 退款政策 link above stays untouched. */}
        <RefundGuaranteeLine visible={preRevealRefundEnabled} />

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
