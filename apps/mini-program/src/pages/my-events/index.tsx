import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import './index.scss'

export default function MyEventsPage() {
  useLoad(() => {
    Taro.switchTab({ url: '/pages/events/index' })
  })

  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>正在跳转</Text>
        <Text className='page__subtitle'>旧入口已迁移到「活动」</Text>
      </View>
    </View>
  )
}
