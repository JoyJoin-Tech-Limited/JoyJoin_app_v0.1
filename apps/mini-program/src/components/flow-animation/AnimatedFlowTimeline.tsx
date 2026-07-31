import { ScrollView, View } from '@tarojs/components'
import FlowProgressLine from './FlowProgressLine'
import FlowStep, { type FlowStepData } from './FlowStep'

interface AnimatedFlowTimelineProps {
  steps: readonly FlowStepData[]
  /** Global progress for the progress bar (0–1). */
  progress: number
  /** Current landed stage index for traveling current-state indicator. */
  stageIndex: number
  /** Progress within the current stage (0–1). */
  stageProgress: number
  /** One-time ghost-pulse teacher has already been shown. */
  hasShownTeacher?: boolean
  /** Called when the user taps the timeline to advance one stage. */
  onTapAhead?: () => void
}

export default function AnimatedFlowTimeline({
  steps,
  progress,
  stageIndex,
  stageProgress,
  hasShownTeacher = false,
  onTapAhead,
}: AnimatedFlowTimelineProps) {
  return (
    <ScrollView className='flow-timeline-scroll' scrollY enhanced showScrollbar={false}>
      <View
        className={`flow-timeline ${!hasShownTeacher ? 'flow-timeline--teacher-pulse' : ''}`}
        onClick={onTapAhead}
        role='button'
        ariaLabel='点击提前推进流程'
      >
        <FlowProgressLine progress={progress} className='flow-timeline__line' />
        <View className='flow-timeline__steps'>
          {steps.map((step, index) => {
            const active = index <= stageIndex
            const current = index === stageIndex
            const traveling = current && stageProgress < 1

            return (
              <FlowStep
                key={step.id}
                step={step}
                active={active}
                current={current}
                traveling={traveling}
              />
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}
