import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { PoolRegistrationSummary } from '@shared/api'
import Card from '../../components/ui/Card'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { formatDateTime } from '../../lib/matching/groupDisplay'

interface MatchHistorySectionProps {
  matches: PoolRegistrationSummary[]
  shouldReduceMotion: boolean
  viewerArchetype?: string | null
}

export default function MatchHistorySection({
  matches,
  shouldReduceMotion,
  viewerArchetype,
}: MatchHistorySectionProps) {
  const handleTapMatch = (registrationId: string) => {
    const url = `/subpackages/matching-status/index?registrationId=${encodeURIComponent(registrationId)}`
    Taro.navigateTo({
      url,
      fail: () => {
        Taro.redirectTo({
          url,
          fail: () => {
            Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
          },
        })
      },
    })
  }

  if (matches.length === 0) return null

  return (
    <View className='matching-status__history-section'>
      <View className='matching-status__history-header'>
        <ArchetypeHead archetype={viewerArchetype ?? 'corgi'} size={28} className='matching-status__history-header-icon' variant='head' />
        <Text className='matching-status__history-title'>过往匹配</Text>
        <Text className='matching-status__history-count'>共 {matches.length} 次</Text>
      </View>

      {matches.map((match) => {
        const statusLabel = match.matchStatus === 'completed' ? '已完成' : '已匹配'
        const dateLabel = match.finalDateTime ?? match.poolDateTime ?? ''

        return (
          <Card
            key={match.id}
            className={`matching-status__history-card ${shouldReduceMotion ? '' : 'matching-status__history-card--enter'}`}
            onClick={() => handleTapMatch(match.id)}
          >
            <View className='matching-status__history-card-top'>
              <View className='matching-status__history-card-left'>
                <Text className='matching-status__history-card-title'>
                  {match.poolTitle ?? match.poolEventType ?? '活动'}
                </Text>
                {dateLabel ? (
                  <Text className='matching-status__history-card-date'>
                    {formatDateTime(dateLabel)}
                  </Text>
                ) : null}
                {match.poolEventType || match.poolCity ? (
                  <Text className='matching-status__history-card-meta'>
                    {[match.poolEventType, match.poolCity].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <View className='matching-status__history-card-right'>
                <JoyJoinIcon emoji='✅' size={20} className='matching-status__history-status-icon' />
                <Text className={`matching-status__history-status-label matching-status__history-status-label--${match.matchStatus}`}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            {match.matchScore ? (
              <View className='matching-status__history-card-score'>
                <Text className='matching-status__history-score-value'>{match.matchScore}</Text>
                <Text className='matching-status__history-score-label'>匹配分</Text>
              </View>
            ) : null}
            <View className='matching-status__history-card-arrow'>
              <Text className='matching-status__history-arrow'>›</Text>
            </View>
          </Card>
        )
      })}
    </View>
  )
}
