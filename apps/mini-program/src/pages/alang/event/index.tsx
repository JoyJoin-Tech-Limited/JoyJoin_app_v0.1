import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useAlangMissions, useStoryArchives } from '../../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import StatusCard from '../../../components/ui/StatusCard'
import { useAuth } from '../../../hooks/useAuth'
import './index.scss'

type ArtworkKind = 'event' | 'story'

function NarrativeArtwork({ kind }: { kind: ArtworkKind }) {
  const artwork = useAlangAssetSource(kind === 'event' ? 'eventHero' : 'resultHero')
  return (
    <>
      <Image
        className='alang-event__card-image'
        src={artwork.src}
        mode='aspectFill'
        onError={artwork.onError}
        aria-hidden='true'
      />
      {artwork.usingFallback && (
        <Text className='alang-event__placeholder-label'>场景示意</Text>
      )}
    </>
  )
}

function formatStoryMoment(value: string): {
  dateLabel: string
  detailLabel: string
  periodTag: string
} {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: '某个夜晚', detailLabel: '时间留在故事里', periodTag: '城市相遇' }
  }
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const periodTag = hour < 6 ? '深夜' : hour < 12 ? '清晨' : hour < 18 ? '白天' : '夜晚'
  return {
    dateLabel: `${month}月${day}日`,
    detailLabel: `${month}月${day}日 · ${weekdays[date.getDay()]} · ${String(hour).padStart(2, '0')}:${minute}`,
    periodTag,
  }
}

function missionStatusCopy(status: string): { badge: string; action: string } {
  switch (status) {
    case 'in_progress':
      return { badge: '故事进行中', action: '继续上次的脚步' }
    case 'completed':
      return { badge: '已经收录', action: '重温这段故事' }
    default:
      return { badge: '今晚可出发', action: '看看是谁在等你' }
  }
}

