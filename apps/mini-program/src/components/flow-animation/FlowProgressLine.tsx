import { View } from '@tarojs/components'

interface FlowProgressLineProps {
  progress: number
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress))
}

export default function FlowProgressLine({
  progress,
  orientation = 'vertical',
  className = '',
}: FlowProgressLineProps) {
  const normalizedProgress = clampProgress(progress)

  return (
    <View className={`flow-progress-line flow-progress-line--${orientation} ${className}`}>
      <View className='flow-progress-line__track' />
      <View
        className='flow-progress-line__active'
        style={{
          transform: orientation === 'vertical'
            ? `scaleY(${normalizedProgress})`
            : `scaleX(${normalizedProgress})`,
        }}
      />
    </View>
  )
}
