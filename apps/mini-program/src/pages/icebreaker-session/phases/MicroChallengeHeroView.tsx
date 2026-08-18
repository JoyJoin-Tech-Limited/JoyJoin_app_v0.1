import { useEffect, useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { TapRhythm } from '../../../components/gesture'
import { ParticleBurst } from '../../../components/reveal'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { haptics } from '../../../lib/utils/haptics'
import { stripEmojis } from '../../../lib/utils/emojiGuard'
import { PHASE_ACCENTS } from './phaseAccents'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import {
  GLANCE_L2_FRAMING_MICRO_CHALLENGE,
  GLANCE_L2_HINT_MICRO_CHALLENGE,
} from '../viewModels/glanceStackModel'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

const TAP_TARGET = 5

export interface MicroChallengeHeroViewProps {
  challenge: { title: string; description: string; durationSeconds: number; completionCTA: string; visualHint?: string } | null
  challengeMeta?: AIResponseMeta
  completedBy: string[]
  currentUserId: string
  playerCount: number
  onComplete: () => void
  isCompleting: boolean
  isHost?: boolean
  onAdvance?: () => void
  isAdvancing?: boolean
  canAdvance?: boolean
  advanceDisabledReason?: string
  /** S3 glance-stack pilot (flag-gated): L1 emblem + L2 script + L3 peek. */
  glanceStackEnabled?: boolean
}

export function MicroChallengeHeroView({
  challenge,
  challengeMeta,
  completedBy,
  currentUserId,
  playerCount,
  onComplete,
  isCompleting,
  isHost,
  onAdvance,
  isAdvancing,
  canAdvance,
  advanceDisabledReason,
  glanceStackEnabled = false,
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
        <PhaseHeroCard
          phase='micro_challenge'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-micro-challenge.webp')}
          title='挑战准备中…'
        />
      </View>
    )
  }

  const statusText = hasCompleted
      ? '你已完成，等待其他玩家'
      : isCompleting
        ? '提交中…'
        : '点按节奏球，和大家一起完成'

  // Zero raw emoji on primary copy: fallback-bank hints are emoji-only
  // decoration (e.g. '❓💬') — strip them and drop the dangling 提示 line;
  // text-bearing hints from AI content keep their words.
  const strippedHint = challenge.visualHint ? stripEmojis(challenge.visualHint).trim() : ''
  const promptText = stripEmojis(
    strippedHint ? `${challenge.description}\n提示：${strippedHint}` : challenge.description,
  )

  return (
    <View className='micro-challenge-hero'>
      <PhaseHeroCard
        phase='micro_challenge'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-micro-challenge.webp')}
        title={challenge.title}
        prompt={promptText}
        statusText={statusText}
        doneCount={optimisticCompletedBy.length}
        totalCount={playerCount}
        glanceMode={glanceStackEnabled}
        l2Framing={glanceStackEnabled ? GLANCE_L2_FRAMING_MICRO_CHALLENGE : undefined}
        actions={
          <>
            {/* S3: the ACT-pairing hint (locked spec §3.3 fragment) sits with
                the ACT target, quiet — never inside the L3 peek. */}
            {glanceStackEnabled && !hasCompleted ? (
              <Text className='micro-challenge-hero__act-hint'>{GLANCE_L2_HINT_MICRO_CHALLENGE}</Text>
            ) : null}
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
        {aigcEnabled ? <PhaseAigcRow meta={challengeMeta} reason='AI 生成微挑战' /> : null}
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