export default function AlangEventPage() {
  const { user } = useAuth()
  const view = Taro.getCurrentInstance().router?.params?.view ?? ''
  const showStories = view === 'stories'
  const enabled = !!user?.features?.alangEnabled
  const {
    data: missions,
    isLoading,
    error,
    refetch: refetchMissions,
  } = useAlangMissions(enabled && !showStories)
  const {
    data: archives,
    isLoading: archivesLoading,
    error: archivesError,
    refetch: refetchArchives,
  } = useStoryArchives(enabled && showStories)

  useEffect(() => {
    if (missions && missions.length > 0) {
      alangEvents.discoverCardImpression()
    }
  }, [missions])

  const handleMissionTap = (slug: string) => {
    alangEvents.discoverCardTap()
    Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodeURIComponent(slug)}`,
    })
  }

  if (showStories) {
    if (archivesLoading) {
      return (
        <View className='alang-event__loading'>
          <Text className='alang-event__loading-text'>正在翻开你的故事…</Text>
        </View>
      )
    }

    if (archivesError) {
      return (
        <View className='alang-event__status-shell'>
          <StatusCard
            tone='error'
            title='故事档案暂时没有打开'
            description='网络恢复后，可以重新读取已经收录的章节。'
            action={{ label: '重新加载', onClick: () => { void refetchArchives() } }}
          />
        </View>
      )
    }

    if (!archives?.length) {
      return (
        <View className='alang-event__status-shell'>
          <StatusCard
            tone='empty'
            title='故事页还在等第一章'
            description='完成一次闪现后，走过的路和遇见的人会收录在这里。'
          />
        </View>
      )
    }

    return (
      <ScrollView className='alang-event alang-event--stories' scrollY>
        <View className='alang-event__header'>
          <Text className='alang-event__eyebrow'>CITY ARCHIVE</Text>
          <Text className='alang-event__title'>我的故事</Text>
          <Text className='alang-event__subtitle'>走过的路，会在这里留下章节。</Text>
        </View>
        <View className='alang-event__story-list'>
          {archives.map((archive) => {
            const moment = formatStoryMoment(archive.completedAt)
            const tags = [...new Set([moment.periodTag, archive.finalMood].filter(Boolean))]
            return (
              <View
                key={archive.id}
                className='alang-event__card alang-event__card--story'
                hoverClass='alang-event__card--pressed'
                onClick={() => Taro.navigateTo({
                  url: `${MINI_PROGRAM_ROUTES.alangStoryDetail}?archiveId=${encodeURIComponent(archive.id)}`,
                })}
                role='button'
                aria-label={`打开故事：${archive.title}`}
              >
                <View className='alang-event__card-visual alang-event__card-visual--story'>
                  <NarrativeArtwork kind='story' />
                  <View className='alang-event__story-date'>
                    <Text className='alang-event__story-date-text'>{moment.dateLabel}</Text>
                  </View>
                </View>
                <View className='alang-event__card-body alang-event__card-body--story'>
                  <View className='alang-event__story-meta'>
                    <Text className='alang-event__story-location'>{archive.locationName || '城市里的某处'}</Text>
                  </View>
                  <Text className='alang-event__card-title'>{archive.title}</Text>
                  <Text className='alang-event__story-moment'>{moment.detailLabel}</Text>
                  <View className='alang-event__story-tags'>
                    {tags.map((tag) => (
                      <Text key={tag} className='alang-event__story-mood'>{tag}</Text>
                    ))}
                  </View>
                  <Text className='alang-event__card-desc'>{archive.summaryLine}</Text>
                  <Text className='alang-event__card-action'>翻开这一章 ›</Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  if (isLoading) {
    return (
      <View className='alang-event__loading'>
        <Text className='alang-event__loading-text'>正在看看谁出现了…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className='alang-event__status-shell'>
        <StatusCard
          tone='error'
          title='今晚的闪现暂时没有打开'
          description='网络恢复后，可以重新看看谁正在城市里出现。'
          action={{ label: '重新加载', onClick: () => { void refetchMissions() } }}
        />
      </View>
    )
  }

  if (!missions?.length) {
    return (
      <View className='alang-event__status-shell'>
        <StatusCard
          tone='empty'
          title='今晚还没有角色现身'
          description='闪现仍在 Beta，新的城市片段准备好后会来这里和你见面。'
        />
      </View>
    )
  }

  return (
    <ScrollView className='alang-event' scrollY>
      <View className='alang-event__header'>
        <View className='alang-event__title-row'>
          <Text className='alang-event__title'>闪现</Text>
          <Text className='alang-event__beta'>Beta</Text>
        </View>
        <Text className='alang-event__subtitle'>附近的角色，会带来一段真实城市故事。</Text>
        <View className='alang-event__privacy-note'>
          <Text className='alang-event__privacy-note-dot'>●</Text>
          <Text className='alang-event__privacy-note-text'>精确位置会在你到达时揭晓</Text>
        </View>
      </View>
      <View className='alang-event__mission-list'>
        {missions.map((mission) => {
          const copy = missionStatusCopy(mission.status)
          return (
            <View
              key={mission.id}
              className='alang-event__card alang-event__card--mission'
              hoverClass='alang-event__card--pressed'
              onClick={() => handleMissionTap(mission.slug)}
              role='button'
              aria-label={`${copy.action}：${mission.title}`}
            >
              <View className='alang-event__card-visual'>
                <NarrativeArtwork kind='event' />
                <View className='alang-event__card-image-wash' />
                <View className='alang-event__card-overlay'>
                  <Text className='alang-event__card-status'>{copy.badge}</Text>
                </View>
              </View>
              <View className='alang-event__card-body'>
                <Text className='alang-event__card-kicker'>一段正在发生的城市片段</Text>
                <Text className='alang-event__card-title'>{mission.title}</Text>
                <Text className='alang-event__card-desc'>{mission.description}</Text>
                {mission.status === 'in_progress' && (
                  <View className='alang-event__card-progress' aria-label={`故事进度 ${mission.progressPercent}%`}>
                    <View
                      className='alang-event__card-progress-bar'
                      style={{ transform: `scaleX(${Math.max(0, Math.min(100, mission.progressPercent)) / 100})` }}
                    />
                  </View>
                )}
                <Text className='alang-event__card-action'>{copy.action} ›</Text>
              </View>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
