import { memo } from 'react'
import { View } from '@tarojs/components'
import IntentCard from '../../../components/intent/IntentCard'
import { INTENT_FLOW_OPTIONS } from '../flowConfig'
import { INTENT_FLEXIBLE_OPTION } from '@shared/constants'

interface PoolRegistrationIntentGridProps {
  selected: string[]
  onToggle: (value: string) => void
}

function PoolRegistrationIntentGrid({ selected, onToggle }: PoolRegistrationIntentGridProps) {
  const isFlexibleActive = selected.includes(INTENT_FLEXIBLE_OPTION.value)

  return (
    <View className='pool-reg__choice-grid'>
      {INTENT_FLOW_OPTIONS.map((option) => {
        const isExplicitlySelected = selected.includes(option.value)
        const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
        const isDimmed = isFlexibleActive && !isFlexibleOption && !isExplicitlySelected

        return (
          <IntentCard
            key={option.value}
            option={{
              value: option.value,
              label: option.label,
              emoji: option.emoji,
              subtitle: option.description,
            }}
            selected={isExplicitlySelected}
            dimmed={isDimmed}
            onClick={() => onToggle(option.value)}
            iconSize={144}
            testId={`pool-reg-intent-${option.value}`}
          />
        )
      })}
    </View>
  )
}

export default memo(PoolRegistrationIntentGrid)
