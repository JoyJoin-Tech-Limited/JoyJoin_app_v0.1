import { View, Image } from '@tarojs/components'
import { useEffect, useCallback, useState } from 'react'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import TeammateCard from './TeammateCard'

export const SQUAD_CARD_BACK_PATTERN_URL = cdnAsset('/assets/lovart/squad/squad-card-back-pattern-20260628-v1.webp')

export interface SquadDeckStageProps {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  viewerPairByMemberId: Map<string, PairExplanation | null>
  focusedIndex: number
  reduceMotion: boolean
  isDegradation: boolean
  onFocusChange: (index: number) => void
}

export default function SquadDeckStage({
  members,
  currentUserId,
  viewerPairByMemberId,
  focusedIndex,
  reduceMotion,
  isDegradation,
  onFocusChange,
}: SquadDeckStageProps) {
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      setIsRevealed(true)
      return
    }

    const timer = setTimeout(() => {
      setIsRevealed(true)
    }, 80)

    return () => clearTimeout(timer)
  }, [reduceMotion])

  const handleFocus = useCallback((index: number) => {
    onFocusChange(index)
  }, [onFocusChange])

  if (members.length === 0) return null

  return (
    <View className='squad-unboxing__deck-stage' role='list' aria-label='桌友卡组'>
      <View className='squad-unboxing__deck-shadow' />

      <View className='squad-unboxing__deck-cards'>
        <View className='squad-unboxing__deck-back-pattern' aria-hidden='true'>
          <Image
            className='squad-unboxing__deck-back-pattern-img'
            src={SQUAD_CARD_BACK_PATTERN_URL}
            mode='aspectFill'
            lazyLoad={false}
          />
        </View>

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
              isCurrentUser={isCurrentUser}
              reduceMotion={reduceMotion}
              isDegradation={isDegradation}
              onFocus={() => handleFocus(index)}
            />
          )
        })}
      </View>

      {!isRevealed ? <View className='squad-unboxing__deck-deal-cover' /> : null}
    </View>
  )
}
