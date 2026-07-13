import Taro from '@tarojs/taro'
import { useEffect, useState, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useAlangMissionDetail, useCompleteMission, useStoryArchives } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { callReportProgress } from '../../../lib/alang/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import StatusCard from '../../../components/ui/StatusCard'
import './index.scss'

export default function AlangResultPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)
  const { data: archives } = useStoryArchives(!!slug && !!user?.features?.alangEnabled)
  const completeMutation = useCompleteMission()
  const [completed, setCompleted] = useState(false)
  const [archiveId, setArchiveId] = useState('')
  const closingAdvanceRef = useRef(false)

  const progress = mission?.myProgress

  // Auto-detect already completed from server state
  useEffect(() => {
    if (progress?.status === 'completed' && archives) {
      const matched = archives.find((a) => a.missionId === mission?.id)
      if (matched) {
        setArchiveId(matched.id)
        setCompleted(true)
      }
    }
  }, [progress?.status, archives, mission?.id])

  useEffect(() => {
    if (slug) alangEvents.resultPageView(slug)
  }, [slug])

  const content = mission?.content as any
  const nodes: Array<any> = content?.nodes ?? []

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
  const resultNodeId = progress?.nodeHistory?.find((id: string) => {
    const n = nodes.find((node: any) => node.id === id)
    return n?.type === 'result_card'
  })
  const resultNode = nodes.find((n: any) => n.id === resultNodeId)
  const resultContent = resultNode?.content ?? {}

  const handleComplete = async () => {
    if (!slug || completed || completeMutation.isPending) return
    alangEvents.resultConfirmTap(slug)
    try {
      const res = await completeMutation.mutateAsync(slug)
      setArchiveId(res.archiveId)
      setCompleted(true)
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

  if (isLoading) {
    return (
      <View className='alang-result__loading'>
        <Text>加载中…</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <StatusCard
        tone='error'
        title='结果暂时没加载出来'
        description='网络恢复后可以再试一次'
        action={{ label: '重新加载', onClick: () => { void refetch() } }}
      />
    )
  }

  if (completed) {
    return (
      <View className='alang-result__completed'>
        <Text className='alang-result__completed-title'>故事已收录</Text>
        <Text className='alang-result__completed-sub'>你可以在「我的故事」中回看这段经历</Text>
        <View className='alang-result__completed-actions'>
          <View className='alang-result__completed-btn' onClick={handleViewStory}>
            <Text>查看故事</Text>
          </View>
          <View className='alang-result__completed-btn alang-result__completed-btn--secondary' onClick={handleGoDiscover}>
            <Text>返回发现</Text>
          </View>
        </View>
      </View>
    )
  }

  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

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
            src='/assets/lovart/alang-result-placeholder.webp'
            mode='aspectFill'
          />
        </View>
        <View className='alang-result__card-body'>
          <Text className='alang-result__card-mood'>
            阿浪最终状态：{resultContent.finalMood ?? '平静'}
          </Text>
          <Text className='alang-result__card-summary'>
            {resultContent.summaryLine ?? '你们一起走过了一段路。'}
          </Text>
          {resultContent.companionStyle && (
            <Text className='alang-result__card-style'>
              陪伴方式：{resultContent.companionStyle}
            </Text>
          )}
        </View>
      </View>

      <View className='alang-result__actions'>
        <View className='alang-result__cta' onClick={handleComplete}>
          <Text className='alang-result__cta-text'>收录故事</Text>
        </View>
      </View>
    </ScrollView>
  )
}
