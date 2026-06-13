import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { ARCHETYPE_BY_ID } from '@shared/personality'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import './ArchetypeCluster.scss'

const MAX_CLUSTER_CIRCLES = 20
const MAX_CIRCLES_PER_ARCHETYPE = 3

interface ArchetypeClusterProps {
  archetypes: string[]
  totalCount: number
}

export default function ArchetypeCluster({ archetypes, totalCount }: ArchetypeClusterProps) {
  const distribution = useMemo(() => {
    if (!archetypes.length) return []
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

    const result: string[] = []
    for (const [key, count] of sorted) {
      if (result.length >= MAX_CLUSTER_CIRCLES) break
      const circles = Math.min(
        MAX_CIRCLES_PER_ARCHETYPE,
        Math.max(1, Math.ceil(count / 5)),
        MAX_CLUSTER_CIRCLES - result.length,
      )
      for (let i = 0; i < circles; i++) {
        result.push(key)
      }
    }
    return result
  }, [archetypes])

  const hasOverflow = distribution.length >= MAX_CLUSTER_CIRCLES && totalCount > distribution.length

  const topNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => ARCHETYPE_BY_ID[key]?.nameCn)
      .filter(Boolean)
  }, [archetypes])

  const labelText =
    topNames.length > 0
      ? `已有 ${totalCount} 位伙伴报名，包括${topNames.join('、')}${hasOverflow ? '…' : ''}`
      : `已有 ${totalCount} 位伙伴报名`

  if (!distribution.length) {
    return (
      <View className='archetype-cluster archetype-cluster--empty'>
        <View className='archetype-cluster__empty-pulse' />
        <Text className='archetype-cluster__label'>已有 {totalCount} 位伙伴报名</Text>
      </View>
    )
  }

  return (
    <View className='archetype-cluster'>
      <View className='archetype-cluster__heads'>
        {distribution.map((key, index) => {
          const tokens = getArchetypeTokens(key)
          return (
            <View
              key={key + index}
              className='archetype-cluster__head-wrap'
              style={{
                borderColor: tokens.primary,
                backgroundColor: tokens.background,
                zIndex: distribution.length - index,
              }}
            >
              <ArchetypeHead archetype={key} size={40} />
            </View>
          )
        })}
        {hasOverflow ? (
          <View className='archetype-cluster__overflow-badge' aria-role='img' aria-label='还有更多人报名'>
            <Text className='archetype-cluster__overflow-text'>+</Text>
          </View>
        ) : null}
      </View>
      <Text className='archetype-cluster__label'>{labelText}</Text>
    </View>
  )
}
