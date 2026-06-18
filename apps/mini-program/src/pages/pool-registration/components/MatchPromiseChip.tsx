import { View, Text } from '@tarojs/components'
import './MatchPromiseChip.scss'

interface MatchPromiseChipProps {
  reason: string
  index: number
  animate: boolean
}

export default function MatchPromiseChip({ reason, index, animate }: MatchPromiseChipProps) {
  const delayClass = index <= 5 ? `match-promise-chip--delay-${index}` : ''
  return (
    <View
      className={[
        'match-promise-chip',
        animate ? 'match-promise-chip--animate' : 'match-promise-chip--visible',
        delayClass,
      ].join(' ')}
    >
      <View className='match-promise-chip__dot' />
      <Text className='match-promise-chip__text'>{reason}</Text>
    </View>
  )
}
