import { useMemo, useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { SpeedFriendingPair } from '@shared/socialIcebreaker'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ArchetypeGlyph from '../../../components/mascot/ArchetypeGlyph'
import { PhaseHeaderIcon } from '../phaseUtils'
import { ParticleBurst } from '../../../components/reveal'
import { haptics } from '../../../lib/utils/haptics'
import { useStaggerMount } from '../../../hooks/useStaggerMount'
import { BRAND_COLORS } from '../../../styles/colors'
import './SpeedFriendingPhaseView.scss'

interface SpeedFriendingPhaseViewProps {
  pairs: SpeedFriendingPair[]
  currentRound: number
  totalRounds: number
  roundStartedAt?: number
  allRoundsComplete: boolean
  participants: Array<{
    userId: string
    displayName?: string
    archetype?: string
    isHost?: boolean
  }>
  currentUserId: string
  isHost: boolean
  onNextRound: () => void
  onComplete: () => void
  isLoading: boolean
}

function formatElapsedMinutes(startedAt?: number): string {
  if (!startedAt) return '0'
  const elapsed = Math.floor((Date.now() - startedAt) / 60000)
  return `${elapsed}`
}

export function SpeedFriendingPhaseView({
  pairs,
  currentRound,
  totalRounds,
  roundStartedAt,
  allRoundsComplete,
  participants,
  currentUserId,
  isHost,
  onNextRound,
  onComplete,
  isLoading,
}: SpeedFriendingPhaseViewProps) {
  const [burstTrigger, setBurstTrigger] = useState(false)
  const staggerMounted = useStaggerMount()

  // Detect reduced motion once at mount
  const reducedMotion = useMemo(() => {
    try {
      return !!(Taro.getSystemInfoSync() as any).reduceMotion
    } catch {
      return false
    }
  }, [])

  // Round-change celebration + haptic (gated by reduced-motion preference)
  useEffect(() => {
    if (totalRounds > 0 && currentRound >= 0) {
      setBurstTrigger(true)
      if (!reducedMotion) {
        haptics('light')
      }
      const t = setTimeout(() => setBurstTrigger(false), 2500)
      return () => clearTimeout(t)
    }
  }, [currentRound, totalRounds, reducedMotion])

  const currentPairs = useMemo(
    () => pairs.filter((p) => p.roundIndex === currentRound),
    [pairs, currentRound]
  )

  const myPair = useMemo(
    () => currentPairs.find((p) => p.userIdA === currentUserId || p.userIdB === currentUserId),
    [currentPairs, currentUserId]
  )

  const isBye = currentPairs.length > 0 && !myPair

  const participantMap = useMemo(() => {
    const map = new Map<string, { displayName?: string; archetype?: string }>()
    for (const p of participants) {
      map.set(p.userId, { displayName: p.displayName, archetype: p.archetype })
    }
    return map
  }, [participants])

  function getArchetype(userId: string): string | undefined {
    return participantMap.get(userId)?.archetype
  }

  const elapsedMinutes = formatElapsedMinutes(roundStartedAt)
  const isFinalRound = currentRound >= totalRounds - 1

  // ── All rounds complete summary ──
  if (allRoundsComplete) {
    return (
      <View className='speed-friending'>
        <View className='speed-friending__burst-container speed-friending__burst-container--summary'>
          <ParticleBurst trigger type='confetti' count={50} reducedMotion={reducedMotion} />
        </View>
        <Card className='speed-friending__summary-card'>
          <View className='speed-friending__summary-emoji'>
            <PhaseHeaderIcon phase='speed_friending' size={80} />
          </View>
          <Text className='speed-friending__summary-title'>快速破冰完成</Text>
          <Text className='speed-friending__summary-subtitle'>
            共 {totalRounds} 轮，{pairs.length} 次配对
          </Text>
          <Text className='speed-friending__summary-hint'>
            大家都认识了新伙伴，真棒！
          </Text>
        </Card>
      </View>
    )
  }

  // ── Main active view ──
  return (
    <View className='speed-friending'>
      <View className='speed-friending__burst-container'>
        <ParticleBurst trigger={burstTrigger} type='confetti' count={40} spotlightColor={BRAND_COLORS.particleGrowth} reducedMotion={reducedMotion} />
      </View>

      {/* Round badge */}
      <View className='speed-friending__round-badge'>
        <View className='speed-friending__round-pill'>
          <Text className='speed-friending__round-text'>
            第 {currentRound + 1} / {totalRounds} 轮
          </Text>
        </View>
        {roundStartedAt ? (
          <Text className='speed-friending__elapsed'>已进行 {elapsedMinutes} 分钟</Text>
        ) : null}
      </View>

      {/* My partner highlight */}
      {myPair ? (
        <Card className='speed-friending__my-pair-card'>
          <View className='speed-friending__my-pair-header'>
            <JoyJoinIcon emoji='🤝' size={28} />
            <Text className='speed-friending__my-pair-label'>你的本轮搭档</Text>
          </View>
          <View className='speed-friending__my-pair-content'>
            <View className='speed-friending__my-pair-avatar'>
              {getArchetype(myPair.userIdA) ? (
                <ArchetypeGlyph archetype={getArchetype(myPair.userIdA)!} size={48} />
              ) : (
                <View className='speed-friending__avatar-fallback'>
                  <Text className='speed-friending__avatar-fallback-text'>
                    {myPair.displayNameA.charAt(0)}
                  </Text>
                </View>
              )}
              <Text className='speed-friending__my-pair-name'>{myPair.displayNameA}</Text>
            </View>
            <View className='speed-friending__my-pair-vs'>
              <Text className='speed-friending__my-pair-vs-text'>×</Text>
            </View>
            <View className='speed-friending__my-pair-avatar'>
              {getArchetype(myPair.userIdB) ? (
                <ArchetypeGlyph archetype={getArchetype(myPair.userIdB)!} size={48} />
              ) : (
                <View className='speed-friending__avatar-fallback'>
                  <Text className='speed-friending__avatar-fallback-text'>
                    {myPair.displayNameB.charAt(0)}
                  </Text>
                </View>
              )}
              <Text className='speed-friending__my-pair-name'>{myPair.displayNameB}</Text>
            </View>
          </View>
        </Card>
      ) : isBye ? (
        <Card className='speed-friending__my-pair-card speed-friending__my-pair-card--bye'>
          <View className='speed-friending__my-pair-header'>
            <JoyJoinIcon emoji='☕' size={28} />
            <Text className='speed-friending__my-pair-label'>本轮观察席</Text>
          </View>
          <Text className='speed-friending__bye-text'>
            本轮人数为奇数，你暂时轮空。
          </Text>
          <Text className='speed-friending__bye-sub'>
            正好观察大家的聊天节奏，下一轮就会有新搭档！
          </Text>
        </Card>
      ) : null}

      {/* All pairs grid */}
      {currentPairs.length > 0 && (
        <View className='speed-friending__all-pairs'>
          <Text className='speed-friending__section-title'>本轮配对</Text>
          <View className='speed-friending__pairs-grid'>
            {currentPairs.map((pair, index) => {
              const isMine = pair.userIdA === currentUserId || pair.userIdB === currentUserId
              return (
                <View
                  key={`${pair.userIdA}-${pair.userIdB}`}
                  className={`speed-friending__pair-tile${staggerMounted ? ' stagger-in' : ' stagger-in-hidden'}${isMine ? ' speed-friending__pair-tile--mine' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
                  aria-label={`${pair.displayNameA} 与 ${pair.displayNameB} 配对${isMine ? '（你的搭档）' : ''}`}
                >
                  <View className='speed-friending__pair-tile-avatars'>
                    <View className='speed-friending__pair-tile-avatar'>
                      {getArchetype(pair.userIdA) ? (
                        <ArchetypeGlyph archetype={getArchetype(pair.userIdA)!} size={32} />
                      ) : (
                        <View className='speed-friending__avatar-fallback speed-friending__avatar-fallback--sm'>
                          <Text className='speed-friending__avatar-fallback-text'>
                            {pair.displayNameA.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className='speed-friending__pair-tile-vs'>×</Text>
                    <View className='speed-friending__pair-tile-avatar'>
                      {getArchetype(pair.userIdB) ? (
                        <ArchetypeGlyph archetype={getArchetype(pair.userIdB)!} size={32} />
                      ) : (
                        <View className='speed-friending__avatar-fallback speed-friending__avatar-fallback--sm'>
                          <Text className='speed-friending__avatar-fallback-text'>
                            {pair.displayNameB.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className='speed-friending__pair-tile-names'>
                    <Text className='speed-friending__pair-tile-name'>{pair.displayNameA}</Text>
                    <Text className='speed-friending__pair-tile-name'>{pair.displayNameB}</Text>
                  </View>
                  {isMine && (
                    <View className='speed-friending__pair-tile-badge'>
                      <Text className='speed-friending__pair-tile-badge-text'>你</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Empty / loading state */}
      {currentPairs.length === 0 && !isBye && (
        <Card className='speed-friending__empty-card'>
          <PhaseHeaderIcon phase='speed_friending' size={64} />
          <Text className='speed-friending__empty-title'>配对准备中…</Text>
          <Text className='speed-friending__empty-sub'>稍等片刻，配对结果马上揭晓</Text>
        </Card>
      )}

      {/* Host controls */}
      {isHost && (
        <View className='speed-friending__host-actions'>
          {!isFinalRound ? (
            <Button
              variant='primary'
              className='speed-friending__action-btn'
              onClick={onNextRound}
              disabled={isLoading}
              loading={isLoading}
            >
              {isLoading ? '切换中…' : '下一轮'}
            </Button>
          ) : (
            <Button
              variant='primary'
              className='speed-friending__action-btn'
              onClick={onComplete}
              disabled={isLoading}
              loading={isLoading}
            >
              {isLoading ? '提交中…' : '完成互动'}
            </Button>
          )}
        </View>
      )}

      {/* Player hint */}
      {!isHost && (
        <Text className='speed-friending__player-hint'>
          {isBye
            ? '享受观察席时光，下一轮见！'
            : '和搭档聊聊吧，时间由主持人把控'}
        </Text>
      )}
    </View>
  )
}
