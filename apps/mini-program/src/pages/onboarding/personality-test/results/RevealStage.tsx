import { Image, Text, View } from '@tarojs/components'
import { COLOR_PRIMARY } from '../../../../lib/utils/uiConstants'
import type { ArchetypeVisual } from '../visuals'
import type { RevealPhase } from './resultHelpers'

interface RevealStageProps {
  displayArchetypeName: string
  displayAsset: string
  visual: ArchetypeVisual
  revealPhase: RevealPhase
  phaseText?: string
}

export default function RevealStage({ displayArchetypeName, displayAsset, visual, revealPhase, phaseText }: RevealStageProps) {
  return (
    <View className='personality-results__immersive-shell personality-results__immersive-shell--reveal'>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
      <Text className='personality-results__immersive-title'>你的卡面正在显形</Text>
      <Text className='personality-results__immersive-copy'>
        {phaseText || '最后一点火花亮起之后，就会进入完整的结果页。'}
      </Text>

      <View className='personality-results__reveal-orb'>
        <View className='personality-results__reveal-glow' style={{ background: visual.accent || COLOR_PRIMARY }} />
        <Image
          className={`personality-results__reveal-image personality-results__reveal-image--${revealPhase}`}
          mode='aspectFit'
          src={displayAsset}
        />
        <View className={`personality-results__reveal-scrim personality-results__reveal-scrim--${revealPhase}`} />
        <View className={`personality-results__reveal-glow-overlay personality-results__reveal-glow-overlay--${revealPhase}`} />
      </View>

      <Text className='personality-results__reveal-label'>{displayArchetypeName}</Text>
      <Text className='personality-results__reveal-copy'>
        {revealPhase === 'silhouette'
          ? '先看轮廓，留一点悬念。'
          : revealPhase === 'fill'
            ? '颜色和气场正在回到正确的位置。'
            : '最后这一圈火花之后，就是你的完整结果页。'}
      </Text>
    </View>
  )
}
