import { useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { MILESTONE_BADGES } from '../../../lib/milestoneBadges'
import { logError } from '../../../lib/utils/logger'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { Phase } from './types'
import './HalfwayMilestone.scss'

// How long the halfway card stays visible before it fades out and unmounts.
const HALFWAY_DISPLAY_MS = 4000
// Fade-out duration — keep in sync with `halfway-card-exit` in the SCSS.
const HALFWAY_EXIT_MS = 300

interface HalfwayMilestoneProps {
  progressPercent: number
  phase: Phase
  answered: number
  estimatedTotal: number
  /**
   * Fires exactly once per session, the first time the test crosses 50%
   * progress in the testing phase. Parent owns side-effects (haptic, log,
   * analytics) so this component stays pure presentation.
   */
  onMilestoneReached?: (info: { answered: number; estimatedTotal: number }) => void
}

export function HalfwayMilestone({
  progressPercent,
  phase,
  answered,
  estimatedTotal,
  onMilestoneReached,
}: HalfwayMilestoneProps) {
  const halfwayShownRef = useRef(false)
  const onReachedRef = useRef(onMilestoneReached)
  const [shown, setShown] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [badgeError, setBadgeError] = useState(false)
  onReachedRef.current = onMilestoneReached

  useEffect(() => {
    if (progressPercent >= 50 && !halfwayShownRef.current && phase === 'testing') {
      halfwayShownRef.current = true
      setShown(true)
      onReachedRef.current?.({ answered, estimatedTotal })
    }
  }, [progressPercent, phase, answered, estimatedTotal])

  // Transient beat: the card cheers once, then fades out and unmounts instead
  // of lingering (with a breathing badge) for the whole second half.
  useEffect(() => {
    if (!shown) return
    const dismissTimer = setTimeout(() => setIsDismissing(true), HALFWAY_DISPLAY_MS)
    const removeTimer = setTimeout(() => setDismissed(true), HALFWAY_DISPLAY_MS + HALFWAY_EXIT_MS)
    return () => {
      clearTimeout(dismissTimer)
      clearTimeout(removeTimer)
    }
  }, [shown])

  if (!shown || dismissed || phase !== 'testing') {
    return null
  }

  return (
    <View
      className={`halfway-milestone__card${isDismissing ? ' halfway-milestone__card--exiting' : ''}`}
      role='region'
      aria-label='测验已完成一半，继续加油'
    >
      <View className='halfway-milestone__badge'>
        {badgeError ? (
          <View className='halfway-milestone__badge-fallback' aria-hidden='true'>
            <JoyJoinIcon emoji='🎯' size={48} className='halfway-milestone__badge-fallback-icon' />
          </View>
        ) : (
          <Image
            className='halfway-milestone__badge-img'
            mode='aspectFit'
            src={MILESTONE_BADGES.quizHalfway}
            lazyLoad={false}
            onError={() => {
              setBadgeError(true)
              logError('[HalfwayMilestone] Badge asset failed to load', {
                src: MILESTONE_BADGES.quizHalfway,
              })
            }}
          />
        )}
      </View>
      <View className='halfway-milestone__text'>
        <Text className='halfway-milestone__text-eyebrow'>半程已过</Text>
        <Text className='halfway-milestone__text-main'>越来越了解你的性格了</Text>
        <View className='halfway-milestone__text-sub'>
          <Text className='halfway-milestone__text-sub-label'>悦仔为你加油</Text>
          <JoyJoinIcon emoji='✨' tier='mood' size={28} />
        </View>
      </View>
    </View>
  )
}
