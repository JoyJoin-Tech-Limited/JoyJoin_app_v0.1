import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useAlangMissions, useStoryArchives } from '../../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import StatusCard from '../../../components/ui/StatusCard'
import { useAuth } from '../../../hooks/useAuth'
import { haptics } from '../../../lib/utils/haptics'
import './index.scss'

type ArtworkKind = 'event' | 'story'
type StoryTab = 'all' | 'continuing'

function NarrativeArtwork({
  kind,
  placeholderLabel = '场景示意',
}: {
  kind: ArtworkKind
  placeholderLabel?: string
}) {
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
        <Text className='alang-event__placeholder-label'>{placeholderLabel}</Text>
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

function missionStageTag(stage: string): string {
  switch (stage) {
    case 'searching':
      return '寻找中'
    case 'found':
    case 'dialogue':
      return '对话中'
    case 'companion':
    case 'arrived':
      return '同行中'
    case 'closing':
    case 'result':
      return '待收录'
    default:
      return '进行中'
  }
}

export default function AlangEventPage() {
  const { user } = useAuth()
  const view = Taro.getCurrentInstance().router?.params?.view ?? ''
  const showStories = view === 'stories'
  const [storyTab, setStoryTab] = useState<StoryTab>('all')
  const enabled = !!user?.features?.alangEnabled
  const {
    data: missions,
    isLoading: missionsLoading,
    error: missionsError,
    refetch: refetchMissions,
  } = useAlangMissions(enabled)
  const {
    data: archives,
    isLoading: archivesLoading,
    error: archivesError,
    refetch: refetchArchives,
  } = useStoryArchives(enabled && showStories)

  const inProgressMissions = useMemo(
    () => (missions ?? []).filter(({ status }) => status === 'in_progress'),
    [missions],
  )
  const uniqueLocationCount = useMemo(() => {
    const locations = (archives ?? [])
      .map(({ locationName }) => locationName?.trim())
      .filter((location): location is string => Boolean(location))
    return new Set(locations).size
  }, [archives])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: showStories ? '我的故事' : '闪现' })
  }, [showStories])

  useEffect(() => {
    if (!showStories && missions && missions.length > 0) {
      alangEvents.discoverCardImpression()
    }
  }, [missions, showStories])

  const handleMissionTap = (slug: string) => {
    haptics('light')
    alangEvents.discoverCardTap()
    void Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodeURIComponent(slug)}`,
    })
  }

  const handleArchiveTap = (archiveId: string) => {
    haptics('light')
    void Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.alangStoryDetail}?archiveId=${encodeURIComponent(archiveId)}`,
    })
  }

  const handleStoryTabChange = (nextTab: StoryTab) => {
    if (nextTab === storyTab) return
    haptics('light')
    setStoryTab(nextTab)
  }

  const handleOpenAvailableStories = () => {
    haptics('light')
    void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
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

    return (
      <ScrollView className='alang-event alang-event--stories' scrollY>
        <View
          className='alang-event__story-summary'
          role='region'
          aria-label={`${archives?.length ?? 0} 段故事收藏，${missionsLoading ? '进行中故事读取中' : `${inProgressMissions.length} 条仍在继续`}，${uniqueLocationCount} 个故事地点`}
        >
          <View className='alang-event__story-summary-copy'>
            <View className='alang-event__story-summary-stat'>
              <Text className='alang-event__story-summary-value'>{archives?.length ?? 0}</Text>
              <Text className='alang-event__story-summary-label'>段故事收藏</Text>
            </View>
            <View className='alang-event__story-summary-stat'>
              <Text className='alang-event__story-summary-value'>
                {missionsLoading ? '—' : inProgressMissions.length}
              </Text>
              <Text className='alang-event__story-summary-label'>条仍在继续</Text>
            </View>
            <View className='alang-event__story-summary-stat'>
              <Text className='alang-event__story-summary-value'>{uniqueLocationCount}</Text>
              <Text className='alang-event__story-summary-label'>个故事地点</Text>
            </View>
          </View>
          <View className='alang-event__story-summary-art' aria-hidden='true'>
            <NarrativeArtwork kind='story' placeholderLabel='故事总览场景示意' />
            <View className='alang-event__story-summary-wash' />
          </View>
        </View>

        <View className='alang-event__story-tabs' role='tablist' aria-label='故事筛选'>
          <View
            className={`alang-event__story-tab${storyTab === 'all' ? ' alang-event__story-tab--active' : ''}`}
            hoverClass='alang-event__story-tab--pressed'
            onClick={() => handleStoryTabChange('all')}
            role='tab'
            aria-selected={storyTab === 'all'}
            aria-label='查看全部故事'
          >
            <Text className='alang-event__story-tab-text'>全部故事</Text>
          </View>
          <View
            className={`alang-event__story-tab${storyTab === 'continuing' ? ' alang-event__story-tab--active' : ''}`}
            hoverClass='alang-event__story-tab--pressed'
            onClick={() => handleStoryTabChange('continuing')}
            role='tab'
            aria-selected={storyTab === 'continuing'}
            aria-label='查看继续中的故事'
          >
            <Text className='alang-event__story-tab-text'>继续中的故事</Text>
          </View>
        </View>

        {storyTab === 'all' && (
          archives?.length ? (
            <View className='alang-event__story-feed' role='list' aria-label='已收录故事'>
              {archives.map((archive) => {
                const moment = formatStoryMoment(archive.completedAt)
                const tags = [...new Set([moment.periodTag, archive.finalMood].filter(Boolean))].slice(0, 2)
                const locationName = archive.locationName?.trim() || '城市里的某处'
                return (
                  <View key={archive.id} className='alang-event__story-feed-item' role='listitem'>
                    <View className='alang-event__story-timeline-dot' aria-hidden='true' />
                    <View
                      className='alang-event__card alang-event__card--story'
                      hoverClass='alang-event__card--pressed'
                      onClick={() => handleArchiveTap(archive.id)}
                      role='button'
                      aria-label={`打开故事：${archive.title}，${locationName}，${moment.detailLabel}`}
                    >
                      <View className='alang-event__card-visual alang-event__card-visual--story'>
                        <NarrativeArtwork kind='story' placeholderLabel='故事场景示意' />
                      </View>
                      <View className='alang-event__card-body alang-event__card-body--story'>
                        <Text className='alang-event__card-title'>{archive.title}</Text>
                        <Text className='alang-event__story-location'>地点 · {locationName}</Text>
                        <Text className='alang-event__story-moment'>时间 · {moment.detailLabel}</Text>
                        <View className='alang-event__story-tags'>
                          {tags.map((tag) => (
                            <Text key={tag} className='alang-event__story-mood'>{tag}</Text>
                          ))}
                        </View>
                      </View>
                      <View className='alang-event__story-chevron' aria-hidden='true' />
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className='alang-event__story-inline-state' role='status' aria-live='polite'>
              <Text className='alang-event__story-inline-title'>故事页还在等第一章</Text>
              <Text className='alang-event__story-inline-copy'>完成一次闪现后，走过的路和遇见的人会收录在这里。</Text>
              <View
                className='alang-event__story-inline-action'
                hoverClass='alang-event__story-inline-action--pressed'
                onClick={handleOpenAvailableStories}
                role='button'
                aria-label='去看看当前可开始的闪现故事'
              >
                <Text className='alang-event__story-inline-action-text'>去看看谁出现了</Text>
              </View>
            </View>
          )
        )}

        {storyTab === 'continuing' && (
          missionsLoading ? (
            <View className='alang-event__story-inline-state' role='status' aria-live='polite'>
              <Text className='alang-event__story-inline-title'>正在找回继续中的故事…</Text>
              <Text className='alang-event__story-inline-copy'>已经走过的进度会从服务端恢复。</Text>
            </View>
          ) : missionsError ? (
            <View className='alang-event__story-inline-state' role='alert'>
              <Text className='alang-event__story-inline-title'>继续中的故事暂时没读到</Text>
              <Text className='alang-event__story-inline-copy'>网络恢复后，可以从上次停下的地方接着走。</Text>
              <View
                className='alang-event__story-inline-action'
                hoverClass='alang-event__story-inline-action--pressed'
                onClick={() => { haptics('light'); void refetchMissions() }}
                role='button'
                aria-label='重新读取继续中的故事'
              >
                <Text className='alang-event__story-inline-action-text'>重新读取</Text>
              </View>
            </View>
          ) : inProgressMissions.length ? (
            <View className='alang-event__story-feed' role='list' aria-label='继续中的故事'>
              {inProgressMissions.map((mission) => {
                const progressPercent = Math.max(0, Math.min(100, Math.round(mission.progressPercent)))
                return (
                  <View key={mission.id} className='alang-event__story-feed-item' role='listitem'>
                    <View className='alang-event__story-timeline-dot alang-event__story-timeline-dot--continuing' aria-hidden='true' />
                    <View
                      className='alang-event__card alang-event__card--story alang-event__card--continuing'
                      hoverClass='alang-event__card--pressed'
                      onClick={() => handleMissionTap(mission.slug)}
                      role='button'
                      aria-label={`继续故事：${mission.title}，当前进度 ${progressPercent}%`}
                    >
                      <View className='alang-event__card-visual alang-event__card-visual--story'>
                        <NarrativeArtwork kind='event' placeholderLabel='故事场景示意' />
                      </View>
                      <View className='alang-event__card-body alang-event__card-body--story'>
                        <Text className='alang-event__card-title'>{mission.title}</Text>
                        <Text className='alang-event__story-location'>地点 · 精确位置会在到达时揭晓</Text>
                        <Text className='alang-event__story-moment'>进度 · 已走完 {progressPercent}%</Text>
                        <View className='alang-event__story-tags'>
                          <Text className='alang-event__story-mood'>继续中</Text>
                          <Text className='alang-event__story-mood'>{missionStageTag(mission.stage)}</Text>
                        </View>
                      </View>
                      <View className='alang-event__story-chevron' aria-hidden='true' />
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className='alang-event__story-inline-state' role='status' aria-live='polite'>
              <Text className='alang-event__story-inline-title'>没有停在半路的故事</Text>
              <Text className='alang-event__story-inline-copy'>下一次闪现开始后，你可以随时从这里接着走。</Text>
            </View>
          )
        )}

        <Text className='alang-event__story-footer'>每段故事，都是记忆留下的一点光。</Text>
      </ScrollView>
    )
  }

  if (missionsLoading) {
    return (
      <View className='alang-event__loading'>
        <Text className='alang-event__loading-text'>正在看看谁出现了…</Text>
      </View>
    )
  }

  if (missionsError) {
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
