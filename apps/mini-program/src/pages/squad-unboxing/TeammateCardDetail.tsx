import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import ConnectionPointPill from '../../components/ConnectionPointPill'

export interface TeammateCardDetailProps {
  member?: PoolGroupMemberSummary | null
  viewerPair?: PairExplanation | null
  visible: boolean
}

function getMemberName(member?: PoolGroupMemberSummary | null): string {
  return member?.displayName || '这位桌友'
}

function getArchetypeDisplayName(archetype?: string | null): string {
  if (!archetype) return ''
  return ARCHETYPE_BY_ID[archetype]?.nameCn || archetype
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
}: TeammateCardDetailProps) {
  const name = getMemberName(member)
  const archetypeName = getArchetypeDisplayName(member?.archetype)
  const connectionPoints = useMemo(() => getConnectionPoints(viewerPair), [viewerPair])
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

      {viewerPair?.explanation ? (
        <View className='squad-unboxing__deck-detail-section'>
          <Text className='squad-unboxing__deck-detail-section-title'>{name} 和你的连接感</Text>
          <Text className='squad-unboxing__deck-detail-reason'>{viewerPair.explanation}</Text>
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
          <Text className='squad-unboxing__deck-detail-intro'>{viewerPair.introAngle}</Text>
        </View>
      ) : null}

      {!viewerPair?.explanation && connectionPoints.length === 0 ? (
        <Text className='squad-unboxing__deck-detail-empty'>
          悦仔还在分析你们之间的连接点，稍后会更新更详细的解读。
        </Text>
      ) : null}
    </View>
  )
}
