import { View, Text } from '@tarojs/components'
import { ARCHETYPE_FAMILY_COLORS } from '@shared/archetypeColors'

interface CompatibilityIndicatorProps {
  score: number
  family: 'warm' | 'cool' | 'fire' | 'calm'
}

export default function CompatibilityIndicator({
  score,
  family,
}: CompatibilityIndicatorProps) {
  const color = ARCHETYPE_FAMILY_COLORS[family] || '#A86BFF'
  const fillPercent = Math.min(100, Math.max(0, score))

  return (
    <View className='compatibility-indicator'>
      <View className='compatibility-indicator__bar'>
        <View className='compatibility-indicator__track'>
          <View
            className='compatibility-indicator__fill'
            style={{
              transform: `scaleX(${fillPercent / 100})`,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
      <Text className='compatibility-indicator__score' style={{ color }}>
        高默契占比 {score}%
      </Text>
    </View>
  )
}
