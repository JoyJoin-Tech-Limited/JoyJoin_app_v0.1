import { View, Text } from '@tarojs/components'
import type { ConnectionPointWithRarity } from '@shared/types/groupAnalysis'
import './index.scss'

interface ConnectionPointPillProps extends ConnectionPointWithRarity {}

export default function ConnectionPointPill({ text, rarity }: ConnectionPointPillProps) {
  return (
    <View className={`connection-point-pill pill--${rarity}`}>
      <Text className='pill-text'>{text}</Text>
    </View>
  )
}
