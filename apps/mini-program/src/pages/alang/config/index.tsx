import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { View, Text, Map, Button, Input } from '@tarojs/components'
import type { MapProps } from '@tarojs/components'
import type { AlangCoordinate } from '@shared/alang/missionTypes'
import type { GeoPlace, WalkingRouteSuccessResponse } from '@shared/api'
import {
  getWalkingRoute,
  reverseGeocode,
  searchNearbyGeoPlaces,
  suggestGeoPlaces,
} from '@shared/api'
import {
  ALANG_DEFAULT_SEARCH_RADIUS_METERS,
} from '@shared/alang/constants'
import {
  ALANG_TEST_RECOMMENDED_MAX_DISTANCE_METERS,
  ALANG_TEST_RECOMMENDED_MIN_DISTANCE_METERS,
  validateAlangTestPointConfiguration,
} from '@shared/alang/testPointValidation'
import {
  useAlangMissionDetail,
  useResetAlangMission,
  useStartMission,
  useSyncAlangMissionProgress,
} from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { haversine } from '../../../lib/alang/api'
import { useAlangGpsOnce } from '../../../lib/alang/useAlangGps'
import { apiRequest } from '../../../lib/api/api'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { logInfo, logWarn } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import StatusCard from '../../../components/ui/StatusCard'
import './index.scss'

type PointKind = 'target' | 'end'

type PointLabel = {
  name?: string
  address?: string
}

const SHENZHEN_FALLBACK: AlangCoordinate = {
  latitude: 22.5431,
  longitude: 114.0579,
}

export function getTestPointValidationError(
  target: AlangCoordinate | null,
  endPoint: AlangCoordinate | null,
): string | null {
  const validation = validateAlangTestPointConfiguration(target, endPoint)
  if (validation.valid) return null
  if (validation.reason === 'invalid_coordinate' || validation.reason === 'outside_gcj02_bounds') {
    return '测试点位无效，请重新选择出现点和陪伴终点'
  }
  return '出现点与陪伴终点需相距 10–2000 米'
}

type AlangStartError = {
  statusCode?: number
  data?: unknown
  message?: string
}

function getAlangStartErrorCode(error: unknown): string | undefined {
  const data = (error as AlangStartError | null)?.data
  if (data && typeof data === 'object' && 'error' in data) {
    const code = (data as { error?: unknown }).error
    if (typeof code === 'string') return code
  }
  const message = (error as AlangStartError | null)?.message
  return typeof message === 'string' ? message : undefined
}

export function getAlangStartErrorMessage(error: unknown): string {
  const code = getAlangStartErrorCode(error)
  const statusCode = (error as AlangStartError | null)?.statusCode

  if (statusCode === 401) return '登录状态已失效，请重新进入小程序'
  if (code === 'ALANG_RECONFIG_REQUIRES_RESET' || code === 'ALANG_RETEST_REQUIRES_RESET') {
    return '检测到上一轮测试进度，请先重置阿浪测试，再开始新一轮'
  }
  if (code === 'ALANG_TEST_POINTS_REQUIRED' || code === 'ALANG_TEST_POINTS_INVALID') {
    return '测试点位没有保存成功，请重新设置两个点位'
  }
  if (code === 'ALANG_DISABLED') return '阿浪测试暂时关闭，请稍后再试'
  if (code === 'MISSION_NOT_FOUND' || code === 'CONTENT_NOT_LOADED'
    || code === 'NO_PATH_TO_SEARCH' || code === 'INVALID_SEARCH_PATH'
    || code === 'SEARCH_NODE_NOT_REACHED') {
    return '故事配置暂时不可用，请稍后再试'
  }
  return '没有准备好，请检查网络后再试'
}

