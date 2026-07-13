import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import type { MissionContent } from '@shared/alang/contentSchema'
import { useAlangMissionDetail, useStartMission, useRecoverMission } from '../../../lib/alang/useAlangMission'
import { callReportProgress } from '../../../lib/alang/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import StatusCard from '../../../components/ui/StatusCard'
import { useAuth } from '../../../hooks/useAuth'
import './index.scss'

type ProgressRoute = {
  stage: string
  currentNodeId: string
  completed?: boolean
}

function getCtaText(
  status: string | undefined,
  stage: string | undefined,
  npcName: string,
  canUseDebugTools: boolean,
): string {
  if (status === 'completed') return '查看这段故事'
  if (status !== 'in_progress') return `出发去找${npcName}`

  switch (stage) {
    case 'not_started':
    case 'configuring':
      return canUseDebugTools ? '设置测试地点' : `出发去找${npcName}`
    case 'searching':
      return `继续寻找${npcName}`
    case 'found':
    case 'dialogue':
      return `回到${npcName}身边`
    case 'companion':
    case 'arrived':
      return '继续一起走'
    case 'closing':
    case 'result':
      return '查看故事结尾'
    default:
      return '继续这段故事'
  }
}

function getStatusLine(status: string | undefined, stage: string | undefined): string {
  if (status === 'completed') return '这段相遇已经收进你的故事'
  if (status !== 'in_progress') return '今晚可以出发'

  switch (stage) {
    case 'searching':
      return '你已经在靠近他了'
    case 'found':
    case 'dialogue':
      return '你们的对话还没有结束'
    case 'companion':
    case 'arrived':
      return '这段同行还在继续'
    case 'closing':
    case 'result':
      return '故事正等你写下结尾'
    default:
      return '下一步，会在你出发后出现'
  }
}

