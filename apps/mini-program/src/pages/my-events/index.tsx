import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'

export default function MyEventsLegacyPage() {
  useEffect(() => {
    Taro.switchTab({ url: '/pages/events/index' })
  }, [])

  return (
    <View>
      <Text>正在前往我的足迹...</Text>
    </View>
  )
}
