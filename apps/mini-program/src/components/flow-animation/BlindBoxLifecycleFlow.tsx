import { useEffect, useRef } from 'react'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import AnimatedFlowTimeline from './AnimatedFlowTimeline'
import { FLOW_ANIMATION_TIMING, LIFECYCLE_STEPS } from './flowAnimation.config'
import FlowShell from './FlowShell'
import { markFlowSeen } from './FlowStorage'
import { useFlowProgress } from './useFlowProgress'

interface BlindBoxLifecycleFlowProps {
  userId?: string | null
  onSkip: () => void
  onViewActivity: () => void
}

export default function BlindBoxLifecycleFlow({
  userId,
  onSkip,
  onViewActivity,
}: BlindBoxLifecycleFlowProps) {
  const completedCallbackRef = useRef(false)
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { progress, completed } = useFlowProgress(
    FLOW_ANIMATION_TIMING.lifecycleMs,
    shouldReduceMotion,
  )

  useEffect(() => {
    if (completed && !completedCallbackRef.current) {
      completedCallbackRef.current = true
      markFlowSeen('blind-box-lifecycle', userId)
    }
  }, [completed, userId])

  const handleSkip = () => {
    markFlowSeen('blind-box-lifecycle', userId)
    onSkip()
  }

  const handleAction = () => {
    markFlowSeen('blind-box-lifecycle', userId)
    onViewActivity()
  }

  return (
    <FlowShell
      title='这次出发，正在一步步发生'
      onSkip={handleSkip}
      actionLabel='查看我的活动'
      actionVisible={completed}
      onAction={handleAction}
    >
      <AnimatedFlowTimeline steps={LIFECYCLE_STEPS} progress={progress} />
    </FlowShell>
  )
}
