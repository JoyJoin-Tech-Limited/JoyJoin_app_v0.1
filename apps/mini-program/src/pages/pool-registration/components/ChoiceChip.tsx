import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { FlowOption } from '../flowConfig'

interface ChoiceChipProps {
  option: FlowOption
  selected: boolean
  onClick: () => void
}

export default function ChoiceChip({ option, selected, onClick }: ChoiceChipProps) {
  const handleTap = useCallback(() => {
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      // decorative
    }
    onClick()
  }, [onClick])

  return (
    <View
      className={['pool-reg__chip', selected ? 'pool-reg__chip--active' : '']
        .filter(Boolean)
        .join(' ')}
      hoverClass='pool-reg__chip--hover'
      onClick={handleTap}
      role='checkbox'
      aria-label={option.label}
      aria-checked={selected}
    >
      {option.emoji ? <JoyJoinIcon emoji={option.emoji} tier='intent' size={28} className='pool-reg__chip-icon' /> : null}
      <Text className='pool-reg__chip-label'>{option.label}</Text>
    </View>
  )
}
