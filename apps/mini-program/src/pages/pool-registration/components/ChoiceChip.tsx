import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { FlowOption } from '../flowConfig'

interface ChoiceChipProps {
  option: FlowOption
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

export default function ChoiceChip({ option, selected, onClick, disabled = false }: ChoiceChipProps) {
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
        'pool-reg__chip',
        selected ? 'pool-reg__chip--active' : '',
        disabled ? 'pool-reg__chip--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      hoverClass={disabled ? '' : 'pool-reg__chip--hover'}
      onClick={handleTap}
      role='checkbox'
      aria-label={`${option.label}${disabled ? '（不可选）' : ''}`}
      aria-checked={selected}
      aria-disabled={disabled}
    >
      {option.emoji ? <JoyJoinIcon emoji={option.emoji} tier='intent' size={28} className='pool-reg__chip-icon' /> : null}
      <Text className='pool-reg__chip-label'>{option.label}</Text>
    </View>
  )
}
