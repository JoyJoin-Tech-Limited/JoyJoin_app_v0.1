import Taro from '@tarojs/taro'
import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useAlangMissionDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { callReportProgress, callSubmitChoice } from '../../../lib/alang/api'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import StatusCard from '../../../components/ui/StatusCard'
import './index.scss'

export default function AlangDialoguePage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const initialNodeId = Taro.getCurrentInstance().router?.params?.nodeId ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)

  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId)
  const [history, setHistory] = useState<Array<{ type: 'narration' | 'choice' | 'response'; text: string; imageKey?: string }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecovered, setIsRecovered] = useState(false)
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const content = mission?.content as any
  const nodes: Array<any> = content?.nodes ?? []
  const progress = mission?.myProgress

  const currentNode = nodes.find((n: any) => n.id === currentNodeId)

  // Recover history from progress
  useEffect(() => {
    if (!isRecovered && progress && nodes.length > 0) {
      const recoveredHistory: Array<{ type: 'narration' | 'choice' | 'response'; text: string; imageKey?: string }> = []

      // Replay node history
      for (const nodeId of progress.nodeHistory ?? []) {
        const node = nodes.find((n: any) => n.id === nodeId)
        if (!node) continue

        if (node.type === 'found_scene' && node.content?.narration) {
          recoveredHistory.push({ type: 'narration', text: node.content.narration, imageKey: node.content.imageKey })
        }
      }

      // Replay choices
      for (const choiceMade of progress.choicesMade ?? []) {
        const node = nodes.find((n: any) => n.id === choiceMade.nodeId)
        const choice = node?.choices?.[choiceMade.choiceIndex]
        if (choice) {
          recoveredHistory.push({ type: 'choice', text: choice.label })
          recoveredHistory.push({ type: 'response', text: choice.response })
        }
      }

      setHistory(recoveredHistory)
      setIsRecovered(true)
    }
  }, [progress, nodes, isRecovered])

  useEffect(() => {
    if (currentNodeId && slug) {
      alangEvents.dialoguePageView(slug, currentNodeId)
    }
  }, [currentNodeId, slug])

  useEffect(() => {
    if (currentNode && currentNode.type === 'found_scene') {
      // Auto-show found scene narration
      const narration = currentNode.content?.narration ?? '你看到了阿浪。'
      setHistory((items) => items.some((item) => item.type === 'narration' && item.text === narration)
        ? items
        : [...items, { type: 'narration', text: narration, imageKey: currentNode.content?.imageKey }])
      // Auto advance after delay
      let active = true
      const timer = setTimeout(async () => {
        if (!currentNode.nextNodeId) return
        try {
          const updated = await callReportProgress(slug, currentNode.nextNodeId)
          if (active) setCurrentNodeId(updated.currentNodeId)
        } catch {
          if (active) Taro.showToast({ title: '故事同步遇到小状况', icon: 'none' })
        }
      }, 2000)
      return () => {
        active = false
        clearTimeout(timer)
      }
    }
  }, [currentNode, slug])

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
  }, [])

  const handleChoice = useCallback(async (choiceIndex: number) => {
    if (!currentNode || !slug || isProcessing) return
    const choice = currentNode.choices?.[choiceIndex]
    if (!choice) return

    setIsProcessing(true)
    alangEvents.choiceMade(slug, currentNodeId, choiceIndex)

    try {
      const res = await callSubmitChoice(slug, { nodeId: currentNodeId, choiceIndex })

      setHistory((h) => [
        ...h,
        { type: 'choice', text: choice.label },
        { type: 'response', text: res.response },
      ])

      setCurrentNodeId(res.nextNodeId)

      // Check if next node is companion_start (end of dialogue)
      const nextNode = nodes.find((n: any) => n.id === res.nextNodeId)
      if (nextNode?.type === 'companion_start') {
        navigationTimerRef.current = setTimeout(() => {
          Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangCompanion}?slug=${slug}&nodeId=${res.nextNodeId}` })
        }, 1500)
      }
    } catch {
      Taro.showToast({ title: '没成功，再选一次即可', icon: 'none' })
    } finally {
      setIsProcessing(false)
    }
  }, [currentNode, currentNodeId, slug, isProcessing, nodes])

  if (isLoading) {
    return (
      <View className='alang-dialogue__loading'>
        <Text>加载中…</Text>
      </View>
    )
  }

  if (isError || !mission) {
    return (
      <StatusCard
        tone='error'
        title='故事暂时没加载出来'
        description='网络恢复后可以再试一次'
        action={{ label: '重新加载', onClick: () => { void refetch() } }}
      />
    )
  }

  if (!currentNode) {
    return (
      <StatusCard
        tone='error'
        title='节点未找到'
        description='故事内容可能已更新'
      />
    )
  }

  // Found scene render
  if (currentNode.type === 'found_scene') {
    const lastHistory = history[history.length - 1]
    return (
      <View className='alang-dialogue__found-scene'>
        {lastHistory?.imageKey && (
          <Image
            className='alang-dialogue__found-image'
            src={`/assets/lovart/${lastHistory.imageKey}.webp`}
            mode='aspectFit'
          />
        )}
        <View className='alang-dialogue__found-narration'>
          <Text className='alang-dialogue__found-narration-text'>
            {lastHistory?.text ?? currentNode.content?.narration}
          </Text>
        </View>
      </View>
    )
  }

  // Dialogue render
  const nodeContent = currentNode.content ?? {}

  return (
    <View className='alang-dialogue'>
      <ScrollView className='alang-dialogue__history' scrollY>
        {history.map((item, idx) => (
          <View key={idx} className={`alang-dialogue__history-item alang-dialogue__history-item--${item.type}`}>
            {item.imageKey && (
              <Image className='alang-dialogue__history-image' src={`/assets/lovart/${item.imageKey}.webp`} mode='aspectFit' />
            )}
            <Text className={`alang-dialogue__history-text alang-dialogue__history-text--${item.type}`}>
              {item.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className='alang-dialogue__current'>
        {nodeContent.speaker && (
          <Text className='alang-dialogue__speaker'>{nodeContent.speaker}</Text>
        )}
        <Text className='alang-dialogue__body'>{nodeContent.body}</Text>
        {nodeContent.moodTag && (
          <Text className='alang-dialogue__mood'>{nodeContent.moodTag}</Text>
        )}
      </View>

      <View className='alang-dialogue__choices'>
        {currentNode.choices?.map((choice: any, idx: number) => (
          <View
            key={idx}
            className={`alang-dialogue__choice ${isProcessing ? 'alang-dialogue__choice--disabled' : ''}`}
            onClick={() => handleChoice(idx)}
          >
            <Text className='alang-dialogue__choice-text'>{choice.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
