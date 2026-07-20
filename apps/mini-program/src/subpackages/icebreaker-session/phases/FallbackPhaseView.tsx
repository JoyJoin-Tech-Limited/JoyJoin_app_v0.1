import { Image } from '@tarojs/components'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import Button from '../../../components/ui/Button'
import { type SessionPhase } from '../phaseUtils'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
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
      <Image
        src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
        mode='aspectFit'
        style={{ width: '160rpx', height: '160rpx', alignSelf: 'center' }}
      />
    </PhaseHeroCard>
  )
}
