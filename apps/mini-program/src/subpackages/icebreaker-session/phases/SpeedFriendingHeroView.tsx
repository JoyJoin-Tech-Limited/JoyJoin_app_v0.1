import { useMemo, useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { SpeedFriendingPair } from '@shared/socialIcebreaker'
import Button from '../../../components/ui/Button'
import ArchetypeGlyph from '../../../components/mascot/ArchetypeGlyph'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { ParticleBurst } from '../../../components/reveal'
import { haptics } from '../../../lib/utils/haptics'
import './SpeedFriendingHeroView.scss'
import { cdnAsset } from '../../../lib/utils/cdnAssets'

interface SpeedFriendingHeroViewProps {
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
  onAdvance?: () => void
  isAdvancing?: boolean
}

function formatElapsedMinutes(startedAt?: number): string {
  if (!startedAt) return '0'
  const elapsed = Math.floor((Date.now() - startedAt) / 60000)
  return `${elapsed}`
}

export function SpeedFriendingHeroView({
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
  onAdvance,
  isAdvancing,
}: SpeedFriendingHeroViewProps) {
  const [burstTrigger, setBurstTrigger] = useState(false)

  const reducedMotion = useMemo(() => {
    try {
      return !!(Taro.getSystemInfoSync() as any).reduceMotion
    } catch {
      return false
    }
  }, [])

  // Round-change celebration + haptic — fires only on an actual round change
  // (round > 0), never on initial mount (design audit: wow before achievement).
  useEffect(() => {
    if (totalRounds > 0 && currentRound > 0) {
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
    [pairs, currentRound],
  )

  const myPair = useMemo(
    () => currentPairs.find((p) => p.userIdA === currentUserId || p.userIdB === currentUserId),
    [currentPairs, currentUserId],
  )

  const isBye = currentPairs.length > 0 && !myPair
  const partnerName = myPair
    ? myPair.userIdA === currentUserId
      ? myPair.displayNameB
      : myPair.displayNameA
    : undefined

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

  // ── All rounds complete ──
  if (allRoundsComplete) {
    return (
      <View className='speed-friending-hero'>
        <View className='speed-friending-hero__burst'>
          <ParticleBurst trigger type='confetti' count={50} reducedMotion={reducedMotion} />
        </View>
        <PhaseHeroCard
          phase='speed_friending'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-speed-friending.webp')}
          title='快速交友完成'
          prompt={`共 ${totalRounds} 轮，${pairs.length} 次配对 · 大家都认识了新伙伴，真棒！`}
          statusText='本环节已完成'
          doneCount={totalRounds}
          totalCount={totalRounds}
          actions={
            isHost && onAdvance ? (
              <Button
                variant='primary'
                onClick={onAdvance}
                disabled={isAdvancing}
                loading={isAdvancing}
              >
                {isAdvancing ? '推进中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        />
      </View>
    )
  }

  const statusText = isBye
    ? '本轮观察席，下一轮就有新搭档'
    : partnerName
      ? `本轮搭档：${partnerName}`
      : '配对准备中…'

  return (
    <View className='speed-friending-hero'>
      <View className='speed-friending-hero__burst'>
        <ParticleBurst trigger={burstTrigger} type='confetti' count={40} reducedMotion={reducedMotion} />
      </View>

      <PhaseHeroCard
        phase='speed_friending'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-speed-friending.webp')}
        title={myPair ? `搭档：${partnerName}` : isBye ? '本轮观察席' : '快速交友'}
        prompt={
          myPair
            ? '和搭档聊聊吧，时间由主持人把控'
            : isBye
              ? '本轮人数为奇数，正好观察大家的聊天节奏，下一轮就会有新搭档！'
              : '稍等片刻，配对结果马上揭晓'
        }
        statusChip={roundStartedAt && elapsedMinutes !== '0' ? `已进行 ${elapsedMinutes} 分钟` : undefined}
        statusText={statusText}
        doneCount={Math.min(currentRound + 1, totalRounds)}
        totalCount={totalRounds}
        actions={
          isHost ? (
            <>
              {!isFinalRound ? (
                <Button variant='primary' onClick={onNextRound} disabled={isLoading} loading={isLoading}>
                  {isLoading ? '切换中…' : '下一轮'}
                </Button>
              ) : (
                <Button variant='primary' onClick={onComplete} disabled={isLoading} loading={isLoading}>
                  {isLoading ? '提交中…' : '完成互动'}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {/* Signature wow: partner deal — tiles re-deal (staggered) on every
            round change via the round-keyed container */}
        {currentPairs.length > 0 && (
          <View className='speed-friending-hero__pairs' key={`round-${currentRound}`}>
            {currentPairs.map((pair, index) => {
              const isMine = pair.userIdA === currentUserId || pair.userIdB === currentUserId
              return (
                <View
                  key={`${pair.userIdA}-${pair.userIdB}`}
                  className={`speed-friending-hero__pair-tile${isMine ? ' speed-friending-hero__pair-tile--mine' : ''}`}
                  style={reducedMotion ? undefined : { animationDelay: `${Math.min(index, 6) * 60}ms` }}
                  aria-label={`${pair.displayNameA} 与 ${pair.displayNameB} 配对${isMine ? '（你的搭档）' : ''}`}
                >
                  <View className='speed-friending-hero__pair-tile-avatars'>
                    <View className='speed-friending-hero__pair-tile-avatar'>
                      {getArchetype(pair.userIdA) ? (
                        <ArchetypeGlyph archetype={getArchetype(pair.userIdA)!} size={64} className='speed-friending-hero__glyph' />
                      ) : (
                        <View className='speed-friending-hero__avatar-fallback'>
                          <Text className='speed-friending-hero__avatar-fallback-text'>
                            {pair.displayNameA.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className='speed-friending-hero__pair-tile-vs'>×</Text>
                    <View className='speed-friending-hero__pair-tile-avatar'>
                      {getArchetype(pair.userIdB) ? (
                        <ArchetypeGlyph archetype={getArchetype(pair.userIdB)!} size={64} className='speed-friending-hero__glyph' />
                      ) : (
                        <View className='speed-friending-hero__avatar-fallback'>
                          <Text className='speed-friending-hero__avatar-fallback-text'>
                            {pair.displayNameB.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className='speed-friending-hero__pair-tile-names'>
                    <Text className='speed-friending-hero__pair-tile-name'>{pair.displayNameA}</Text>
                    <Text className='speed-friending-hero__pair-tile-name'>{pair.displayNameB}</Text>
                  </View>
                  {isMine && (
                    <View className='speed-friending-hero__pair-tile-badge'>
                      <Text className='speed-friending-hero__pair-tile-badge-text'>你</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </PhaseHeroCard>
    </View>
  )
}
