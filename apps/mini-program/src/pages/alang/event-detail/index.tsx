import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useAlangMissionDetail, useStartMission, useRecoverMission } from '../../../lib/alang/useAlangMission'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import StatusCard from '../../../components/ui/StatusCard'
import { useAuth } from '../../../hooks/useAuth'
import './index.scss'

export default function AlangEventDetailPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)
  const startMutation = useStartMission()
  const recoverMutation = useRecoverMission()

  useEffect(() => {
    if (slug) alangEvents.eventDetailView(slug)
  }, [slug])

  const handleStart = async () => {
    if (!slug) return
    try {
      const progress = mission?.myProgress
      if (progress && progress.status === 'completed') {
        // Already completed — go straight to result
        alangEvents.startSearchTap(slug)
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${slug}` })
        return
      }
      if (progress && progress.status === 'in_progress') {
        // Recover and continue
        const recovered = await recoverMutation.mutateAsync(slug)
        alangEvents.startSearchTap(slug)
        routeToStage(recovered.stage, slug, recovered.currentNodeId)
        return
      }
      const started = await startMutation.mutateAsync(slug)
      alangEvents.startSearchTap(slug)
      routeToStage(started.stage, slug, started.currentNodeId)
    } catch {
      Taro.showToast({ title: '没成功，再点一次即可', icon: 'none' })
    }
  }

  const routeToStage = (stage: string, slug: string, nodeId: string) => {
    switch (stage) {
      case 'not_started':
      case 'configuring':
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangConfig}?slug=${slug}` })
        break
      case 'searching':
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${slug}&nodeId=${nodeId}` })
        break
      case 'found':
      case 'dialogue':
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${slug}&nodeId=${nodeId}` })
        break
      case 'companion':
      case 'arrived':
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${slug}&nodeId=${nodeId}` })
        break
      case 'closing':
      case 'result':
      case 'completed':
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${slug}` })
        break
      default:
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${slug}&nodeId=${nodeId}` })
    }
  }

  if (isLoading) {
    return (
      <View className='alang-event-detail__loading'>
        <Text>加载中…</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <StatusCard
        tone='error'
        title='任务暂时没加载出来'
        description='网络恢复后可以再试一次'
        action={{ label: '重新加载', onClick: () => { void refetch() } }}
      />
    )
  }

  const content = mission.content as any
  const npcName = content?.meta?.npcName ?? '阿浪'

  return (
    <ScrollView className='alang-event-detail' scrollY>
      <View className='alang-event-detail__hero'>
        <Image
          className='alang-event-detail__hero-image'
          src='/assets/lovart/alang-event-card-placeholder.webp'
          mode='aspectFill'
        />
        <View className='alang-event-detail__hero-overlay'>
          <Text className='alang-event-detail__hero-label'>闪现 NPC</Text>
          <Text className='alang-event-detail__hero-title'>{mission.title}</Text>
        </View>
      </View>
      <View className='alang-event-detail__body'>
        <Text className='alang-event-detail__desc'>{mission.description}</Text>
        <View className='alang-event-detail__meta'>
          <Text className='alang-event-detail__meta-item'>角色：{npcName}</Text>
          <Text className='alang-event-detail__meta-item'>类型：一次性完整故事</Text>
        </View>
      </View>
      <View className='alang-event-detail__action-bar'>
        <View className='alang-event-detail__cta' onClick={handleStart}>
          <Text className='alang-event-detail__cta-text'>
            {mission.myProgress?.status === 'in_progress' ? '继续寻找' : '出发去找他'}
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}
