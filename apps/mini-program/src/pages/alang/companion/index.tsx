import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { View, Text, Map, Image, ScrollView } from '@tarojs/components'
import type { MapProps } from '@tarojs/components'
import type { MissionContent, StoryNode } from '@shared/alang/contentSchema'
import {
  normalizeAlangCoordinate,
  type AlangCoordinate,
} from '@shared/alang/missionTypes'
import { getWalkingRoute, type WalkingRouteSuccessResponse } from '@shared/api'
import { useAlangMissionDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { useAlangGps } from '../../../lib/alang/useAlangGps'
import { callReportProgress, getCurrentPosition } from '../../../lib/alang/api'
import { apiRequest } from '../../../lib/api/api'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import StatusCard from '../../../components/ui/StatusCard'
import { haptics } from '../../../lib/utils/haptics'
import { BRAND_COLORS } from '../../../styles/colors'
import './index.scss'

type DebugCompanionConfig = {
  endPoint?: unknown
}

function destinationFromStoredConfig(slug: string): AlangCoordinate | null {
  if (!slug) return null
  try {
    const stored = Taro.getStorageSync(`jj_alang_config_${slug}`) as DebugCompanionConfig | undefined
    return normalizeAlangCoordinate(stored?.endPoint)
  } catch {
    return null
  }
}

export default function AlangCompanionPage() {
  const { user } = useAuth()
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const urlNodeId = Taro.getCurrentInstance().router?.params?.nodeId ?? ''
  const { data: mission, isLoading, isError, refetch } = useAlangMissionDetail(
    slug,
    !!slug && !!user?.features?.alangEnabled,
  )
  const atmosphere = useAlangAssetSource('companionAtmosphere')

  const [showMap, setShowMap] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [currentNodeId, setCurrentNodeId] = useState(urlNodeId)
  const [isConfirming, setIsConfirming] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [route, setRoute] = useState<WalkingRouteSuccessResponse | null>(null)
  const [routeUnavailable, setRouteUnavailable] = useState(false)
  const navigationKeyRef = useRef('')
  const arrivalFeedbackRef = useRef(false)

  const content = mission?.content as MissionContent | undefined
  const nodes = useMemo<StoryNode[]>(() => content?.nodes ?? [], [content?.nodes])
  const progress = mission?.myProgress
  const currentNode = nodes.find((node) => node.id === currentNodeId)
  const companionNode = currentNode?.type === 'companion_move'
    ? currentNode
    : [...(progress?.nodeHistory ?? [])]
      .reverse()
      .map((id) => nodes.find((node) => node.id === id))
      .find((node) => node?.type === 'companion_move')
  const companionLines = companionNode?.content.companionLines ?? []
  const routeDestination = normalizeAlangCoordinate(mission?.routeDestination)
    ?? (canUseDebugTools ? destinationFromStoredConfig(slug) : null)

  useDidShow(() => {
    if (slug) void refetch()
  })

  useEffect(() => {
    if (!progress) return
    if (!urlNodeId || progress.currentNodeId !== urlNodeId) {
      setCurrentNodeId(progress.currentNodeId)
    }
    if (progress.stage === 'arrived') setArrived(true)
  }, [progress, urlNodeId])

  // A stale URL never decides the user's position in the story. Recover from
  // the server stage and replace this page when the current phase belongs
  // elsewhere.
  useEffect(() => {
    if (!progress || ['companion', 'arrived'].includes(progress.stage)) return
    const key = `${progress.progressId}:${progress.stage}:${progress.currentNodeId}`
    if (navigationKeyRef.current === key) return

    const encodedSlug = encodeURIComponent(slug)
    const encodedNode = encodeURIComponent(progress.currentNodeId)
    const url = progress.stage === 'searching'
      ? `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${encodedSlug}&nodeId=${encodedNode}`
      : ['found', 'dialogue'].includes(progress.stage)
        ? `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${encodedSlug}&nodeId=${encodedNode}`
        : ['closing', 'result', 'completed'].includes(progress.stage)
          ? `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodedSlug}`
          : `${MINI_PROGRAM_ROUTES.alangEventDetail}?slug=${encodedSlug}`

    navigationKeyRef.current = key
    void Taro.redirectTo({ url }).catch(() => {
      navigationKeyRef.current = ''
    })
  }, [progress, slug])

  useEffect(() => {
    if (currentNode?.type !== 'companion_start' || !currentNode.nextNodeId) return
    let active = true
    callReportProgress(slug, currentNode.nextNodeId)
      .then(async (updated) => {
        if (!active) return
        setCurrentNodeId(updated.currentNodeId)
        await refetch()
      })
      .catch(() => {
        if (active) Taro.showToast({ title: '陪伴片段没有接上，再试一次即可', icon: 'none' })
      })
    return () => { active = false }
  }, [currentNode, refetch, slug])

  useEffect(() => {
    if (companionLines.length === 0) return
    setLineIndex(0)
    const timer = setInterval(() => {
      setLineIndex((index) => {
        if (index >= companionLines.length - 1) {
          clearInterval(timer)
          return index
        }
        return index + 1
      })
    }, 8000)
    return () => clearInterval(timer)
  }, [companionLines])

  const handleArrival = useCallback(() => {
    if (!arrivalFeedbackRef.current) {
      arrivalFeedbackRef.current = true
      haptics('light')
      alangEvents.arrivalReached(slug)
    }
    setArrived(true)
  }, [slug])

  const handleGpsError = useCallback(() => {
    setLocationError(true)
    void Taro.getSetting()
      .then((setting) => {
        setPermissionDenied(setting.authSetting?.['scope.userLocation'] === false)
      })
      .catch(() => undefined)
  }, [])

  const {
    distance,
    nodeId: gpsNodeId,
    position,
  } = useAlangGps({
    slug,
    target: routeDestination ?? undefined,
    enabled: !!slug && currentNode?.type === 'companion_move' && !arrived,
    onArrival: handleArrival,
    onError: handleGpsError,
  })

  useEffect(() => {
    if (!position) return
    setLocationError(false)
    setPermissionDenied(false)
  }, [position])

  const handleOpenSetting = useCallback(async () => {
    try {
      const setting = await Taro.openSetting()
      if (setting.authSetting?.['scope.userLocation'] === true) {
        setPermissionDenied(false)
        setLocationError(false)
        await refetch()
      }
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }, [refetch])

  const handleConfirmArrival = async () => {
    if (!slug || !arrived || isConfirming) return
    alangEvents.confirmArrivalTap(slug)
    setIsConfirming(true)
    try {
      let node = nodes.find((item) => item.id === (gpsNodeId || currentNodeId))
      let safety = 0
      while (node && node.type !== 'result_card' && safety < nodes.length) {
        if (!node.nextNodeId) throw new Error('NO_PATH_TO_RESULT')
        const nextNode = nodes.find((item) => item.id === node?.nextNodeId)
        if (!nextNode) throw new Error('INVALID_RESULT_PATH')
        const updated = await callReportProgress(slug, nextNode.id)
        setCurrentNodeId(updated.currentNodeId)
        node = nextNode
        safety += 1
      }
      if (node?.type !== 'result_card') throw new Error('RESULT_NODE_NOT_REACHED')
      await refetch()
      Taro.redirectTo({
        url: `${MINI_PROGRAM_ROUTES.alangResult}?slug=${encodeURIComponent(slug)}&nodeId=${encodeURIComponent(node.id)}`,
      })
    } catch {
      Taro.showToast({ title: '没有接上故事结尾，再点一次即可', icon: 'none' })
    } finally {
      setIsConfirming(false)
    }
  }

  const handleShowMap = async () => {
    if (!routeDestination) {
      Taro.showToast({ title: '路线终点还没有准备好', icon: 'none' })
      return
    }

    alangEvents.mapViewTap(slug)
    setShowMap(true)
    setMapError(false)
    setRouteUnavailable(false)
    setRouteLoading(true)

    try {
      let from = position
      if (!from) {
        const current = await getCurrentPosition()
        from = { latitude: current.latitude, longitude: current.longitude }
      }
      const result = await getWalkingRoute(apiRequest, {
        from,
        to: routeDestination,
      })
      if (result.success) {
        setRoute(result)
      } else {
        setRoute(null)
        setRouteUnavailable(true)
      }
    } catch {
      // Route rendering is auxiliary. Geofence reporting and story progress
      // continue independently when Tencent routing or location is unavailable.
      setRoute(null)
      setRouteUnavailable(true)
    } finally {
      setRouteLoading(false)
    }
  }

  const polyline = useMemo<NonNullable<MapProps['polyline']>>(() => (
    route && route.polyline.length > 1
      ? [{
          points: route.polyline,
          color: `${BRAND_COLORS.secondary}CC`,
          width: 7,
          dottedLine: false,
          arrowLine: true,
        }]
      : []
  ), [route])

  const markers = useMemo<NonNullable<MapProps['markers']>>(() => (
    routeDestination
      ? [{
          id: 1,
          latitude: routeDestination.latitude,
          longitude: routeDestination.longitude,
          title: '陪伴终点',
          iconPath: '/assets/icons/ui/icon-location.webp',
          width: 34,
          height: 34,
        }]
      : []
  ), [routeDestination])

  if (isLoading) {
    return <View className='alang-companion__loading'><Text>正在接上同行片段…</Text></View>
  }

  if (isError || !mission) {
    return (
      <View className='alang-companion__status-shell'>
        <StatusCard
          tone='error'
          title='同行片段暂时没有打开'
          description='网络恢复后，故事会从服务端进度继续。'
          action={{ label: '重新打开', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  if (showMap && routeDestination) {
    return (
      <View className='alang-companion__map-full'>
        <Map
          className='alang-companion__map-full-map'
          latitude={routeDestination.latitude}
          longitude={routeDestination.longitude}
          showLocation
          markers={markers}
          polyline={polyline}
          circles={[{
            latitude: routeDestination.latitude,
            longitude: routeDestination.longitude,
            radius: 5,
            fillColor: `${BRAND_COLORS.secondary}20`,
            color: `${BRAND_COLORS.secondary}80`,
            strokeWidth: 2,
          }]}
          onError={() => setMapError(true)}
        />
        <View className='alang-companion__map-panel'>
          <Text className='alang-companion__map-title'>一起走到陪伴终点</Text>
          <Text className='alang-companion__map-detail'>
            {routeLoading
              ? '正在规划步行路线…'
              : route
                ? `${Math.round(route.distanceMeters)} 米 · 约 ${Math.max(1, Math.ceil(route.durationSeconds / 60))} 分钟`
                : '先按地图方向前进，距离判断仍会继续'}
          </Text>
          {(routeUnavailable || mapError) && (
            <Text className='alang-companion__map-warning'>路线服务暂时不可用，不影响到达判断和故事进度。</Text>
          )}
        </View>
        <View
          className='alang-companion__map-back'
          onClick={() => setShowMap(false)}
          role='button'
          aria-label='返回同行'
        >
          <Text>返回同行</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className='alang-companion' scrollY>
      <View className='alang-companion__content'>
      <View className='alang-companion__visual'>
        <Image
          className='alang-companion__visual-image'
          src={atmosphere.src}
          mode='aspectFill'
          onError={atmosphere.onError}
        />
        <View className='alang-companion__visual-wash' />
        {atmosphere.usingFallback && (
          <Text className='alang-companion__placeholder-label'>陪伴场景示意</Text>
        )}
      </View>

      <View className='alang-companion__atmosphere'>
        <Text className='alang-companion__eyebrow'>陪阿浪走一段</Text>
        <Text className='alang-companion__title'>不急着回答，先一起往前走</Text>
        {companionLines.slice(0, lineIndex + 1).map((line, index) => (
          <View key={`${index}-${line}`} className='alang-companion__line-wrap'>
            <Text className='alang-companion__line'>{line}</Text>
          </View>
        ))}
      </View>

      <View className='alang-companion__status'>
        <Text className='alang-companion__status-label'>距离陪伴终点约</Text>
        <Text className='alang-companion__distance'>
          {distance !== null ? `${Math.max(0, Math.round(distance))} 米` : '正在定位…'}
        </Text>
        <Text className='alang-companion__status-note'>靠近终点并稳定停留片刻，确认按钮会自动亮起</Text>
      </View>

      {(locationError || permissionDenied) && (
        <View className='alang-companion__recovery'>
          <Text className='alang-companion__recovery-title'>定位暂时没有更新</Text>
          <Text className='alang-companion__recovery-copy'>故事进度已经保存，恢复定位后会继续判断距离。</Text>
          {permissionDenied && (
            <View
              className='alang-companion__recovery-btn'
              onClick={() => { void handleOpenSetting() }}
              role='button'
              aria-label='打开定位设置'
            >
              <Text>打开定位设置</Text>
            </View>
          )}
        </View>
      )}

      <View className='alang-companion__actions'>
        <View
          className='alang-companion__map-btn'
          onClick={() => { void handleShowMap() }}
          role='button'
          aria-label='查看步行路线'
        >
          <Text className='alang-companion__map-btn-text'>查看步行路线</Text>
        </View>
      </View>

        {arrived && (
        <View className='alang-companion__arrival'>
          <Text className='alang-companion__arrival-text'>你们到了</Text>
          <Text className='alang-companion__arrival-note'>确认后先看结果卡，再决定是否收录故事。</Text>
          <View
            className={`alang-companion__arrival-cta${isConfirming ? ' alang-companion__arrival-cta--disabled' : ''}`}
            onClick={() => { void handleConfirmArrival() }}
            role='button'
            aria-label={isConfirming ? '正在生成结果' : '确认到达'}
            aria-disabled={isConfirming}
          >
            <Text className='alang-companion__arrival-cta-text'>
              {isConfirming ? '正在生成结果…' : '确认到达'}
            </Text>
          </View>
        </View>
        )}
      </View>
    </ScrollView>
  )
}
