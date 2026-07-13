import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { View, Text, Map, Button } from '@tarojs/components'
import type { MapProps } from '@tarojs/components'
import { useAlangMissionDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { haversine } from '../../../lib/alang/api'
import { useAlangGpsOnce } from '../../../lib/alang/useAlangGps'
import { callReportProgress } from '../../../lib/alang/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { ALANG_ARRIVAL_RADIUS_METERS, ALANG_DEFAULT_SEARCH_RADIUS_METERS } from '@shared/alang/constants'
import './index.scss'

export default function AlangConfigPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission } = useAlangMissionDetail(slug, !!slug && !!user?.features?.alangEnabled)
  const { position, request, loading } = useAlangGpsOnce()

  const content = mission?.content as any
  const nodes: Array<any> = content?.nodes ?? []

  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [endPoint, setEndPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleGetLocation = useCallback(async () => {
    const pos = await request()
    if (pos) {
      setTarget({ lat: pos.lat, lng: pos.lng })
      setEndPoint({ lat: pos.lat + 0.00135, lng: pos.lng })
    }
  }, [request])

  const handleMapTap = useCallback((e: any) => {
    const { latitude, longitude } = e.detail
    if (!target) {
      setTarget({ lat: latitude, lng: longitude })
    } else if (!endPoint) {
      setEndPoint({ lat: latitude, lng: longitude })
    }
  }, [target, endPoint])

  // WeChat Map marker does not support native drag.
  // Provide arrow buttons for fine-tuning position.
  const ADJUST_STEP_METERS = 10
  const adjustPoint = (point: 'target' | 'end', dx: number, dy: number) => {
    const setter = point === 'target' ? setTarget : setEndPoint
    const current = point === 'target' ? target : endPoint
    if (!current) return
    // Approx: 1 deg lat ~ 111km, 1 deg lng ~ 111km * cos(lat)
    const latDelta = dy / 111000
    const lngDelta = dx / (111000 * Math.cos(current.lat * Math.PI / 180))
    setter({ lat: current.lat + latDelta, lng: current.lng + lngDelta })
  }

  const handleMarkerTap = useCallback<NonNullable<MapProps['onMarkerTap']>>((e) => {
    const markerId = e.detail.markerId
    Taro.showToast({
      title: Number(markerId) === 1 ? '已选择阿浪出现点' : '已选择陪伴终点',
      icon: 'none',
    })
  }, [])

  const distance = target && endPoint ? haversine(target.lat, target.lng, endPoint.lat, endPoint.lng) : 0
  const walkMinutes = Math.round((distance / 80) * 60)

  const handleConfirm = async () => {
    if (!target || !endPoint || !mission?.myProgress || isSubmitting) return
    const searchNode = nodes.find((node) => node.type === 'search_gate')
    if (!searchNode) {
      Taro.showToast({ title: '故事配置暂不可用', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    try {
      let currentNode = nodes.find((node) => node.id === mission.myProgress?.currentNodeId)
      let safety = 0
      while (currentNode && currentNode.id !== searchNode.id && safety < nodes.length) {
        if (!currentNode.nextNodeId) throw new Error('NO_PATH_TO_SEARCH')
        const nextNode = nodes.find((node) => node.id === currentNode.nextNodeId)
        if (!nextNode) throw new Error('INVALID_SEARCH_PATH')
        await callReportProgress(slug, nextNode.id)
        currentNode = nextNode
        safety += 1
      }
      if (currentNode?.id !== searchNode.id) throw new Error('SEARCH_NODE_NOT_REACHED')

      Taro.setStorageSync(`jj_alang_config_${slug}`, {
        target,
        endPoint,
        radius: ALANG_ARRIVAL_RADIUS_METERS,
      })
      Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${slug}&nodeId=${searchNode.id}` })
    } catch {
      Taro.showToast({ title: '没成功，再试一次即可', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const markers: NonNullable<MapProps['markers']> = []
  if (target) {
    markers.push({
      id: 1,
      latitude: target.lat,
      longitude: target.lng,
      title: '阿浪出现点',
      iconPath: '/assets/icons/ui/icon-location.webp',
      width: 32,
      height: 32,
    })
  }
  if (endPoint) {
    markers.push({
      id: 2,
      latitude: endPoint.lat,
      longitude: endPoint.lng,
      title: '陪伴终点',
      iconPath: '/assets/icons/ui/icon-location.webp',
      width: 32,
      height: 32,
    })
  }

  const mapLat = target?.lat ?? position?.lat ?? 22.5431
  const mapLng = target?.lng ?? position?.lng ?? 114.0579

  return (
    <View className='alang-config'>
      <View className='alang-config__header'>
        <Text className='alang-config__title'>配置测试点位</Text>
        <Text className='alang-config__hint'>拖动地图或点击设置两个点</Text>
      </View>

      <View className='alang-config__map-wrap'>
        <Map
          className='alang-config__map'
          latitude={mapLat}
          longitude={mapLng}
          onError={() => {}}
          showLocation
          onTap={handleMapTap}
          onMarkerTap={handleMarkerTap}
          markers={markers}
          circles={target ? [{
            latitude: target.lat,
            longitude: target.lng,
            radius: ALANG_DEFAULT_SEARCH_RADIUS_METERS,
            fillColor: '#8B5CF620',
            color: '#8B5CF680',
            strokeWidth: 2,
          }] : []}
        />
        {!target && (
          <View className='alang-config__map-overlay'>
            <Button className='alang-config__loc-btn' onClick={handleGetLocation} loading={loading}>
              使用当前位置
            </Button>
          </View>
        )}
      </View>

      <View className='alang-config__info'>
        {target && (
          <>
            <View className='alang-config__info-row'>
              <Text className='alang-config__info-label'>阿浪出现点</Text>
              <Text className='alang-config__info-value'>
                {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
              </Text>
            </View>
            <View className='alang-config__adjust-row'>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('target', 0, ADJUST_STEP_METERS)}><Text>↑</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('target', -ADJUST_STEP_METERS, 0)}><Text>←</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('target', 0, -ADJUST_STEP_METERS)}><Text>↓</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('target', ADJUST_STEP_METERS, 0)}><Text>→</Text></View>
              <Text className='alang-config__adjust-hint'>微调阿浪出现点 (10m)</Text>
            </View>
          </>
        )}
        {endPoint && (
          <>
            <View className='alang-config__info-row'>
              <Text className='alang-config__info-label'>陪伴终点</Text>
              <Text className='alang-config__info-value'>
                {endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)}
              </Text>
            </View>
            <View className='alang-config__adjust-row'>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('end', 0, ADJUST_STEP_METERS)}><Text>↑</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('end', -ADJUST_STEP_METERS, 0)}><Text>←</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('end', 0, -ADJUST_STEP_METERS)}><Text>↓</Text></View>
              <View className='alang-config__adjust-btn' onClick={() => adjustPoint('end', ADJUST_STEP_METERS, 0)}><Text>→</Text></View>
              <Text className='alang-config__adjust-hint'>微调陪伴终点 (10m)</Text>
            </View>
          </>
        )}
        {target && endPoint && (
          <View className='alang-config__info-row'>
            <Text className='alang-config__info-label'>直线距离</Text>
            <Text className='alang-config__info-value'>{Math.round(distance)} 米</Text>
          </View>
        )}
        {target && endPoint && (
          <View className='alang-config__info-row'>
            <Text className='alang-config__info-label'>预计步行</Text>
            <Text className='alang-config__info-value'>约 {Math.max(1, walkMinutes)} 分钟</Text>
          </View>
        )}
      </View>

      <View className='alang-config__actions'>
        <View
          className={`alang-config__confirm ${!target || !endPoint || isSubmitting ? 'alang-config__confirm--disabled' : ''}`}
          onClick={handleConfirm}
        >
          <Text className='alang-config__confirm-text'>{isSubmitting ? '正在准备…' : '开始测试'}</Text>
        </View>
      </View>
    </View>
  )
}
