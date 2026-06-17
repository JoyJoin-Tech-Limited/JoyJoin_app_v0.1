import { View, Text } from '@tarojs/components'
import './ShareCardShimmer.scss'

export default function ShareCardShimmer() {
  return (
    <View className='share-card-shimmer' aria-live='polite'>
      <View className='share-card-shimmer__card'>
        <View className='share-card-shimmer__avatar' />
        <View className='share-card-shimmer__lines'>
          <View className='share-card-shimmer__line' />
          <View className='share-card-shimmer__line share-card-shimmer__line--short' />
        </View>
      </View>
      <Text className='share-card-shimmer__text'>悦仔正在绘制你的社交名片…</Text>
    </View>
  )
}
