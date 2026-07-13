import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useAlangMissions, useStoryArchives } from '../../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import StatusCard from '../../../components/ui/StatusCard'
import { useAuth } from '../../../hooks/useAuth'
import './index.scss'

export default function AlangEventPage() {
  const { user } = useAuth()
  const view = Taro.getCurrentInstance().router?.params?.view ?? ''
  const showStories = view === 'stories'
  const enabled = !!user?.features?.alangEnabled
  const { data: missions, isLoading, error } = useAlangMissions(enabled && !showStories)
  const {
    data: archives,
    isLoading: archivesLoading,
    error: archivesError,
  } = useStoryArchives(enabled && showStories)

  useEffect(() => {
    if (missions && missions.length > 0) {
      alangEvents.discoverCardImpression()
    }
  }, [missions])

  const handleMissionTap = (slug: string) => {
    alangEvents.discoverCardTap()
    Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${slug}` })
  }

  if (showStories) {
    if (archivesLoading) {
      return (
        <View className='alang-event__loading'>
          <Text className='alang-event__loading-text'>加载中…</Text>
        </View>
      )
    }

    if (archivesError || !archives?.length) {
      return (
        <StatusCard
          tone='empty'
          title='还没有收录故事'
          description='完成一次闪现 NPC 体验后，故事会保存在这里。'
        />
      )
    }

    return (
      <ScrollView className='alang-event' scrollY>
        <View className='alang-event__header'>
          <Text className='alang-event__title'>我的故事</Text>
          <Text className='alang-event__subtitle'>已收录的阿浪片段</Text>
        </View>
        {archives.map((archive) => (
          <View
            key={archive.id}
            className='alang-event__card'
            hoverClass='alang-event__card--pressed'
            onClick={() => Taro.navigateTo({
              url: `${MINI_PROGRAM_ROUTES.alangStoryDetail}?archiveId=${archive.id}`,
            })}
          >
            <View className='alang-event__card-visual'>
              <Image
                className='alang-event__card-image'
                src='/assets/lovart/alang-result-placeholder.webp'
                mode='aspectFill'
              />
            </View>
            <View className='alang-event__card-body'>
              <Text className='alang-event__card-title'>{archive.title}</Text>
              <Text className='alang-event__card-desc'>{archive.summaryLine}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    )
  }

  if (isLoading) {
    return (
      <View className='alang-event__loading'>
        <Text className='alang-event__loading-text'>加载中…</Text>
      </View>
    )
  }

  if (error || !missions?.length) {
    return (
      <StatusCard
        tone='empty'
        title='暂无阿浪事件'
        description='内部测试内容尚未开放'
      />
    )
  }

  return (
    <ScrollView className='alang-event' scrollY>
      <View className='alang-event__header'>
        <Text className='alang-event__title'>闪现 NPC</Text>
        <Text className='alang-event__subtitle'>阿浪内部 Prototype</Text>
      </View>
      {missions.map((m) => (
        <View
          key={m.id}
          className='alang-event__card'
          onClick={() => handleMissionTap(m.slug)}
        >
          <View className='alang-event__card-visual'>
            <Image
              className='alang-event__card-image'
              src='/assets/lovart/alang-event-card-placeholder.webp'
              mode='aspectFill'
            />
            <View className='alang-event__card-overlay'>
              <Text className='alang-event__card-status'>
                {m.status === 'in_progress' ? '进行中' : m.status === 'completed' ? '已完成' : '未开始'}
              </Text>
            </View>
          </View>
          <View className='alang-event__card-body'>
            <Text className='alang-event__card-title'>{m.title}</Text>
            <Text className='alang-event__card-desc'>{m.description}</Text>
            {m.status === 'in_progress' && (
              <View className='alang-event__card-progress'>
                <View
                  className='alang-event__card-progress-bar'
                  style={{ width: `${m.progressPercent}%` }}
                />
              </View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
