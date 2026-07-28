import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/ui/Button'
import StatusCard from '../../../components/ui/StatusCard'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { usePageTTI } from '../../../hooks/usePageTTI'
import { haptics } from '../../../lib/utils/haptics'
import {
  PERSONAL_STORY_POLL_INTERVAL_MS,
  PERSONAL_STORY_QUERY_KEY,
  fetchPersonalStory,
  isPersonalStoryUpdatePending,
  requestPersonalStoryUpdate,
  type PersonalStoryDocument,
  type PersonalStoryResponse,
} from './api'
import {
  formatPersonalStoryChapterDate,
  formatPersonalStoryUpdatedAt,
  getPersonalStoryPreview,
  mergePersonalStory,
  splitPersonalStoryBody,
} from './storyModel'
import './index.scss'

const DEFAULT_STORY_TITLE = '你的故事，正在慢慢长大'
const DEFAULT_STORY_SUBTITLE = '每次真实出发，都会在这里变成同一部只属于你的连续小说。'

export default function PersonalStoryPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuthGuard()
  const queryClient = useQueryClient()
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null)
  const [coverFailed, setCoverFailed] = useState(false)
  const [updateFailed, setUpdateFailed] = useState(false)
  const readableStoryRef = useRef<PersonalStoryDocument | null>(null)
  const readableStoryOwnerRef = useRef<string | null>(null)
  const viewerKey = user?.id ?? 'authenticated-user'
  const storyQueryKey = [...PERSONAL_STORY_QUERY_KEY, viewerKey] as const

  if (readableStoryOwnerRef.current !== viewerKey) {
    readableStoryOwnerRef.current = viewerKey
    readableStoryRef.current = null
  }

  const storyQuery = useQuery<PersonalStoryResponse>({
    queryKey: storyQueryKey,
    queryFn: () => fetchPersonalStory(),
    enabled: !authLoading && isAuthenticated,
    staleTime: 15_000,
    retry: 1,
    refetchInterval: (query) => (
      isPersonalStoryUpdatePending(query.state.data?.updateJob?.status)
        ? PERSONAL_STORY_POLL_INTERVAL_MS
        : false
    ),
  })

  useDidShow(() => {
    if (!authLoading && isAuthenticated) {
      void queryClient.invalidateQueries({ queryKey: PERSONAL_STORY_QUERY_KEY })
    }
  })

  const updateMutation = useMutation({
    mutationFn: () => requestPersonalStoryUpdate(),
    onSuccess: async (response) => {
      setUpdateFailed(false)
      queryClient.setQueryData<PersonalStoryResponse>(storyQueryKey, (current) => ({
        story: mergePersonalStory(current?.story ?? null, response.story),
        updateJob: response.updateJob ?? current?.updateJob ?? null,
        aiEnabled: current?.aiEnabled ?? true,
        canUpdate: current?.canUpdate ?? true,
      }))
      await queryClient.invalidateQueries({ queryKey: storyQueryKey })
      Taro.showToast({
        title: response.noNewExperiences
          ? '最近的故事都已经写进来了'
          : '新的一章正在写到故事最后',
        icon: 'none',
        duration: 2200,
      })
    },
    onError: () => {
      setUpdateFailed(true)
      Taro.showToast({
        title: '这次没更新成功，旧章节都还在',
        icon: 'none',
        duration: 2600,
      })
    },
  })

  const responseStory = storyQuery.data?.story
  if (responseStory) {
    readableStoryRef.current = mergePersonalStory(readableStoryRef.current, responseStory)
  }
  const story = readableStoryRef.current
  const chapters = story?.chapters ?? []
  const updateStatus = storyQuery.data?.updateJob?.status
  const updateInProgress = updateMutation.isPending || isPersonalStoryUpdatePending(updateStatus)
  const updateUnavailable = storyQuery.data?.aiEnabled === false
    || storyQuery.data?.canUpdate === false
    || updateStatus === 'disabled'
  const serverUpdateFailed = updateStatus === 'failed'
  const coverImageUrl = story?.coverImageUrl?.trim() || ''

  useEffect(() => {
    setCoverFailed(false)
  }, [coverImageUrl])

  useEffect(() => {
    setExpandedChapterId(null)
    setUpdateFailed(false)
  }, [viewerKey])

  usePageTTI({
    pageName: 'personal-story',
    ready: !authLoading && !storyQuery.isLoading,
  })

  const handleUpdate = () => {
    if (updateInProgress || updateUnavailable) return
    haptics('light')
    setUpdateFailed(false)
    updateMutation.mutate()
  }

  const handleChapterToggle = (chapterId: string) => {
    haptics('light')
    setExpandedChapterId((current) => current === chapterId ? null : chapterId)
  }

  if (authLoading || storyQuery.isLoading) {
    return <LoadingScreen message='正在翻开只属于你的故事…' />
  }

  if (storyQuery.isError && !story) {
    return (
      <View className='personal-story personal-story--status'>
        <StatusCard
          tone='error'
          title='故事页暂时没有翻开'
          description='网络恢复后，可以重新读取已经写下的章节。'
          action={{
            label: '重新翻开',
            onClick: () => { void storyQuery.refetch() },
          }}
        />
      </View>
    )
  }

  const updateHint = updateInProgress
    ? '悦仲正在整理这段真实经历，你可以先读以前的章节。'
    : updateFailed || serverUpdateFailed
      ? '旧章节都好好留着。准备好时，可以再试一次更新。'
      : updateUnavailable
        ? '旧章节会一直留在这里，故事更新开放后再继续写。'
        : '有了新的真实经历，就把它写成故事的下一章。'

  return (
    <ScrollView
      className='personal-story'
      scrollY
      enhanced
      showScrollbar={false}
    >
      <View className='personal-story__content'>
        <View
          className='personal-story__cover'
          role='region'
          aria-label={`个人连续故事：${story?.title || DEFAULT_STORY_TITLE}`}
        >
          {coverImageUrl && !coverFailed ? (
            <Image
              className='personal-story__cover-image'
              src={coverImageUrl}
              mode='aspectFill'
              aria-hidden='true'
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <View className='personal-story__cover-art' aria-hidden='true'>
              <View className='personal-story__star personal-story__star--one' />
              <View className='personal-story__star personal-story__star--two' />
              <View className='personal-story__star personal-story__star--three' />
              <View className='personal-story__book'>
                <View className='personal-story__book-page personal-story__book-page--left' />
                <View className='personal-story__book-spine' />
                <View className='personal-story__book-page personal-story__book-page--right' />
              </View>
            </View>
          )}
          <View className='personal-story__cover-shade' />
          <View className='personal-story__cover-copy'>
            <Text className='personal-story__eyebrow'>你的连续故事</Text>
            <Text className='personal-story__title'>{story?.title || DEFAULT_STORY_TITLE}</Text>
            <Text className='personal-story__subtitle'>{story?.subtitle || DEFAULT_STORY_SUBTITLE}</Text>
            <Text className='personal-story__updated-at'>
              {formatPersonalStoryUpdatedAt(story?.updatedAt)}
            </Text>
          </View>
        </View>

        <View className='personal-story__update-area'>
          <Button
            variant='brand'
            className='personal-story__update-button'
            onClick={handleUpdate}
            disabled={updateUnavailable}
            loading={updateInProgress}
            aria-label={updateInProgress ? '故事正在更新' : updateUnavailable ? '故事更新暂不可用' : '把新经历写成下一章'}
          >
            把新经历写成下一章
          </Button>
          <Text className='personal-story__update-hint' aria-live='polite'>{updateHint}</Text>
        </View>

        {chapters.length > 0 ? (
          <View className='personal-story__timeline' role='list' aria-label='个人故事章节，从最早到最近'>
            {chapters.map((chapter, index) => {
              const expanded = expandedChapterId === chapter.id
              const chapterPanelId = `personal-story-chapter-${index}`
              const chapterTitleId = `personal-story-chapter-title-${index}`
              return (
                <View key={chapter.id} className='personal-story__timeline-item' role='listitem'>
                  <View className='personal-story__timeline-dot' aria-hidden='true' />
                  <View className={`personal-story__chapter${expanded ? ' personal-story__chapter--expanded' : ''}`}>
                    <Text className='personal-story__chapter-meta'>
                      {formatPersonalStoryChapterDate(chapter.occurredAt)} · {chapter.activityType}
                    </Text>
                    <AIGCLabel meta={chapter.aigc} className='personal-story__aigc-label' />
                    <Text id={chapterTitleId} className='personal-story__chapter-title'>{chapter.title}</Text>
                    <Text className='personal-story__chapter-preview'>{getPersonalStoryPreview(chapter)}</Text>
                    <View
                      className='personal-story__chapter-action'
                      hoverClass='personal-story__chapter-action--pressed'
                      onClick={() => handleChapterToggle(chapter.id)}
                      role='button'
                      aria-label={`${expanded ? '收起' : '阅读完整'}章节：${chapter.title}`}
                      aria-expanded={expanded}
                      aria-controls={chapterPanelId}
                    >
                      <Text className='personal-story__chapter-action-text'>
                        {expanded ? '收起这一章' : '读完整章节'}
                      </Text>
                      <View className={`personal-story__chapter-chevron${expanded ? ' personal-story__chapter-chevron--up' : ''}`} aria-hidden='true' />
                    </View>
                    {expanded && (
                      <View
                        id={chapterPanelId}
                        className='personal-story__chapter-body'
                        role='region'
                        aria-labelledby={chapterTitleId}
                      >
                        {splitPersonalStoryBody(chapter.body).map((paragraph, paragraphIndex) => (
                          <Text key={`${chapter.id}-${paragraphIndex}`} className='personal-story__chapter-paragraph' userSelect>
                            {paragraph}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className='personal-story__empty' role='status' aria-live='polite'>
            <Text className='personal-story__empty-title'>故事的第一页还留着空白</Text>
            <Text className='personal-story__empty-copy'>
              下一次真实出发后，你经历过的人和事会从这里开始连成一部小说。
            </Text>
          </View>
        )}

        <Text className='personal-story__footer'>旧章节不会被新故事覆盖，每一次相遇都留在原来的位置。</Text>
      </View>
    </ScrollView>
  )
}
