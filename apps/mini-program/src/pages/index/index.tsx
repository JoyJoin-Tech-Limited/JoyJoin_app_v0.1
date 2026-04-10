import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Index() {
  useLoad(() => {
    Taro.reLaunch({ url: '/pages/discover/index' })
  })

  return (
    <View className='index'>
      <Text>正在进入 JoyJoin…</Text>
    </View>
  )
}
