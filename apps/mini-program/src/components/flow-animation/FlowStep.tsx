import { View } from '@tarojs/components'
import FlowNode from './FlowNode'
import type { FlowAccent, FlowIconName } from './flowAnimation.types'

export interface FlowStepData {
  id: string
  title: string
  description: string
  icon?: FlowIconName
  accent?: FlowAccent
}

interface FlowStepProps {
  step: FlowStepData
  active: boolean
  current?: boolean
  compact?: boolean
  align?: 'left' | 'right' | 'center'
}

export default function FlowStep({
  step,
  active,
  current = false,
  compact = false,
  align = 'left',
}: FlowStepProps) {
  return (
    <View className='flow-step'>
      <FlowNode
        label={step.title}
        detail={step.description}
        icon={step.icon}
        accent={step.accent}
        active={active}
        current={current}
        compact={compact}
        align={align}
      />
    </View>
  )
}
