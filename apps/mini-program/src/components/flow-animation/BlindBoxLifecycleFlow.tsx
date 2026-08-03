import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useFlowTimeline } from './useFlowTimeline'

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
  const hapticFiredRef = useRef(false)
  const tappedAheadRef = useRef(false)
  const mountedAtRef = useRef(Date.now())
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [hasTappedAhead, setHasTappedAhead] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)
  const steps = useMemo(() => buildLifecycleSteps(facts), [facts])
  const heroStatus = useMemo(() => getFlow2HeroStatus(facts), [facts])
  const heroMeta = useMemo(() => getFlow2HeroMeta(facts), [facts])

  const handleStageLand = useCallback((index: number) => {
    if (index > 0) {
      haptics('light')
    }
  }, [])

  const handleComplete = useCallback(() => {
    if (completedCallbackRef.current) return
    completedCallbackRef.current = true
    const elapsed = Date.now() - mountedAtRef.current
    flowAnalytics.trackComplete('lifecycle', elapsed, tappedAheadRef.current, steps.length)
    markFlowSeen('blind-box-lifecycle', userId)
  }, [steps.length, userId])

  const { stageIndex, stageProgress, globalProgress, completed, advance } = useFlowTimeline({
    stageDurationsMs: FLOW_ANIMATION_TIMING.lifecycleStageDurationsMs,
    shouldReduceMotion,
    onStageLand: handleStageLand,
    onComplete: handleComplete,
  })

  useEffect(() => {
    flowAnalytics.trackView('lifecycle')
  }, [])

  useEffect(() => {
    if (!completed || hapticFiredRef.current) return
    const timer = setTimeout(() => {
      hapticFiredRef.current = true
      haptics('success')
    }, FLOW_ANIMATION_TIMING.completionHapticMs)
    return () => clearTimeout(timer)
  }, [completed])

  useEffect(() => {
    if (!completed) return
    const delay = shouldReduceMotion ? 150 : FLOW_ANIMATION_TIMING.ctaCrossfadeStartMs
    const timer = setTimeout(() => {
      setCtaVisible(true)
    }, delay)
    return () => clearTimeout(timer)
  }, [completed, shouldReduceMotion])

  const handleSkip = () => {
    haptics('light')
    if (!completedCallbackRef.current) {
      flowAnalytics.trackSkip('lifecycle', Date.now() - mountedAtRef.current)
    }
    markFlowSeen('blind-box-lifecycle', userId)
    onSkip()
  }

  const handleAction = () => {
    haptics('medium')
    flowAnalytics.trackCtaTap('lifecycle')
    markFlowSeen('blind-box-lifecycle', userId)
    onViewActivity()
  }

  const handleTapAhead = () => {
    if (completed) return
    haptics('light')
    if (!tappedAheadRef.current) {
      tappedAheadRef.current = true
      setHasTappedAhead(true)
      flowAnalytics.trackTapAhead('lifecycle')
    }
    advance()
  }

  return (
    <FlowShell
      title={FLOW_SHELL_COPY.flow2Title}
      onSkip={handleSkip}
      actionLabel={FLOW_SHELL_COPY.ctaViewActivity}
      actionVisible={ctaVisible}
      onAction={handleAction}
    >
      <View className='flow-lifecycle'>
        {completed && !shouldReduceMotion ? (
          <View className='flow-lifecycle__glow' aria-hidden='true'>
            <View className='flow-lifecycle__glow-sweep' />
          </View>
        ) : null}
        <View className='flow-lifecycle-hero'>
          <Text className='flow-lifecycle-hero__status'>{heroStatus}</Text>
          <Text className='flow-lifecycle-hero__meta'>{heroMeta}</Text>
        </View>
        <AnimatedFlowTimeline
          steps={steps}
          progress={globalProgress}
          stageIndex={stageIndex}
          stageProgress={stageProgress}
          hasShownTeacher={hasTappedAhead}
          onTapAhead={handleTapAhead}
        />
      </View>
    </FlowShell>
  )
}
