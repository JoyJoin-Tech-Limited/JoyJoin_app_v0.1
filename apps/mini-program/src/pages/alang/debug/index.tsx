import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useAuth } from '../../../hooks/useAuth'
import { callDebugReset, callDebugMockGps, callDebugForceNode } from '../../../lib/alang/api'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import './index.scss'

export default function AlangDebugPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? 'alang-demo'
  const [lat, setLat] = useState('22.5431')
  const [lng, setLng] = useState('114.0579')
  const [nodeId, setNodeId] = useState('')
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const handleReset = async () => {
    try {
      alangEvents.debugResetTap(slug)
      await callDebugReset(slug)
      await queryClient.invalidateQueries({ queryKey: ['alang'] })
      addLog(`Reset mission ${slug}: OK`)
    } catch (err: any) {
      addLog(`Reset failed: ${err?.message ?? 'unknown'}`)
    }
  }

  const handleMockGps = async () => {
    try {
      alangEvents.debugMockGpsTap(slug)
      const res = await callDebugMockGps(slug, parseFloat(lat), parseFloat(lng))
      await queryClient.invalidateQueries({ queryKey: ['alang'] })
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
      await queryClient.invalidateQueries({ queryKey: ['alang'] })
      addLog(`Force node ${nodeId}: OK`)
    } catch (err: any) {
      addLog(`Force node failed: ${err?.message ?? 'unknown'}`)
    }
  }

  const handleGoTo = (page: string) => {
    Taro.navigateTo({ url: `${page}?slug=${slug}` })
  }

  if (!shouldShowAlangDebugTools(user)) return null

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
        <Text className='alang-debug__section-title'>重置</Text>
        <View className='alang-debug__btn alang-debug__btn--danger' onClick={handleReset}>
          <Text>重置阿浪测试</Text>
        </View>
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
