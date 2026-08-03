import { memo } from 'react'
import { View } from '@tarojs/components'
import IntentCard from '../../../components/intent/IntentCard'
import { INTENT_FLOW_OPTIONS } from '../flowConfig'
import { INTENT_FLEXIBLE_OPTION } from '@shared/constants'

export const MAX_INTENTS = 3

interface PoolRegistrationIntentGridProps {
  selected: string[]
  onToggle: (value: string) => void
}

function PoolRegistrationIntentGrid({ selected, onToggle }: PoolRegistrationIntentGridProps) {
  const isFlexibleActive = selected.includes(INTENT_FLEXIBLE_OPTION.value)
  const explicitCount = selected.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value).length
  const isCapReached = explicitCount >= MAX_INTENTS

  return (
    <View className='pool-reg__choice-grid'>
      {INTENT_FLOW_OPTIONS.map((option) => {
        const isExplicitlySelected = selected.includes(option.value)
        const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
        const isDimmed = isFlexibleActive && !isFlexibleOption && !isExplicitlySelected
        const isDisabled = isCapReached && !isExplicitlySelected && !isFlexibleOption

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
            disabled={isDisabled}
            onClick={() => onToggle(option.value)}
            iconSize={48}
            testId={`pool-reg-intent-${option.value}`}
          />
        )
      })}
    </View>
  )
}

export default memo(PoolRegistrationIntentGrid)
