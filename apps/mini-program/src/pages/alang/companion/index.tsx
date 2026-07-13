import Taro from '@tarojs/taro'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, Map } from '@tarojs/components'
import { useAlangMissionDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { useAlangGps } from '../../../lib/alang/useAlangGps'
import { callReportProgress } from '../../../lib/alang/api'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import './index.scss'

export default function AlangCompanionPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const urlNodeId = Taro.getCurrentInstance().router?.params?.nodeId ?? ''
  const { data: mission, refetch } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)

  const [config, setConfig] = useState<{ endPoint: { lat: number; lng: number } } | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [currentNodeId, setCurrentNodeId] = useState(urlNodeId)
  const [isConfirming, setIsConfirming] = useState(false)

  const content = mission?.content as any
  const nodes: Array<any> = content?.nodes ?? []
  const progress = mission?.myProgress
  const currentNode = nodes.find((n: any) => n.id === currentNodeId)
  const companionNode = currentNode?.type === 'companion_move'
    ? currentNode
    : [...(progress?.nodeHistory ?? [])]
      .reverse()
      .map((id: string) => nodes.find((node: any) => node.id === id))
      .find((node: any) => node?.type === 'companion_move')
  const companionLines: string[] = companionNode?.content?.companionLines ?? []

  useEffect(() => {
    if (!urlNodeId && progress?.currentNodeId) setCurrentNodeId(progress.currentNodeId)
    if (progress?.stage === 'arrived') setArrived(true)
  }, [progress?.currentNodeId, progress?.stage, urlNodeId])

  useEffect(() => {
    if (currentNode?.type !== 'companion_start' || !currentNode.nextNodeId) return
    let active = true
    callReportProgress(slug, currentNode.nextNodeId)
      .then((updated) => {
        if (active) setCurrentNodeId(updated.currentNodeId)
      })
      .catch(() => {
        if (active) Taro.showToast({ title: '陪伴片段同步遇到小状况', icon: 'none' })
      })
    return () => { active = false }
  }, [currentNode, slug])

  useEffect(() => {
    if (slug) {
      const stored = Taro.getStorageSync(`jj_alang_config_${slug}`)
      if (stored?.endPoint) {
        setConfig(stored)
      } else {
        const defaultEnd = content?.meta?.defaultCompanionEndLocation
        if (defaultEnd) {
          setConfig({ endPoint: defaultEnd })
        }
      }
    }
  }, [slug, content])

  useEffect(() => {
    if (companionLines.length > 0) {
      const timer = setInterval(() => {
        setLineIndex((i) => {
          if (i >= companionLines.length - 1) {
            clearInterval(timer)
            return i
          }
          return i + 1
        })
      }, 8000) // Show a new line every 8 seconds
      return () => clearInterval(timer)
    }
  }, [companionLines])

  const handleArrival = useCallback(() => {
    if (!arrived) {
      setArrived(true)
      alangEvents.arrivalReached(slug)
    }
  }, [arrived, slug])

  const handleGpsError = useCallback(() => {
    Taro.showToast({ title: '定位暂时不可用，请稍后重试', icon: 'none' })
  }, [])

  const { distance, nodeId: gpsNodeId } = useAlangGps({
    slug,
    targetLat: config?.endPoint.lat,
    targetLng: config?.endPoint.lng,
    radiusMeters: 5,
    enabled: !!slug && currentNode?.type === 'companion_move' && !arrived,
    onArrival: handleArrival,
    onError: handleGpsError,
  })

  const handleConfirmArrival = async () => {
    if (!slug || !arrived || isConfirming) return
    alangEvents.confirmArrivalTap(slug)
    setIsConfirming(true)
    try {
      let node = nodes.find((item: any) => item.id === (gpsNodeId || currentNodeId))
      let safety = 0
      while (node && node.type !== 'result_card' && safety < nodes.length) {
        if (!node.nextNodeId) throw new Error('NO_PATH_TO_RESULT')
        const nextNode = nodes.find((item: any) => item.id === node.nextNodeId)
        if (!nextNode) throw new Error('INVALID_RESULT_PATH')
        const updated = await callReportProgress(slug, nextNode.id)
        setCurrentNodeId(updated.currentNodeId)
        node = nextNode
        safety += 1
      }
      if (node?.type !== 'result_card') throw new Error('RESULT_NODE_NOT_REACHED')
      await refetch()
      Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${slug}&nodeId=${node.id}` })
    } catch {
      Taro.showToast({ title: '没成功，再点一次即可', icon: 'none' })
    } finally {
      setIsConfirming(false)
    }
  }

  const handleShowMap = () => {
    if (!config?.endPoint) {
      Taro.showToast({ title: '路线正在准备中', icon: 'none' })
      return
    }
    setShowMap(true)
  }

  if (showMap && config) {
    return (
      <View className='alang-companion__map-full'>
        <Map
          className="alang-companion__map-full-map"
          latitude={config.endPoint.lat}
          longitude={config.endPoint.lng}
          onError={() => {}}
          showLocation
          circles={[{
            latitude: config.endPoint.lat,
            longitude: config.endPoint.lng,
            radius: 5,
            fillColor: '#FF6B9D20',
            color: '#FF6B9D80',
            strokeWidth: 2,
          }]}
        />
        <View className='alang-companion__map-back' onClick={() => setShowMap(false)}>
          <Text>返回</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='alang-companion'>
      <View className='alang-companion__atmosphere'>
        <Text className='alang-companion__title'>陪阿浪一起走</Text>
        {companionLines.slice(0, lineIndex + 1).map((line, idx) => (
          <View key={idx} className='alang-companion__line-wrap'>
            <Text className='alang-companion__line'>{line}</Text>
          </View>
        ))}
      </View>

      <View className='alang-companion__status'>
        <Text className='alang-companion__distance'>
          {distance !== null ? `剩余 ${Math.round(distance)} 米` : '计算距离中…'}
        </Text>
      </View>

      <View className='alang-companion__actions'>
        <View className='alang-companion__map-btn' onClick={handleShowMap}>
          <Text className='alang-companion__map-btn-text'>查看路线</Text>
        </View>
      </View>

      {arrived && (
        <View className='alang-companion__arrival'>
          <Text className='alang-companion__arrival-text'>我们到了</Text>
          <View className='alang-companion__arrival-cta' onClick={handleConfirmArrival}>
            <Text className='alang-companion__arrival-cta-text'>{isConfirming ? '正在生成结果…' : '确认到达'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
