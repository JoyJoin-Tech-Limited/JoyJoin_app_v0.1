import { Text, View } from '@tarojs/components'
import FlowIcon from './icons/FlowIcon'
import type { FlowAccent, FlowIconName } from './flowAnimation.types'

interface FlowNodeProps {
  label: string
  detail?: string
  icon?: FlowIconName
  accent?: FlowAccent
  active: boolean
  current?: boolean
  traveling?: boolean
  compact?: boolean
  align?: 'left' | 'right' | 'center'
}

export default function FlowNode({
  label,
  detail,
  icon,
  accent = 'brand',
  active,
  current = false,
  traveling = false,
  compact = false,
  align = 'left',
}: FlowNodeProps) {
  return (
    <View
      className={[
        'flow-node',
        active ? 'flow-node--active' : '',
        current ? 'flow-node--current' : '',
        traveling ? 'flow-node--traveling' : '',
        compact ? 'flow-node--compact' : '',
        `flow-node--${align}`,
      ].filter(Boolean).join(' ')}
    >
      <View className='flow-node__marker'>
        {icon ? (
          <View className='flow-node__icon'>
            <FlowIcon name={icon} active={active} accent={accent} size={compact ? 'sm' : 'md'} />
          </View>
        ) : <View className='flow-node__dot' />}
      </View>
      <View className='flow-node__content'>
        <Text className='flow-node__label'>{label}</Text>
        {detail ? <Text className='flow-node__detail'>{detail}</Text> : null}
      </View>
    </View>
  )
}
