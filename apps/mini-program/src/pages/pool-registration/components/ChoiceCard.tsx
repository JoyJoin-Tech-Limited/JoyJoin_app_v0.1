import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { FlowOption } from '../flowConfig'

interface ChoiceCardProps {
  option: FlowOption
  selected: boolean
  onClick: () => void
  compact?: boolean
  disabled?: boolean
}

export default function ChoiceCard({ option, selected, onClick, compact = false, disabled = false }: ChoiceCardProps) {
  const handleTap = useCallback(() => {
    if (disabled) return
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      // decorative
    }
    onClick()
  }, [disabled, onClick])

  return (
    <View
      className={[
        'pool-reg__choice-card',
        compact ? 'pool-reg__choice-card--compact' : '',
        selected ? 'pool-reg__choice-card--selected' : '',
        disabled ? 'pool-reg__choice-card--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      hoverClass={disabled ? '' : 'pool-reg__choice-card--hover'}
      onClick={handleTap}
      role='radio'
      aria-label={`${option.label}${option.description ? '：' + option.description : ''}${disabled ? '（不可选）' : ''}`}
      aria-checked={selected}
      aria-disabled={disabled}
    >
      <View className='pool-reg__choice-label-row'>
        {option.emoji ? (
          <JoyJoinIcon
            emoji={option.emoji}
            tier='intent'
            size={compact ? 36 : 40}
            className='pool-reg__choice-icon'
          />
        ) : null}
        <Text className='pool-reg__choice-title'>{option.label}</Text>
      </View>
      {option.description ? <Text className='pool-reg__choice-desc'>{option.description}</Text> : null}
      {selected ? (
        <View className='pool-reg__choice-check'>
          <View className='pool-reg__choice-check-mark' />
        </View>
      ) : null}
    </View>
  )
}
