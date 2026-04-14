import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { redirectLegacyEventsEntryToTab } from '../../lib/eventsTabRedirect'
import './index.scss'

export default function MyEventsPage() {
  useLoad(() => {
    void redirectLegacyEventsEntryToTab(Taro)
  })

  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>正在跳转</Text>
        <Text className='page__subtitle'>旧入口已迁移到「足迹」</Text>
      </View>
    </View>
  )
}
