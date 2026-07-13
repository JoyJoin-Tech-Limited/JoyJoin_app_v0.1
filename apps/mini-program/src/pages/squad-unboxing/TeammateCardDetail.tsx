import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import type { AIGCMeta } from '@shared/types/aiMeta'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'

export interface TeammateCardDetailProps {
  member?: PoolGroupMemberSummary | null
  viewerPair?: PairExplanation | null
  visible: boolean
  groupId: string
  aigcMeta?: AIGCMeta
  aigcEnabled?: boolean
}

function getMemberName(member?: PoolGroupMemberSummary | null): string {
  return member?.displayName || '这位桌友'
}

function getArchetypeDisplayName(archetype?: string | null): string {
  if (!archetype) return ''
  return ARCHETYPE_BY_ID[archetype]?.nameCn || '神秘伙伴'
}

function getConnectionPoints(pair?: PairExplanation | null) {
  if (!pair) return []
  if (pair.connectionPointsWithRarity && pair.connectionPointsWithRarity.length > 0) {
    return pair.connectionPointsWithRarity.slice(0, 3)
  }
  if (pair.connectionPoints && pair.connectionPoints.length > 0) {
    return pair.connectionPoints.slice(0, 3).map((text) => ({ text, rarity: 'common' as const }))
  }
  return []
}

export default function TeammateCardDetail({
  member,
  viewerPair,
  visible,
  groupId,
  aigcMeta,
  aigcEnabled,
}: TeammateCardDetailProps) {
  const name = getMemberName(member)
  const archetypeName = getArchetypeDisplayName(member?.archetype)
  const connectionPoints = useMemo(() => getConnectionPoints(viewerPair), [viewerPair])
  const connectionReason = useMemo(() => normalizeMatchingCopy(viewerPair?.explanation), [viewerPair?.explanation])
  const metaParts = [member?.ageLabel, member?.industryNicheLabel || member?.industryCategoryLabel].filter(Boolean)

  if (!visible || !member) return null

  return (
    <View className='squad-unboxing__deck-detail' aria-live='polite'>
      <View className='squad-unboxing__deck-detail-header'>
        <Text className='squad-unboxing__deck-detail-name'>{name}</Text>
        {archetypeName ? <Text className='squad-unboxing__deck-detail-archetype'>{archetypeName}</Text> : null}
        {metaParts.length > 0 ? (
          <Text className='squad-unboxing__deck-detail-meta'>{metaParts.join(' · ')}</Text>
        ) : null}
      </View>

      {connectionReason ? (
        <View className='squad-unboxing__deck-detail-section'>
          <Text className='squad-unboxing__deck-detail-section-title'>{name}和你的连接感</Text>
          <AIGCLabel meta={aigcMeta} className='squad-unboxing__deck-detail-aigc' />
          <Text className='squad-unboxing__deck-detail-reason'>{connectionReason}</Text>
        </View>
      ) : null}

      {connectionPoints.length > 0 ? (
        <View className='squad-unboxing__deck-detail-section'>
          <Text className='squad-unboxing__deck-detail-section-title'>你们的共同点</Text>
          <View className='squad-unboxing__deck-detail-pills'>
            {connectionPoints.map((point) => (
              <ConnectionPointPill key={point.text} text={point.text} rarity={point.rarity} />
            ))}
          </View>
        </View>
      ) : null}

      {viewerPair?.introAngle ? (
        <View className='squad-unboxing__deck-detail-section'>
          <Text className='squad-unboxing__deck-detail-section-title'>开场可以这样聊</Text>
          <AIGCLabel meta={aigcMeta} className='squad-unboxing__deck-detail-aigc' />
          <Text className='squad-unboxing__deck-detail-intro'>{viewerPair.introAngle}</Text>
        </View>
      ) : null}

      {aigcEnabled && aigcMeta?.aiGenerated ? (
        <View className='squad-unboxing__deck-detail-report-wrap'>
          <AIContentReportButton
            options={{
              reason: '举报 AI 生成的队友连接解读内容',
              relatedEventId: groupId,
              reportedUserId: member?.userId,
            }}
            label='举报此内容'
          />
        </View>
      ) : null}

      {!connectionReason && connectionPoints.length === 0 ? (
        <Text className='squad-unboxing__deck-detail-empty'>
          悦仔还在分析你们之间的连接点，稍后会更新更详细的解读。
        </Text>
      ) : null}
    </View>
  )
}
