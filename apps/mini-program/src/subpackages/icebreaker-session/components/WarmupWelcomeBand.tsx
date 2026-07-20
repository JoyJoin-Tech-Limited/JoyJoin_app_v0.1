import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { WelcomeSegment } from '../viewModels/warmupViewModels'
import './WarmupWelcomeBand.scss'

interface WarmupWelcomeBandProps {
  welcomeSegments: WelcomeSegment[]
  caption: string
}

export function WarmupWelcomeBand({ welcomeSegments, caption }: WarmupWelcomeBandProps) {
  return (
    <View className='warmup-welcome'>
      <View className='warmup-welcome__row'>
        <Image
          className='warmup-welcome__avatar'
          src={getXiaoyueExpressionAsset('homeWelcome')}
          mode='aspectFit'
        />
        <Text className='warmup-welcome__line'>
          {welcomeSegments.map((segment, index) => {
            if (segment.accentArchetype) {
              const def = ARCHETYPE_BY_ID[segment.accentArchetype]
              const accentColor = def
                ? getContrastSafeArchetypeColor(segment.accentArchetype)
                : undefined
              return (
                <Text
                  key={index}
                  className='warmup-welcome__accent'
                  style={accentColor ? { color: accentColor } : undefined}
                >
                  {segment.text}
                </Text>
              )
            }
            return (
              <Text key={index} className='warmup-welcome__plain'>
                {segment.text}
              </Text>
            )
          })}
        </Text>
      </View>
      <Text className='warmup-welcome__caption'>{caption}</Text>
    </View>
  )
}
