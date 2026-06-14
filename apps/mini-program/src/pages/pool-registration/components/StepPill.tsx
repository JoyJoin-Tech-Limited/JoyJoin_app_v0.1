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
      aria-label={`步骤 ${index}${complete ? ' 已完成' : active ? ' 进行中' : ''}: ${label}`}
      role='listitem'
    >
      <View className='pool-reg__step-index' aria-hidden='true'>
        {complete ? <Text className='pool-reg__step-check'>✓</Text> : index}
      </View>
      <Text className='pool-reg__step-text'>{label}</Text>
    </View>
  )
}
