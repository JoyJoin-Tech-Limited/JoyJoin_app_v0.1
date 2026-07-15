import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import type { MissionContent, StoryNode } from '@shared/alang/contentSchema'
import {
  useAlangMissionDetail,
  useSyncAlangMissionProgress,
} from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { callReportProgress, callSubmitChoice } from '../../../lib/alang/api'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import StatusCard from '../../../components/ui/StatusCard'
import { haptics } from '../../../lib/utils/haptics'
import './index.scss'

type StoryHistoryItem = {
  type: 'narration' | 'choice' | 'response'
  text: string
  imageKey?: string
}

type DialogueRound = {
  choice: string
  response?: string
}

function buildDialogueRounds(history: StoryHistoryItem[]): DialogueRound[] {
  const rounds: DialogueRound[] = []
  for (let index = 0; index < history.length; index += 1) {
    const item = history[index]
    if (item.type !== 'choice') continue
    const nextItem = history[index + 1]
    rounds.push({
      choice: item.text,
      response: nextItem?.type === 'response' ? nextItem.text : undefined,
    })
  }
  return rounds.slice(-3)
}

export default function AlangDialoguePage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const initialNodeId = Taro.getCurrentInstance().router?.params?.nodeId ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(
    slug,
    !!slug && !!user?.features?.alangEnabled
  )
  const syncMissionProgress = useSyncAlangMissionProgress()

  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId)
  const [history, setHistory] = useState<StoryHistoryItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecovered, setIsRecovered] = useState(false)
  const [companionNavigationFailed, setCompanionNavigationFailed] = useState(false)
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recoveredProgressKeyRef = useRef('')
  const recoveryNavigationKeyRef = useRef('')
  const foundSceneArtwork = useAlangAssetSource('foundScene')

  const content = mission?.content as MissionContent | undefined
  const nodes = useMemo<StoryNode[]>(() => content?.nodes ?? [], [content?.nodes])
  const progress = mission?.myProgress
  const activeNodeId = isRecovered
    ? (currentNodeId || progress?.currentNodeId || initialNodeId)
    : (progress?.currentNodeId || currentNodeId || initialNodeId)
  const currentNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId),
    [activeNodeId, nodes]
  )

  useEffect(() => {
    setCurrentNodeId(initialNodeId)
    setHistory([])
    setIsRecovered(false)
    setIsProcessing(false)
    setCompanionNavigationFailed(false)
    recoveredProgressKeyRef.current = ''
  }, [initialNodeId, slug])

  // Recover the three dialogue rounds from server progress. The replay is
  // rendered as a compact story log, not as chat bubbles.
  useEffect(() => {
    if (!progress || nodes.length === 0) return
    const progressKey = `${progress.progressId}:${progress.currentNodeId}:${progress.choicesMade?.length ?? 0}`
    if (recoveredProgressKeyRef.current === progressKey) return
    const recoveredHistory: StoryHistoryItem[] = []

    for (const nodeId of progress.nodeHistory ?? []) {
      const node = nodes.find((item) => item.id === nodeId)
      if (node?.type === 'found_scene' && node.content.narration) {
        recoveredHistory.push({
          type: 'narration',
          text: node.content.narration,
          imageKey: node.content.imageKey,
        })
      }
    }

    for (const choiceMade of progress.choicesMade ?? []) {
      const node = nodes.find((item) => item.id === choiceMade.nodeId)
      const choice = node?.choices?.[choiceMade.choiceIndex]
      if (!choice) continue
      recoveredHistory.push({ type: 'choice', text: choice.label })
      recoveredHistory.push({ type: 'response', text: choice.response })
    }

    setHistory(recoveredHistory)
    setCurrentNodeId(progress.currentNodeId || initialNodeId)
    setIsRecovered(true)
    recoveredProgressKeyRef.current = progressKey
  }, [initialNodeId, nodes, progress])

  useDidShow(() => {
    if (slug) void refetch()
  })

  useEffect(() => {
    if (!progress || ['found', 'dialogue'].includes(progress.stage)) return
    const key = `${progress.progressId}:${progress.stage}:${progress.currentNodeId}`
    if (recoveryNavigationKeyRef.current === key) return

    const encodedSlug = encodeURIComponent(slug)
    const encodedNode = encodeURIComponent(progress.currentNodeId)
    const url = progress.stage === 'searching'
      ? `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${encodedSlug}&nodeId=${encodedNode}`
      : ['companion', 'arrived'].includes(progress.stage)
        ? `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${encodedSlug}&nodeId=${encodedNode}`
        : ['closing', 'result', 'completed'].includes(progress.stage)
          ? `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodedSlug}`
          : `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodedSlug}`

    recoveryNavigationKeyRef.current = key
    void Taro.redirectTo({ url }).catch(() => {
      recoveryNavigationKeyRef.current = ''
    })
  }, [progress, slug])

  useEffect(() => {
    if (activeNodeId && slug) alangEvents.dialoguePageView(slug, activeNodeId)
  }, [activeNodeId, slug])

  useEffect(() => {
    if (currentNode?.type !== 'found_scene') return
    const narration = currentNode.content.narration ?? '你看到了阿浪。'
    setHistory((items) => items.some((item) => item.type === 'narration' && item.text === narration)
      ? items
      : [...items, { type: 'narration', text: narration, imageKey: currentNode.content.imageKey }])
  }, [currentNode])

  const enterCompanion = useCallback(async (nodeId: string) => {
    try {
      await Taro.redirectTo({
        url: `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${slug}&nodeId=${nodeId}`,
      })
    } catch {
      setCompanionNavigationFailed(true)
      Taro.showToast({ title: '陪伴页没有打开，再试一次即可', icon: 'none' })
    }
  }, [slug])

  useEffect(() => {
    if (currentNode?.type !== 'companion_start' || !slug) return
    setCompanionNavigationFailed(false)
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    navigationTimerRef.current = setTimeout(() => {
      navigationTimerRef.current = null
      void enterCompanion(currentNode.id)
    }, 900)

    return () => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    }
  }, [currentNode, enterCompanion, slug])

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
  }, [])

  const handleChoice = useCallback(async (choiceIndex: number) => {
    if (!currentNode || currentNode.type !== 'dialogue' || !slug || isProcessing) return
    const choice = currentNode.choices?.[choiceIndex]
    if (!choice) return

    setIsProcessing(true)
    alangEvents.choiceMade(slug, currentNode.id, choiceIndex)

    try {
      const response = await callSubmitChoice(slug, { nodeId: currentNode.id, choiceIndex })
      setHistory((items) => [
        ...items,
        { type: 'choice', text: choice.label },
        { type: 'response', text: response.response },
      ])
      syncMissionProgress(slug, {
        stage: response.stage,
        currentNodeId: response.nextNodeId,
      })
      setCurrentNodeId(response.nextNodeId)
    } catch {
      Taro.showToast({ title: '这次没送达，再选一次就好', icon: 'none' })
    } finally {
      setIsProcessing(false)
    }
  }, [currentNode, isProcessing, slug, syncMissionProgress])

  const handleContinueFromFoundScene = useCallback(async () => {
    if (!currentNode || currentNode.type !== 'found_scene' || !currentNode.nextNodeId || isProcessing) return
    setIsProcessing(true)
    try {
      const updated = await callReportProgress(slug, currentNode.nextNodeId)
      haptics('light')
      syncMissionProgress(slug, {
        stage: updated.stage,
        currentNodeId: updated.currentNodeId,
      })
      setCurrentNodeId(updated.currentNodeId)
    } catch {
      Taro.showToast({ title: '故事同步遇到小状况，再试一次即可', icon: 'none' })
    } finally {
      setIsProcessing(false)
    }
  }, [currentNode, isProcessing, slug, syncMissionProgress])

  const dialogueRounds = useMemo(() => buildDialogueRounds(history), [history])
  const isUsingPlaceholder = foundSceneArtwork.usingFallback

  if (isLoading) {
    return (
      <View className='alang-dialogue__loading'>
        <View className='alang-dialogue__loading-mark' />
        <Text className='alang-dialogue__loading-title'>阿浪的故事正在展开…</Text>
        <Text className='alang-dialogue__loading-detail'>会从你离开的地方继续</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <View className='alang-dialogue__status'>
        <StatusCard
          tone='error'
          title='故事暂时没加载出来'
          description='网络恢复后，可以从刚才的位置继续'
          action={{ label: '重新加载', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  if (!currentNode) {
    return (
      <View className='alang-dialogue__status'>
        <StatusCard
          tone='error'
          title='这一页故事走丢了'
          description='重新加载会读取已保存的故事进度'
          action={{ label: '重新加载', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  if (currentNode.type === 'found_scene') {
    return (
      <ScrollView className='alang-dialogue__found-scene' scrollY enhanced showScrollbar={false}>
        <View className='alang-dialogue__found-scene-inner'>
          <View className='alang-dialogue__found-header'>
            <Text className='alang-dialogue__found-kicker'>刚刚 · 找到阿浪</Text>
            <Text className='alang-dialogue__found-title'>你们第一次面对面</Text>
          </View>
          <View className='alang-dialogue__found-visual'>
            <Image
              className='alang-dialogue__found-image'
              src={foundSceneArtwork.src}
              mode='aspectFill'
              onError={foundSceneArtwork.onError}
            />
            {isUsingPlaceholder && (
              <View className='alang-dialogue__scene-note'>
                <Text className='alang-dialogue__scene-note-text'>场景示意</Text>
              </View>
            )}
          </View>
          <View className='alang-dialogue__found-narration'>
            <Text className='alang-dialogue__found-narration-text'>
              {currentNode.content.narration ?? currentNode.content.body}
            </Text>
          </View>
          <View className='alang-dialogue__found-progress'>
            <View className='alang-dialogue__found-progress-dot' />
            <Text className='alang-dialogue__found-progress-text'>先看清这一刻，再继续听阿浪说</Text>
          </View>
          <View
            className={`alang-dialogue__found-continue${isProcessing ? ' alang-dialogue__found-continue--disabled' : ''}`}
            onClick={handleContinueFromFoundScene}
            role='button'
            aria-label='继续和阿浪聊聊'
            aria-disabled={isProcessing}
          >
            <Text className='alang-dialogue__found-continue-text'>
              {isProcessing ? '正在接上故事…' : '和阿浪聊聊'}
            </Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  const completedRoundCount = progress?.choicesMade?.length ?? dialogueRounds.length
  const visibleChoices = currentNode.type === 'dialogue'
    ? (currentNode.choices ?? []).slice(0, 3)
    : []

  return (
    <View className='alang-dialogue'>
      <ScrollView className='alang-dialogue__story' scrollY enhanced showScrollbar={false}>
        <View className='alang-dialogue__story-inner'>
          <View className='alang-dialogue__scene'>
            <Image
              className='alang-dialogue__scene-image'
              src={foundSceneArtwork.src}
              mode='aspectFill'
              onError={foundSceneArtwork.onError}
            />
            <View className='alang-dialogue__scene-shade' />
            <View className='alang-dialogue__scene-caption'>
              <Text className='alang-dialogue__scene-name'>{currentNode.content.speaker ?? '阿浪'}</Text>
              <Text className='alang-dialogue__scene-moment'>一段真实相遇</Text>
            </View>
            {isUsingPlaceholder && (
              <View className='alang-dialogue__scene-note'>
                <Text className='alang-dialogue__scene-note-text'>场景示意</Text>
              </View>
            )}
          </View>

          <View className='alang-dialogue__narrative-card'>
            <View className='alang-dialogue__narrative-meta'>
              <Text className='alang-dialogue__speaker'>{currentNode.content.speaker ?? '阿浪'}</Text>
              {currentNode.content.moodTag && (
                <Text className='alang-dialogue__mood'>{currentNode.content.moodTag}</Text>
              )}
            </View>
            <Text className='alang-dialogue__body'>{currentNode.content.body}</Text>
          </View>

          {dialogueRounds.length > 0 && (
            <View className='alang-dialogue__recap'>
              <View className='alang-dialogue__recap-heading'>
                <Text className='alang-dialogue__recap-title'>刚才的故事</Text>
                <Text className='alang-dialogue__recap-count'>保留最近 {dialogueRounds.length} 段</Text>
              </View>
              {dialogueRounds.map((round, index) => (
                <View key={`${round.choice}-${index}`} className='alang-dialogue__recap-item'>
                  <View className='alang-dialogue__recap-index'>
                    <Text className='alang-dialogue__recap-index-text'>{index + 1}</Text>
                  </View>
                  <View className='alang-dialogue__recap-copy'>
                    <Text className='alang-dialogue__recap-choice'>你选择：{round.choice}</Text>
                    {round.response && (
                      <Text className='alang-dialogue__recap-response'>{round.response}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className='alang-dialogue__choices-dock'>
        {currentNode.type === 'dialogue' ? (
          <>
            <View className='alang-dialogue__choices-heading'>
              <Text className='alang-dialogue__choices-title'>你想怎么回应？</Text>
              <Text className='alang-dialogue__choices-step'>第 {Math.min(completedRoundCount + 1, 3)} / 3 段</Text>
            </View>
            <View className={`alang-dialogue__choices${isProcessing ? ' alang-dialogue__choices--processing' : ''}`}>
              {visibleChoices.map((choice, index) => (
                <View
                  key={`${currentNode.id}-${index}`}
                  className={`alang-dialogue__choice ${isProcessing ? 'alang-dialogue__choice--disabled' : ''}`}
                  onClick={() => { void handleChoice(index) }}
                  role='button'
                  aria-label={choice.label}
                  aria-disabled={isProcessing}
                >
                  <Text className='alang-dialogue__choice-letter'>{String.fromCharCode(65 + index)}</Text>
                  <Text className='alang-dialogue__choice-text'>{choice.label}</Text>
                </View>
              ))}
            </View>
            {isProcessing && (
              <Text className='alang-dialogue__processing'>正在把你的选择交给阿浪…</Text>
            )}
          </>
        ) : (
          <View className='alang-dialogue__transition'>
            <View className='alang-dialogue__transition-dot' />
            <View>
              <Text className='alang-dialogue__transition-title'>阿浪站起身了</Text>
              <Text className='alang-dialogue__transition-detail'>接下来，陪他走一段路</Text>
            </View>
            {companionNavigationFailed && (
              <View
                className='alang-dialogue__transition-retry'
                onClick={() => { void enterCompanion(currentNode.id) }}
                role='button'
                aria-label='继续同行'
              >
                <Text className='alang-dialogue__transition-retry-text'>继续同行</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
