import { Button, View, Text } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import { apiRequest, authenticateMiniProgramUser } from '../../lib/api'
import { logError, logWarn } from '../../lib/logger'
import './index.scss'

type PlanKey = 'vip_monthly' | 'vip_quarterly'

interface PricingPlan {
  id: string
  planType: string
  displayName: string
  description?: string
  price: number
  originalPrice?: number | null
}

interface PaymentIntentResponse {
  outTradeNo: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
  type: string
}

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

function clearPendingOrderStorage() {
  wx.removeStorageSync('pending_order')
  wx.removeStorageSync('pending_order_context')
}

export default function BlindBoxPaymentPage() {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('vip_monthly')
  const [plans, setPlans] = useState<Record<PlanKey, PricingPlan>>(DEFAULT_PLANS)
  const [couponCount, setCouponCount] = useState(0)
  const [openid, setOpenid] = useState('')
  const [pageError, setPageError] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isCreatingIntent, setIsCreatingIntent] = useState(false)

  const loadPageData = useCallback(async () => {
    setIsBootstrapping(true)
    setPageError('')

    try {
      const session = await authenticateMiniProgramUser()
      setOpenid(session.openid)

      const [pricing, coupons] = await Promise.all([
        apiRequest<PricingPlan[]>({
          path: '/api/pricing',
        }).catch(() => []),
        apiRequest<{ count?: number }>({
          path: '/api/user/coupons',
        }).catch(() => ({ count: 0 })),
      ])

      const monthlyPlan = pricing.find((plan) => plan.planType === 'vip_monthly')
      const quarterlyPlan = pricing.find((plan) => plan.planType === 'vip_quarterly')

      setPlans({
        vip_monthly: monthlyPlan ?? DEFAULT_PLANS.vip_monthly,
        vip_quarterly: quarterlyPlan ?? DEFAULT_PLANS.vip_quarterly,
      })
      setCouponCount(typeof coupons.count === 'number' ? coupons.count : 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载支付信息失败'
      setPageError(message)
      logError('Failed to bootstrap mini-program payment page', { message })
    } finally {
      setIsBootstrapping(false)
    }
  }, [])

  useLoad(() => {
    loadPageData()
  })

  useDidShow(() => {
    loadPageData()
  })

  const selectedPlanData = useMemo(() => plans[selectedPlan], [plans, selectedPlan])

  const handlePay = useCallback(async () => {
    if (isCreatingIntent || !openid) {
      return
    }

    setIsCreatingIntent(true)
    setPageError('')

    try {
      const paymentIntent = await apiRequest<PaymentIntentResponse>({
        path: '/api/payments/miniprogram/create',
        method: 'POST',
        data: {
          type: selectedPlan,
          planId: selectedPlan,
          openid,
        },
      })

      wx.setStorageSync('pending_order', paymentIntent.outTradeNo)
      wx.setStorageSync('pending_order_context', {
        type: paymentIntent.type,
      })

      await new Promise<void>((resolve, reject) => {
        wx.requestPayment({
          timeStamp: paymentIntent.timeStamp,
          nonceStr: paymentIntent.nonceStr,
          package: paymentIntent.package,
          signType: paymentIntent.signType,
          paySign: paymentIntent.paySign,
          success: () => resolve(),
          fail: (error) => reject(error),
        })
      })

      await Taro.navigateTo({
        url: `/pages/payment-verification/index?outTradeNo=${encodeURIComponent(paymentIntent.outTradeNo)}`,
      })
    } catch (error: any) {
      const errMsg = typeof error?.errMsg === 'string' ? error.errMsg : undefined
      const friendlyMessage = getFriendlyPaymentError(errMsg || error?.message)

      if (!friendlyMessage) {
        clearPendingOrderStorage()
        return
      }

      clearPendingOrderStorage()
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
  }, [isCreatingIntent, openid, selectedPlan])

  return (
    <View className='payment-page'>
      <View className='payment-page__header'>
        <Button
          className='payment-page__back-button'
          onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })}
        >
          返回
        </Button>
        <Text className='payment-page__eyebrow'>福利柜</Text>
        <Text className='payment-page__title'>开通会员权益</Text>
        <Text className='payment-page__subtitle'>支付成功后将进入结果确认页，避免误判成功。</Text>
      </View>

      <View className='payment-page__summary-card'>
        <Text className='payment-page__summary-label'>可用优惠</Text>
        <Text className='payment-page__summary-value'>{couponCount} 张</Text>
        <Text className='payment-page__summary-note'>价格会在页面回前台时自动刷新</Text>
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

      {pageError ? <Text className='payment-page__error'>{pageError}</Text> : null}

      <View className='payment-page__footer'>
        <View className='payment-page__amount-row'>
          <Text className='payment-page__amount-label'>当前选择</Text>
          <Text className='payment-page__amount-value'>{selectedPlanData.displayName}</Text>
        </View>
        <View className='payment-page__amount-row payment-page__amount-row--total'>
          <Text className='payment-page__amount-label'>应付金额</Text>
          <Text className='payment-page__amount-total'>{formatPrice(selectedPlanData.price)}</Text>
        </View>
        <Button
          className='payment-page__pay-button'
          onClick={handlePay}
          disabled={isBootstrapping || isCreatingIntent || !openid}
          loading={isCreatingIntent}
        >
          {isBootstrapping ? '正在准备支付...' : '微信支付'}
        </Button>
        <Text className='payment-page__hint'>
          {isCreatingIntent ? '正在拉起微信支付，请勿重复点击' : '切回应用后会自动校验订单结果'}
        </Text>
      </View>
    </View>
  )
}
