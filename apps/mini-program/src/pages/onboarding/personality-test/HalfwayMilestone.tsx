import { useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { MILESTONE_BADGES } from '../../../lib/milestoneBadges'
import { logError } from '../../../lib/utils/logger'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { Phase } from './types'
import './HalfwayMilestone.scss'

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
  const [badgeError, setBadgeError] = useState(false)
  onReachedRef.current = onMilestoneReached

  useEffect(() => {
    if (progressPercent >= 50 && !halfwayShownRef.current && phase === 'testing') {
      halfwayShownRef.current = true
      onReachedRef.current?.({ answered, estimatedTotal })
    }
  }, [progressPercent, phase, answered, estimatedTotal])

  if (progressPercent < 50 || phase !== 'testing' || !halfwayShownRef.current) {
    return null
  }

  return (
    <View className='halfway-milestone__card' role='region' aria-label='测验已完成一半，继续加油'>
      <View className='halfway-milestone__badge'>
        {badgeError ? (
          <View className='halfway-milestone__badge-fallback' aria-hidden='true'>
            <Text className='halfway-milestone__badge-fallback-icon'>🎯</Text>
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
        <Text className='halfway-milestone__text-sub'>
          悦仔为你加油 <JoyJoinIcon emoji='✨' size={28} />
        </Text>
      </View>
    </View>
  )
}
