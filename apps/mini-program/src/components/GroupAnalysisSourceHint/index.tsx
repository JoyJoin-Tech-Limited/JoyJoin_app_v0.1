import { Text, View } from '@tarojs/components'
import type { GroupAnalysisResponse } from '@shared/types/groupAnalysis'
import { shouldShowGroupAnalysisDebugMeta } from '../../lib/matching/groupAnalysisDebug'
import './index.scss'

export type GroupAnalysisSourceHintProps = {
  analysis: Pick<GroupAnalysisResponse, 'fromCache' | 'generatedAt'> | null | undefined
  className?: string
}

function formatShortGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      return ''
    }
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Renders only when {@link shouldShowGroupAnalysisDebugMeta} is true (dev or explicit beta flag).
 */
export function GroupAnalysisSourceHint({ analysis, className = '' }: GroupAnalysisSourceHintProps) {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  if (!shouldShowGroupAnalysisDebugMeta() || !analysis) {
    return null
  }

  const source = analysis.fromCache ? '缓存' : '实时生成'
  const timeLabel = formatShortGeneratedAt(analysis.generatedAt)
  const rootClass = ['group-analysis-source-hint', className].filter(Boolean).join(' ')

  return (
    <View className={rootClass}>
      <Text className='group-analysis-source-hint__text'>
        调试 · 桌友分析 {source}
        {timeLabel ? ` · ${timeLabel}` : ''}
      </Text>
    </View>
  )
}
