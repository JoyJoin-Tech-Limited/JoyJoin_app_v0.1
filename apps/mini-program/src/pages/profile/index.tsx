import { Button, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function ProfilePage() {
  return (
    <View className='profile-page'>
      <View className='profile-page__hero'>
        <Text className='profile-page__eyebrow'>我的福利柜</Text>
        <Text className='profile-page__title'>把支付入口放到 2 次点击内</Text>
        <Text className='profile-page__subtitle'>
          从发现页进入“我的”，再点下方按钮即可完成会员支付。
        </Text>
      </View>

      <View className='profile-page__card'>
        <Text className='profile-page__card-title'>会员权益</Text>
        <Text className='profile-page__card-copy'>月度 / 季度权益包，支付成功后自动进入订单确认流程。</Text>
        <Button
          className='profile-page__cta'
          onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}
        >
          去开通权益
        </Button>
      </View>
    </View>
  )
}
