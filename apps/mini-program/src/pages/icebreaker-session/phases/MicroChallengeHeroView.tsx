import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { TapRhythm } from '../../../components/gesture'
import { ParticleBurst } from '../../../components/reveal'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { haptics } from '../../../lib/utils/haptics'
import { PHASE_ACCENTS } from './phaseAccents'
import './MicroChallengeHeroView.scss'

const TAP_TARGET = 5

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Memoized live countdown — ticks without re-rendering the parent card. */
function useLiveCountdown(deadlineMs: number | null): { text?: string; urgent: boolean; expired: boolean } {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadlineMs === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadlineMs])
  return useMemo(() => {
    if (deadlineMs === null) return { urgent: false, expired: false }
    const remaining = deadlineMs - now
    return {
      // Numerals only — the mono countdown element carries no CJK glyphs.
      text: remaining <= 0 ? undefined : formatRemaining(remaining),
      urgent: remaining > 0 && remaining <= 30_000,
      expired: remaining <= 0,
    }
  }, [deadlineMs, now])
}

export interface MicroChallengeHeroViewProps {
  challenge: { title: string; description: string; durationSeconds: number; completionCTA: string; visualHint?: string } | null
  challengeMeta?: AIResponseMeta
  completedBy: string[]
  currentUserId: string
  playerCount: number
  /** Phase start timestamp (ms) — drives the live countdown. */
  phaseStartedAt?: number
  onComplete: () => void
  isCompleting: boolean
  isHost?: boolean
  onAdvance?: () => void
  isAdvancing?: boolean
  canAdvance?: boolean
  advanceDisabledReason?: string
}

export function MicroChallengeHeroView({
  challenge,
  challengeMeta,
  completedBy,
  currentUserId,
  playerCount,
  phaseStartedAt,
  onComplete,
  isCompleting,
  isHost,
  onAdvance,
  isAdvancing,
  canAdvance,
  advanceDisabledReason,
}: MicroChallengeHeroViewProps) {
  const [optimisticCompletedBy, setOptimisticCompletedBy] = useState<string[]>(completedBy)
  const [localTapCount, setLocalTapCount] = useState(0)
  const [showBurst, setShowBurst] = useState(false)
  const [burstKey, setBurstKey] = useState(0)

  useEffect(() => {
    setOptimisticCompletedBy(completedBy)
  }, [completedBy])

  useEffect(() => {
    setLocalTapCount(0)
    setShowBurst(false)
  }, [challenge?.title])

  const hasCompleted = optimisticCompletedBy.includes(currentUserId)
  const aigcEnabled = useAIGCLabelsEnabled()
  const challengeAigcMeta = challengeMeta?.aigc ?? { aiGenerated: true, labelType: 'ai-generated' as const }

  const deadlineMs =
    challenge?.durationSeconds && phaseStartedAt
      ? phaseStartedAt + challenge.durationSeconds * 1000
      : null
  const countdown = useLiveCountdown(deadlineMs)

  const handleTap = useCallback(() => {
    if (hasCompleted || isCompleting) return
    haptics('light')
    const nextTap = localTapCount + 1
    if (nextTap >= TAP_TARGET) {
      setOptimisticCompletedBy((prev) =>
        prev.includes(currentUserId) ? prev : [...prev, currentUserId],
      )
      setShowBurst(true)
      setBurstKey((k) => k + 1)
      setLocalTapCount(0)
      onComplete()
    } else {
      setLocalTapCount(nextTap)
    }
  }, [hasCompleted, isCompleting, localTapCount, currentUserId, onComplete])

  if (!challenge) {
    return (
      <View className='micro-challenge-hero'>
        <PhaseHeroCard phase='micro_challenge' title='挑战准备中…' />
      </View>
    )
  }

  const statusText = countdown.expired
    ? '时间到'
    : hasCompleted
      ? '你已完成，等待其他玩家'
      : isCompleting
        ? '提交中…'
        : '点按节奏球，和大家一起完成'

  return (
    <View className='micro-challenge-hero'>
      <PhaseHeroCard
        phase='micro_challenge'
        title={challenge.title}
        prompt={challenge.visualHint ? `${challenge.description}\n提示：${challenge.visualHint}` : challenge.description}
        statusText={statusText}
        doneCount={optimisticCompletedBy.length}
        totalCount={playerCount}
        countdownText={countdown.text}
        countdownUrgent={countdown.urgent}
        actions={
          <>
            {!hasCompleted ? (
              <TapRhythm
                onTap={handleTap}
                tapCount={localTapCount}
                targetCount={TAP_TARGET}
                emoji='🎯'
              />
            ) : (
              <View className='phase-hero-card__complete-badge micro-challenge-hero__complete'>
                <Text className='micro-challenge-hero__complete-text'>已完成 ✓</Text>
              </View>
            )}
            {isHost && onAdvance ? (
              <>
                <Button
                  variant={hasCompleted ? 'primary' : 'secondary'}
                  onClick={onAdvance}
                  disabled={isAdvancing || canAdvance === false}
                  loading={isAdvancing}
                >
                  {isAdvancing ? '推进中…' : '进入下一阶段 ›'}
                </Button>
                {canAdvance === false && advanceDisabledReason ? (
                  <Text className='phase-hero-card__ghost-link'>{advanceDisabledReason}</Text>
                ) : null}
              </>
            ) : null}
          </>
        }
      >
        {aigcEnabled ? (
          <View className='micro-challenge-hero__aigc-row'>
            <AIGCLabel meta={challengeAigcMeta} />
            <AIContentReportButton options={{ reason: 'AI 生成微挑战' }} label='反馈这段内容' />
          </View>
        ) : null}
      </PhaseHeroCard>

      {/* Signature wow (kept): tap-rhythm completion burst */}
      {showBurst && (
        <View className='micro-challenge-hero__burst'>
          <ParticleBurst key={burstKey} trigger={showBurst} type='confetti' count={40} spotlightColor={PHASE_ACCENTS.micro_challenge?.accent} />
        </View>
      )}
    </View>
  )
}
