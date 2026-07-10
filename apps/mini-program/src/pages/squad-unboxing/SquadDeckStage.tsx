import { View, Text } from '@tarojs/components'
import { useEffect, useCallback, useState } from 'react'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import TeammateCard from './TeammateCard'

export interface SquadDeckStageProps {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  viewerPairByMemberId: Map<string, PairExplanation | null>
  focusedIndex: number
  anyFocused: boolean
  reduceMotion: boolean
  isDegradation: boolean
  onFocusChange: (index: number) => void
  onEmergeComplete?: () => void
}

export default function SquadDeckStage({
  members,
  currentUserId,
  viewerPairByMemberId,
  focusedIndex,
  anyFocused,
  reduceMotion,
  isDegradation,
  onFocusChange,
  onEmergeComplete,
}: SquadDeckStageProps) {
  const [isRevealed, setIsRevealed] = useState(() => reduceMotion || isDegradation)
  const [emergeComplete, setEmergeComplete] = useState(() => reduceMotion || isDegradation)

  useEffect(() => {
    if (reduceMotion || isDegradation) {
      setIsRevealed(true)
      setEmergeComplete(true)
      return
    }

    // Yield one frame so the initial (hidden, inside-box) transform is committed
    // before the final fanned transform is applied, triggering the transition.
    const revealTimer = setTimeout(() => setIsRevealed(true), 0)
    const maxStaggerMs = 280 + Math.max(0, members.length - 1) * 50
    const completeTimer = setTimeout(() => setEmergeComplete(true), maxStaggerMs + 550)

    return () => {
      clearTimeout(revealTimer)
      clearTimeout(completeTimer)
    }
  }, [reduceMotion, isDegradation, members.length])

  useEffect(() => {
    if (emergeComplete) {
      onEmergeComplete?.()
    }
  }, [emergeComplete, onEmergeComplete])

  const handleFocus = useCallback((index: number) => {
    onFocusChange(index)
  }, [onFocusChange])

  if (members.length === 0) {
    return (
      <View className='squad-unboxing__deck-stage squad-unboxing__deck-stage--empty' role='list' aria-label='桌友卡组'>
        <Text className='squad-unboxing__deck-empty-text'>
          {`${DEFAULT_MASCOT_DISPLAY_NAME}还没收到这桌的名单，稍后再来看看～`}
        </Text>
      </View>
    )
  }

  return (
    <View
      className={[
        'squad-unboxing__deck-stage',
        isRevealed ? 'squad-unboxing__deck-stage--revealed' : '',
        reduceMotion ? 'squad-unboxing__deck-stage--reduce-motion' : '',
        isDegradation ? 'squad-unboxing__deck-stage--degradation' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role='list'
      aria-label={`桌友卡组，共 ${members.length} 张`}
    >
      <View className='squad-unboxing__deck-shadow' />

      <View className='squad-unboxing__deck-cards'>
        {members.map((member, index) => {
          const isCurrentUser = member.userId === currentUserId
          const viewerPair = viewerPairByMemberId.get(member.userId) ?? null

          return (
            <TeammateCard
              key={member.userId}
              member={member}
              viewerPair={viewerPair}
              index={index}
              total={members.length}
              focused={focusedIndex === index}
              anyFocused={anyFocused}
              isCurrentUser={isCurrentUser}
              isRevealed={isRevealed}
              emergeComplete={emergeComplete}
              reduceMotion={reduceMotion}
              isDegradation={isDegradation}
              onFocus={() => handleFocus(index)}
            />
          )
        })}
      </View>
    </View>
  )
}
