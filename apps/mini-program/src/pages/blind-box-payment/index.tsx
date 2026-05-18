import { View, Text, Image, ScrollView } from '@tarojs/components'
import JoyButton from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api/api'
import {
  createMiniProgramPaymentIntent,
  getPricing,
  getUserCoupons,
  isEventPackPlanType,
  type PaymentIntentResponse,
  type PricingPlan,
  type UserCouponSummary,
} from '@shared/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logError, logWarn } from '../../lib/utils/logger'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import {
  buildPaymentVerificationUrl,
  type MiniProgramPaymentReturnContext,
  type MiniProgramPoolRegistrationReturnContext,
  type ReadyMiniProgramPendingOrder,
} from '../../lib/payment/paymentPendingOrder'
import {
  clearPendingOrderStorage,
  clearPaymentReturnContextStorage,
  persistPendingOrder,
  readStoredPaymentReturnContext,
  readStoredPendingOrder,
} from '../../lib/payment/paymentPendingOrderStorage'
import {
  buildMiniProgramPaymentAmountSummary,
  buildMiniProgramPaymentCouponDisplayModel,
  DEFAULT_MINI_PROGRAM_PAYMENT_PLANS,
  formatMiniProgramPaymentPrice,
  getMiniProgramPaymentPlanMeta,
  resolveMiniProgramPaymentPlans,
  type MiniProgramPaymentPlanKey,
} from '../../lib/payment/paymentPageModel'
import './index.scss'

type CouponValidationResponse = {
  valid: boolean
  message?: string
  discountAmount?: number
  finalAmount?: number
}

const PENDING_ORDER_RESUME_MESSAGE = '支付结果待确认，请继续查询订单'

function isPoolRegistrationReturnContext(
  context: MiniProgramPaymentReturnContext | null | undefined,
): context is MiniProgramPoolRegistrationReturnContext {
  return Boolean(context && context.kind === 'pool-registration')
}

function getRegistrationContextBudget(
  context: MiniProgramPoolRegistrationReturnContext,
): string {
  return context.draft.barBudgetRange?.[0] ?? context.draft.budgetRange?.[0] ?? ''
}

function getRegistrationContextNote(
  context: MiniProgramPoolRegistrationReturnContext,
): string {
  if (context.paymentStatus === 'paid') {
    return '权益已经确认，回到报名页后可以直接完成这场报名。'
  }

  if (context.handoffCode === 'NO_AVAILABLE_EVENT_PACK_CREDITS') {
    return '这次是为了续上活动权益。支付确认后会直接回到刚才那场报名。'
  }

  return '这次支付是为了继续刚才的报名。支付确认后会直接回到报名页。'
}

function requestMiniProgramPayment(paymentIntent: PaymentIntentResponse): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Taro.requestPayment({
      timeStamp: paymentIntent.timeStamp,
      nonceStr: paymentIntent.nonceStr,
      package: paymentIntent.package,
      signType: paymentIntent.signType,
      paySign: paymentIntent.paySign,
      success: () => resolve(),
      fail: (error: { errMsg?: string }) => reject(error),
    })
  })
}

// Returning null means the user explicitly cancelled the WeChat sheet, so the
// caller should exit quietly without showing an error toast.
function getFriendlyPaymentError(errMsg?: string): string | null {
  if (!errMsg) return '支付未成功，再试一次即可'

  const normalized = errMsg.toLowerCase()
  if (normalized.includes('cancel')) {
    return null
  }

  if (normalized.includes('parameter error')) {
    return '支付参数有误，再试一次即可'
  }

  if (normalized.includes('network')) {
    return '网络不太稳，检查后再试'
  }

  if (normalized.includes('limit') || normalized.includes('balance')) {
    return '支付未成功，检查余额或联系客服'
  }

  return '支付未成功，再试一次即可'
}

