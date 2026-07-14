import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useAuth } from '../../hooks/useAuth'
import { useAlangMissions } from '../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import { shouldShowAlangEntry } from '../../lib/alang/alangAccess'
import { useAlangAssetSource } from '../../lib/alang/alangAssets'
import { haptics } from '../../lib/utils/haptics'
import './AlangDiscoverCard.scss'

export default function AlangDiscoverCard() {
  const { user } = useAuth()
  const isEnabled = shouldShowAlangEntry(user)
  const { data: missions, isLoading, isError } = useAlangMissions(isEnabled)
  const artwork = useAlangAssetSource('eventHero')

  if (!isEnabled) return null

  const mission = missions?.find(({ status }) => status === 'in_progress')
    ?? missions?.find(({ status }) => status === 'not_started')
    ?? missions?.[0]
  const isContinuing = mission?.status === 'in_progress'
  const storyTitle = mission?.title
    ?? (isError ? '今晚的角色还没回信' : '附近有个角色，正等你出发')
  const storyLine = mission?.description
    ?? (isError
      ? '先逛逛别处，稍后再回来看看。'
      : '跟着接近提示，去遇见一段正在发生的城市故事。')
  const ctaText = isLoading
    ? '正在看看谁出现了…'
    : isContinuing
      ? '继续这段故事'
      : mission?.status === 'completed'
        ? '重温这段故事'
        : '进入闪现'

  const handleTap = () => {
    if (isLoading) return
    haptics('light')
    alangEvents.discoverCardTap()
    const url = mission
      ? `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodeURIComponent(mission.slug)}`
      : MINI_PROGRAM_ROUTES.alangEvent
    Taro.navigateTo({ url })
  }

  return (
    <View className='alang-discover-card' role='region' aria-label='闪现 Beta 城市探索体验'>
      <View className='alang-discover-card__art' aria-hidden='true'>
        <Image
          className='alang-discover-card__image'
          src={artwork.src}
          mode='aspectFill'
          onError={artwork.onError}
        />
        <View className='alang-discover-card__art-wash' />
        <View className='alang-discover-card__character-beacon'>
          <Text className='alang-discover-card__character-beacon-glyph'>✦</Text>
        </View>
        {artwork.usingFallback && (
          <Text className='alang-discover-card__placeholder-label'>活动场景示意</Text>
        )}
      </View>

      <View className='alang-discover-card__content'>
        <View className='alang-discover-card__brand-row'>
          <View className='alang-discover-card__bolt' aria-hidden='true'>
            <Text className='alang-discover-card__bolt-glyph'>⚡</Text>
          </View>
          <Text className='alang-discover-card__brand'>闪现</Text>
          <Text className='alang-discover-card__beta'>Beta</Text>
        </View>

        <Text className='alang-discover-card__title'>{storyTitle}</Text>
        <Text className='alang-discover-card__desc'>{storyLine}</Text>

        <View className='alang-discover-card__chips' aria-label='闪现体验说明'>
          <Text className='alang-discover-card__chip'>附近角色</Text>
          <Text className='alang-discover-card__chip'>位置保持神秘</Text>
          <Text className='alang-discover-card__chip'>
            {isContinuing ? '可继续上次进度' : '到达后触发故事'}
          </Text>
        </View>

        <View
          className={`alang-discover-card__cta${isLoading ? ' alang-discover-card__cta--disabled' : ''}`}
          hoverClass={isLoading ? '' : 'alang-discover-card__cta--pressed'}
          onClick={handleTap}
          role='button'
          aria-label={ctaText}
          aria-disabled={isLoading}
        >
          <Text className='alang-discover-card__cta-text'>{ctaText}</Text>
          {!isLoading && <Text className='alang-discover-card__cta-arrow'>›</Text>}
        </View>
      </View>
    </View>
  )
}
