import { Button, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, getUserCoupons } from '@shared/api'
import { apiRequest } from '../../lib/api'
import './index.scss'

export default function ProfilePage() {
  // TODO: Taro adaptation needed for the web profile page's charts, dialogs, and DOM-specific interaction polish.
  const { data: user } = useQuery({
    queryKey: ['mini-program', 'auth-user'],
    queryFn: () => getCurrentUser(apiRequest),
  })
  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupon-count'],
    queryFn: () => getUserCoupons(apiRequest),
  })

  return (
    <View className='profile-page'>
      <View className='profile-page__hero'>
        <Text className='profile-page__eyebrow'>我的福利柜</Text>
        <Text className='profile-page__title'>{typeof user?.nickname === 'string' ? `${user.nickname} 的权益中心` : '把支付入口放到 2 次点击内'}</Text>
        <Text className='profile-page__subtitle'>
          已接通用户态、优惠信息与支付入口，后续逐步承接 web 资料页能力。
        </Text>
      </View>

      <View className='profile-page__card'>
        <Text className='profile-page__card-title'>会员权益</Text>
        <Text className='profile-page__card-copy'>月度 / 季度权益包，支付成功后自动进入订单确认流程。当前可用优惠 {coupons.count ?? 0} 张。</Text>
        <Button
          className='profile-page__cta'
          onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}
        >
          去开通权益
        </Button>
      </View>

      <View className='profile-page__card'>
        <Text className='profile-page__card-title'>资料进度</Text>
        <Text className='profile-page__card-copy'>当前 nextStep：{String(user?.nextStep ?? 'discover')}</Text>
        <Button
          className='profile-page__cta'
          onClick={() => Taro.navigateTo({ url: '/pages/onboarding/profile-review/index' })}
        >
          查看占位流程页
        </Button>
      </View>
    </View>
  )
}
