import { Button, View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import {
  createMiniProgramPaymentIntent,
  type EventPackPlanKey,
  findPricingPlan,
  getPricing,
  getUserCoupons,
  type PaymentIntentResponse,
  type PricingPlan,
  type UserCouponSummary,
  type VipSubscriptionPlanKey,
} from '@shared/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logError, logWarn } from '../../lib/logger'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboardingRoutes'
import {
  buildPaymentVerificationUrl,
  type ReadyMiniProgramPendingOrder,
} from '../../lib/paymentPendingOrder'
import {
  clearPendingOrderStorage,
  persistPendingOrder,
  readStoredPendingOrder,
} from '../../lib/paymentPendingOrderStorage'
import './index.scss'

type PlanKey = VipSubscriptionPlanKey | EventPackPlanKey

const DEFAULT_PLANS: Record<PlanKey, PricingPlan> = {
  vip_monthly: {
    id: 'vip_monthly',
    planType: 'vip_monthly',
    displayName: '月度活动礼包',
    description: '30天内无限参与活动',
    price: 128,
  },
  vip_quarterly: {
    id: 'vip_quarterly',
    planType: 'vip_quarterly',
    displayName: '季度活动礼包',
    description: '90天内无限参与活动',
    price: 268,
    originalPrice: 384,
  },
  pack_3: {
    id: 'pack_3',
    planType: 'pack_3',
    displayName: '3次活动包',
    description: '90天内可使用3次活动名额',
    price: 211,
    originalPrice: 264,
  },
  pack_6: {
    id: 'pack_6',
    planType: 'pack_6',
    displayName: '6次活动包',
    description: '90天内可使用6次活动名额',
    price: 370,
    originalPrice: 528,
  },
}

type CouponValidationResponse = {
  valid: boolean
  message?: string
  discountAmount?: number
  finalAmount?: number
}

function isEventPackPlan(planKey: PlanKey): planKey is EventPackPlanKey {
  return planKey === 'pack_3' || planKey === 'pack_6'
}

function formatPrice(value: number): string {
  return `¥${value.toFixed(0)}`
}

// Returning null means the user explicitly cancelled the WeChat sheet, so the
// caller should exit quietly without showing an error toast.
function getFriendlyPaymentError(errMsg?: string): string | null {
  if (!errMsg) return '支付失败，请稍后重试'

  const normalized = errMsg.toLowerCase()
  if (normalized.includes('cancel')) {
    return null
  }

  if (normalized.includes('parameter error')) {
    return '支付参数错误，请稍后重试'
  }

  if (normalized.includes('network')) {
    return '网络连接失败，请检查网络后重试'
  }

  if (normalized.includes('limit') || normalized.includes('balance')) {
    return '支付失败，请检查微信支付余额或联系客服'
  }

  return '支付失败，请稍后重试'
}

export default function BlindBoxPaymentPage() {
  const { user, isLoading: authLoading } = useAuthGuard()
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('vip_monthly')
  const [plans, setPlans] = useState<Record<PlanKey, PricingPlan>>(DEFAULT_PLANS)
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
  const hasSkippedFirstDidShowRef = useRef(false)
  const paymentsDisabled = user?.paymentsEnabled === false

  const refreshPendingOrderState = useCallback(() => {
    const pendingOrder = readStoredPendingOrder({ currentUserId: user?.id })

    if (pendingOrder.status === 'clear') {
      clearPendingOrderStorage()
      setPendingOrderToResume(null)
      logWarn('Cleared invalid mini-program pending order on payment page', {
        reason: pendingOrder.reason,
        userId: user?.id ?? null,
      })
      return
    }

    if (pendingOrder.status === 'ready') {
      setPendingOrderToResume({
        orderId: pendingOrder.orderId,
        context: pendingOrder.context,
      })
      return
    }

    setPendingOrderToResume(null)
  }, [user?.id])

  const navigateToVerification = useCallback(async (orderId: string) => {
    const verificationUrl = buildPaymentVerificationUrl(orderId)
    await Taro.navigateTo({
      url: verificationUrl,
      fail: () => Taro.redirectTo({ url: verificationUrl }),
    })
  }, [])

  const loadPageData = useCallback(async () => {
    setIsBootstrapping(true)
    setPageError('')

    try {
      const [pricing, coupons] = await Promise.all([
        getPricing(apiRequest).catch(() => []),
        getUserCoupons(apiRequest).catch(() => ({ count: 0, availableCount: 0, coupons: [] })),
      ])

      const monthlyPlan = findPricingPlan(pricing, 'vip_monthly')
      const quarterlyPlan = findPricingPlan(pricing, 'vip_quarterly')

      setPlans({
        vip_monthly: monthlyPlan ?? DEFAULT_PLANS.vip_monthly,
        vip_quarterly: quarterlyPlan ?? DEFAULT_PLANS.vip_quarterly,
        pack_3: findPricingPlan(pricing, 'pack_3') ?? DEFAULT_PLANS.pack_3,
        pack_6: findPricingPlan(pricing, 'pack_6') ?? DEFAULT_PLANS.pack_6,
      })
      setCouponCount(typeof coupons.count === 'number' ? coupons.count : 0)
      setAvailableCoupons(
        Array.isArray(coupons.coupons)
          ? coupons.coupons.filter((coupon) => coupon.status === 'available')
          : []
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载支付信息失败'
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

    refreshPendingOrderState()

    if (paymentsDisabled) {
      setIsBootstrapping(false)
      return
    }

    void loadPageData()
  }, [authLoading, loadPageData, paymentsDisabled, refreshPendingOrderState, user?.id])

  useDidShow(() => {
    if (authLoading || !user?.id) {
      return
    }

    refreshPendingOrderState()

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

  const selectedPlanData = useMemo(() => plans[selectedPlan], [plans, selectedPlan])
  const payableAmount = finalAmount ?? selectedPlanData.price

  const validateSelectedCoupon = useCallback(async (planKey: PlanKey, couponCode: string) => {
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
          paymentType: isEventPackPlan(planKey) ? 'event_pack' : 'event_bundle',
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
      const message = error instanceof Error ? error.message : '优惠券校验失败'
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

    await navigateToVerification(pendingOrderToResume.orderId)
  }, [navigateToVerification, pendingOrderToResume])

  const handlePay = useCallback(async () => {
    if (isCreatingIntent || !user?.id || pendingOrderToResume || paymentsDisabled) {
      return
    }

    setIsCreatingIntent(true)
    setPageError('')

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
      })

      await new Promise<void>((resolve, reject) => {
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

      await navigateToVerification(paymentIntent.outTradeNo)
    } catch (error: any) {
      const errMsg = typeof error?.errMsg === 'string' ? error.errMsg : undefined
      const friendlyMessage = getFriendlyPaymentError(errMsg || error?.message)

      if (!friendlyMessage) {
        clearPendingOrderStorage()
        setPendingOrderToResume(null)
        return
      }

      clearPendingOrderStorage()
      setPendingOrderToResume(null)
      setPageError(friendlyMessage)
      logWarn('Mini-program payment intent or payment modal failed', {
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
    selectedCouponCode,
    selectedPlan,
    user?.id,
  ])

  if (paymentsDisabled) {
    return (
      <View className='payment-page'>
        <View className='payment-page__header'>
          <Button
            className='payment-page__back-button'
            onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile }) })}
          >
            返回
          </Button>
          <Text className='payment-page__eyebrow'>福利柜</Text>
          <Text className='payment-page__title'>开通会员权益</Text>
          <Text className='payment-page__subtitle'>支付功能升级中，当前暂不支持发起新的订单。</Text>
        </View>

        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>支付状态</Text>
          <Text className='payment-page__summary-value'>支付功能维护中</Text>
          <Text className='payment-page__summary-note'>我们正在升级支付系统，请稍后再试。</Text>
          <Text className='payment-page__summary-note'>若你刚完成支付，可继续查看已有订单结果。</Text>
          {pendingOrderToResume ? (
            <Button className='payment-page__resume-button' onClick={handleResumePendingOrder}>
              继续查看已有订单
            </Button>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View className='payment-page'>
      <View className='payment-page__header'>
        <Button
          className='payment-page__back-button'
          onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile }) })}
        >
          返回
        </Button>
        <Text className='payment-page__eyebrow'>福利柜</Text>
        <Text className='payment-page__title'>开通会员权益</Text>
        <Text className='payment-page__subtitle'>支付成功后将进入结果确认页，避免误判成功。</Text>
      </View>

      {pendingOrderToResume ? (
        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>待确认订单</Text>
          <Text className='payment-page__summary-value'>继续查看支付结果</Text>
          <Text className='payment-page__summary-note'>你有一笔订单仍在等待确认，先完成结果确认再发起新的支付。</Text>
          <Button className='payment-page__resume-button' onClick={handleResumePendingOrder}>
            继续查询订单
          </Button>
        </View>
      ) : null}

      <View className='payment-page__summary-card'>
        <Text className='payment-page__summary-label'>可用优惠</Text>
        <Text className='payment-page__summary-value'>{couponCount} 张</Text>
        <Text className='payment-page__summary-note'>支持会员权益与活动次数包</Text>
      </View>

      <View className='payment-page__plans'>
        {(Object.keys(plans) as PlanKey[]).map((planKey) => {
          const plan = plans[planKey]
          const isSelected = planKey === selectedPlan

          return (
            <Button
              key={planKey}
              className={`payment-page__plan ${isSelected ? 'payment-page__plan--selected' : ''}`}
              onClick={() => setSelectedPlan(planKey)}
            >
              <View className='payment-page__plan-content'>
                <View>
                  <Text className='payment-page__plan-title'>{plan.displayName}</Text>
                  <Text className='payment-page__plan-desc'>{plan.description || '悦聚会员专属权益'}</Text>
                </View>
                <View className='payment-page__plan-price-wrap'>
                  {plan.originalPrice ? (
                    <Text className='payment-page__plan-original'>{formatPrice(plan.originalPrice)}</Text>
                  ) : null}
                  <Text className='payment-page__plan-price'>{formatPrice(plan.price)}</Text>
                </View>
              </View>
            </Button>
          )
        })}
      </View>

      {availableCoupons.length > 0 ? (
        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>优惠券</Text>
          <View className='payment-page__plans'>
            <Button
              className={`payment-page__plan ${selectedCouponCode === '' ? 'payment-page__plan--selected' : ''}`}
              onClick={() => setSelectedCouponCode('')}
            >
              <View className='payment-page__plan-content'>
                <View>
                  <Text className='payment-page__plan-title'>不使用优惠券</Text>
                  <Text className='payment-page__plan-desc'>按当前套餐原价支付</Text>
                </View>
              </View>
            </Button>
            {availableCoupons.map((coupon) => (
              <Button
                key={coupon.id}
                className={`payment-page__plan ${selectedCouponCode === (coupon.code || '') ? 'payment-page__plan--selected' : ''}`}
                onClick={() => setSelectedCouponCode(coupon.code || '')}
              >
                <View className='payment-page__plan-content'>
                  <View>
                    <Text className='payment-page__plan-title'>{coupon.code || '优惠券'}</Text>
                    <Text className='payment-page__plan-desc'>
                      {coupon.discountType === 'percentage'
                        ? `${coupon.discountValue || 0}% 折扣`
                        : `立减 ¥${((coupon.discountValue || 0) / 100).toFixed(0)}`}
                    </Text>
                  </View>
                </View>
              </Button>
            ))}
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
        <View className='payment-page__amount-row'>
          <Text className='payment-page__amount-label'>当前选择</Text>
          <Text className='payment-page__amount-value'>{selectedPlanData.displayName}</Text>
        </View>
        {selectedPlanData.originalPrice ? (
          <View className='payment-page__amount-row'>
            <Text className='payment-page__amount-label'>原价</Text>
            <Text className='payment-page__amount-value'>{formatPrice(selectedPlanData.originalPrice)}</Text>
          </View>
        ) : null}
        {selectedCouponCode && discountAmount > 0 ? (
          <View className='payment-page__amount-row'>
            <Text className='payment-page__amount-label'>优惠减免</Text>
            <Text className='payment-page__amount-value'>- {formatPrice(discountAmount)}</Text>
          </View>
        ) : null}
        <View className='payment-page__amount-row payment-page__amount-row--total'>
          <Text className='payment-page__amount-label'>应付金额</Text>
          <Text className='payment-page__amount-total'>{formatPrice(payableAmount)}</Text>
        </View>
        <Button
          className='payment-page__pay-button'
          onClick={handlePay}
          disabled={isBootstrapping || isCreatingIntent || !user?.id || !!pendingOrderToResume}
          loading={isCreatingIntent}
        >
          {isBootstrapping ? '正在准备支付...' : pendingOrderToResume ? '请先确认当前订单' : '微信支付'}
        </Button>
        <Text className='payment-page__hint'>
          {isCreatingIntent
            ? '正在拉起微信支付，请勿重复点击'
            : pendingOrderToResume
              ? '你有一笔待确认订单，先继续查看支付结果'
              : isEventPackPlan(selectedPlan)
                ? '购买成功后可直接用次数包报名活动'
                : '切回应用后会自动校验订单结果'}
        </Text>
      </View>
    </View>
  )
}
