import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useArchiveDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import StatusCard from '../../../components/ui/StatusCard'
import './index.scss'

export default function AlangStoryDetailPage() {
  const { user } = useAuth()
  const archiveId = Taro.getCurrentInstance().router?.params?.archiveId ?? ''
  const { data: archive, isLoading } = useArchiveDetail(
    archiveId,
    !!archiveId && !!user?.features?.alangEnabled
  )

  useEffect(() => {
    if (archiveId) alangEvents.storyDetailView(archiveId)
  }, [archiveId])

  if (isLoading) {
    return (
      <View className='alang-story-detail__loading'>
        <Text>加载中…</Text>
      </View>
    )
  }

  if (!archive) {
    return (
      <StatusCard
        tone='error'
        title='故事未找到'
        description='可能已被删除或归档'
      />
    )
  }

  const dateStr = archive.completedAt
    ? new Date(archive.completedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <ScrollView className='alang-story-detail' scrollY>
      <View className='alang-story-detail__header'>
        <Text className='alang-story-detail__title'>{archive.title}</Text>
        <Text className='alang-story-detail__meta'>
          {dateStr} · {archive.locationName}
        </Text>
        {archive.isDebugSession && (
          <Text className='alang-story-detail__debug-badge'>调试记录</Text>
        )}
      </View>

      <View className='alang-story-detail__hero'>
        <Image
          className='alang-story-detail__hero-image'
          src='/assets/lovart/alang-result-placeholder.webp'
          mode='aspectFill'
        />
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>最终状态</Text>
        <Text className='alang-story-detail__mood'>{archive.finalMood}</Text>
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>你的选择</Text>
        {archive.choicesMade?.map((choice, idx) => (
          <View key={idx} className='alang-story-detail__choice'>
            <Text className='alang-story-detail__choice-label'>
              {idx + 1}. {choice.label}
            </Text>
          </View>
        ))}
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>陪伴片段</Text>
        {archive.companionLines?.map((line, idx) => (
          <Text key={idx} className='alang-story-detail__line'>
            {line}
          </Text>
        ))}
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>收束</Text>
        <Text className='alang-story-detail__closing'>{archive.closingLine}</Text>
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>总结</Text>
        <Text className='alang-story-detail__summary'>{archive.summaryLine}</Text>
      </View>
    </ScrollView>
  )
}
