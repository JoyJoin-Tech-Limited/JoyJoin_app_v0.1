import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Image, Map, ScrollView } from '@tarojs/components'
import {
  ALANG_ARRIVAL_RADIUS_METERS,
  ALANG_DEFAULT_SEARCH_RADIUS_METERS,
} from '@shared/alang/constants'
import { useAlangGps } from '../../../lib/alang/useAlangGps'
import {
  useAlangMissionDetail,
  useResetAlangMission,
  useSyncAlangMissionProgress,
} from '../../../lib/alang/useAlangMission'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangDebugTools } from '../../../lib/alang/alangAccess'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { useAlangAssetSource } from '../../../lib/alang/alangAssets'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { BRAND_COLORS } from '../../../styles/colors'
import './index.scss'

type SignalTone = 'locating' | 'steady' | 'fair' | 'weak' | 'error'

export default function AlangSearchPage() {
  const { user } = useAuth()
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''
  const canUseDebugTools = shouldShowAlangDebugTools(user)
  const { data: mission, refetch } = useAlangMissionDetail(
    slug,
    !!slug && !!user?.features?.alangEnabled,
  )
  const resetMutation = useResetAlangMission()
  const syncMissionProgress = useSyncAlangMissionProgress()
  const progress = mission?.myProgress
  const areaArtwork = useAlangAssetSource('eventHero')
  const foundSceneArtwork = useAlangAssetSource('foundScene')

  const [showMap, setShowMap] = useState(false)
  const [found, setFound] = useState(false)
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recoveryNavigationKeyRef = useRef('')
  const reconfigureActionRef = useRef(false)

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
    void resumeLocation()

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    }
  }, [resumeLocation, slug])

  useDidShow(() => {
    // Server progress owns the configured target. Resume only permission and
    // mission state after a cold start/background transition.
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

  const handleProgress = useCallback((snapshot: { stage: string; currentNodeId: string }) => {
    syncMissionProgress(slug, snapshot)
  }, [slug, syncMissionProgress])

  const {
    distance,
    accuracy,
    nodeId: gpsNodeId,
    position,
    configurationInvalid: gpsConfigurationInvalid,
  } = useAlangGps({
    slug,
    // Never recover a hidden NPC point from device storage. The server computes
    // distance against the per-run point saved by the start request.
    target: undefined,
    enabled: !!slug
      && gpsEnabled
      && !found
      && !permissionDenied
      && !mission?.testConfigurationInvalid
      && (!progress || progress.stage === 'searching'),
    onArrival: handleArrival,
    onProgress: handleProgress,
    onError: handleGpsError,
  })

  useEffect(() => {
    if (!position) return
    setPermissionDenied(false)
    setLocationError(null)
  }, [position])

  const handleToggleMap = () => {
    haptics('light')
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

  const handlePrimarySearchAction = useCallback(() => {
    haptics('light')
    if (permissionDenied) {
      void handleOpenSetting()
      return
    }
    void handleRetryLocation()
  }, [handleOpenSetting, handleRetryLocation, permissionDenied])

  const handleReconfigure = useCallback(async () => {
    if (!canUseDebugTools
      || !slug
      || reconfigureActionRef.current
      || resetMutation.isPending) return
    reconfigureActionRef.current = true
    try {
      const modal = await Taro.showModal({
        title: '重新配置测试点位',
        content: '将清除当前阿浪测试进度与本轮点位，是否重新设置？',
        confirmText: '重新配置',
        cancelText: '取消',
        confirmColor: BRAND_COLORS.primary,
      })
      if (!modal.confirm) return
      await resetMutation.mutateAsync(slug)
      await Taro.reLaunch({
        url: `${MINI_PROGRAM_ROUTES.alangConfig}?slug=${encodeURIComponent(slug)}`,
      })
    } catch {
      Taro.showToast({ title: '没有清除成功，请稍后再试', icon: 'none' })
    } finally {
      reconfigureActionRef.current = false
    }
  }, [canUseDebugTools, resetMutation, slug])

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

  const areaTitle = distance === null
    ? '正在确认你所在的寻找区域'
    : distance <= ALANG_DEFAULT_SEARCH_RADIUS_METERS
      ? '你已进入阿浪可能出现的范围'
      : '继续靠近阿浪出现的区域'
  const signalStrength = signal.tone === 'steady'
    ? 4
    : signal.tone === 'fair'
      ? 3
      : signal.tone === 'weak'
        ? 2
        : signal.tone === 'locating'
          ? 1
          : 0
  const primaryActionLabel = permissionDenied
    ? '打开定位并继续'
    : locationError
      ? '重新定位'
      : distance === null
        ? '开始寻找'
        : '继续寻找'

  const hasInvalidTestConfiguration = !!mission?.testConfigurationInvalid
    || !!gpsConfigurationInvalid

  if (hasInvalidTestConfiguration) {
    return (
      <ScrollView className='alang-search' scrollY>
        <View className='alang-search__content'>
          <View className='alang-search__recovery' role='alert'>
            <Text className='alang-search__recovery-title'>测试点位配置异常，请重新设置测试点位</Text>
            <Text className='alang-search__recovery-detail'>旧点位不会继续用于定位，本轮需要重新设置出现点和陪伴终点。</Text>
            {canUseDebugTools && (
              <View className='alang-search__recovery-actions'>
                <View
                  className='alang-search__recovery-btn alang-search__recovery-btn--primary'
                  onClick={() => { void handleReconfigure() }}
                  role='button'
                  aria-label={resetMutation.isPending ? '正在清除测试进度' : '重新配置点位'}
                  aria-disabled={resetMutation.isPending}
                >
                  <Text className='alang-search__recovery-btn-text alang-search__recovery-btn-text--primary'>
                    {resetMutation.isPending ? '正在清除…' : '重新配置点位'}
                  </Text>
                </View>
                <View
                  className='alang-search__recovery-btn'
                  onClick={() => {
                    void Taro.navigateTo({
                      url: `${MINI_PROGRAM_ROUTES.alangDebug}?slug=${encodeURIComponent(slug)}`,
                    })
                  }}
                  role='button'
                  aria-label='打开测试工具'
                >
                  <Text className='alang-search__recovery-btn-text'>打开测试工具</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    )
  }

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
      <View className='alang-search__area-card'>
        <View className='alang-search__area-icon'>
          <View className='alang-search__area-icon-core' />
        </View>
        <View className='alang-search__area-copy'>
          <Text className='alang-search__area-title'>{areaTitle}</Text>
          <Text className='alang-search__area-detail'>{areaMessage}</Text>
        </View>
        <View className='alang-search__area-art' aria-hidden='true'>
          <Image
            className='alang-search__area-art-image'
            src={areaArtwork.src}
            mode='aspectFill'
            onError={areaArtwork.onError}
          />
          <View className='alang-search__area-art-wash' />
          {areaArtwork.usingFallback && (
            <Text className='alang-search__area-placeholder-label'>区域场景示意</Text>
          )}
        </View>
      </View>

      <View className='alang-search__radar-card'>
        <View className='alang-search__radar-heading'>
          <Text className='alang-search__radar-title'>阿浪就在附近</Text>
          <Text className='alang-search__radar-subtitle'>他在约 {ALANG_DEFAULT_SEARCH_RADIUS_METERS} 米的寻找区域里，越靠近信号越清楚</Text>
        </View>
        <View className='alang-search__radar-grid'>
          <View className='alang-search__radar-visual' aria-hidden='true'>
            <View className='alang-search__orbit alang-search__orbit--outer' />
            <View className='alang-search__orbit alang-search__orbit--middle' />
            <View className='alang-search__orbit alang-search__orbit--inner' />
            <View className='alang-search__radar-axis alang-search__radar-axis--horizontal' />
            <View className='alang-search__radar-axis alang-search__radar-axis--vertical' />
            <View className='alang-search__radar-core'>
              <Text className='alang-search__radar-core-glyph'>?</Text>
            </View>
            <View className='alang-search__radar-clue'>
              <Text className='alang-search__radar-clue-glyph'>✦</Text>
            </View>
          </View>
          <View className='alang-search__distance-panel'>
            <Text className='alang-search__distance-label'>距离阿浪约</Text>
            <View className='alang-search__distance-readout'>
              <Text className='alang-search__distance-value'>
                {distance !== null ? `${Math.max(0, Math.round(distance))}` : '—'}
              </Text>
              <Text className='alang-search__distance-unit'>米</Text>
            </View>
            <View className='alang-search__signal-bars' aria-label={`信号强度 ${signalStrength} 格`}>
              {[1, 2, 3, 4].map((level) => (
                <View
                  key={level}
                  className={`alang-search__signal-bar${level <= signalStrength ? ' alang-search__signal-bar--active' : ''}`}
                />
              ))}
            </View>
            <Text className={`alang-search__signal-label alang-search__signal-label--${signal.tone}`}>{signal.label}</Text>
            <Text className='alang-search__signal-detail'>{signal.detail}</Text>
          </View>
        </View>
        <View className='alang-search__radar-tip'>
          <Text className='alang-search__radar-tip-text'>小提示：朝距离变小的方向走，信号会越来越稳</Text>
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
        <View className='alang-search__after-layout'>
          <View className='alang-search__after-visual' aria-hidden='true'>
            <Image
              className='alang-search__after-image'
              src={foundSceneArtwork.src}
              mode='aspectFill'
              onError={foundSceneArtwork.onError}
            />
            {foundSceneArtwork.usingFallback && (
              <Text className='alang-search__after-placeholder-label'>找到后场景示意</Text>
            )}
          </View>
          <View className='alang-search__after-steps'>
            <View className='alang-search__after-step'>
              <Text className='alang-search__after-index'>聊</Text>
              <View className='alang-search__after-step-copy'>
                <Text className='alang-search__after-text'>与阿浪对话</Text>
                <Text className='alang-search__after-detail'>了解他的情况</Text>
              </View>
            </View>
            <View className='alang-search__after-step'>
              <Text className='alang-search__after-index'>托</Text>
              <View className='alang-search__after-step-copy'>
                <Text className='alang-search__after-text'>触发委托</Text>
                <Text className='alang-search__after-detail'>可能需要你的帮助</Text>
              </View>
            </View>
            <View className='alang-search__after-step'>
              <Text className='alang-search__after-index'>藏</Text>
              <View className='alang-search__after-step-copy'>
                <Text className='alang-search__after-text'>收录故事</Text>
                <Text className='alang-search__after-detail'>完成后留下这一章</Text>
              </View>
            </View>
          </View>
        </View>
        <View
          className='alang-search__primary-action'
          hoverClass='alang-search__primary-action--pressed'
          onClick={handlePrimarySearchAction}
          role='button'
          aria-label={primaryActionLabel}
        >
          <Text className='alang-search__primary-action-text'>{primaryActionLabel}</Text>
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
            hoverClass='alang-search__map-toggle--pressed'
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
