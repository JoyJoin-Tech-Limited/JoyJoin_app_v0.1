import { View, Text } from '@tarojs/components'
import './CityUnlockFeedCard.scss'

interface CityUnlockFeedCardProps {
  onSelectCity: () => void
}

/**
 * Contextual card shown at the bottom of the Discover feed.
 * Invites non-Shenzhen users to register interest in their city.
 */
export default function CityUnlockFeedCard({ onSelectCity }: CityUnlockFeedCardProps) {
  return (
    <View className='city-unlock-feed-card' onClick={onSelectCity}>
      <View className='city-unlock-feed-card__border' />
      <View className='city-unlock-feed-card__content'>
        <Text className='city-unlock-feed-card__emoji'>🌟</Text>
        <View className='city-unlock-feed-card__text'>
          <Text className='city-unlock-feed-card__title'>想在你的城市玩？</Text>
          <Text className='city-unlock-feed-card__subtitle'>
            点击告诉我们，人数够了我们就带着活动来找你！
          </Text>
        </View>
        <View className='city-unlock-feed-card__cta'>
          <Text className='city-unlock-feed-card__cta-text'>选择我的城市</Text>
        </View>
      </View>
    </View>
  )
}
