import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useAlangMissionDetail, useCompleteMission, useStoryArchives } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { callReportProgress } from '../../../lib/alang/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import StatusCard from '../../../components/ui/StatusCard'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import { haptics } from '../../../lib/utils/haptics'
import './index.scss'

export default function AlangResultPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)
  const {
    data: archives,
    refetch: refetchArchives,
  } = useStoryArchives(!!slug && !!user?.features?.alangEnabled)
  const completeMutation = useCompleteMission()
  const resultHero = useAlangAssetSource('resultHero')
  const [completed, setCompleted] = useState(false)
  const [archiveId, setArchiveId] = useState('')
  const closingAdvanceRef = useRef(false)
  const navigationKeyRef = useRef('')

  const progress = mission?.myProgress

  useDidShow(() => {
    if (!slug) return
    void Promise.all([refetch(), refetchArchives()])
  })

  // Recover archive identity from the mission response first. The archive list
  // remains a compatibility fallback for older server responses.
  useEffect(() => {
    if (progress?.status !== 'completed') return
    const recoveredArchiveId = progress.archiveId
      ?? archives?.find((archive) => archive.missionId === mission?.id)?.id
    if (recoveredArchiveId) {
      setArchiveId(recoveredArchiveId)
    }
    setCompleted(true)
  }, [progress?.archiveId, progress?.status, archives, mission?.id])

  useEffect(() => {
    if (slug) alangEvents.resultPageView(slug)
  }, [slug])

  const content = mission?.content as any
  const nodes: Array<any> = content?.nodes ?? []

  useEffect(() => {
    if (!progress || ['closing', 'result', 'completed'].includes(progress.stage)) return
    const key = `${progress.progressId}:${progress.stage}:${progress.currentNodeId}`
    if (navigationKeyRef.current === key) return
    const encodedSlug = encodeURIComponent(slug)
    const encodedNode = encodeURIComponent(progress.currentNodeId)
    const url = progress.stage === 'searching'
      ? `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${encodedSlug}&nodeId=${encodedNode}`
      : ['found', 'dialogue'].includes(progress.stage)
        ? `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${encodedSlug}&nodeId=${encodedNode}`
        : ['companion', 'arrived'].includes(progress.stage)
          ? `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${encodedSlug}&nodeId=${encodedNode}`
          : `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodedSlug}`
    navigationKeyRef.current = key
    void Taro.redirectTo({ url }).catch(() => {
      navigationKeyRef.current = ''
    })
  }, [progress, slug])

  useEffect(() => {
    if (closingAdvanceRef.current || progress?.stage !== 'closing') return
    const currentNode = nodes.find((node: any) => node.id === progress.currentNodeId)
    if (!currentNode?.nextNodeId) return
    const nextNode = nodes.find((node: any) => node.id === currentNode.nextNodeId)
    if (nextNode?.type !== 'result_card') return

    closingAdvanceRef.current = true
    callReportProgress(slug, nextNode.id)
      .then(() => refetch())
      .catch(() => {
        closingAdvanceRef.current = false
        Taro.showToast({ title: '结果同步遇到小状况', icon: 'none' })
      })
  }, [nodes, progress?.currentNodeId, progress?.stage, refetch, slug])

  // Find result card node from history
  const currentResultNode = nodes.find((node: any) => (
    node.id === progress?.currentNodeId && node.type === 'result_card'
  ))
  const resultNodeId = progress?.nodeHistory?.find((id: string) => {
    const n = nodes.find((node: any) => node.id === id)
    return n?.type === 'result_card'
  })
  const resultNode = currentResultNode ?? nodes.find((n: any) => n.id === resultNodeId)
  const resultContent = resultNode?.content ?? {}

  const handleComplete = async () => {
    if (!slug || completed || completeMutation.isPending) return
    alangEvents.resultConfirmTap(slug)
    try {
      const res = await completeMutation.mutateAsync(slug)
      setArchiveId(res.archiveId)
      setCompleted(true)
      haptics('success')
    } catch {
      Taro.showToast({ title: '没成功，再点一次即可', icon: 'none' })
    }
  }

  const handleGoDiscover = () => {
    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
  }

  const handleViewStory = () => {
    if (archiveId) {
      Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangStoryDetail}?archiveId=${archiveId}` })
    }
  }

  const handleRefreshArchive = () => {
    void Promise.all([refetch(), refetchArchives()])
  }

  if (isLoading) {
    return (
      <View className='alang-result__loading'>
        <Text>加载中…</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <View className='alang-result__status-shell'>
        <StatusCard
          tone='error'
          title='结果暂时没加载出来'
          description='网络恢复后可以再试一次'
          action={{ label: '重新加载', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  if (completed) {
    return (
      <View className='alang-result__completed'>
        <Text className='alang-result__completed-title'>故事已收录</Text>
        <Text className='alang-result__completed-sub'>你可以在「我的故事」中回看这段经历</Text>
        <View className='alang-result__completed-actions'>
          <View
            className='alang-result__completed-btn'
            onClick={archiveId ? handleViewStory : handleRefreshArchive}
            hoverClass='alang-result__completed-btn--pressed'
            role='button'
            aria-label={archiveId ? '查看已收录故事' : '同步故事记录'}
          >
            <Text className='alang-result__completed-btn-text'>
              {archiveId ? '查看故事' : '同步故事记录'}
            </Text>
          </View>
          <View
            className='alang-result__completed-btn alang-result__completed-btn--secondary'
            onClick={handleGoDiscover}
            hoverClass='alang-result__completed-btn--pressed'
            role='button'
            aria-label='返回发现'
          >
            <Text className='alang-result__completed-btn-text'>返回发现</Text>
          </View>
        </View>
      </View>
    )
  }

  const stableMoment = progress?.arrivedAt ?? progress?.completedAt
  const stableDate = stableMoment ? new Date(stableMoment) : null
  const dateStr = stableDate && !Number.isNaN(stableDate.getTime())
    ? stableDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : (resultContent.dateLabel ?? '这次相遇')

  return (
    <ScrollView className='alang-result' scrollY>
      <View className='alang-result__card'>
        <View className='alang-result__card-header'>
          <Text className='alang-result__card-date'>{dateStr}</Text>
          <Text className='alang-result__card-location'>{resultContent.locationLabel ?? '某个角落'}</Text>
        </View>
        <View className='alang-result__card-visual'>
          <Image
            className='alang-result__card-image'
            src={resultHero.src}
            mode='aspectFill'
            onError={resultHero.onError}
          />
          {resultHero.usingFallback && (
            <Text className='alang-result__placeholder-label'>结果场景示意</Text>
          )}
        </View>
        <View className='alang-result__card-body'>
          <Text className='alang-result__card-mood'>
            {resultContent.finalMood ?? '平静'}
          </Text>
          <Text className='alang-result__card-summary'>
            {resultContent.summaryLine ?? '你们一起走过了一段路。'}
          </Text>
          {resultContent.companionStyle && (
            <Text className='alang-result__card-style'>
              你用「{resultContent.companionStyle}」陪他走完了这一段。
            </Text>
          )}
        </View>
      </View>

      <View className='alang-result__actions'>
        <View
          className={`alang-result__cta${completeMutation.isPending ? ' alang-result__cta--disabled' : ''}`}
          onClick={handleComplete}
          hoverClass={completeMutation.isPending ? '' : 'alang-result__cta--pressed'}
          role='button'
          aria-label={completeMutation.isPending ? '正在收录故事' : '收录故事'}
          aria-disabled={completeMutation.isPending}
        >
          <Text className='alang-result__cta-text'>
            {completeMutation.isPending ? '正在收录…' : '收录故事'}
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}
