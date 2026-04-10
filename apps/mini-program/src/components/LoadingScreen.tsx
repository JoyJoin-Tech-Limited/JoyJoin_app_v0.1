import { View, Text } from '@tarojs/components'
import './LoadingScreen.scss'

/**
 * Standard full-page loading state.
 */
export default function LoadingScreen({ message = '加载中…' }: { message?: string }) {
  return (
    <View className='loading-screen'>
      <View className='loading-screen__spinner' />
      <Text className='loading-screen__message'>{message}</Text>
    </View>
  )
}
