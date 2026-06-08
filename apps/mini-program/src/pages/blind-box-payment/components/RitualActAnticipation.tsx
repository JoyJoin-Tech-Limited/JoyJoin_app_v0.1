import { View, Text, Image } from '@tarojs/components'
import { memo, useEffect, useRef, useState } from 'react'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import type { ArchetypeTheme, CommunityPulse } from '../lib/paymentRitualState'
import { getActICopy, getEasterEggLine } from '../lib/paymentRitualCopy'
import { trackAct1Complete } from '../lib/paymentRitualAnalytics'

interface Props {
  archetype: string | null
  theme: ArchetypeTheme
  community: CommunityPulse
  hasContextActivity: boolean
  onComplete: () => void
  onSkip?: () => void
}

function RitualActAnticipation({
  archetype,
  theme,
  community,
  hasContextActivity,
  onComplete,
  onSkip,
}: Props) {
  const [stage, setStage] = useState(0)
  const [easterEggTap, setEasterEggTap] = useState(0)
  const easterEggTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copy = getActICopy(archetype, theme.family, hasContextActivity, community.monthlyEvents)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 200),
      setTimeout(() => setStage(2), 500),
      setTimeout(() => setStage(3), 800),
      setTimeout(() => setStage(4), 1100),
      setTimeout(() => setStage(5), 1400),
      setTimeout(() => setStage(6), 1700),
      setTimeout(() => {
        setStage(7)
        trackAct1Complete()
        onComplete()
      }, 2100),
    ]
    return () => {
      timers.forEach(clearTimeout)
      if (easterEggTimerRef.current) {
        clearTimeout(easterEggTimerRef.current)
      }
    }
  }, [onComplete])

  const handleXiaoyueTap = () => {
    setEasterEggTap((prev) => (prev % 4) + 1)
    if (easterEggTimerRef.current) {
      clearTimeout(easterEggTimerRef.current)
    }
    easterEggTimerRef.current = setTimeout(() => setEasterEggTap(0), 3000)
  }

  return (
    <View className='ritual-act-anticipation'>
      {/* Progress hint (Achievement seed) */}
      {stage >= 1 && (
        <View
          className={`ritual-act-anticipation__progress ${
            stage >= 1 ? 'ritual-act-anticipation__progress--visible' : ''
          }`}
        >
          <View className='ritual-act-anticipation__progress-track'>
            <View className='ritual-act-anticipation__progress-fill' style={{ width: '33%' }} />
          </View>
          <Text className='ritual-act-anticipation__progress-label'>{copy.progressHint}</Text>
        </View>
      )}

      {/* Xiaoyue with spotlight */}
      <View
        className={`ritual-act-anticipation__xiaoyue-wrap ${
          stage >= 2 ? 'ritual-act-anticipation__xiaoyue-wrap--visible' : ''
        }`}
      >
        <View className='ritual-act-anticipation__spotlight' />
        <View onClick={handleXiaoyueTap}>
          <Image
            className='ritual-act-anticipation__xiaoyue'
            src={getXiaoyueExpressionAsset('paymentTrust')}
            mode='aspectFit'
            aria-label='悦仔'
            onError={() => {}}
          />
        </View>
        {easterEggTap > 0 && easterEggTap < 5 && (
          <View className='ritual-act-anticipation__easter-egg'>
            <Text className='ritual-act-anticipation__easter-egg-text'>
              {getEasterEggLine(easterEggTap - 1)}
            </Text>
          </View>
        )}
        {stage >= 3 && (
          <Text className='ritual-act-anticipation__xiaoyue-line'>{copy.xiaoyueLine}</Text>
        )}
      </View>

      {/* Title */}
      {stage >= 4 && (
        <Text className='ritual-act-anticipation__title'>{copy.title}</Text>
      )}

      {/* Subtitle */}
      {stage >= 5 && (
        <Text className='ritual-act-anticipation__subtitle'>{copy.subtitle}</Text>
      )}

      {/* Community Pulse with deep belonging */}
      {stage >= 6 && community.totalMembers > 0 && (
        <View className='ritual-act-anticipation__community'>
          <View className='ritual-act-anticipation__pulse-dot' />
          <Text className='ritual-act-anticipation__community-text'>
            {community.city} {community.totalMembers.toLocaleString()} 位探索者已加入
          </Text>
        </View>
      )}

      {/* Community subline (deep belonging) */}
      {stage >= 7 && (
        <Text className='ritual-act-anticipation__community-subline'>
          {copy.communitySubline}
        </Text>
      )}

      {/* Skip ritual (visible after 500ms) */}
      {stage >= 2 && onSkip && (
        <Text className='ritual-act-anticipation__skip' onClick={onSkip}>
          跳过
        </Text>
      )}
    </View>
  )
}

export default memo(RitualActAnticipation)
