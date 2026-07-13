import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useAuth } from '../../hooks/useAuth'
import { useAlangMissions } from '../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import './AlangDiscoverCard.scss'

export default function AlangDiscoverCard() {
  const { user } = useAuth()
  const isEnabled = user?.features?.alangEnabled ?? false
  const { data: missions, isLoading } = useAlangMissions(isEnabled)

  if (!isEnabled) return null
  if (isLoading || !missions?.length) return null

  const mission = missions[0]

  const handleTap = () => {
    alangEvents.discoverCardTap()
    Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${mission.slug}` })
  }

  return (
    <View className='alang-discover-card' onClick={handleTap}>
      <View className='alang-discover-card__visual'>
        <Image
          className='alang-discover-card__image'
          src='/assets/lovart/alang-event-card-placeholder.webp'
          mode='aspectFill'
        />
        <View className='alang-discover-card__overlay'>
          <Text className='alang-discover-card__badge'>内部测试</Text>
        </View>
      </View>
      <View className='alang-discover-card__body'>
        <Text className='alang-discover-card__title'>{mission.title}</Text>
        <Text className='alang-discover-card__desc'>{mission.description}</Text>
        <View className='alang-discover-card__footer'>
          <Text className='alang-discover-card__footer-text'>
            {mission.status === 'in_progress' ? '继续寻找阿浪 →' : '出发去找阿浪 →'}
          </Text>
        </View>
      </View>
    </View>
  )
}
