import { Button, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, getUserCoupons } from '@shared/api'
import type { OnboardingStep } from '../../lib/api'
import { apiRequest } from '../../lib/api'
import { nextStepToMiniProgramRoute } from '../../lib/onboardingRoutes'
import './index.scss'

/**
 * ProfilePage — user profile hub.
 *
 * Displays the user's identity and profile completion state.
 * Payment/membership access is surfaced as a secondary action below profile info.
 *
 * TODO: Taro adaptation needed for the web profile page's edit flows, charts,
 * dialogs, and DOM-specific interaction polish.
 */
export default function ProfilePage() {
  const { data: user } = useQuery({
    queryKey: ['mini-program', 'auth-user'],
    queryFn: () => getCurrentUser(apiRequest),
  })
  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
  })

  const displayName = user?.nickname || '我的资料'
  const onboardingStep = (user?.nextStep as OnboardingStep | undefined) ?? 'discover'
  // 'discover' and 'guide' are the terminal steps after onboarding is complete
  const isOnboarding = onboardingStep !== 'discover' && onboardingStep !== 'guide'
  const couponCount = coupons?.count ?? 0
  const onboardingRoute = nextStepToMiniProgramRoute(onboardingStep)

  return (
    <View className='profile-page'>
      <View className='profile-page__hero'>
        <Text className='profile-page__eyebrow'>个人资料</Text>
        <Text className='profile-page__title'>{displayName}</Text>
        <Text className='profile-page__subtitle'>
          {isOnboarding ? '资料填写尚未完成，完成后即可参与匹配活动。' : '资料已完善，可参与匹配活动。'}
        </Text>
      </View>

      {isOnboarding && (
        <View className='profile-page__card'>
          <Text className='profile-page__card-title'>完善资料</Text>
          <Text className='profile-page__card-copy'>继续填写你的个人信息，让算法更好地为你匹配。</Text>
          <Button
            className='profile-page__cta'
            onClick={() => Taro.navigateTo({ url: onboardingRoute })}
          >
            继续填写资料
          </Button>
        </View>
      )}

      <View className='profile-page__card'>
        <Text className='profile-page__card-title'>会员权益</Text>
        <Text className='profile-page__card-copy'>
          月度 / 季度权益包，支付成功后自动进入订单确认流程。{couponCount > 0 ? `当前可用优惠 ${couponCount} 张。` : ''}
        </Text>
        <Button
          className='profile-page__cta'
          onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}
        >
          查看权益方案
        </Button>
      </View>
    </View>
  )
}
