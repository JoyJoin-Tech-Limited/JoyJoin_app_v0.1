import { View, Text } from '@tarojs/components'

interface StepPillProps {
  index: number
  label: string
  active: boolean
  complete: boolean
}

export default function StepPill({ index, label, active, complete }: StepPillProps) {
  return (
    <View
      className={[
        'pool-reg__step-pill',
        active ? 'pool-reg__step-pill--active' : '',
        complete ? 'pool-reg__step-pill--complete' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className='pool-reg__step-index'>{index}</Text>
      <Text className='pool-reg__step-text'>{label}</Text>
    </View>
  )
}
