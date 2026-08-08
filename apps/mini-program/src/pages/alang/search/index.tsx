import Taro, { useDidHide } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map, ScrollView, Text, View } from '@tarojs/components'
import type { MapProps } from '@tarojs/components'
import { getWalkingRoute, type WalkingRouteSuccessResponse } from '@shared/api'
import { FlashButton, FlashFeatureClosed, FlashNpcPortrait, FlashNpcSceneBackdrop, FlashPageState, formatFlashAvailability } from '../../../components/alang/FlashUi'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode, getFlashLocationPermission } from '../../../lib/alang/flashApi'
import { decodeFlashRouteParam, redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useLocateFlashAppearance } from '../../../lib/alang/useFlash'
import type { FlashLocationSnapshot, FlashLocateView } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { apiRequest } from '../../../lib/api/api'
import '../flash.scss'

type LocateState = 'idle' | 'locating' | 'tracking' | 'inside' | 'denied' | 'ended' | 'rate_limited' | 'error'

const FOUND_REVEAL_MS = 420
const MAP_FRAME_INTERVAL_MS = 2_000

const MAP_STATUS: Record<LocateState, { label: string; assistiveLabel: string }> = {
  idle: { label: '待开启', assistiveLabel: '地图引导尚未开启' },
  locating: { label: '连接中', assistiveLabel: '正在开启前台持续定位和方向传感器' },
  tracking: { label: '引导中', assistiveLabel: '地图正在根据当前位置指引目标点' },
  inside: { label: '找到了', assistiveLabel: '已经到达隐藏目标点附近' },
  denied: { label: '未连接', assistiveLabel: '定位权限未开启' },
  ended: { label: '已散场', assistiveLabel: '本次闪现已经结束' },
  rate_limited: { label: '稍后再试', assistiveLabel: '地图定位请求暂时已达安全上限' },
  error: { label: '连接中断', assistiveLabel: '地图引导暂时无法继续' },
}

