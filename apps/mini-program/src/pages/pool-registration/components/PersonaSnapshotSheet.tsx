import { View, Text, ScrollView } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { PoolPersonaSnapshotResponse } from '@shared/api'
import type { PoolEventType } from '../flowConfig'
import './PersonaSnapshotSheet.scss'

interface PersonaSnapshotSheetProps {
  snapshot: PoolPersonaSnapshotResponse
  eventType: PoolEventType
  initialDimension?: string
  onClose: () => void
}

const DIMENSION_LABELS: Record<string, string> = {
  archetype: '社交氛围',
  industry: '行业背景',
  intent: '报名期待',
  age: '年龄分布',
  gender: '性别比例',
}

export default function PersonaSnapshotSheet({ snapshot, eventType, initialDimension, onClose }: PersonaSnapshotSheetProps) {
  const disclosedDimensions = snapshot.dimensions.filter((d) => d.disclosed)
  const [scrollIntoView, setScrollIntoView] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!initialDimension) return
    const exists = disclosedDimensions.some((d) => d.key === initialDimension)
    if (!exists) return
    // Defer scroll until the sheet has rendered and layout is stable.
    const timer = setTimeout(() => {
      setScrollIntoView(`persona-dim-${initialDimension}`)
    }, 100)
    return () => clearTimeout(timer)
  }, [initialDimension, disclosedDimensions])

  return (
    <View className='persona-snapshot-sheet' onClick={onClose}>
      <View className='persona-snapshot-sheet__backdrop' />
      <View
        className='persona-snapshot-sheet__surface'
        role='dialog'
        aria-modal='true'
        aria-label='当前报名的伙伴画像'
        onClick={(e) => e.stopPropagation()}
      >
        <View className='persona-snapshot-sheet__handle' />
        <View className='persona-snapshot-sheet__header'>
          <Text className='persona-snapshot-sheet__title'>当前报名的伙伴画像</Text>
          <Text className='persona-snapshot-sheet__subtitle'>
            已有 {snapshot.totalRegistrants} 位伙伴报名这场{eventType}
          </Text>
        </View>

        <ScrollView
          className='persona-snapshot-sheet__scroll'
          scrollY
          enhanced
          showScrollbar={false}
          scrollIntoView={scrollIntoView}
        >
          {disclosedDimensions.length === 0 ? (
            <View className='persona-snapshot-sheet__empty'>
              <Text className='persona-snapshot-sheet__empty-title'>画像还在聚合中</Text>
              <Text className='persona-snapshot-sheet__empty-body'>
                报名伙伴还不够多，等再多几位加入，悦仔就能拼出这一桌的轮廓。
              </Text>
            </View>
          ) : (
            disclosedDimensions.map((dimension) => (
              <View
                key={dimension.key}
                id={`persona-dim-${dimension.key}`}
                className='persona-snapshot-sheet__dimension'
              >
                <View className='persona-snapshot-sheet__dimension-header'>
                  <Text className='persona-snapshot-sheet__dimension-label'>
                    {DIMENSION_LABELS[dimension.key] || dimension.label}
                  </Text>
                  <Text className='persona-snapshot-sheet__dimension-total'>{dimension.total} 人</Text>
                </View>
                <View className='persona-snapshot-sheet__clusters' role='list'>
                  {dimension.clusters.slice(0, 4).map((cluster) => (
                    <View key={cluster.label} className='persona-snapshot-sheet__cluster' role='listitem'>
                      <Text className='persona-snapshot-sheet__cluster-label'>{cluster.label}</Text>
                      <View className='persona-snapshot-sheet__cluster-bar-wrap'>
                        <View
                          className='persona-snapshot-sheet__cluster-bar'
                          style={{ width: `${cluster.percentage}%` }}
                        />
                      </View>
                      <Text className='persona-snapshot-sheet__cluster-count'>
                        {cluster.count} · {cluster.percentage}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}

          <View className='persona-snapshot-sheet__disclaimer'>
            <Text className='persona-snapshot-sheet__disclaimer-text'>
              数据为当前报名伙伴的聚合画像，会随新伙伴加入而变化。最终组队以匹配结果为准。
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}
