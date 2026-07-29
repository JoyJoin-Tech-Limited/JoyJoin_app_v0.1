import { useEffect, useMemo, useRef } from 'react'
import { Text, View } from '@tarojs/components'
import {
  FLOW_SHELL_COPY,
  getFlow2HeroMeta,
  getFlow2HeroStatus,
  type FlowLifecycleFacts,
} from '@shared/copy/flowAnimationCopy'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { flowAnalytics } from '../../lib/analytics/flowAnalytics'
import { haptics } from '../../lib/utils/haptics'
import AnimatedFlowTimeline from './AnimatedFlowTimeline'
import { buildLifecycleSteps, FLOW_ANIMATION_TIMING } from './flowAnimation.config'
import FlowShell from './FlowShell'
import { markFlowSeen } from './FlowStorage'
import { useFlowProgress } from './useFlowProgress'

interface BlindBoxLifecycleFlowProps {
  userId?: string | null
  /** Real facts from the just-registered pool (client-side only, never fetched). */
  facts?: FlowLifecycleFacts | null
  onSkip: () => void
  onViewActivity: () => void
}

export default function BlindBoxLifecycleFlow({
  userId,
  facts,
  onSkip,
  onViewActivity,
}: BlindBoxLifecycleFlowProps) {
  const completedCallbackRef = useRef(false)
  const mountedAtRef = useRef(Date.now())
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { progress, completed } = useFlowProgress(
    FLOW_ANIMATION_TIMING.lifecycleMs,
    shouldReduceMotion,
  )
  const steps = useMemo(() => buildLifecycleSteps(facts), [facts])
  const heroStatus = useMemo(() => getFlow2HeroStatus(facts), [facts])
  const heroMeta = useMemo(() => getFlow2HeroMeta(facts), [facts])

  useEffect(() => {
    flowAnalytics.trackView('lifecycle')
  }, [])

  useEffect(() => {
    if (completed && !completedCallbackRef.current) {
      completedCallbackRef.current = true
      flowAnalytics.trackComplete('lifecycle', Date.now() - mountedAtRef.current, false, steps.length)
      markFlowSeen('blind-box-lifecycle', userId)
    }
  }, [completed, userId, steps.length])

  const handleSkip = () => {
    haptics('light')
    flowAnalytics.trackSkip('lifecycle', Date.now() - mountedAtRef.current)
    markFlowSeen('blind-box-lifecycle', userId)
    onSkip()
  }

  const handleAction = () => {
    haptics('medium')
    flowAnalytics.trackCtaTap('lifecycle')
    markFlowSeen('blind-box-lifecycle', userId)
    onViewActivity()
  }

  return (
    <FlowShell
      title={FLOW_SHELL_COPY.flow2Title}
      onSkip={handleSkip}
      actionLabel={FLOW_SHELL_COPY.ctaViewActivity}
      actionVisible={completed}
      onAction={handleAction}
    >
      <View className='flow-lifecycle'>
        <View className='flow-lifecycle-hero'>
          <Text className='flow-lifecycle-hero__status'>{heroStatus}</Text>
          <Text className='flow-lifecycle-hero__meta'>{heroMeta}</Text>
        </View>
        <AnimatedFlowTimeline steps={steps} progress={progress} />
      </View>
    </FlowShell>
  )
}
