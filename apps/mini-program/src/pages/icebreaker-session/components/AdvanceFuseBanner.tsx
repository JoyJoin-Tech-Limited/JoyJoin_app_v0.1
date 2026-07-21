import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Button from '../../../components/ui/Button'

/**
 * PR1 flow revamp — visible advance fuse + stall nudge.
 *
 * Fuse (all players): the server schedules `autoAdvanceScheduledAt`; everyone
 * sees the same countdown so an auto-advance never feels like a jump scare.
 * Stall nudge (host only): a stuck phase surfaces a gentle choice — advance
 * now (force, skips stragglers) or keep waiting (suppresses stall automation
 * for the rest of the phase).
 */

export interface AdvanceFuseBannerProps {
  fuseAt?: number
  fuseKind?: 'all_ready' | 'stall_recovery'
  stallNudgeAt?: number
  isHost: boolean
  isActing: boolean
  onStallAdvance: () => void
  onStallDismiss: () => void
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

export function AdvanceFuseBanner({
  fuseAt,
  fuseKind,
  stallNudgeAt,
  isHost,
  isActing,
  onStallAdvance,
  onStallDismiss,
}: AdvanceFuseBannerProps) {
  const fuseActive = typeof fuseAt === 'number' && fuseAt > Date.now()
  const now = useNow(fuseActive)

  if (fuseActive) {
    const remainingSeconds = Math.max(1, Math.ceil((fuseAt - now) / 1000))
    const sentence =
      fuseKind === 'stall_recovery' ? '时间差不多啦，即将进入下一环节～' : '都准备好啦，马上进入下一环节～'
    return (
      <View className='icebreaker__fuse-banner' role='status' aria-live='polite'>
        <Text className='icebreaker__fuse-banner-text'>
          {sentence}
          {/* Numerals only in the mono span — CJK glyphs don't exist in the
              mono stack and would fall back to a mismatched system font. */}
          <Text className='icebreaker__fuse-banner-countdown' aria-hidden='true'>
            {' '}
            剩余 <Text className='icebreaker__fuse-banner-numeral'>{remainingSeconds}</Text> 秒
          </Text>
        </Text>
      </View>
    )
  }

  if (stallNudgeAt && isHost) {
    return (
      <View className='icebreaker__stall-nudge' role='status' aria-live='polite'>
        <Text className='icebreaker__stall-nudge-text'>有小伙伴还没完成，要继续吗？</Text>
        <View className='icebreaker__stall-nudge-actions'>
          <Button
            variant='primary'
            className='icebreaker__stall-nudge-btn'
            onClick={onStallAdvance}
            disabled={isActing}
          >
            <Text className='icebreaker__stall-nudge-btn-label'>进入下一阶段</Text>
          </Button>
          <Button
            variant='secondary'
            className='icebreaker__stall-nudge-btn'
            onClick={onStallDismiss}
            disabled={isActing}
          >
            <Text className='icebreaker__stall-nudge-btn-label'>再等一会儿</Text>
          </Button>
        </View>
      </View>
    )
  }

  return null
}
