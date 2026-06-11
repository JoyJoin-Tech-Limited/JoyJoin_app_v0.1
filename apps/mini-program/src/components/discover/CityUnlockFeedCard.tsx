import { View, Text, Image } from '@tarojs/components'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../lib/utils/haptics'
import { useState, useCallback, useMemo } from 'react'
import './CityUnlockFeedCard.scss'

interface CityUnlockFeedCardProps {
  onSelectCity: () => void
}

/**
 * Contextual card shown at the bottom of the Discover feed.
 * Invites non-Shenzhen users to register interest in their city.
 * Features a small Xiaoyue mascot for brand warmth.
 */
export default function CityUnlockFeedCard({ onSelectCity }: CityUnlockFeedCardProps) {
  const xiaoyueAsset = useMemo(() => getXiaoyueExpressionAsset('coachGuide'), [])
  const [mascotError, setMascotError] = useState(false)

  const handleTap = useCallback(() => {
    haptics('light')
    onSelectCity()
  }, [onSelectCity])

  return (
    <View
      className='city-unlock-feed-card'
      onClick={handleTap}
      hoverClass='city-unlock-feed-card__hover'
      role='button'
      aria-label='选择你的城市，告诉我们你在哪里'
    >
      <View className='city-unlock-feed-card__border' />
      <View className='city-unlock-feed-card__content'>
        <View className='city-unlock-feed-card__hero'>
        {!mascotError && (
          <Image
            className='city-unlock-feed-card__mascot'
            src={xiaoyueAsset}
            mode='aspectFit'
            onError={() => setMascotError(true)}
          />
        )}
          <JoyJoinIcon emoji='🌟' size={40} className='city-unlock-feed-card__emoji' />
        </View>
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