export default function AlangConfigPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const {
    data: mission,
    isLoading: isMissionLoading,
    isError: isMissionError,
    refetch,
  } = useAlangMissionDetail(
    slug,
    !!slug && canUseDebugTools,
  )
  const startMutation = useStartMission()
  const resetMutation = useResetAlangMission()
  const syncMissionProgress = useSyncAlangMissionProgress()
  const { position, request, loading } = useAlangGpsOnce()

  const [target, setTarget] = useState<AlangCoordinate | null>(null)
  const [endPoint, setEndPoint] = useState<AlangCoordinate | null>(null)
  const [targetLabel, setTargetLabel] = useState<PointLabel>({})
  const [endPointLabel, setEndPointLabel] = useState<PointLabel>({})
  const [selectedKind, setSelectedKind] = useState<PointKind>('target')
  const [keyword, setKeyword] = useState('')
  const [places, setPlaces] = useState<GeoPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [routeEstimate, setRouteEstimate] = useState<WalkingRouteSuccessResponse | null>(null)
  const [routeUnavailable, setRouteUnavailable] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [requiresReset, setRequiresReset] = useState(false)
  const submitLockRef = useRef(false)

  const describePoint = useCallback(async (
    point: AlangCoordinate,
    setter: (value: PointLabel) => void,
  ) => {
    try {
      const result = await reverseGeocode(
        apiRequest,
        point.latitude,
        point.longitude,
      )
      setter({
        name: result.poi?.name ?? result.name,
        address: result.poi?.address ?? result.address,
      })
    } catch {
      setter({})
    }
  }, [])

  const setPoint = useCallback((kind: PointKind, point: AlangCoordinate, label?: PointLabel) => {
    setRouteEstimate(null)
    setRouteUnavailable(false)
    if (kind === 'target') {
      setTarget(point)
      setTargetLabel(label ?? {})
      if (!label) void describePoint(point, setTargetLabel)
      setSelectedKind('end')
    } else {
      setEndPoint(point)
      setEndPointLabel(label ?? {})
      if (!label) void describePoint(point, setEndPointLabel)
    }
  }, [describePoint])

  const handleGetLocation = useCallback(async () => {
    try {
      const current = await request()
      if (!current) return
      const firstPoint = {
        latitude: current.latitude,
        longitude: current.longitude,
      }
      const companionPoint = {
        latitude: current.latitude + 0.00135,
        longitude: current.longitude,
      }
      setPoint('target', firstPoint)
      setPoint('end', companionPoint)
    } catch {
      Taro.showToast({ title: '没有拿到定位，请检查微信定位权限', icon: 'none' })
    }
  }, [request, setPoint])

  useEffect(() => {
    if (!canUseDebugTools || keyword.trim().length < 2) {
      setPlaces([])
      setIsSearching(false)
      return
    }

    let active = true
    setIsSearching(true)
    const timer = setTimeout(() => {
      void suggestGeoPlaces(apiRequest, {
        keyword: keyword.trim(),
        region: '深圳',
        location: position
          ? { latitude: position.latitude, longitude: position.longitude }
          : undefined,
        limit: 6,
      }).then((result) => {
        if (active) setPlaces(result.success ? result.places : [])
      }).catch(() => {
        if (active) setPlaces([])
      }).finally(() => {
        if (active) setIsSearching(false)
      })
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [canUseDebugTools, keyword, position])

  const handleNearbySearch = useCallback(async () => {
    if (isSearching) return
    if (!position || keyword.trim().length < 2) {
      Taro.showToast({ title: '先获取当前位置，再输入地点关键词', icon: 'none' })
      return
    }
    setIsSearching(true)
    try {
      const result = await searchNearbyGeoPlaces(apiRequest, {
        keyword: keyword.trim(),
        location: {
          latitude: position.latitude,
          longitude: position.longitude,
        },
        radiusMeters: 5000,
        limit: 8,
      })
      setPlaces(result.success ? result.places : [])
      if (!result.success) {
        Taro.showToast({ title: '地点服务暂时不可用，也可以直接点地图', icon: 'none' })
      }
    } catch {
      setPlaces([])
      Taro.showToast({ title: '地点服务暂时不可用，也可以直接点地图', icon: 'none' })
    } finally {
      setIsSearching(false)
    }
  }, [isSearching, keyword, position])

  const handleMapTap = useCallback((event: any) => {
    const latitude = event.detail?.latitude
    const longitude = event.detail?.longitude
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return
    setPoint(selectedKind, { latitude, longitude })
  }, [selectedKind, setPoint])

  const ADJUST_STEP_METERS = 10
  const adjustPoint = (kind: PointKind, dx: number, dy: number) => {
    const current = kind === 'target' ? target : endPoint
    if (!current) return
    const latitudeDelta = dy / 111000
    const longitudeDelta = dx / (
      111000 * Math.cos(current.latitude * Math.PI / 180)
    )
    setPoint(kind, {
      latitude: current.latitude + latitudeDelta,
      longitude: current.longitude + longitudeDelta,
    })
  }

  const handleMarkerTap = useCallback<NonNullable<MapProps['onMarkerTap']>>((event) => {
    const kind = Number(event.detail.markerId) === 1 ? 'target' : 'end'
    setSelectedKind(kind)
    Taro.showToast({
      title: kind === 'target' ? '正在调整阿浪出现点' : '正在调整陪伴终点',
      icon: 'none',
    })
  }, [])

  const straightDistance = target && endPoint
    ? haversine(
        target.latitude,
        target.longitude,
        endPoint.latitude,
        endPoint.longitude,
      )
    : 0
  const pointValidation = target && endPoint
    ? validateAlangTestPointConfiguration(target, endPoint)
    : null
  const pointValidationError = target && endPoint
    ? getTestPointValidationError(target, endPoint)
    : null
  const isStartPending = isSubmitting || startMutation.isPending
  const shouldRecommendShorterRoute = !pointValidationError
    && pointValidation?.valid
    && (pointValidation.distanceMeters < ALANG_TEST_RECOMMENDED_MIN_DISTANCE_METERS
      || pointValidation.distanceMeters > ALANG_TEST_RECOMMENDED_MAX_DISTANCE_METERS)

  const handleEstimateRoute = useCallback(async () => {
    if (!target || !endPoint) return
    setRouteUnavailable(false)
    try {
      const result = await getWalkingRoute(apiRequest, {
        from: target,
        to: endPoint,
      })
      if (result.success) {
        setRouteEstimate(result)
      } else {
        setRouteEstimate(null)
        setRouteUnavailable(true)
      }
    } catch {
      setRouteEstimate(null)
      setRouteUnavailable(true)
    }
  }, [endPoint, target])

  const handleConfirm = async () => {
    if (submitLockRef.current || isStartPending) return
    if (!target || !endPoint || !mission) {
      const message = '请先设置阿浪出现点和陪伴终点'
      setSubmitError(message)
      Taro.showToast({ title: message, icon: 'none' })
      return
    }
    const validationError = getTestPointValidationError(target, endPoint)
    if (validationError) {
      setSubmitError(validationError)
      Taro.showToast({ title: validationError, icon: 'none' })
      return
    }
    submitLockRef.current = true
    setSubmitError(null)
    setRequiresReset(false)
    setIsSubmitting(true)
    try {
      try {
        haptics('light')
      } catch {
        // Optional device feedback must never block the mission start request.
      }
      try {
        logInfo('[AlangConfig] start test tapped', { slug })
      } catch {
        // Realtime logging is diagnostic-only and must never trap the start lock.
      }

      const started = await startMutation.mutateAsync({
        slug,
        targetLocation: target,
        companionEndLocation: endPoint,
        coordinateSystem: 'gcj02',
      })
      if (started.completed) throw new Error('ALANG_RETEST_REQUIRES_RESET')
      if (started.stage !== 'searching' || !started.currentNodeId) {
        throw new Error('SEARCH_NODE_NOT_REACHED')
      }
      syncMissionProgress(slug, {
        stage: started.stage,
        currentNodeId: started.currentNodeId,
      })

      await Taro.redirectTo({
        url: `${MINI_PROGRAM_ROUTES.alangSearch}?slug=${encodeURIComponent(slug)}&nodeId=${encodeURIComponent(started.currentNodeId)}`,
      })
    } catch (error) {
      const message = getAlangStartErrorMessage(error)
      const apiError = error as AlangStartError
      setSubmitError(message)
      setRequiresReset([
        'ALANG_RECONFIG_REQUIRES_RESET',
        'ALANG_RETEST_REQUIRES_RESET',
      ].includes(getAlangStartErrorCode(error) ?? ''))
      try {
        Taro.showToast({ title: message, icon: 'none' })
      } catch {
        // The persistent inline error above remains the user-facing fallback.
      }
      try {
        logWarn('[AlangConfig] start test failed', {
          slug,
          statusCode: apiError?.statusCode,
          errorCode: getAlangStartErrorCode(error),
        })
      } catch {
        // Failure telemetry must never hide the actionable error or keep the lock set.
      }
    } finally {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleClearPreviousRun = useCallback(async () => {
    if (!slug || resetMutation.isPending || isStartPending) return
    try {
      const modal = await Taro.showModal({
        title: '清除上一轮阿浪测试',
        content: '将清除当前账号上一轮阿浪测试进度与测试故事；本页刚设置的两个新点位会保留，是否继续？',
        confirmText: '清除旧进度',
        cancelText: '取消',
        confirmColor: '#8B5CF6',
      })
      if (!modal.confirm) return
      await resetMutation.mutateAsync(slug)
      setSubmitError(null)
      setRequiresReset(false)
      await refetch()
      Taro.showToast({ title: '旧进度已清除，可以开始新一轮', icon: 'none' })
    } catch {
      Taro.showToast({ title: '旧进度没有清除成功，请稍后再试', icon: 'none' })
    }
  }, [isStartPending, refetch, resetMutation, slug])

  const markers = useMemo<NonNullable<MapProps['markers']>>(() => {
    const items: NonNullable<MapProps['markers']> = []
    if (target) {
      items.push({
        id: 1,
        latitude: target.latitude,
        longitude: target.longitude,
        title: '阿浪出现点',
        iconPath: '/assets/icons/ui/icon-location.webp',
        width: 32,
        height: 32,
      })
    }
    if (endPoint) {
      items.push({
        id: 2,
        latitude: endPoint.latitude,
        longitude: endPoint.longitude,
        title: '陪伴终点',
        iconPath: '/assets/icons/ui/icon-location.webp',
        width: 32,
        height: 32,
      })
    }
    return items
  }, [endPoint, target])

  if (isAuthLoading) {
    return <View className='alang-config__gate'><Text>正在确认测试权限…</Text></View>
  }

  if (!canUseDebugTools) {
    return (
      <View className='alang-config__gate'>
        <StatusCard
          tone='info'
          title='这个页面只在单人测试中开放'
          description='正式故事会直接进入寻找阶段，不需要设置内部点位。'
          action={{ label: '返回故事', onClick: () => Taro.navigateBack() }}
        />
      </View>
    )
  }

  if (isMissionLoading) {
    return <View className='alang-config__gate'><Text>正在读取阿浪测试配置…</Text></View>
  }

  if (isMissionError || !mission) {
    return (
      <View className='alang-config__gate'>
        <StatusCard
          tone='error'
          title='测试配置暂时没有打开'
          description='网络恢复后重新读取，不会使用默认点位代替。'
          action={{ label: '重新读取', onClick: () => { void refetch() } }}
        />
      </View>
    )
  }

  const mapCenter = target
    ?? (position
      ? { latitude: position.latitude, longitude: position.longitude }
      : SHENZHEN_FALLBACK)

  return (
    <View className='alang-config'>
      <View className='alang-config__header'>
        <Text className='alang-config__eyebrow'>单人测试工具</Text>
        <Text className='alang-config__title'>配置测试点位</Text>
        <Text className='alang-config__hint'>正式用户不会看到本页或任何内部坐标。</Text>
      </View>

      <View className='alang-config__selector'>
        <View
          className={`alang-config__selector-item ${selectedKind === 'target' ? 'alang-config__selector-item--active' : ''}`}
          onClick={() => setSelectedKind('target')}
          role='button'
          aria-label='设置阿浪出现点'
          aria-pressed={selectedKind === 'target'}
        >
          <Text>设置出现点</Text>
        </View>
        <View
          className={`alang-config__selector-item ${selectedKind === 'end' ? 'alang-config__selector-item--active' : ''}`}
          onClick={() => setSelectedKind('end')}
          role='button'
          aria-label='设置陪伴终点'
          aria-pressed={selectedKind === 'end'}
        >
          <Text>设置陪伴终点</Text>
        </View>
      </View>

      <View className='alang-config__search'>
        <Input
          className='alang-config__search-input'
          value={keyword}
          placeholder='输入深圳地点或 POI'
          onInput={(event) => setKeyword(event.detail.value)}
        />
        <View
          className='alang-config__nearby-btn'
          onClick={() => { void handleNearbySearch() }}
          role='button'
          aria-label={isSearching ? '正在搜索附近地点' : '搜索附近地点'}
          aria-disabled={isSearching}
        >
          <Text>{isSearching ? '搜索中' : '搜附近'}</Text>
        </View>
        {places.length > 0 && (
          <View className='alang-config__places'>
            {places.map((place) => (
              <View
                key={place.id}
                className='alang-config__place'
                role='button'
                aria-label={`选择地点：${place.name}`}
                onClick={() => {
                  setPoint(selectedKind, place.location, {
                    name: place.name,
                    address: place.address,
                  })
                  setPlaces([])
                  setKeyword(place.name)
                }}
              >
                <Text className='alang-config__place-name'>{place.name}</Text>
                <Text className='alang-config__place-address'>{place.address || '深圳'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className='alang-config__map-wrap'>
        <Map
          className='alang-config__map'
          latitude={mapCenter.latitude}
          longitude={mapCenter.longitude}
          showLocation
          onError={() => {
            Taro.showToast({ title: '地图暂时没有加载，也可以用地点搜索', icon: 'none' })
          }}
          onTap={handleMapTap}
          onMarkerTap={handleMarkerTap}
          markers={markers}
          circles={target ? [{
            latitude: target.latitude,
            longitude: target.longitude,
            radius: ALANG_DEFAULT_SEARCH_RADIUS_METERS,
            fillColor: '#8B5CF620',
            color: '#8B5CF680',
            strokeWidth: 2,
          }] : []}
        />
        {!position && (
          <View className='alang-config__map-overlay'>
            <Button className='alang-config__loc-btn' onClick={handleGetLocation} loading={loading}>
              使用当前位置
            </Button>
          </View>
        )}
      </View>

      <View className='alang-config__info'>
        {target && (
          <PointSummary
            title='阿浪出现点'
            point={target}
            label={targetLabel}
            onAdjust={(dx, dy) => adjustPoint('target', dx, dy)}
          />
        )}
        {endPoint && (
          <PointSummary
            title='陪伴终点'
            point={endPoint}
            label={endPointLabel}
            onAdjust={(dx, dy) => adjustPoint('end', dx, dy)}
          />
        )}
        {target && endPoint && (
          <View className='alang-config__route-row'>
            <View>
              <Text className='alang-config__info-label'>路线估算</Text>
              <Text className='alang-config__info-value'>
                {routeEstimate
                  ? `${Math.round(routeEstimate.distanceMeters)} 米 · 约 ${Math.max(1, Math.ceil(routeEstimate.durationSeconds / 60))} 分钟`
                  : `直线 ${Math.round(straightDistance)} 米`}
              </Text>
              {routeUnavailable && (
                <Text className='alang-config__route-note'>路线服务暂时不可用，不影响点位测试</Text>
              )}
              {pointValidationError && (
                <Text className='alang-config__route-note alang-config__route-note--error'>
                  {pointValidationError}
                </Text>
              )}
              {shouldRecommendShorterRoute && (
                <Text className='alang-config__route-note'>建议将陪伴路程设为 100–300 米，真机复测会更顺畅</Text>
              )}
            </View>
            <View
              className='alang-config__route-btn'
              onClick={() => { void handleEstimateRoute() }}
              role='button'
              aria-label='估算步行路线'
            >
              <Text>估算步行路线</Text>
            </View>
          </View>
        )}
      </View>

      <View className='alang-config__actions'>
        {submitError && (
          <>
            <View className='alang-config__submit-error' role='alert' aria-live='polite'>
              <Text>{submitError}</Text>
            </View>
            {requiresReset && (
              <View
                className={`alang-config__reset-previous${resetMutation.isPending ? ' alang-config__reset-previous--disabled' : ''}`}
                onClick={() => { void handleClearPreviousRun() }}
                role='button'
                aria-label={resetMutation.isPending ? '正在清除上一轮阿浪测试' : '清除旧进度'}
                aria-disabled={resetMutation.isPending}
              >
                <Text>{resetMutation.isPending ? '正在清除…' : '清除旧进度'}</Text>
              </View>
            )}
          </>
        )}
        {!submitError && (
          <View
            className={`alang-config__submit-feedback ${isStartPending ? 'alang-config__submit-feedback--active' : ''}`}
            role='status'
            aria-live='polite'
          >
            <Text>
              {isStartPending
                ? '已收到点击，正在启动阿浪…'
                : '启动反馈已开启 · 点击后会立即显示进度'}
            </Text>
          </View>
        )}
        <View
          className={`alang-config__confirm ${!target || !endPoint || !!pointValidationError || isStartPending ? 'alang-config__confirm--disabled' : ''}`}
          onClick={() => { void handleConfirm() }}
          hoverClass={isStartPending ? '' : 'alang-config__confirm--pressed'}
          hoverStartTime={0}
          hoverStayTime={100}
          role='button'
          aria-label={isStartPending ? '正在准备测试' : '开始测试'}
          aria-disabled={!target || !endPoint || !!pointValidationError || isStartPending}
          aria-busy={isStartPending}
        >
          <Text className='alang-config__confirm-text'>{isStartPending ? '已收到，正在启动…' : '开始测试'}</Text>
        </View>
      </View>
    </View>
  )
}

function PointSummary({
  title,
  point,
  label,
  onAdjust,
}: {
  title: string
  point: AlangCoordinate
  label: PointLabel
  onAdjust: (dx: number, dy: number) => void
}) {
  const step = 10
  return (
    <View className='alang-config__point'>
      <View className='alang-config__info-row'>
        <View>
          <Text className='alang-config__info-label'>{title}</Text>
          {label.name && <Text className='alang-config__point-name'>{label.name}</Text>}
          {label.address && <Text className='alang-config__point-address'>{label.address}</Text>}
        </View>
        <Text className='alang-config__coordinate'>
          {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
        </Text>
      </View>
      <View className='alang-config__adjust-row'>
        <View className='alang-config__adjust-btn' onClick={() => onAdjust(0, step)} role='button' aria-label={`${title}向北微调 10 米`}><Text>↑</Text></View>
        <View className='alang-config__adjust-btn' onClick={() => onAdjust(-step, 0)} role='button' aria-label={`${title}向西微调 10 米`}><Text>←</Text></View>
        <View className='alang-config__adjust-btn' onClick={() => onAdjust(0, -step)} role='button' aria-label={`${title}向南微调 10 米`}><Text>↓</Text></View>
        <View className='alang-config__adjust-btn' onClick={() => onAdjust(step, 0)} role='button' aria-label={`${title}向东微调 10 米`}><Text>→</Text></View>
        <Text className='alang-config__adjust-hint'>每次微调 10 米</Text>
      </View>
    </View>
  )
}
