/**
 * ChemistryMiniGrid — Post-registration archetype chemistry preview
 *
 * Shows the top archetypes in a pool and their chemistry score
 * with the user's archetype. Color-coded by compatibility.
 */

import './ChemistryMiniGrid.scss'
import { View, Text } from '@tarojs/components'
import { getArchetypeCompatibility } from '@shared/personality/archetypeCompatibility'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily } from '@shared/archetypeColors'
import type { EventPoolSummary } from '@shared/api'

interface ChemistryMiniGridProps {
  pool: EventPoolSummary
  userArchetype: string | null
}

function getChemistryLabel(score: number): string {
  if (score >= 85) return '高默契'
  if (score >= 70) return '默契'
  if (score >= 50) return '普通'
  return '需谨慎'
}

function getChemistryColorClass(score: number): string {
  if (score >= 85) return 'chemistry-mini-grid__score--high'
  if (score >= 70) return 'chemistry-mini-grid__score--good'
  if (score >= 50) return 'chemistry-mini-grid__score--neutral'
  return 'chemistry-mini-grid__score--low'
}

function getChemistryBarWidth(score: number): string {
  return `${Math.max(10, Math.min(100, score))}%`
}

export default function ChemistryMiniGrid({ pool, userArchetype }: ChemistryMiniGridProps) {
  const topArchetypes = pool.topArchetypes ?? []

  if (!userArchetype || topArchetypes.length === 0) {
    return (
      <View className='chemistry-mini-grid chemistry-mini-grid--empty'>
        <Text className='chemistry-mini-grid__title'>人群默契分析</Text>
        <Text className='chemistry-mini-grid__empty-text'>报名后解锁完整人群分析</Text>
      </View>
    )
  }

  const rows = topArchetypes.map(({ archetype, count }) => {
    const score = getArchetypeCompatibility(userArchetype, archetype)
    const definition = ARCHETYPE_BY_ID[archetype]
    const family = getArchetypeFamily(archetype)
    return {
      archetype,
      name: definition?.nameCn ?? archetype,
      count,
      score,
      family,
    }
  })

  // Sort by chemistry score descending
  rows.sort((a, b) => b.score - a.score)

  const userDefinition = ARCHETYPE_BY_ID[userArchetype]
  const userFamily = getArchetypeFamily(userArchetype)

  return (
    <View className='chemistry-mini-grid'>
      <View className='chemistry-mini-grid__header'>
        <Text className='chemistry-mini-grid__title'>人群默契分析</Text>
        <View className={`chemistry-mini-grid__user-badge chemistry-mini-grid__user-badge--${userFamily}`}>
          <Text className='chemistry-mini-grid__user-badge-text'>
            你是 {userDefinition?.nameCn ?? userArchetype}
          </Text>
        </View>
      </View>

      <View className='chemistry-mini-grid__list'>
        {rows.map((row) => (
          <View key={row.archetype} className='chemistry-mini-grid__row'>
            <View className='chemistry-mini-grid__row-info'>
              <Text className='chemistry-mini-grid__name'>{row.name}</Text>
              <Text className='chemistry-mini-grid__count'>{row.count}人</Text>
            </View>
            <View className='chemistry-mini-grid__row-bar'>
              <View
                className={[
                  'chemistry-mini-grid__bar',
                  `chemistry-mini-grid__bar--${row.family}`,
                ].join(' ')}
                style={{ width: getChemistryBarWidth(row.score) }}
              />
            </View>
            <View className='chemistry-mini-grid__row-score'>
              <Text className={['chemistry-mini-grid__score', getChemistryColorClass(row.score)].join(' ')}>
                {getChemistryLabel(row.score)}
              </Text>
              <Text className='chemistry-mini-grid__score-num'>{row.score}</Text>
            </View>
          </View>
        ))}
      </View>

      {pool.highChemistryCount != null && pool.highChemistryCount > 0 && (
        <Text className='chemistry-mini-grid__footer'>
          这局有 {pool.highChemistryCount} 位高默契对象
        </Text>
      )}
    </View>
  )
}
