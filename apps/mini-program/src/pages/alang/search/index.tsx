import Taro, { useDidHide } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashNpcPortrait, FlashNpcSceneBackdrop, FlashPageState, formatFlashRemainingTime } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode, getFlashLocationPermission } from '../../../lib/alang/flashApi'
import { decodeFlashRouteParam, redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useLocateFlashAppearance } from '../../../lib/alang/useFlash'
import type { FlashLocationSnapshot, FlashLocateView } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import '../flash.scss'

type LocateState = 'idle' | 'locating' | 'tracking' | 'inside' | 'denied' | 'ended' | 'rate_limited' | 'error'

const FOUND_REVEAL_MS = 420
const RADAR_FRAME_INTERVAL_MS = 2_000

const RADAR_STATUS: Record<LocateState, { label: string; assistiveLabel: string }> = {
  idle: { label: '待开启', assistiveLabel: '实时雷达尚未开启' },
  locating: { label: '连接中', assistiveLabel: '正在开启前台持续定位和方向传感器' },
  tracking: { label: '追踪中', assistiveLabel: '实时雷达正在根据位置和朝向指引目标点' },
  inside: { label: '找到了', assistiveLabel: '已经到达隐藏目标点附近' },
  denied: { label: '未连接', assistiveLabel: '定位权限未开启' },
  ended: { label: '已散场', assistiveLabel: '本次闪现已经结束' },
  rate_limited: { label: '稍后再试', assistiveLabel: '实时雷达请求暂时已达安全上限' },
  error: { label: '连接中断', assistiveLabel: '实时雷达暂时无法继续' },
}

type LocationChangeHandler = Parameters<typeof Taro.onLocationChange>[0]
type CompassChangeHandler = Parameters<typeof Taro.onCompassChange>[0]