export default function BlindBoxPaymentPage() {
  const { user, isLoading: authLoading } = useAuthGuard()
  const [selectedPlan, setSelectedPlan] = useState<MiniProgramPaymentPlanKey>('vip_monthly')
  const [plans, setPlans] = useState<Record<MiniProgramPaymentPlanKey, PricingPlan>>(
    DEFAULT_MINI_PROGRAM_PAYMENT_PLANS,
  )
  const [couponCount, setCouponCount] = useState(0)
  const [availableCoupons, setAvailableCoupons] = useState<UserCouponSummary[]>([])
  const [selectedCouponCode, setSelectedCouponCode] = useState('')
  const [isCouponValid, setIsCouponValid] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [finalAmount, setFinalAmount] = useState<number | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [pageError, setPageError] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isCreatingIntent, setIsCreatingIntent] = useState(false)
  const [pendingOrderToResume, setPendingOrderToResume] = useState<ReadyMiniProgramPendingOrder | null>(null)
  const [paymentReturnContext, setPaymentReturnContext] = useState<MiniProgramPaymentReturnContext | null>(null)
  const hasSkippedFirstDidShowRef = useRef(false)
  const paymentsDisabled = user?.paymentsEnabled === false

  const refreshPaymentFlowState = useCallback(() => {
    const pendingOrder = readStoredPendingOrder({ currentUserId: user?.id })
    let nextReturnContext: MiniProgramPaymentReturnContext | null = null

    if (pendingOrder.status === 'clear') {
      clearPendingOrderStorage()
      setPendingOrderToResume(null)
      logWarn('Cleared invalid mini-program pending order on payment page', {
        reason: pendingOrder.reason,
        userId: user?.id ?? null,
      })
    } else if (pendingOrder.status === 'ready') {
      setPendingOrderToResume({
        orderId: pendingOrder.orderId,
        context: pendingOrder.context,
      })
      nextReturnContext = pendingOrder.context.returnContext ?? null
    } else {
      setPendingOrderToResume(null)
    }

    const storedReturnContext = readStoredPaymentReturnContext({
      currentUserId: user?.id,
    })

    if (storedReturnContext.status === 'clear') {
      clearPaymentReturnContextStorage()
      logWarn('Cleared invalid mini-program payment return context', {
        reason: storedReturnContext.reason,
        userId: user?.id ?? null,
      })
    } else if (pendingOrder.status !== 'ready' && !nextReturnContext && storedReturnContext.status === 'ready') {
      nextReturnContext = storedReturnContext.context
    }

    setPaymentReturnContext(nextReturnContext)
  }, [user?.id])

  const navigateToVerification = useCallback(async (orderId: string) => {
    const verificationUrl = buildPaymentVerificationUrl(orderId)

    try {
      await Taro.navigateTo({ url: verificationUrl })
      return true
    } catch (navigateError) {
      try {
        await Taro.redirectTo({ url: verificationUrl })
        return true
      } catch (redirectError) {
        logWarn('Failed to route mini-program payment into verification', {
          orderId,
          navigateError: navigateError instanceof Error ? navigateError.message : 'Unknown error',
          redirectError: redirectError instanceof Error ? redirectError.message : 'Unknown error',
        })
        return false
      }
    }
  }, [])

  const showResumeOnlyState = useCallback(async (orderId: string, reason: string) => {
    refreshPaymentFlowState()
    setPageError(PENDING_ORDER_RESUME_MESSAGE)
    logWarn('Mini-program payment left in resume-only state', {
      orderId,
      reason,
    })
    await Taro.showToast({
      title: PENDING_ORDER_RESUME_MESSAGE,
      icon: 'none',
    })
  }, [refreshPaymentFlowState])

  const loadPageData = useCallback(async () => {
    setIsBootstrapping(true)
    setPageError('')

    try {
      const [pricing, coupons] = await Promise.all([
        getPricing(apiRequest).catch(() => []),
        getUserCoupons(apiRequest).catch(() => ({ count: 0, availableCount: 0, coupons: [] })),
      ])

      setPlans(resolveMiniProgramPaymentPlans(pricing))
      setCouponCount(typeof coupons.count === 'number' ? coupons.count : 0)
      setAvailableCoupons(
        Array.isArray(coupons.coupons)
          ? coupons.coupons.filter((coupon) => coupon.status === 'available')
          : []
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载支付信息没成功'
      setPageError(message)
      logError('Failed to bootstrap mini-program payment page', { message })
    } finally {
      setIsBootstrapping(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user?.id) {
      return
    }

    refreshPaymentFlowState()

    if (paymentsDisabled) {
      setIsBootstrapping(false)
      return
    }

    void loadPageData()
  }, [authLoading, loadPageData, paymentsDisabled, refreshPaymentFlowState, user?.id])

  useDidShow(() => {
    if (authLoading || !user?.id) {
      return
    }

    refreshPaymentFlowState()

    if (!hasSkippedFirstDidShowRef.current) {
      hasSkippedFirstDidShowRef.current = true
      return
    }

    if (paymentsDisabled) {
      setIsBootstrapping(false)
      return
    }

    void loadPageData()
  })

  const registrationReturnContext = isPoolRegistrationReturnContext(paymentReturnContext)
    ? paymentReturnContext
    : null

  const registrationContextPills = useMemo(() => {
    if (!registrationReturnContext) {
      return [] as string[]
    }

    const pills = [
      getRegistrationContextBudget(registrationReturnContext),
      registrationReturnContext.draft.eventIntent?.length
        ? `${registrationReturnContext.draft.eventIntent.length} 个期待`
        : '',
      registrationReturnContext.poolArea ?? '',
    ]

    return pills.filter(Boolean).slice(0, 3)
  }, [registrationReturnContext])

  const selectedPlanData = useMemo(() => plans[selectedPlan], [plans, selectedPlan])
  const amountSummary = useMemo(
    () => buildMiniProgramPaymentAmountSummary({
      plan: selectedPlanData,
      discountAmount,
      finalAmount,
      hasSelectedCoupon: selectedCouponCode !== '',
    }),
    [discountAmount, finalAmount, selectedCouponCode, selectedPlanData],
  )
  const payableAmount = amountSummary.payableAmount

  const validateSelectedCoupon = useCallback(async (planKey: MiniProgramPaymentPlanKey, couponCode: string) => {
    const normalizedCouponCode = couponCode.trim()
    if (!normalizedCouponCode) {
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage('')
      return
    }

    setIsValidatingCoupon(true)
    try {
      const response = await apiRequest<CouponValidationResponse>({
        path: '/api/coupons/validate',
        method: 'POST',
        data: {
          paymentType: isEventPackPlanType(planKey) ? 'event_pack' : 'event_bundle',
          code: normalizedCouponCode,
          planId: planKey,
          planType: planKey,
          type: planKey,
        },
      })

      if (!response.valid) {
        setIsCouponValid(false)
        setDiscountAmount(0)
        setFinalAmount(null)
        setCouponMessage(response.message || '当前套餐暂不可使用这张优惠券')
        return
      }

      setIsCouponValid(true)
      setDiscountAmount((response.discountAmount ?? 0) / 100)
      setFinalAmount(typeof response.finalAmount === 'number' ? response.finalAmount / 100 : null)
      setCouponMessage(response.message || '优惠券已应用')
    } catch (error) {
      const message = error instanceof Error ? error.message : '优惠券核验没成功'
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage(message)
    } finally {
      setIsValidatingCoupon(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedCouponCode) {
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage('')
      return
    }

    void validateSelectedCoupon(selectedPlan, selectedCouponCode)
  }, [selectedCouponCode, selectedPlan, validateSelectedCoupon])

  const handleResumePendingOrder = useCallback(async () => {
    if (!pendingOrderToResume) {
      return
    }

    const didNavigate = await navigateToVerification(pendingOrderToResume.orderId)

    if (!didNavigate) {
      await Taro.showToast({
        title: '确认页没打开，稍后再试',
        icon: 'none',
      })
    }
  }, [navigateToVerification, pendingOrderToResume])

  const handlePay = useCallback(async () => {
    if (isCreatingIntent || !user?.id || pendingOrderToResume || paymentsDisabled) {
      return
    }

    setIsCreatingIntent(true)
    setPageError('')

    let persistedOrderId: string | null = null

    try {
      const paymentIntent = await createMiniProgramPaymentIntent(apiRequest, {
        type: selectedPlan,
        planId: selectedPlan,
        couponCode: isCouponValid ? selectedCouponCode : undefined,
      })

      persistPendingOrder({
        orderId: paymentIntent.outTradeNo,
        type: paymentIntent.type,
        userId: user.id,
        returnContext: paymentReturnContext ?? undefined,
      })
      persistedOrderId = paymentIntent.outTradeNo

      await requestMiniProgramPayment(paymentIntent)

      const didNavigate = await navigateToVerification(paymentIntent.outTradeNo)
      if (!didNavigate) {
        await showResumeOnlyState(paymentIntent.outTradeNo, 'verification-navigation-failed')
      }
    } catch (error: any) {
      const errMsg = typeof error?.errMsg === 'string' ? error.errMsg : undefined
      const friendlyMessage = getFriendlyPaymentError(errMsg || error?.message)

      if (persistedOrderId) {
        if (!friendlyMessage) {
          clearPendingOrderStorage()
          setPendingOrderToResume(null)
          return
        }

        logWarn('Mini-program requestPayment failed after order persistence; routing to verification', {
          orderId: persistedOrderId,
          message: friendlyMessage,
        })

        const didNavigate = await navigateToVerification(persistedOrderId)
        if (!didNavigate) {
          await showResumeOnlyState(persistedOrderId, friendlyMessage)
        }
        return
      }

      if (!friendlyMessage) {
        return
      }

      setPageError(friendlyMessage)
      logWarn('Mini-program payment intent creation failed', {
        message: friendlyMessage,
      })
      await Taro.showToast({
        title: friendlyMessage,
        icon: 'none',
      })
    } finally {
      setIsCreatingIntent(false)
    }
  }, [
    isCouponValid,
    isCreatingIntent,
    navigateToVerification,
    paymentsDisabled,
    pendingOrderToResume,
    showResumeOnlyState,
    selectedCouponCode,
    selectedPlan,
    user?.id,
    paymentReturnContext,
  ])

  const payButtonLabel = isBootstrapping
    ? '正在准备支付...'
    : pendingOrderToResume
      ? registrationReturnContext
        ? '先确认当前订单并返回报名'
        : '请先确认当前订单'
      : registrationReturnContext
        ? '支付并回到报名页'
        : '微信支付'

  const payHint = isCreatingIntent
    ? '正在拉起微信支付，请勿重复点击'
    : pendingOrderToResume
      ? registrationReturnContext
        ? '先确认这笔订单，悦仔会把你带回报名页继续'
        : '你有一笔待确认订单，先继续查看支付结果'
      : registrationReturnContext
        ? '支付确认后会自动回到报名页，你刚才填写的偏好不会丢'
        : isEventPackPlanType(selectedPlan)
          ? '购买成功后可直接用次数包报名活动'
          : '切回应用后会自动校验订单结果'

  if (paymentsDisabled) {
    return (
      <ScrollView className='payment-page' scrollY enhanced showScrollbar={false}>
        <View className='payment-page__header'>
          <JoyButton
            variant='secondary'
            className='payment-page__back-button'
            onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile }) })}
          >
            返回
          </JoyButton>
          <Text className='payment-page__eyebrow'>
            {registrationReturnContext ? '继续报名' : '福利柜'}
          </Text>
          <Text className='payment-page__title'>
            {registrationReturnContext ? '先确认已有订单，再回来完成报名' : '解锁专属权益'}
          </Text>
          <Text className='payment-page__subtitle'>
            {registrationReturnContext
              ? '支付功能升级中。若你刚完成支付，继续确认订单后会直接回到报名页。'
              : '支付功能升级中，当前暂不支持发起新的订单。'}
          </Text>
        </View>

        {registrationReturnContext ? (
          <View className='payment-page__context-card'>
            <Text className='payment-page__context-kicker'>继续报名</Text>
            <Text className='payment-page__context-title'>
              {registrationReturnContext.poolTitle || '刚才那场活动'}
            </Text>
            <Text className='payment-page__context-copy'>
              {getRegistrationContextNote(registrationReturnContext)}
            </Text>
            {registrationContextPills.length > 0 ? (
              <View className='payment-page__context-pills'>
                {registrationContextPills.map((item) => (
                  <Text key={item} className='payment-page__context-pill'>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>支付状态</Text>
          <Text className='payment-page__summary-value'>支付功能维护中</Text>
          <Text className='payment-page__summary-note'>支付服务正在升级，稍后回来试试～</Text>
          <Text className='payment-page__summary-note'>
            {registrationReturnContext
              ? '若你刚完成支付，继续确认订单后会直接回到报名页。'
              : '若你刚完成支付，可继续查看已有订单结果。'}
          </Text>
          {pendingOrderToResume ? (
            <JoyButton
              variant='primary'
              className='payment-page__resume-button'
              onClick={handleResumePendingOrder}
            >
              {registrationReturnContext ? '继续确认并返回报名' : '继续查看已有订单'}
            </JoyButton>
          ) : null}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView className='payment-page' scrollY enhanced showScrollbar={false}>
      <View className='payment-page__header'>
        <JoyButton
          variant='secondary'
          className='payment-page__back-button'
          onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile }) })}
        >
          返回
        </JoyButton>
        <Text className='payment-page__eyebrow'>
          {registrationReturnContext ? '继续报名' : '福利柜'}
        </Text>
        <Text className='payment-page__title'>
          {registrationReturnContext ? '先开通权益，再回来完成报名' : '解锁专属权益'}
        </Text>
        <Text className='payment-page__subtitle'>
          {registrationReturnContext
            ? `你刚才在${registrationReturnContext.poolTitle ? `《${registrationReturnContext.poolTitle}》里` : '活动报名里'}填写的预算和偏好已经替你留好，支付确认后会自动回去继续。`
            : '支付成功后将进入结果确认页，避免误判成功。'}
        </Text>

      </View>

      {registrationReturnContext ? (
        <View className='payment-page__context-card'>
          <Text className='payment-page__context-kicker'>
            {registrationReturnContext.paymentStatus === 'paid' ? '权益已确认' : '继续报名'}
          </Text>
          <Text className='payment-page__context-title'>
            {registrationReturnContext.poolTitle || '刚才那场活动'}
          </Text>
          <Text className='payment-page__context-copy'>
            {getRegistrationContextNote(registrationReturnContext)}
          </Text>
          {registrationContextPills.length > 0 ? (
            <View className='payment-page__context-pills'>
              {registrationContextPills.map((item) => (
                <Text key={item} className='payment-page__context-pill'>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {pendingOrderToResume ? (
        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>待确认订单</Text>
          <Text className='payment-page__summary-value'>继续查看支付结果</Text>
          <Text className='payment-page__summary-note'>
            {registrationReturnContext
              ? '你有一笔订单仍在等待确认，先完成确认后悦仔会把你带回报名页。'
              : '你有一笔订单仍在等待确认，先完成结果确认再发起新的支付。'}
          </Text>
          <JoyButton
            variant='primary'
            className='payment-page__resume-button'
            onClick={handleResumePendingOrder}
          >
            {registrationReturnContext ? '继续确认并返回报名' : '继续查询订单'}
          </JoyButton>
        </View>
      ) : null}

      <View className='payment-page__summary-card'>
        <Text className='payment-page__summary-label'>可用优惠</Text>
        <Text className='payment-page__summary-value'>{couponCount} 张</Text>
        <Text className='payment-page__summary-note'>支持专属权益与活动次数包</Text>
      </View>

      <View className='payment-page__section-heading'>
        <Text className='payment-page__section-title'>选一个更适合你的权益方式</Text>
        <Text className='payment-page__section-copy'>
          常参加选专属权益更省心，按次参加可以选活动次数包。
        </Text>
      </View>

      <View className='payment-page__plans'>
        {(Object.keys(plans) as MiniProgramPaymentPlanKey[]).map((planKey) => {
          const plan = plans[planKey]
          const isSelected = planKey === selectedPlan
          const planMeta = getMiniProgramPaymentPlanMeta(planKey)

          return (
            <Card
              key={planKey}
              className={`payment-page__plan ${isSelected ? 'payment-page__plan--selected' : ''}`}
              onClick={() => setSelectedPlan(planKey)}
            >
              <View className='payment-page__plan-content'>
                <View className='payment-page__plan-copy'>
                  <View className='payment-page__plan-topline'>
                    <Text className='payment-page__plan-title'>{plan.displayName}</Text>
                    <Text className='payment-page__plan-badge'>{planMeta.badge}</Text>
                  </View>
                  <Text className='payment-page__plan-desc'>{plan.description || '悦聚专属权益'}</Text>
                  <Text className='payment-page__plan-note'>{planMeta.supportCopy}</Text>
                </View>
                <View className='payment-page__plan-price-wrap'>
                  {plan.originalPrice ? (
                    <Text className='payment-page__plan-original'>
                      {formatMiniProgramPaymentPrice(plan.originalPrice)}
                    </Text>
                  ) : null}
                  <Text className='payment-page__plan-price'>
                    {formatMiniProgramPaymentPrice(plan.price)}
                  </Text>
                </View>
              </View>
            </Card>
          )
        })}
      </View>

      {couponCount > 0 ? (
        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>优惠券</Text>
          <View className='payment-page__plans'>
            <Card
              className={`payment-page__plan ${selectedCouponCode === '' ? 'payment-page__plan--selected' : ''}`}
              onClick={() => setSelectedCouponCode('')}
            >
              <View className='payment-page__plan-content'>
                <View>
                  <Text className='payment-page__plan-title'>不使用优惠券</Text>
                  <Text className='payment-page__plan-desc'>按当前套餐原价支付</Text>
                </View>
              </View>
            </Card>
            {availableCoupons.map((coupon) => {
              const couponModel = buildMiniProgramPaymentCouponDisplayModel(coupon)

              return (
                <Card
                  key={couponModel.id}
                  className={`payment-page__plan ${selectedCouponCode === couponModel.code ? 'payment-page__plan--selected' : ''}`}
                  onClick={() => setSelectedCouponCode(couponModel.code)}
                >
                  <View className='payment-page__plan-content'>
                    <View>
                      <Text className='payment-page__plan-title'>{couponModel.title}</Text>
                      <Text className='payment-page__plan-desc'>{couponModel.description}</Text>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
          {selectedCouponCode ? (
            <Text className='payment-page__summary-note'>
              {isValidatingCoupon ? '正在校验优惠券...' : couponMessage || '已选择优惠券'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {pageError ? <Text className='payment-page__error'>{pageError}</Text> : null}

      <View className='payment-page__footer'>
        {amountSummary.rows.map((row) => (
          <View
            key={row.kind}
            className={`payment-page__amount-row${row.kind === 'total' ? ' payment-page__amount-row--total' : ''}`}
          >
            <Text className='payment-page__amount-label'>{row.label}</Text>
            <Text className={row.kind === 'total' ? 'payment-page__amount-total' : 'payment-page__amount-value'}>
              {row.value}
            </Text>
          </View>
        ))}
        <JoyButton
          variant='primary'
          className='payment-page__pay-button'
          onClick={handlePay}
          disabled={isBootstrapping || isCreatingIntent || !user?.id || !!pendingOrderToResume}
          loading={isCreatingIntent}
        >
          {payButtonLabel}
        </JoyButton>
        <Text className='payment-page__hint'>{payHint}</Text>
      </View>
    </ScrollView>
  )
}