type LocationChangeHandler = Parameters<typeof Taro.onLocationChange>[0]
export default function FlashMapPage() {
  const enabled = shouldShowStreetBlindBoxEntry()
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const appearanceId = decodeFlashRouteParam(params.appearanceId)
  const npcName = decodeFlashRouteParam(params.npcName, '这位朋友')
  const npcSlug = decodeFlashRouteParam(params.npcSlug)
  const districtName = decodeFlashRouteParam(params.districtName, '深圳')
  const locationAddress = decodeFlashRouteParam(params.locationAddress)
  const endsAt = decodeFlashRouteParam(params.endsAt)
  const availabilityMode = decodeFlashRouteParam(params.availabilityMode) === 'manual_hold' ? 'manual_hold' : 'scheduled'
  const locateMutation = useLocateFlashAppearance()
  const [state, setState] = useState<LocateState>('idle')
  const [mapFrame, setMapFrame] = useState<FlashLocateView | null>(null)
  const [currentLocation, setCurrentLocation] = useState<FlashLocationSnapshot | null>(null)
  const [walkingRoute, setWalkingRoute] = useState<WalkingRouteSuccessResponse | null>(null)
  const [routeUnavailable, setRouteUnavailable] = useState(false)
  const mapStatus = MAP_STATUS[state]
  const trackingRef = useRef(false)
  const requestInFlightRef = useRef(false)
  const lastFrameAtRef = useRef(0)
  const lastRouteAtRef = useRef(0)
  const didAutoStartRef = useRef(false)
  const locationHandlerRef = useRef<LocationChangeHandler | null>(null)

  const isPossiblyLate = useMemo(() => {
    if (availabilityMode === 'manual_hold' || !endsAt) return false
    const remaining = new Date(endsAt).getTime() - Date.now()
    return Number.isFinite(remaining) && remaining > 0 && remaining <= 15 * 60 * 1000
  }, [availabilityMode, endsAt])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: `寻找${npcName}` })
  }, [npcName])

  const stopMapGuidance = useCallback((resetState = true) => {
    trackingRef.current = false
    requestInFlightRef.current = false
    if (locationHandlerRef.current) Taro.offLocationChange(locationHandlerRef.current)
    locationHandlerRef.current = null
    Taro.stopLocationUpdate()
    if (resetState) setState('idle')
  }, [])

  const handleMapFailure = useCallback(async (error: unknown) => {
    stopMapGuidance(false)
    const code = getFlashApiErrorCode(error)
    if (code === 'FLASH_APPEARANCE_ENDED' || code === 'FLASH_APPEARANCE_NOT_FOUND' || code === 'NOT_FOUND') {
      setState('ended')
      return
    }
    if (code === 'FLASH_LOCATE_RATE_LIMITED') {
      setState('rate_limited')
      return
    }
    const permission = await getFlashLocationPermission()
    setState(permission === 'denied' ? 'denied' : 'error')
  }, [stopMapGuidance])

  const submitMapFrame = useCallback(async (location: FlashLocationSnapshot) => {
    if (!trackingRef.current || !appearanceId || requestInFlightRef.current) return
    const now = Date.now()
    if (now - lastFrameAtRef.current < MAP_FRAME_INTERVAL_MS) return
    lastFrameAtRef.current = now
    requestInFlightRef.current = true
    try {
      const response = await locateMutation.mutateAsync({ appearanceId, location })
      if (!trackingRef.current) return
      setCurrentLocation(location)
      setMapFrame(response)
      if (response.canonicalScreen === 'unavailable') {
        stopMapGuidance(false)
        setState('ended')
        return
      }
      if (response.withinRange) {
        stopMapGuidance(false)
        setState('inside')
        haptics('success')
        await new Promise((resolve) => setTimeout(resolve, FOUND_REVEAL_MS))
        const redirected = await redirectToFlashCanonical(response, MINI_PROGRAM_ROUTES.alangSearch)
        if (!redirected && response.encounterId) {
          await Taro.redirectTo({
            url: `${MINI_PROGRAM_ROUTES.alangDialogue}?encounterId=${encodeURIComponent(response.encounterId)}`,
          })
        }
        return
      }
      if (lastRouteAtRef.current === 0 || now - lastRouteAtRef.current >= 30_000) {
        lastRouteAtRef.current = now
        try {
          const route = await getWalkingRoute(apiRequest, {
            from: { latitude: location.latitude, longitude: location.longitude },
            to: response.destination,
          })
          if (route.success) {
            setWalkingRoute(route)
            setRouteUnavailable(false)
          } else {
            setRouteUnavailable(true)
          }
        } catch {
          setRouteUnavailable(true)
        }
      }
      setState('tracking')
    } catch (error) {
      await handleMapFailure(error)
    } finally {
      requestInFlightRef.current = false
    }
  }, [appearanceId, handleMapFailure, locateMutation, stopMapGuidance])

  const startMapGuidance = useCallback(async () => {
    if (!enabled || !appearanceId || trackingRef.current) return
    setState('locating')
    setMapFrame(null)
    setWalkingRoute(null)
    setRouteUnavailable(false)
    lastFrameAtRef.current = 0
    lastRouteAtRef.current = 0

    const locationHandler: LocationChangeHandler = (location) => {
      void submitMapFrame({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      })
    }
    locationHandlerRef.current = locationHandler
    Taro.onLocationChange(locationHandler)

    try {
      await new Promise<void>((resolve, reject) => {
        Taro.startLocationUpdate({ type: 'gcj02', success: () => resolve(), fail: reject })
      })
      trackingRef.current = true
      setState('tracking')
    } catch (error) {
      await handleMapFailure(error)
    }
  }, [appearanceId, enabled, handleMapFailure, submitMapFrame])

  useEffect(() => {
    if (!enabled || !appearanceId || didAutoStartRef.current) return
    didAutoStartRef.current = true
    void startMapGuidance()
  }, [appearanceId, enabled, startMapGuidance])

  const mapMarkers = useMemo<NonNullable<MapProps['markers']>>(() => mapFrame ? [{
    id: 1,
    latitude: mapFrame.destination.latitude,
    longitude: mapFrame.destination.longitude,
    title: `${npcName}在这里`,
    iconPath: '/assets/icons/ui/icon-location.webp',
    width: 36,
    height: 36,
  }] : [], [npcName, mapFrame])

  const mapPolyline = useMemo<NonNullable<MapProps['polyline']>>(() => walkingRoute ? [{
    points: walkingRoute.polyline,
    color: '#8B5CF6',
    width: 6,
    arrowLine: true,
    borderColor: '#FFFFFF',
    borderWidth: 2,
  }] : [], [walkingRoute])

  const handleOpenSetting = async () => {
    try {
      const setting = await Taro.openSetting()
      setState(setting.authSetting?.['scope.userLocation'] === true ? 'idle' : 'denied')
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }

  useDidHide(() => stopMapGuidance())
  useEffect(() => () => stopMapGuidance(false), [stopMapGuidance])

  if (!enabled) return <FlashFeatureClosed />

  if (!appearanceId) {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这次闪现已经散场了'
          description='入口信息不完整，回到闪现页看看还有谁在线。'
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回闪现'
        />
      </View>
    )
  }

  return (
    <View className='flash-page flash-radar'>
      <FlashNpcSceneBackdrop scene='radar' />
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content flash-radar__content'>
          <View className='flash-radar__npc'>
            <FlashNpcPortrait npc={{ slug: npcSlug, name: npcName }} size='large' />
            <Text className='flash-radar__name'>{npcName}</Text>
            <Text className='flash-radar__meta'>在{districtName} · {formatFlashAvailability(availabilityMode, undefined, endsAt)}</Text>
            {locationAddress ? <Text className='flash-radar__address'>{locationAddress}</Text> : null}
          </View>

          <View className='flash-radar__map-shell' data-testid='flash-navigation-map' aria-label={mapStatus.assistiveLabel}>
            {mapFrame && currentLocation ? (
              <Map
                className='flash-radar__map'
                latitude={(currentLocation.latitude + mapFrame.destination.latitude) / 2}
                longitude={(currentLocation.longitude + mapFrame.destination.longitude) / 2}
                scale={16}
                showLocation
                markers={mapMarkers}
                polyline={mapPolyline}
                onError={() => setRouteUnavailable(true)}
              />
            ) : (
              <View className='flash-radar__map-loading'>
                <Text className='flash-radar__map-loading-title'>正在打开地图…</Text>
                <Text className='flash-radar__map-loading-copy'>确认你的位置后，就会显示前往{npcName}出现点的路线。</Text>
              </View>
            )}
          </View>

          {mapFrame ? (
            <View className='flash-radar__live-readout' role='status'>
              <Text className='flash-radar__distance'>{mapFrame.distanceMeters} 米</Text>
              <Text className='flash-radar__direction-copy'>沿地图路线前往{npcName}本次固定出现点</Text>
              {walkingRoute ? (
                <Text className='flash-radar__route-meta'>步行约 {Math.max(1, Math.ceil(walkingRoute.durationSeconds / 60))} 分钟 · {walkingRoute.distanceMeters} 米</Text>
              ) : null}
              {routeUnavailable ? <Text className='flash-radar__route-fallback'>步行路线暂时没有加载，可先按地图终点方向前往。</Text> : null}
            </View>
          ) : (
            <>
              <Text className='flash-radar__title'>正在获取前往出现点的路线</Text>
              <Text className='flash-radar__copy'>地图只在此页前台更新；离开页面会立即停止定位。</Text>
            </>
          )}
          <Text className='flash-visually-hidden'>页面会读取前台位置，用于显示到本次固定出现点的地图路线并确认到达。</Text>

          {isPossiblyLate ? (
            <View className='flash-radar__warning' role='status'>
              <Text>可能有点来不及了，但去不去还是你决定。角色到点会正常离开。</Text>
            </View>
          ) : null}

          {state === 'ended' ? (
            <View className='flash-radar__result' role='status'>
              <Text className='flash-radar__result-title'>刚好散场了</Text>
              <Text className='flash-radar__result-copy'>角色到点就会离开，不接受预约，也不会为这次寻找延长时间。</Text>
              <FlashButton variant='secondary' onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>看看还有谁在线</FlashButton>
            </View>
          ) : null}

          {state === 'denied' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>定位权限没有打开</Text>
              <Text className='flash-radar__result-copy'>拒绝定位就无法显示地图路线，我们也不会改用 IP 定位。</Text>
              <FlashButton variant='secondary' onClick={() => { void handleOpenSetting() }}>打开定位设置</FlashButton>
            </View>
          ) : null}

          {state === 'rate_limited' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>位置更新太频繁了</Text>
              <Text className='flash-radar__result-copy'>地图定位已自动停止。稍后重新开启即可。</Text>
            </View>
          ) : null}

          {state === 'error' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>地图定位中断</Text>
              <Text className='flash-radar__result-copy'>定位信号或网络可能暂时不稳定，可以重新开启。</Text>
            </View>
          ) : null}

          <View className='flash-radar__actions'>
            <FlashButton
              disabled={state === 'locating' || state === 'tracking' || state === 'inside'}
              onClick={() => { void startMapGuidance() }}
            >
              {state === 'locating' ? '正在打开地图…' : state === 'tracking' ? '地图引导中' : '重新打开地图'}
            </FlashButton>
            {state === 'tracking' ? (
              <FlashButton variant='secondary' onClick={() => stopMapGuidance()}>停止地图引导</FlashButton>
            ) : null}
            <FlashButton variant='quiet' onClick={() => { stopMapGuidance(); void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>
              先不去了
            </FlashButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
