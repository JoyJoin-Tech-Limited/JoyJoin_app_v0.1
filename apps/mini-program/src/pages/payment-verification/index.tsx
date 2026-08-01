import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import { bustRegistrationCaches } from '../../lib/api/registrationCacheBust'
import { REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'
import {
  isPoolRegistrationReturnContext,
  useMiniProgramPaymentFlowController,
} from '../../lib/payment/paymentFlowController'
import type {
  MiniProgramPoolRegistrationReturnContext,
} from '../../lib/payment/paymentPendingOrder'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { type MiniProgramPaymentVerificationState } from '../../lib/payment/paymentVerificationStatus'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { CEREMONY_HEROES } from '../../lib/ceremonyHeroes'
import { haptics } from '../../lib/utils/haptics'
import JoyButton from '../../components/ui/Button'
import './index.scss'

function getVerificationMascotExpression(status: MiniProgramPaymentVerificationState): XiaoyueExpressionId {
  switch (status) {
    case 'paid':
      return 'actionSuccess'
    case 'failed':
      return 'actionFailure'
    default:
      return 'paymentTrust'
  }
}

function buildPoolRegistrationUrl(poolId: string): string {
  return `/${MINI_PROGRAM_PAGE_PATHS.poolRegistration}?id=${encodeURIComponent(poolId)}`
}

export default function PaymentVerificationPage() {
  const { user, isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()
  const [incomingOrderId, setIncomingOrderId] = useState('')

  const invalidatePaidCaches = useCallback(async () => {
    await bustRegistrationCaches(queryClient)
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] }),
      queryClient.invalidateQueries({ queryKey: [...REGISTRATIONS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/profile'] }),
    ])
  }, [queryClient])

  const navigateToPoolRegistration = useCallback(async (context: MiniProgramPoolRegistrationReturnContext) => {
    const targetUrl = buildPoolRegistrationUrl(context.poolId)
    const pages = Taro.getCurrentPages()
    const previousPoolRegistrationPage = pages[pages.length - 3]

    if (previousPoolRegistrationPage?.route === MINI_PROGRAM_PAGE_PATHS.poolRegistration) {
      try {
        await Taro.navigateBack({ delta: 2 })
        return
      } catch {
        // Fall through to a clean launch when the old stack is gone.
      }
    }

    await Taro.reLaunch({ url: targetUrl })
  }, [])

  const handleMissingPendingOrder = useCallback((nextMessage: string) => {
    void Taro.showToast({
      title: nextMessage,
      icon: 'none',
    })
    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
  }, [])

  const {
    orderId,
    status,
    message,
    attemptCount,
    returnContext,
    bootstrap,
    handleDidShow,
    handleLeavePendingOrder,
    navigateAfterPaid,
  } = useMiniProgramPaymentFlowController({
    authLoading,
    currentUserId: user?.id,
    incomingOrderId,
    fetchPaymentStatus: (targetOrderId) =>
      apiRequest<{ status?: string }>({
        path: `/api/payments/status/${encodeURIComponent(targetOrderId)}`,
      }),
    invalidatePaidCaches,
    onMissingPendingOrder: handleMissingPendingOrder,
    navigateToPoolRegistration,
    navigateToEvents: async () => {
      await Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
    },
    navigateToProfile: async () => {
      await Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
    },
  })

  useLoad((params) => {
    setIncomingOrderId(typeof params?.outTradeNo === 'string' ? params.outTradeNo : '')
  })

  useDidShow(() => {
    handleDidShow()
  })

  const registrationReturnContext = isPoolRegistrationReturnContext(returnContext)
    ? returnContext
    : null

  if (authLoading) {
    return (
      <JoyJoinLoadingScreen
        title='正在确认你的登录…'
        subtitle={`请稍等，${DEFAULT_MASCOT_DISPLAY_NAME}在核对订单权限`}
        showSkeleton={false}
      />
    )
  }

  return (
    <View className='verification-page'>
      <View className='verification-page__card'>
        <Text className='verification-page__title'>
          {registrationReturnContext ? '权益确认中' : '订单确认中'}
        </Text>

        {registrationReturnContext ? (
          <View className='verification-page__context'>
            <Text className='verification-page__context-kicker'>继续报名</Text>
            <Text className='verification-page__context-title'>
              {registrationReturnContext.poolTitle || '刚才那场活动'}
            </Text>
            <Text className='verification-page__context-copy'>
              支付确认后会回到报名页，你刚才填写的偏好也会一起带回去。
            </Text>
          </View>
        ) : null}

        {status === 'paid' ? (
          // C2 — Ceremony hero for the paid confirmation moment (Batch C)
          <Image
            className='verification-page__hero'
            mode='aspectFit'
            src={CEREMONY_HEROES.eventPaidConfirmed}
            ariaLabel=''
            lazyLoad
            onLoad={() => haptics('success')}
          />
        ) : null}

        <Image
          className='verification-page__mascot'
          mode='aspectFit'
          src={getXiaoyueExpressionAsset(getVerificationMascotExpression(status))}
          ariaLabel='支付状态'
        />

        <Text className='verification-page__message'>{message}</Text>

        {status === 'polling' ? (
          <View className='verification-page__spinner-wrap'>
            <View className='verification-page__spinner' />
            <Text className='verification-page__meta'>已查询 {attemptCount} / 10 次</Text>
          </View>
        ) : null}

        {status === 'paid' ? (
          <JoyButton variant='primary' className='verification-page__button' onClick={() => void navigateAfterPaid()}>
            {registrationReturnContext ? '回到报名页完成报名' : '进入我的权益'}
          </JoyButton>
        ) : null}

        {status === 'pending' ? (
          <View className='verification-page__actions'>
            <JoyButton variant='primary' className='verification-page__button' onClick={handleLeavePendingOrder}>
              {registrationReturnContext ? '先回报名页' : '先回我的页'}
            </JoyButton>
            <JoyButton
              variant='secondary'
              className='verification-page__button verification-page__button--secondary'
              onClick={() => bootstrap(orderId)}
            >
              继续查询
            </JoyButton>
          </View>
        ) : null}

        {status === 'failed' ? (
          <View className='verification-page__actions'>
            <JoyButton
              variant='primary'
              className='verification-page__button'
              onClick={() => Taro.navigateBack({ fail: () => Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.blindBoxPayment }) })}
            >
              {registrationReturnContext ? '重新支付并继续报名' : '重新支付'}
            </JoyButton>
            <JoyButton
              variant='secondary'
              className='verification-page__button verification-page__button--secondary'
              onClick={() => {
                if (registrationReturnContext) {
                  void navigateToPoolRegistration(registrationReturnContext)
                  return
                }

                Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
              }}
            >
              {registrationReturnContext ? '返回报名页' : '返回我的页'}
            </JoyButton>
          </View>
        ) : null}
      </View>
    </View>
  )
}
