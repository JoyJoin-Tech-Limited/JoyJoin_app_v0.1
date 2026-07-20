import Taro from '@tarojs/taro'
import { useRef, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useAuth } from '../../../hooks/useAuth'
import { callDebugMockGps, callDebugForceNode } from '../../../lib/alang/api'
import {
  useAlangMissionDetail,
  useResetAlangMission,
  useStoryArchives,
} from '../../../lib/alang/useAlangMission'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import './index.scss'

export default function AlangDebugPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? 'alang-demo'
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const {
    data: mission,
    isLoading: isMissionLoading,
    refetch: refetchMission,
  } = useAlangMissionDetail(slug, canUseDebugTools)
  const {
    data: archives,
    isLoading: areArchivesLoading,
    refetch: refetchArchives,
  } = useStoryArchives(canUseDebugTools)
  const resetMutation = useResetAlangMission()
  const [lat, setLat] = useState('22.5431')
  const [lng, setLng] = useState('114.0579')
  const [nodeId, setNodeId] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [resetComplete, setResetComplete] = useState(false)
  const resetActionRef = useRef(false)

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const handleReset = async () => {
    if (resetActionRef.current || resetMutation.isPending) return
    resetActionRef.current = true

    try {
      const modal = await Taro.showModal({
        title: '重置当前阿浪测试',
        content: '将清除当前账号本次阿浪测试的进度与测试故事，是否重新开始？',
        confirmText: '确认重置',
        cancelText: '取消',
        confirmColor: '#8B5CF6',
      })
      if (!modal.confirm) {
        resetActionRef.current = false
        return
      }

      alangEvents.debugResetTap(slug)
      const result = await resetMutation.mutateAsync(slug)
      setResetComplete(true)
      addLog(
        `Reset mission ${slug}: progress=${result.deletedProgressCount}, archive=${result.deletedArchiveCount}`,
      )
      void Promise.allSettled([refetchMission(), refetchArchives()])
      void Taro.showToast({ title: '已重置，可以重新测试', icon: 'success' })
    } catch (err: any) {
      addLog(`Reset failed: ${err?.message ?? 'unknown'}`)
      Taro.showToast({ title: '重置没成功，请稍后再试', icon: 'none' })
    } finally {
      resetActionRef.current = false
    }
  }

  const handleMockGps = async () => {
    try {
      alangEvents.debugMockGpsTap(slug)
      const res = await callDebugMockGps(slug, parseFloat(lat), parseFloat(lng))
      await refetchMission()
      addLog(`Mock GPS ${lat},${lng}: arrived=${res.arrived}, dist=${res.distanceMeters.toFixed(1)}m`)
    } catch (err: any) {
      addLog(`Mock GPS failed: ${err?.message ?? 'unknown'}`)
    }
  }

  const handleForceNode = async () => {
    if (!nodeId) return
    try {
      alangEvents.debugForceNodeTap(slug, nodeId)
      await callDebugForceNode(slug, nodeId)
      await refetchMission()
      addLog(`Force node ${nodeId}: OK`)
    } catch (err: any) {
      addLog(`Force node failed: ${err?.message ?? 'unknown'}`)
    }
  }

  const handleGoTo = (page: string) => {
    Taro.navigateTo({ url: `${page}?slug=${slug}` })
  }

  const matchingArchive = archives?.find((archive) => archive.missionId === mission?.id)
  const progressStatus = resetComplete
    ? 'not_started'
    : (mission?.myProgress?.status ?? 'not_started')
  const progressStage = resetComplete
    ? 'not_started'
    : (mission?.myProgress?.stage ?? 'not_started')
  const hasArchive = resetComplete ? false : !!matchingArchive
  const storyVersion = (mission?.content as { version?: string } | null)?.version ?? '未知'

  const handleStartNewRound = () => {
    if (!resetComplete) return
    void Taro.reLaunch({
      url: `${MINI_PROGRAM_ROUTES.alangConfig}?slug=${encodeURIComponent(slug)}`,
    })
  }

  if (!canUseDebugTools) return null

  return (
    <ScrollView className='alang-debug' scrollY>
      <View className='alang-debug__header'>
        <Text className='alang-debug__title'>阿浪 Debug 面板</Text>
        <Text className='alang-debug__slug'>Mission: {slug}</Text>
        {user?.features?.alangEnabled ? (
          <Text className='alang-debug__flag-on'>alangEnabled: true</Text>
        ) : (
          <Text className='alang-debug__flag-off'>alangEnabled: false (不可用)</Text>
        )}
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>当前测试状态</Text>
        <View className='alang-debug__status-row'>
          <Text className='alang-debug__status-label'>Progress</Text>
          <Text className='alang-debug__status-value'>
            {isMissionLoading ? '读取中…' : `${progressStatus} / ${progressStage}`}
          </Text>
        </View>
        <View className='alang-debug__status-row'>
          <Text className='alang-debug__status-label'>已有 Archive</Text>
          <Text className='alang-debug__status-value'>
            {areArchivesLoading ? '读取中…' : (hasArchive ? '是' : '否')}
          </Text>
        </View>
        <View className='alang-debug__status-row'>
          <Text className='alang-debug__status-label'>Story Version</Text>
          <Text className='alang-debug__status-value'>{storyVersion}</Text>
        </View>
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>重置</Text>
        <View
          className={`alang-debug__btn alang-debug__btn--danger${resetMutation.isPending ? ' alang-debug__btn--disabled' : ''}`}
          onClick={() => { void handleReset() }}
          role='button'
          aria-label={resetMutation.isPending ? '正在重置当前阿浪测试' : '重置当前阿浪测试'}
          aria-disabled={resetMutation.isPending}
        >
          <Text>{resetMutation.isPending ? '正在重置…' : '重置当前阿浪测试'}</Text>
        </View>
        {resetComplete && (
          <View
            className='alang-debug__btn alang-debug__btn--success'
            onClick={handleStartNewRound}
            role='button'
            aria-label='开始新一轮测试'
          >
            <Text>开始新一轮测试</Text>
          </View>
        )}
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>模拟定位</Text>
        <View className='alang-debug__input-row'>
          <Text className='alang-debug__input-label'>Lat</Text>
          <Input
            className='alang-debug__input'
            value={lat}
            onInput={(e) => setLat(e.detail.value)}
            type='digit'
          />
        </View>
        <View className='alang-debug__input-row'>
          <Text className='alang-debug__input-label'>Lng</Text>
          <Input
            className='alang-debug__input'
            value={lng}
            onInput={(e) => setLng(e.detail.value)}
            type='digit'
          />
        </View>
        <View className='alang-debug__btn' onClick={handleMockGps}>
          <Text>提交 Mock GPS</Text>
        </View>
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>手动推进</Text>
        <View className='alang-debug__input-row'>
          <Text className='alang-debug__input-label'>Node ID</Text>
          <Input
            className='alang-debug__input'
            value={nodeId}
            onInput={(e) => setNodeId(e.detail.value)}
            placeholder='输入节点 ID'
          />
        </View>
        <View className='alang-debug__btn' onClick={handleForceNode}>
          <Text>强制跳转节点</Text>
        </View>
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>快速跳转</Text>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangEvent)}>
          <Text>事件列表</Text>
        </View>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangEventDetail)}>
          <Text>事件详情</Text>
        </View>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangSearch)}>
          <Text>寻找页</Text>
        </View>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangDialogue)}>
          <Text>对话页</Text>
        </View>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangCompanion)}>
          <Text>陪伴页</Text>
        </View>
        <View className='alang-debug__btn' onClick={() => handleGoTo(MINI_PROGRAM_ROUTES.alangResult)}>
          <Text>结果页</Text>
        </View>
      </View>

      <View className='alang-debug__section'>
        <Text className='alang-debug__section-title'>日志</Text>
        {log.length === 0 && (
          <Text className='alang-debug__log-empty'>暂无操作记录</Text>
        )}
        {log.map((line, idx) => (
          <Text key={idx} className='alang-debug__log-line'>{line}</Text>
        ))}
      </View>
    </ScrollView>
  )
}
