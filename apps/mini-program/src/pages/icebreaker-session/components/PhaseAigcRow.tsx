import { View } from '@tarojs/components'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'

/**
 * PhaseAigcRow — quiet AIGC disclosure row for phase cards.
 * When no meta is persisted for the phase, falls back to the plain
 * "AI 生成内容" label (the content is still AI-generated).
 */
export function PhaseAigcRow({ meta, reason }: { meta?: AIResponseMeta; reason: string }) {
  const enabled = useAIGCLabelsEnabled()
  if (!enabled) return null
  const aigcMeta = meta?.aigc ?? { aiGenerated: true, labelType: 'ai-generated' as const }
  return (
    <View
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12rpx',
        marginTop: '16rpx',
      }}
    >
      <AIGCLabel meta={aigcMeta} />
      <AIContentReportButton options={{ reason }} label='反馈这段内容' />
    </View>
  )
}
