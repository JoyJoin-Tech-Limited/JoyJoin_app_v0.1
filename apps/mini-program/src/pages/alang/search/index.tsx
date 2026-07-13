import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Map, ScrollView } from '@tarojs/components'
import {
  ALANG_ARRIVAL_RADIUS_METERS,
  ALANG_DEFAULT_SEARCH_RADIUS_METERS,
} from '@shared/alang/constants'
import {
  normalizeAlangCoordinate,
  type AlangCoordinate,
} from '@shared/alang/missionTypes'
import { useAlangGps } from '../../../lib/alang/useAlangGps'
import { useAlangMissionDetail } from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import './index.scss'

type AlangSearchConfig = {
  target?: AlangCoordinate
  radius: number
}

type SignalTone = 'locating' | 'steady' | 'fair' | 'weak' | 'error'

export default function AlangSearchPage() {
  const { user } = useAuth()
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const { data: mission, refetch } = useAlangMissionDetail(
    slug,
    !!slug && !!user?.features?.alangEnabled,
  )
  const progress = mission?.myProgress

  const [config, setConfig] = useState<AlangSearchConfig | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [found, setFound] = useState(false)
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recoveryNavigationKeyRef = useRef('')

  const loadStoredConfig = useCallback(() => {
    if (!slug) return
    const stored = Taro.getStorageSync(`jj_alang_config_${slug}`) as AlangSearchConfig | undefined
    const target = canUseDebugTools
      ? normalizeAlangCoordinate(stored?.target)
      : null
    if (target) {
      setConfig({
        target,
        radius: stored?.radius ?? ALANG_ARRIVAL_RADIUS_METERS,
      })
      return
    }

    // Canonical NPC coordinates stay server-side.
    setConfig({ radius: ALANG_ARRIVAL_RADIUS_METERS })
  }, [canUseDebugTools, slug])

  const restartLocation = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    setGpsEnabled(false)
    setLocationError(null)
    retryTimerRef.current = setTimeout(() => {
      setGpsEnabled(true)
      retryTimerRef.current = null
    }, 120)
  }, [])

  const resumeLocation = useCallback(async () => {
    if (!slug) return
    try {
      const setting = await Taro.getSetting()
      const denied = setting.authSetting?.['scope.userLocation'] === false
      setPermissionDenied(denied)
      if (!denied) restartLocation()
    } catch {
      // A settings lookup failure must not block the native location request.
      restartLocation()
    }
  }, [restartLocation, slug])

  useEffect(() => {
    if (!slug) return
    alangEvents.searchPageView(slug)
    loadStoredConfig()
    void resumeLocation()

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    }
  }, [loadStoredConfig, resumeLocation, slug])

  useDidShow(() => {
    // Re-read the local mission point and permission after a cold start or
    // returning from WeChat settings/background.
    loadStoredConfig()
    void resumeLocation()
    if (slug) void refetch()
  })

  useEffect(() => {
    if (!progress || progress.stage === 'searching') return
    const key = `${progress.progressId}:${progress.stage}:${progress.currentNodeId}`
    if (recoveryNavigationKeyRef.current === key) return

    const encodedSlug = encodeURIComponent(slug)
    const encodedNode = encodeURIComponent(progress.currentNodeId)
    const url = ['found', 'dialogue'].includes(progress.stage)
      ? `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${encodedSlug}&nodeId=${encodedNode}`
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

  const handleArrival = useCallback(() => {
    if (!found) {
      haptics('success')
      setFound(true)
      alangEvents.foundAuto(slug)
    }
  }, [found, slug])

  const handleGpsError = useCallback(() => {
    setLocationError('定位信号暂时中断，距离可能不会更新')
    void Taro.getSetting()
      .then((setting) => {
        setPermissionDenied(setting.authSetting?.['scope.userLocation'] === false)
      })
      .catch(() => undefined)
  }, [])

  const { distance, accuracy, nodeId: gpsNodeId, position } = useAlangGps({
    slug,
    target: config?.target,
    enabled: !!slug
      && gpsEnabled
      && !found
      && !permissionDenied
      && (!progress || progress.stage === 'searching'),
    onArrival: handleArrival,
    onError: handleGpsError,
  })

  useEffect(() => {
    if (!position) return
    setPermissionDenied(false)
    setLocationError(null)
  }, [position])

  const handleToggleMap = () => {
    alangEvents.mapViewTap(slug)
    if (!position) {
      setLocationError('还没有收到你的位置，请先重新定位')
      return
    }
    setMapError(false)
    setShowMap((visible) => !visible)
  }

  const handleRetryLocation = useCallback(async () => {
    try {
      const setting = await Taro.getSetting()
      const denied = setting.authSetting?.['scope.userLocation'] === false
      setPermissionDenied(denied)
      if (denied) {
        Taro.showToast({ title: '请打开定位权限后再试', icon: 'none' })
        return
      }
    } catch {
      // Continue with the native location request when settings are unavailable.
    }
    restartLocation()
  }, [restartLocation])

  const handleOpenSetting = useCallback(async () => {
    try {
      const setting = await Taro.openSetting()
      const granted = setting.authSetting?.['scope.userLocation'] === true
      setPermissionDenied(!granted)
      if (granted) {
        restartLocation()
      } else {
        Taro.showToast({ title: '需要允许定位，才能继续寻找阿浪', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }, [restartLocation])

  useEffect(() => {
    if (!found || !gpsNodeId) return
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    navigationTimerRef.current = setTimeout(() => {
      navigationTimerRef.current = null
      void Taro.redirectTo({
        url: `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${slug}&nodeId=${gpsNodeId}`,
      }).catch(() => {
        setFound(false)
        restartLocation()
        Taro.showToast({ title: '故事页没有打开，再试一次即可', icon: 'none' })
      })
    }, 1200)

    return () => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    }
  }, [found, gpsNodeId, restartLocation, slug])

  const signal: { tone: SignalTone; label: string; detail: string } = permissionDenied
    ? { tone: 'error', label: '定位权限未开启', detail: '允许定位后，距离会自动继续更新' }
    : locationError && !position
      ? { tone: 'error', label: '定位暂时不可用', detail: locationError }
      : accuracy === null
        ? { tone: 'locating', label: '正在接收定位信号', detail: '到开阔处走几步，通常会更快' }
        : accuracy <= 25
          ? { tone: 'steady', label: '定位信号稳定', detail: `当前精度约 ±${Math.round(accuracy)} 米` }
          : accuracy <= 65
            ? { tone: 'fair', label: '定位信号一般', detail: `当前精度约 ±${Math.round(accuracy)} 米，距离仅供参考` }
            : { tone: 'weak', label: '定位信号较弱', detail: `当前精度约 ±${Math.round(accuracy)} 米，建议走到室外` }

  const areaMessage = distance === null
    ? '阿浪在附近的一片区域里，先让定位找到你'
    : distance <= ALANG_ARRIVAL_RADIUS_METERS
      ? '已经进入到达范围，正在确认你的位置…'
      : distance <= ALANG_DEFAULT_SEARCH_RADIUS_METERS
        ? '你已进入寻找区域，再慢慢靠近一点'
        : '继续朝阿浪所在的区域走近'

  if (found) {
    return (
      <View className='alang-search__found'>
        <View className='alang-search__found-glow' />
        <Text className='alang-search__found-kicker'>距离归零</Text>
        <Text className='alang-search__found-title'>你找到阿浪了</Text>
        <Text className='alang-search__found-sub'>故事正在向你走来…</Text>
      </View>
    )
  }

  return (
    <ScrollView className='alang-search' scrollY>
      <View className='alang-search__content'>
      <View className='alang-search__header'>
        <Text className='alang-search__eyebrow'>寻找阿浪 · 距离提示</Text>
        <Text className='alang-search__title'>跟着距离，去见一个人</Text>
      </View>

      <View className='alang-search__area-card'>
        <View className='alang-search__area-icon'>
          <View className='alang-search__area-icon-core' />
        </View>
        <View className='alang-search__area-copy'>
          <Text className='alang-search__area-title'>{areaMessage}</Text>
          <Text className='alang-search__area-detail'>
            {distance !== null && distance <= ALANG_DEFAULT_SEARCH_RADIUS_METERS
              ? '已进入阿浪可能出现的范围'
              : `先靠近约 ${ALANG_DEFAULT_SEARCH_RADIUS_METERS} 米的寻找区域`}
          </Text>
        </View>
      </View>

      <View className='alang-search__radar-card'>
        <View className='alang-search__radar-heading'>
          <Text className='alang-search__radar-title'>阿浪就在附近</Text>
          <Text className='alang-search__radar-subtitle'>越靠近，距离提示会越清楚</Text>
        </View>
        <View className='alang-search__distance-stage'>
          <View className='alang-search__orbit alang-search__orbit--outer' />
          <View className='alang-search__orbit alang-search__orbit--inner' />
          <View className='alang-search__radar-sweep' />
          <View className='alang-search__distance-ring'>
            <Text className='alang-search__distance-label'>距离阿浪约</Text>
            <View className='alang-search__distance-readout'>
              <Text className='alang-search__distance-value'>
                {distance !== null ? `${Math.max(0, Math.round(distance))}` : '—'}
              </Text>
              <Text className='alang-search__distance-unit'>米</Text>
            </View>
            <Text className='alang-search__distance-caption'>距离会随你走动更新</Text>
          </View>
        </View>
        <View className='alang-search__radar-tip'>
          <Text className='alang-search__radar-tip-text'>小提示：朝距离变小的方向走，信号会越来越稳</Text>
        </View>
      </View>

      <View className={`alang-search__signal alang-search__signal--${signal.tone}`}>
        <View className='alang-search__signal-dot' />
        <View className='alang-search__signal-copy'>
          <Text className='alang-search__signal-label'>{signal.label}</Text>
          <Text className='alang-search__signal-detail'>{signal.detail}</Text>
        </View>
      </View>

      {(permissionDenied || locationError) && (
        <View className='alang-search__recovery'>
          <Text className='alang-search__recovery-title'>距离没有变化？</Text>
          <Text className='alang-search__recovery-detail'>
            重新定位会继续当前故事，不会丢失进度。
          </Text>
          <View className='alang-search__recovery-actions'>
            <View
              className='alang-search__recovery-btn'
              onClick={() => { void handleRetryLocation() }}
              role='button'
              aria-label='重新定位'
            >
              <Text className='alang-search__recovery-btn-text'>重新定位</Text>
            </View>
            {permissionDenied && (
              <View
                className='alang-search__recovery-btn alang-search__recovery-btn--primary'
                onClick={() => { void handleOpenSetting() }}
                role='button'
                aria-label='打开定位设置'
              >
                <Text className='alang-search__recovery-btn-text alang-search__recovery-btn-text--primary'>打开定位设置</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View className='alang-search__after-card'>
        <Text className='alang-search__after-title'>找到阿浪后</Text>
        <Text className='alang-search__after-subtitle'>先看看他怎么了，再决定下一步要不要帮他。</Text>
        <View className='alang-search__after-steps'>
          <View className='alang-search__after-step'>
            <Text className='alang-search__after-index'>1</Text>
            <Text className='alang-search__after-text'>和阿浪聊三段</Text>
          </View>
          <View className='alang-search__after-step'>
            <Text className='alang-search__after-index'>2</Text>
            <Text className='alang-search__after-text'>听听他的委托</Text>
          </View>
          <View className='alang-search__after-step'>
            <Text className='alang-search__after-index'>3</Text>
            <Text className='alang-search__after-text'>陪他走一段路</Text>
          </View>
        </View>
        <Text className='alang-search__after-note'>在 {ALANG_ARRIVAL_RADIUS_METERS} 米范围内稳定停留后，故事会自动继续。</Text>
      </View>

        <View className='alang-search__map-section'>
        <View className='alang-search__map-heading'>
          <View>
            <Text className='alang-search__map-title'>辅助地图</Text>
            <Text className='alang-search__map-subtitle'>只确认你在哪里，不显示阿浪坐标或路线</Text>
          </View>
          <View
            className='alang-search__map-toggle'
            onClick={handleToggleMap}
            role='button'
            aria-label={showMap ? '收起辅助地图' : '打开辅助地图'}
          >
            <Text className='alang-search__map-toggle-text'>{showMap ? '收起' : '打开'}</Text>
          </View>
        </View>

        {showMap && position && (
          <View className='alang-search__map-frame'>
            <Map
              className='alang-search__map'
              latitude={position.latitude}
              longitude={position.longitude}
              onError={() => setMapError(true)}
              showLocation
            />
            <View className='alang-search__map-note'>
              <Text className='alang-search__map-note-text'>地图中心是你当前的位置</Text>
            </View>
          </View>
        )}
        {mapError && (
          <Text className='alang-search__map-error'>辅助地图暂时没加载出来，距离寻找仍会继续</Text>
        )}
        </View>
      </View>
    </ScrollView>
  )
}
