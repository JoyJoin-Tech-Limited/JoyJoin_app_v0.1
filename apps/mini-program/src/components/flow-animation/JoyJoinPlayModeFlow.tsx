import { useEffect } from 'react'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import ExperienceEntryFlow from './ExperienceEntryFlow'
import { EXPERIENCE_DEFINITIONS, FLOW_ANIMATION_TIMING } from './flowAnimation.config'
import FlowShell from './FlowShell'
import { markFlowSeen } from './FlowStorage'
import { useFlowProgress } from './useFlowProgress'

interface JoyJoinPlayModeFlowProps {
  userId?: string | null
  onComplete: () => void
  initialDetailId?: 'event' | 'street'
}

export default function JoyJoinPlayModeFlow({
  userId,
  onComplete,
  initialDetailId,
}: JoyJoinPlayModeFlowProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { progress, completed } = useFlowProgress(
    FLOW_ANIMATION_TIMING.experienceRevealMs,
    shouldReduceMotion,
  )

  useEffect(() => {
    if (completed) {
      markFlowSeen('joyjoin-intro', userId)
    }
  }, [completed, userId])

  const handleSkip = () => {
    markFlowSeen('joyjoin-intro', userId)
    onComplete()
  }

  const handleAction = () => {
    markFlowSeen('joyjoin-intro', userId)
    onComplete()
  }

  return (
    <FlowShell
      title='玩法介绍'
      showGameBackground
      onSkip={handleSkip}
      actionLabel='开始探索'
      actionVisible={progress >= 0.62}
      onAction={handleAction}
    >
      <ExperienceEntryFlow
        entries={EXPERIENCE_DEFINITIONS}
        revealProgress={progress}
        initialDetailId={initialDetailId}
      />
    </FlowShell>
  )
}
