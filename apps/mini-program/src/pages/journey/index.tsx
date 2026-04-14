import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { redirectLegacyJourneyToEvents } from './redirect'
import './index.scss'

export default function JourneyPage() {
  useLoad(() => {
    void redirectLegacyJourneyToEvents(Taro)
  })

  return (
    <View className='journey-page'>
      <View className='journey-page__loading'>
        <Text className='journey-page__loading-text'>正在前往「我的足迹」…</Text>
      </View>
    </View>
  )
}
