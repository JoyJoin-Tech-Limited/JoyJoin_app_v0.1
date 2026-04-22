import { Image, Text, View } from '@tarojs/components'
import { useMemo } from 'react'
import Card from '../../../../../components/Card'
import { COLOR_PRIMARY } from '../../../../../lib/uiConstants'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../../visuals'
import { getVisibleReelItems, type SlotPhase } from '../resultHelpers'

interface SlotStageProps {
  reelIndex: number
  slotPhase: SlotPhase
  isSlowNetwork: boolean
  progress: number
  phaseText?: string
}

export default function SlotStage({ reelIndex, slotPhase, isSlowNetwork, progress, phaseText }: SlotStageProps) {
  const visibleItems = useMemo(() => getVisibleReelItems(reelIndex), [reelIndex])
  const progressWidth = `${Math.min(100, Math.max(progress, 4))}%`
  const slotFocusVisual = useMemo(() => getArchetypeVisual(visibleItems[1]), [visibleItems])

  return (
    <View className='personality-results__immersive-shell'>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
      <Text className='personality-results__immersive-title'>你的社交卡面正在靠近</Text>
      <Text className='personality-results__immersive-copy'>
        先让命运转几圈，再锁定真正属于你的那一张牌。
      </Text>

      <View className='personality-results__slot-frame'>
        <View className='personality-results__slot-rail' />
        <View className='personality-results__slot-highlight' />

        <View className='personality-results__slot-track'>
          {visibleItems.map((archetype, index) => {
            const itemVisual = getArchetypeVisual(archetype)
            const isActive = index === 1

            return (
              <View
                key={`${archetype}-${index}`}
                className={`personality-results__slot-card${isActive ? ' personality-results__slot-card--active' : ''}`}
                style={{
                  background: isActive ? itemVisual.accentSurface : 'rgba(255, 255, 255, 0.78)',
                  borderColor: isActive ? itemVisual.accentBorder : 'rgba(139, 92, 246, 0.12)',
                  boxShadow: isActive ? `0 18rpx 48rpx ${itemVisual.accentGlow}` : 'none',
                }}
              >
                <Image
                  className='personality-results__slot-image'
                  mode='aspectFit'
                  src={
                    itemVisual.asset ||
                    getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsSlotFallback)
                  }
                />
                <Text className='personality-results__slot-name'>{archetype}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className='personality-results__progress-track'>
        <View
          className='personality-results__progress-fill'
          style={{
            width: progressWidth,
            background: slotFocusVisual.accent || COLOR_PRIMARY,
          }}
        />
      </View>
      <Text className='personality-results__progress-copy'>{phaseText || '正在准备最终揭晓...'}</Text>

      {(slotPhase === 'holding' || isSlowNetwork) ? (
        <Card className='personality-results__network-card'>
          <Image
            className='personality-results__network-xiaoyue'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.networkHolding)}
          />
          <View className='personality-results__network-copy'>
            <Text className='personality-results__network-title'>小悦还在等最后一条同步</Text>
            <Text className='personality-results__network-text'>
              网络有点慢也没关系，动画会继续转到结果真正到位为止。
            </Text>
          </View>
        </Card>
      ) : null}
    </View>
  )
}
