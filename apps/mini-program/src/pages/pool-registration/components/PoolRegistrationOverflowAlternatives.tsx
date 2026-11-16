import { View, Text } from '@tarojs/components'
import type { PoolOverflowAlternative } from '@shared/api/eventPools'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatAlternativeDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${WEEKDAYS[parsed.getDay()]}`
}

interface PoolRegistrationOverflowAlternativesProps {
  alternatives: PoolOverflowAlternative[]
  onSelect: (alternative: PoolOverflowAlternative) => void
}

/**
 * D4 (2026-11-11): a full pool is a redirect, not a dead end.
 *
 * The list only ever states facts we hold (same city, usually same district,
 * within seven days, real remaining 名额). It never implies urgency, never
 * re-orders the seats, and never moves the user by itself — tapping a row is
 * the only way anything changes.
 */
export default function PoolRegistrationOverflowAlternatives({
  alternatives,
  onSelect,
}: PoolRegistrationOverflowAlternativesProps) {
  if (alternatives.length === 0) return null

  return (
    <View className='pool-reg__overflow' role='group' aria-label='同区还有位置的场次'>
      <Text className='pool-reg__overflow-title'>这场满了，隔壁还有位置</Text>
      {alternatives.map((alternative) => {
        const when = formatAlternativeDateTime(alternative.dateTime)
        const place = [alternative.district, alternative.city].filter(Boolean).join(' · ')
        const meta = [when, place, `剩 ${alternative.spotsLeft} 个名额`]
          .filter(Boolean)
          .join(' · ')

        return (
          <View
            key={alternative.poolId}
            className='pool-reg__overflow-row'
            hoverClass='pool-reg__overflow-row--pressed'
            role='button'
            aria-label={`${alternative.title}，${meta}`}
            onClick={() => onSelect(alternative)}
          >
            <View className='pool-reg__overflow-row-body'>
              <Text className='pool-reg__overflow-row-title'>{alternative.title}</Text>
              <Text className='pool-reg__overflow-row-meta'>{meta}</Text>
            </View>
            <Text className='pool-reg__overflow-row-cue' aria-hidden='true'>
              ›
            </Text>
          </View>
        )
      })}
    </View>
  )
}
