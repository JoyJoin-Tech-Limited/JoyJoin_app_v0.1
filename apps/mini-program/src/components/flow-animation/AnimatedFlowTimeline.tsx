import { ScrollView, View } from '@tarojs/components'
import FlowProgressLine from './FlowProgressLine'
import FlowStep, { type FlowStepData } from './FlowStep'

// prefers-reduced-motion is resolved by BlindBoxLifecycleFlow before progress reaches this timeline.
interface AnimatedFlowTimelineProps {
  steps: readonly FlowStepData[]
  progress: number
}

export default function AnimatedFlowTimeline({
  steps,
  progress,
}: AnimatedFlowTimelineProps) {
  const lastIndex = Math.max(steps.length - 1, 1)

  return (
    <ScrollView className='flow-timeline-scroll' scrollY enhanced showScrollbar={false}>
      <View className='flow-timeline'>
        <FlowProgressLine progress={progress} className='flow-timeline__line' />
        <View className='flow-timeline__steps'>
          {steps.map((step, index) => {
          const threshold = index === 0 ? 0.02 : index / lastIndex
          const active = progress >= threshold
          const nextThreshold = (index + 1) / lastIndex
          const current = active && (index === steps.length - 1 || progress < nextThreshold)

          return (
            <FlowStep
              key={step.id}
              step={step}
              active={active}
              current={current}
            />
          )
          })}
        </View>
      </View>
    </ScrollView>
  )
}
