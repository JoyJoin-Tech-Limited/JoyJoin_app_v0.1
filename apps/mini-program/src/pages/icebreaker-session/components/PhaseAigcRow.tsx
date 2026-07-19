import { View } from '@tarojs/components'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'

/**
 * PhaseAigcRow — quiet AIGC disclosure row for phase cards.
 * FAIL-CLOSED: renders only when meta explicitly marks the content as
 * AI-generated. A missing meta must never claim AI authorship (e.g.,
 * curated-bank fallbacks or user-authored content).
 */
export function PhaseAigcRow({ meta, reason }: { meta?: AIResponseMeta; reason: string }) {
  const enabled = useAIGCLabelsEnabled()
  if (!enabled) return null
  if (!meta?.aigc?.aiGenerated) return null
  return (
    <View
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8rpx',
        marginTop: '16rpx',
      }}
    >
      <AIGCLabel meta={meta.aigc} />
      <AIContentReportButton options={{ reason }} label='反馈这段内容' />
    </View>
  )
}
