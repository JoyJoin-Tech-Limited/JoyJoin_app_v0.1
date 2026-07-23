import { Text, View } from '@tarojs/components'

interface FlowNodeProps {
  label: string
  detail?: string
  active?: boolean
  accent?: 'purple' | 'coral' | 'blue' | 'green'
  compact?: boolean
}

export default function FlowNode({
  label,
  detail,
  active = true,
  accent = 'purple',
  compact = false,
}: FlowNodeProps) {
  return (
    <View
      className={[
        'flow-node',
        `flow-node--${accent}`,
        active ? 'flow-node--active' : '',
        compact ? 'flow-node--compact' : '',
      ].filter(Boolean).join(' ')}
    >
      <View className='flow-node__light' />
      <Text className='flow-node__label'>{label}</Text>
      {detail ? <Text className='flow-node__detail'>{detail}</Text> : null}
    </View>
  )
}
