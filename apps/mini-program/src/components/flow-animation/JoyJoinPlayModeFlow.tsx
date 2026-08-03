import { useCallback, useEffect, useRef, useState } from 'react'
import { FLOW_SHELL_COPY } from '@shared/copy/flowAnimationCopy'
import './index.scss'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { flowAnalytics } from '../../lib/analytics/flowAnalytics'
import { haptics } from '../../lib/utils/haptics'
import ExperienceDetail from './ExperienceDetail'
import ExperienceEntryFlow from './ExperienceEntryFlow'
import { EXPERIENCE_DEFINITIONS, FLOW_ANIMATION_TIMING } from './flowAnimation.config'
import type { ExperienceDefinition } from './flowAnimation.types'
import FlowShell, { resolveFlowArchetypeBackgrounds } from './FlowShell'
import { markFlowSeen } from './FlowStorage'
import { useFlowProgress } from './useFlowProgress'

interface JoyJoinPlayModeFlowProps {
  userId?: string | null
  archetypeId?: string | null
  alangEnabled?: boolean
  onComplete: () => void | Promise<void>
  initialDetailId?: 'event' | 'street'
}

export default function JoyJoinPlayModeFlow({
  userId,
  archetypeId,
  alangEnabled = false,
  onComplete,
  initialDetailId,
}: JoyJoinPlayModeFlowProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [entranceDone, setEntranceDone] = useState(shouldReduceMotion)
  const { progress } = useFlowProgress(
    FLOW_ANIMATION_TIMING.experienceRevealMs,
    shouldReduceMotion,
    entranceDone,
  )
  const [detailId, setDetailId] = useState<ExperienceDefinition['id'] | null>(initialDetailId ?? null)
  const mountedAtRef = useRef(Date.now())
  const detailOpenedAtRef = useRef<number | null>(null)
  const detail = EXPERIENCE_DEFINITIONS.find((entry) => entry.id === detailId) ?? null
  const handleEntranceResolve = useCallback(() => setEntranceDone(true), [])

  useEffect(() => {
    flowAnalytics.trackView('intro')
  }, [])

  const handleSkip = async () => {
    haptics('light')
    flowAnalytics.trackSkip('intro', Date.now() - mountedAtRef.current)
    await onComplete()
    markFlowSeen('joyjoin-intro', userId)
  }

  const handleAction = async () => {
    haptics('medium')
    flowAnalytics.trackCtaTap('intro')
    await onComplete()
    markFlowSeen('joyjoin-intro', userId)
  }

  const handleOpenDetail = (id: 'event' | 'street') => {
    detailOpenedAtRef.current = Date.now()
    setDetailId(id)
  }

  const handleCloseDetail = () => {
    if (detail) {
      haptics('light')
      const openedAt = detailOpenedAtRef.current
      flowAnalytics.trackDetailBack(detail.id, openedAt ? Date.now() - openedAt : 0)
    }
    detailOpenedAtRef.current = null
    setDetailId(null)
  }

  return (
    <>
      <FlowShell
        title={FLOW_SHELL_COPY.flow1Title}
        showGameBackground
        archetypeId={archetypeId}
        onSkip={handleSkip}
        actionLabel={FLOW_SHELL_COPY.ctaExplore}
        actionVisible={progress >= 0.62}
        onAction={handleAction}
        onEntranceResolve={handleEntranceResolve}
      >
        <ExperienceEntryFlow
          entries={EXPERIENCE_DEFINITIONS}
          revealProgress={progress}
          backgroundSources={resolveFlowArchetypeBackgrounds(archetypeId)}
          alangEnabled={alangEnabled}
          onOpenDetail={handleOpenDetail}
        />
      </FlowShell>
      {detail ? <ExperienceDetail experience={detail} archetypeId={archetypeId} onBack={handleCloseDetail} /> : null}
    </>
  )
}