export default function FlashRadarPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const appearanceId = decodeFlashRouteParam(params.appearanceId)
  const npcName = decodeFlashRouteParam(params.npcName, '这位朋友')
  const npcSlug = decodeFlashRouteParam(params.npcSlug)
  const districtName = decodeFlashRouteParam(params.districtName, '深圳')
  const locationAddress = decodeFlashRouteParam(params.locationAddress)
  const endsAt = decodeFlashRouteParam(params.endsAt)
  const locateMutation = useLocateFlashAppearance()
  const [state, setState] = useState<LocateState>('idle')
  const [radarFrame, setRadarFrame] = useState<FlashLocateView | null>(null)
  const [compassHeading, setCompassHeading] = useState(0)
  const radarStatus = RADAR_STATUS[state]
  const trackingRef = useRef(false)
  const requestInFlightRef = useRef(false)
  const lastFrameAtRef = useRef(0)
  const locationHandlerRef = useRef<LocationChangeHandler | null>(null)
  const compassHandlerRef = useRef<CompassChangeHandler | null>(null)

  const isPossiblyLate = useMemo(() => {
    if (!endsAt) return false
    const remaining = new Date(endsAt).getTime() - Date.now()
    return Number.isFinite(remaining) && remaining > 0 && remaining <= 15 * 60 * 1000
  }, [endsAt])

  const relativeBearing = useMemo(() => {
    if (!radarFrame) return 0
    return Math.round((radarFrame.targetBearingDegrees - compassHeading + 540) % 360 - 180)
  }, [compassHeading, radarFrame])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: `寻找${npcName}` })
  }, [npcName])

  const stopLiveRadar = useCallback((resetState = true) => {
    trackingRef.current = false
    requestInFlightRef.current = false
    if (locationHandlerRef.current) Taro.offLocationChange(locationHandlerRef.current)
    if (compassHandlerRef.current) Taro.offCompassChange(compassHandlerRef.current)
    locationHandlerRef.current = null
    compassHandlerRef.current = null
    Taro.stopLocationUpdate()
    void Taro.stopCompass()
    if (resetState) setState('idle')
  }, [])

  const handleRadarFailure = useCallback(async (error: unknown) => {
    stopLiveRadar(false)
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
  }, [stopLiveRadar])

  const submitRadarFrame = useCallback(async (location: FlashLocationSnapshot) => {
    if (!trackingRef.current || !appearanceId || requestInFlightRef.current) return
    const now = Date.now()
    if (now - lastFrameAtRef.current < RADAR_FRAME_INTERVAL_MS) return
    lastFrameAtRef.current = now
    requestInFlightRef.current = true
    try {
      const response = await locateMutation.mutateAsync({ appearanceId, location })
      if (!trackingRef.current) return
      setRadarFrame(response)
      if (response.canonicalScreen === 'unavailable') {
        stopLiveRadar(false)
        setState('ended')
        return
      }
      if (response.withinRange) {
        stopLiveRadar(false)
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
      setState('tracking')
    } catch (error) {
      await handleRadarFailure(error)
    } finally {
      requestInFlightRef.current = false
    }
  }, [appearanceId, handleRadarFailure, locateMutation, stopLiveRadar])

  const startLiveRadar = useCallback(async () => {
    if (!enabled || !appearanceId || trackingRef.current) return
    setState('locating')
    setRadarFrame(null)
    lastFrameAtRef.current = 0

    const locationHandler: LocationChangeHandler = (location) => {
      void submitRadarFrame({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      })
    }
    const compassHandler: CompassChangeHandler = ({ direction }) => {
      const normalized = Math.round((direction + 360) % 360)
      setCompassHeading(normalized)
    }
    locationHandlerRef.current = locationHandler
    compassHandlerRef.current = compassHandler
    Taro.onLocationChange(locationHandler)
    Taro.onCompassChange(compassHandler)

    try {
      await new Promise<void>((resolve, reject) => {
        Taro.startLocationUpdate({ type: 'gcj02', success: () => resolve(), fail: reject })
      })
      await Taro.startCompass()
      trackingRef.current = true
      setState('tracking')
    } catch (error) {
      await handleRadarFailure(error)
    }
  }, [appearanceId, enabled, handleRadarFailure, submitRadarFrame])

  const handleOpenSetting = async () => {
    try {
      const setting = await Taro.openSetting()
      setState(setting.authSetting?.['scope.userLocation'] === true ? 'idle' : 'denied')
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }

  useDidHide(() => stopLiveRadar())
  useEffect(() => () => stopLiveRadar(false), [stopLiveRadar])

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
            <Text className='flash-radar__meta'>在{districtName} · {formatFlashRemainingTime(undefined, endsAt)}</Text>
            {locationAddress ? <Text className='flash-radar__address'>{locationAddress}</Text> : null}
          </View>

          <View
            className={`flash-radar__instrument flash-radar__instrument--${state} flash-radar__instrument--${radarFrame?.proximityBand ?? 'unknown'}`}
            data-testid='flash-range-radar'
            aria-label={radarStatus.assistiveLabel}
          >
            <View className='flash-radar__paper-disc' />
            <View className='flash-radar__sweep' />
            <View className='flash-radar__ring flash-radar__ring--outer' />
            <View className='flash-radar__ring flash-radar__ring--middle' />
            <View className='flash-radar__ring flash-radar__ring--inner' />
            <View className='flash-radar__range-wave flash-radar__range-wave--one' />
            <View className='flash-radar__range-wave flash-radar__range-wave--two' />
            {radarFrame ? (
              <>
                <View
                  className='flash-radar__pointer'
                  data-testid='flash-radar-pointer'
                  style={{ transform: `rotate(${relativeBearing}deg)` }}
                  aria-hidden='true'
                >
                  <View className='flash-radar__pointer-tip' />
                </View>
                <View
                  className='flash-radar__target-orbit'
                  data-testid='flash-radar-target'
                  style={{ transform: `rotate(${relativeBearing}deg)` }}
                  aria-label='目标方向'
                >
                  <View className='flash-radar__target-pulse' />
                  <View className='flash-radar__target-dot' />
                </View>
              </>
            ) : null}
            <View className='flash-radar__signal'>
              <View className='flash-radar__signal-gem' />
              <Text className='flash-radar__signal-label'>{radarStatus.label}</Text>
            </View>
          </View>

          {radarFrame ? (
            <View className='flash-radar__live-readout' role='status'>
              <Text className='flash-radar__distance'>{radarFrame.distanceMeters} 米</Text>
            </View>
          ) : null}
          <Text className='flash-visually-hidden'>开启后持续读取前台位置与设备方向，用于显示到隐藏目标点的实时距离和方向。</Text>

          {isPossiblyLate ? (
            <View className='flash-radar__warning' role='status'>
              <Text>即将结束</Text>
            </View>
          ) : null}

          {state === 'ended' ? (
            <View className='flash-radar__result' role='status'>
              <Text className='flash-radar__result-title'>刚好散场了</Text>
              <FlashButton variant='secondary' onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>看看还有谁在线</FlashButton>
            </View>
          ) : null}

          {state === 'denied' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>需要定位权限</Text>
              <FlashButton variant='secondary' onClick={() => { void handleOpenSetting() }}>打开定位设置</FlashButton>
            </View>
          ) : null}

          {state === 'rate_limited' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>稍后再试</Text>
            </View>
          ) : null}

          {state === 'error' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>连接中断</Text>
            </View>
          ) : null}

          <View className='flash-radar__actions'>
            <FlashButton
              disabled={state === 'locating' || state === 'tracking' || state === 'inside'}
              onClick={() => { void startLiveRadar() }}
            >
              {state === 'locating' ? '连接中…' : state === 'tracking' ? '追踪中' : '开启雷达'}
            </FlashButton>
            {state === 'tracking' ? (
              <FlashButton variant='secondary' onClick={() => stopLiveRadar()}>停止雷达</FlashButton>
            ) : null}
            <FlashButton variant='quiet' onClick={() => { stopLiveRadar(); void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>
              返回
            </FlashButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
