import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useAuth } from '../../hooks/useAuth'
import { useAlangMissions } from '../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import { shouldShowAlangEntry } from '../../lib/alang/alangAccess'
import { haptics } from '../../lib/utils/haptics'
import './AlangDiscoverCard.scss'

export default function AlangDiscoverCard() {
  const { user } = useAuth()
  const isEnabled = shouldShowAlangEntry(user)
  const { data: missions, isLoading, isError } = useAlangMissions(isEnabled)

  if (!isEnabled) return null

  const mission = missions?.[0]
  const title = mission?.title ?? '闪现 NPC｜阿浪'
  const description = mission?.description
    ?? (isError ? '阿浪暂时没回消息，点进来再试一次。' : '有人在等你，线索正在路上。')
  const footerText = isLoading
    ? '正在准备阿浪的线索…'
    : mission?.status === 'in_progress'
      ? '继续寻找阿浪 →'
      : mission
        ? '出发去找阿浪 →'
        : '进入阿浪故事 →'

  const handleTap = () => {
    haptics('light')
    alangEvents.discoverCardTap()
    const url = mission
      ? `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${mission.slug}`
      : MINI_PROGRAM_ROUTES.alangEvent
    Taro.navigateTo({ url })
  }

  return (
    <View
      className='alang-discover-card'
      hoverClass='alang-discover-card--pressed'
      onClick={handleTap}
      role='button'
      aria-label={`${title}，${footerText}`}
    >
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
        <Text className='alang-discover-card__title'>{title}</Text>
        <Text className='alang-discover-card__desc'>{description}</Text>
        <View className='alang-discover-card__footer'>
          <Text className='alang-discover-card__footer-text'>{footerText}</Text>
        </View>
      </View>
    </View>
  )
}