export default function AlangEventDetailPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(
    slug,
    !!slug && !!user?.features?.alangEnabled,
  )
  const startMutation = useStartMission()
  const recoverMutation = useRecoverMission()
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const hero = useAlangAssetSource('eventHero')

  useEffect(() => {
    if (slug) alangEvents.eventDetailView(slug)
  }, [slug])

  const routeToStage = (progress: ProgressRoute) => {
    const encodedSlug = encodeURIComponent(slug)
    const encodedNodeId = encodeURIComponent(progress.currentNodeId)
    let url: string

    switch (progress.stage) {
      case 'not_started':
      case 'configuring':
        if (!canUseDebugTools) {
          throw new Error('PUBLIC_PROGRESS_DID_NOT_REACH_SEARCH')
        }
        url = `${MINI_PROGRAM_ROUTES.alangConfig}?slug=${encodedSlug}`
        break
      case 'searching':
        url = `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${encodedSlug}&nodeId=${encodedNodeId}`
        break
      case 'found':
      case 'dialogue':
        url = `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${encodedSlug}&nodeId=${encodedNodeId}`
        break
      case 'companion':
      case 'arrived':
        url = `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${encodedSlug}&nodeId=${encodedNodeId}`
        break
      case 'closing':
      case 'result':
      case 'completed':
        url = `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodedSlug}`
        break
      default:
        throw new Error(`UNKNOWN_ALANG_STAGE:${progress.stage}`)
    }

    // Starting/resuming replaces detail so swipe-back never reopens a stale
    // pre-start screen after the server has already advanced the story.
    Taro.redirectTo({ url })
  }

  const advancePublicProgress = async (progress: ProgressRoute): Promise<ProgressRoute> => {
    if (canUseDebugTools || !mission) return progress

    const content = mission.content as MissionContent | null
    const nodes = content?.nodes ?? []
    const visited = new Set<string>()
    let nextProgress = progress

    while (nextProgress.stage === 'not_started' || nextProgress.stage === 'configuring') {
      if (visited.has(nextProgress.currentNodeId)) {
        throw new Error('ALANG_PROGRESS_LOOP')
      }
      visited.add(nextProgress.currentNodeId)

      const currentNode = nodes.find((node) => node.id === nextProgress.currentNodeId)
      if (!currentNode?.nextNodeId) {
        throw new Error('ALANG_NEXT_NODE_MISSING')
      }

      // The public route accepts only currentNode.nextNodeId. Advance one edge
      // at a time so the server remains the authority for every transition.
      const advanced = await callReportProgress(slug, currentNode.nextNodeId)
      nextProgress = {
        stage: advanced.stage,
        currentNodeId: advanced.currentNodeId,
      }
    }

    return nextProgress
  }

  const handleStart = async () => {
    if (!slug || isAdvancing || startMutation.isPending || recoverMutation.isPending) return

    try {
      const progress = mission?.myProgress
      if (progress?.status === 'completed') {
        alangEvents.startSearchTap(slug)
        Taro.redirectTo({
          url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodeURIComponent(slug)}`,
        })
        return
      }

      setIsAdvancing(true)
      const snapshot = progress?.status === 'in_progress'
        ? await recoverMutation.mutateAsync(slug)
        : await startMutation.mutateAsync(slug)

      alangEvents.startSearchTap(slug)
      if (snapshot.completed || snapshot.stage === 'completed') {
        Taro.redirectTo({
          url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodeURIComponent(slug)}`,
        })
        return
      }

      const routableProgress = await advancePublicProgress(snapshot)
      routeToStage(routableProgress)
    } catch {
      Taro.showToast({ title: '这段故事没接上，再试一次吧', icon: 'none' })
    } finally {
      setIsAdvancing(false)
    }
  }

  if (isLoading) {
    return (
      <View className='alang-event-detail__loading'>
        <Text className='alang-event-detail__loading-text'>正在听听今晚发生了什么…</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <View className='alang-event-detail__status-shell'>
        <StatusCard
          tone='error'
          title='这段故事暂时没有打开'
          description='网络恢复后，再来听听角色想说什么。'
          action={{ label: '重新打开', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  const content = mission.content as MissionContent | null
  const npcName = content?.meta?.npcName ?? '阿浪'
  const duration = content?.meta?.estimatedDurationMinutes
  const eventNode = content?.nodes.find((node) => node.type === 'event_detail')
  const narrative = eventNode?.content.body || mission.description
  const isPending = isAdvancing || startMutation.isPending || recoverMutation.isPending
  const ctaText = isPending
    ? '正在接上故事…'
    : getCtaText(
        mission.myProgress?.status,
        mission.myProgress?.stage,
        npcName,
        canUseDebugTools,
      )

  return (
    <ScrollView className='alang-event-detail' scrollY>
      <View className='alang-event-detail__hero'>
        <Image
          className='alang-event-detail__hero-image'
          src={hero.src}
          mode='aspectFill'
          onError={hero.onError}
          aria-hidden='true'
        />
        <View className='alang-event-detail__hero-wash' />
        <View className='alang-event-detail__hero-copy'>
          <View className='alang-event-detail__label-row'>
            <Text className='alang-event-detail__hero-label'>闪现</Text>
            <Text className='alang-event-detail__beta'>Beta</Text>
          </View>
          <Text className='alang-event-detail__hero-title'>{mission.title}</Text>
          <Text className='alang-event-detail__hero-status'>● {getStatusLine(mission.myProgress?.status, mission.myProgress?.stage)}</Text>
        </View>
        {hero.usingFallback && (
          <Text className='alang-event-detail__placeholder-label'>活动场景示意</Text>
        )}
      </View>

      <View className='alang-event-detail__body'>
        <Text className='alang-event-detail__chapter'>今晚，{npcName}的城市片段</Text>
        <Text className='alang-event-detail__desc'>{narrative}</Text>

        <View className='alang-event-detail__facts'>
          <View className='alang-event-detail__fact'>
            <Text className='alang-event-detail__fact-label'>会遇见</Text>
            <Text className='alang-event-detail__fact-value'>{npcName}</Text>
          </View>
          <View className='alang-event-detail__fact-divider' />
          <View className='alang-event-detail__fact'>
            <Text className='alang-event-detail__fact-label'>留一点时间</Text>
            <Text className='alang-event-detail__fact-value'>{duration ? `约 ${duration} 分钟` : '不用赶时间'}</Text>
          </View>
        </View>

        <View className='alang-event-detail__privacy-card'>
          <View className='alang-event-detail__privacy-icon' aria-hidden='true'>
            <Text className='alang-event-detail__privacy-icon-glyph'>⌁</Text>
          </View>
          <View className='alang-event-detail__privacy-copy'>
            <Text className='alang-event-detail__privacy-title'>定位只用于这段寻找</Text>
            <Text className='alang-event-detail__privacy-desc'>出发后会在故事进行时使用定位计算距离；你可以随时退出。页面只给接近提示，不会提前显示角色的精确位置。</Text>
          </View>
        </View>
      </View>

      <View className='alang-event-detail__action-bar'>
        <View
          className={`alang-event-detail__cta${isPending ? ' alang-event-detail__cta--disabled' : ''}`}
          hoverClass={isPending ? '' : 'alang-event-detail__cta--pressed'}
          onClick={() => { void handleStart() }}
          role='button'
          aria-label={ctaText}
          aria-disabled={isPending}
        >
          <Text className='alang-event-detail__cta-text'>{ctaText}</Text>
          {!isPending && <Text className='alang-event-detail__cta-arrow'>›</Text>}
        </View>
        <Text className='alang-event-detail__action-note'>你可以随时退出，下次会从这里继续。</Text>
      </View>
    </ScrollView>
  )
}
