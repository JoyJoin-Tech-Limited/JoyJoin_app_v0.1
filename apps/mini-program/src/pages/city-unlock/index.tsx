import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api/api'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import XiaoyueSpriteAnimator from '../../components/mascot/XiaoyueSpriteAnimator'
import LoadingScreen from '../../components/loading/LoadingScreen'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import './index.scss'

interface CityProgress {
  city: string
  interestedCount: number
  targetThreshold: number
  status: string
  progressPercent: number
}

interface MyInterest {
  city: string
  source: string
  createdAt: string | Date
  progress: CityProgress | null
}

interface MyInterestsApiResponse {
  interests: MyInterest[]
}

interface CityProgressApiResponse {
  cities: CityProgress[]
}

export default function CityUnlockPage() {
  const [shareAnimation, setShareAnimation] = useState(false)

  const {
    data: myInterests,
    isLoading,
    isError,
    refetch,
  } = useQuery<MyInterest[]>({
    queryKey: ['my-city-interests'],
    queryFn: async () => {
      const res = await apiRequest<MyInterestsApiResponse>({
        method: 'GET',
        path: '/api/cities/my-interests',
      })
      return res.interests ?? []
    },
  })

  const { data: allProgress } = useQuery<CityProgress[]>({
    queryKey: ['city-progress-all'],
    queryFn: async () => {
      const res = await apiRequest<CityProgressApiResponse>({
        method: 'GET',
        path: '/api/cities/progress',
      })
      return res.cities ?? []
    },
  })

  // Dynamic share message
  const primaryCity = myInterests?.[0]?.city
  useShareAppMessage(() => {
    const city = primaryCity?.replace('市', '') ?? '你的城市'
    const count = myInterests?.[0]?.progress?.interestedCount ?? 0
    return {
      title: `快来助力解锁${city}！已有 ${count} 人在等`,
      path: `/pages/city-unlock/index?refCity=${encodeURIComponent(primaryCity ?? '')}`,
      imageUrl: getXiaoyueExpressionAsset('cityUnlock'),
    }
  })

  const currentCityProgress = useMemo(() => {
    if (!allProgress || !primaryCity) return null
    return allProgress.find((c) => c.city === primaryCity) ?? null
  }, [allProgress, primaryCity])

  const otherCities = useMemo(() => {
    if (!allProgress || !primaryCity) return []
    return allProgress.filter((c) => c.city !== primaryCity).slice(0, 5)
  }, [allProgress, primaryCity])

  const handleShare = () => {
    setShareAnimation(true)
    setTimeout(() => setShareAnimation(false), 300)

    // Trigger native share sheet — useShareAppMessage provides the card config
    Taro.showShareMenu({ withShareTicket: true })
  }

  const handleBrowseShenzhen = () => {
    Taro.switchTab({ url: '/pages/discover/index' })
  }

  // Error state
  if (isError) {
    return (
      <View className='city-unlock-page'>
        <View className='city-unlock-page__empty'>
          <XiaoyueSpriteAnimator state='error' size='200rpx' />
          <Text className='city-unlock-page__empty-title'>网络开小差了</Text>
          <Text className='city-unlock-page__empty-subtitle'>点击重试，我们在等你</Text>
          <View className='city-unlock-page__empty-cta' onClick={() => refetch()}>
            <Text className='city-unlock-page__empty-cta-text'>重新加载</Text>
          </View>
        </View>
      </View>
    )
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  const primaryInterest = myInterests?.[0]
  const progress = currentCityProgress ?? primaryInterest?.progress

  // Empty state: no city selected
  if (!primaryInterest) {
    return (
      <View className='city-unlock-page'>
        <View className='city-unlock-page__empty'>
          <XiaoyueSpriteAnimator state='coach' size='200rpx' />
          <Text className='city-unlock-page__empty-title'>还没有选择城市</Text>
          <Text className='city-unlock-page__empty-subtitle'>去发现页选择你想解锁的城市吧</Text>
          <View className='city-unlock-page__empty-cta' onClick={handleBrowseShenzhen}>
            <Text className='city-unlock-page__empty-cta-text'>去发现页</Text>
          </View>
        </View>
      </View>
    )
  }

  const cityName = primaryInterest.city.replace('市', '')
  const progressPercent = progress?.progressPercent ?? 0
  const interestedCount = progress?.interestedCount ?? 0
  const targetThreshold = progress?.targetThreshold ?? 50
  const remaining = Math.max(0, targetThreshold - interestedCount)

  return (
    <View className='city-unlock-page'>
      <ScrollView className='city-unlock-page__scroll' scrollY enableFlex>
        {/* Mascot + Title */}
        <View className='city-unlock-page__hero'>
          <Image
            className='city-unlock-page__mascot'
            src={getXiaoyueExpressionAsset('cityUnlock')}
            mode='aspectFit'
            style={{ width: '240rpx', height: '240rpx' }}
          />
          <Text className='city-unlock-page__title'>我们正在朝{cityName}飞来 <JoyJoinIcon emoji='✈️' size={24} /></Text>
        </View>

        {/* Progress Bar */}
        <View className='city-unlock-page__progress-section'>
          <View className='city-unlock-page__progress-bar-bg'>
            <View
              className='city-unlock-page__progress-bar-fill'
              style={{ width: `${progressPercent}%` }}
            />
          </View>
          <View className='city-unlock-page__progress-stats'>
            <Text className='city-unlock-page__progress-number'>{interestedCount}</Text>
            <Text className='city-unlock-page__progress-label'>位小伙伴在等待</Text>
          </View>
          <Text className='city-unlock-page__progress-remaining'>
            还差 {remaining} 人即可解锁{cityName} <JoyJoinIcon emoji='🔓' size={24} />
          </Text>
        </View>

        {/* CTA Buttons */}
        <View className='city-unlock-page__actions'>
          <View
            className={`city-unlock-page__btn city-unlock-page__btn--primary ${shareAnimation ? 'city-unlock-page__btn--pulse' : ''}`}
            onClick={handleShare}
          >
            <JoyJoinIcon emoji='📣' size={24} className='city-unlock-page__btn-icon' />
            <Text className='city-unlock-page__btn-text'>邀请好友助力解锁</Text>
          </View>
          <View
            className='city-unlock-page__btn city-unlock-page__btn--secondary'
            onClick={handleBrowseShenzhen}
          >
            <JoyJoinIcon emoji='🎯' size={24} className='city-unlock-page__btn-icon' />
            <Text className='city-unlock-page__btn-text'>先逛逛深圳的活动</Text>
          </View>
        </View>

        {/* Activity Feed */}
        <View className='city-unlock-page__activity'>
          <Text className='city-unlock-page__activity-title'>最新动态</Text>
          <View className='city-unlock-page__activity-list'>
            <View className='city-unlock-page__activity-item'>
              <JoyJoinIcon emoji='🎉' tier='reaction' size={24} className='city-unlock-page__activity-dot' />
              <Text className='city-unlock-page__activity-text'>你 选择了{cityName}</Text>
            </View>
            {currentCityProgress && (
              <View className='city-unlock-page__activity-item'>
                <JoyJoinIcon emoji='📊' size={24} className='city-unlock-page__activity-dot' />
                <Text className='city-unlock-page__activity-text'>
                  {currentCityProgress.city.replace('市', '')}已有 {currentCityProgress.interestedCount} 人关注
                </Text>
              </View>
            )}
            <View className='city-unlock-page__activity-item'>
              <JoyJoinIcon emoji='✨' tier='reveal' size={24} className='city-unlock-page__activity-dot' />
              <Text className='city-unlock-page__activity-text'>目标：{targetThreshold} 人解锁</Text>
            </View>
          </View>
        </View>

        {/* Other Cities */}
        {otherCities.length > 0 && (
          <View className='city-unlock-page__other-cities'>
            <Text className='city-unlock-page__other-cities-title'>其他城市也在解锁中</Text>
            {otherCities.map((c) => (
              <View key={c.city} className='city-unlock-page__other-city'>
                <Text className='city-unlock-page__other-city-name'>{c.city.replace('市', '')}</Text>
                <View className='city-unlock-page__other-city-bar'>
                  <View
                    className='city-unlock-page__other-city-bar-fill'
                    style={{ width: `${c.progressPercent}%` }}
                  />
                </View>
                <Text className='city-unlock-page__other-city-count'>{c.interestedCount}人</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
