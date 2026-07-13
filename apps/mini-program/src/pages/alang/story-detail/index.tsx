import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useArchiveDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import StatusCard from '../../../components/ui/StatusCard'
import './index.scss'

export default function AlangStoryDetailPage() {
  const { user } = useAuth()
  const archiveId = Taro.getCurrentInstance().router?.params?.archiveId ?? ''
  const resultHero = useAlangAssetSource('resultHero')
  const { data: archive, isLoading, isError, refetch } = useArchiveDetail(
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

  if (isError) {
    return (
      <View className='alang-story-detail__status-shell'>
        <StatusCard
          tone='error'
          title='故事暂时没加载出来'
          description='网络恢复后，可以重新读取这段已收录的故事'
          action={{ label: '重新加载', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  if (!archive) {
    return (
      <View className='alang-story-detail__status-shell'>
        <StatusCard
          tone='error'
          title='故事未找到'
          description='这段故事可能已经不存在，可以返回「我的故事」查看其他记录'
        />
      </View>
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
          src={resultHero.src}
          mode='aspectFill'
          onError={resultHero.onError}
        />
        {resultHero.usingFallback && (
          <Text className='alang-story-detail__placeholder-label'>故事场景示意</Text>
        )}
      </View>

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>最终状态</Text>
        <Text className='alang-story-detail__mood'>{archive.finalMood}</Text>
      </View>

      {!!archive.choicesMade?.length && (
        <View className='alang-story-detail__section'>
          <Text className='alang-story-detail__section-title'>你的选择</Text>
          {archive.choicesMade.map((choice, idx) => (
            <View key={`${choice.nodeId}-${idx}`} className='alang-story-detail__choice'>
              <Text className='alang-story-detail__choice-label'>
                {idx + 1}. {choice.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!!archive.companionLines?.length && (
        <View className='alang-story-detail__section'>
          <Text className='alang-story-detail__section-title'>陪伴片段</Text>
          {archive.companionLines.map((line, idx) => (
            <Text key={`${line}-${idx}`} className='alang-story-detail__line'>
              {line}
            </Text>
          ))}
        </View>
      )}

      {archive.closingLine && (
        <View className='alang-story-detail__section'>
          <Text className='alang-story-detail__section-title'>收束</Text>
          <Text className='alang-story-detail__closing'>{archive.closingLine}</Text>
        </View>
      )}

      <View className='alang-story-detail__section'>
        <Text className='alang-story-detail__section-title'>总结</Text>
        <Text className='alang-story-detail__summary'>{archive.summaryLine}</Text>
      </View>
    </ScrollView>
  )
}
