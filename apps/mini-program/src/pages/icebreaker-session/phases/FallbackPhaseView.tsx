import Button from '../../../components/ui/Button'
import { type SessionPhase } from '../phaseUtils'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import WaitingBeat from '../components/WaitingBeat'
import { PHASE_ACCENTS } from './phaseAccents'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'

export function FallbackPhaseView({
  phase,
  isHost,
  onAdvance,
  onReturnToWarmup,
}: {
  phase: SessionPhase
  isHost: boolean
  onAdvance: () => void
  onReturnToWarmup?: () => void
}) {
  // Use the phase's own accent when the registry knows it; warmup purple otherwise.
  const accentPhase = (phase in PHASE_ACCENTS ? phase : 'warmup') as SocialIcebreakerPhase
  return (
    <PhaseHeroCard
      phase={accentPhase}
      title='这个环节还在筹备中'
      prompt='悦仔先带你回暖场，或者主持人可以直接推进到下一阶段'
      statusText={isHost ? undefined : '等待主持人推进当前阶段'}
      actions={
        <>
          {onReturnToWarmup ? (
            <Button variant='secondary' onClick={onReturnToWarmup}>
              返回暖场
            </Button>
          ) : null}
          {isHost ? (
            <Button variant='primary' onClick={onAdvance}>
              继续下一步
            </Button>
          ) : null}
        </>
      }
    >
      {/* Waiting whisper only for players — the host holds the advance CTA
       * and "主持人就位" copy would read backwards to them. */}
      {!isHost ? <WaitingBeat variant='host' expression='coachGuide' /> : null}
    </PhaseHeroCard>
  )
}
