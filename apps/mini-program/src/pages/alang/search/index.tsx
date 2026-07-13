import Taro from '@tarojs/taro'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, Map } from '@tarojs/components'
import { useAlangGps } from '../../../lib/alang/useAlangGps'
import { alangEvents } from '../../../lib/alang/alangAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import {
  ALANG_ARRIVAL_RADIUS_METERS,
  ALANG_DEFAULT_SEARCH_RADIUS_METERS,
} from '@shared/alang/constants'
import './index.scss'

export default function AlangSearchPage() {
  const slug = Taro.getCurrentInstance().router?.params?.slug ?? ''

  const [config, setConfig] = useState<{ target?: { lat: number; lng: number }; radius: number } | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [found, setFound] = useState(false)

  useEffect(() => {
    if (slug) {
      alangEvents.searchPageView(slug)
      const stored = Taro.getStorageSync(`jj_alang_config_${slug}`)
      if (stored?.target) {
        setConfig(stored)
      } else {
        // Canonical NPC coordinates stay server-side.
        setConfig({ radius: ALANG_ARRIVAL_RADIUS_METERS })
      }
    }
  }, [slug])

  const handleArrival = useCallback(() => {
    if (!found) {
      setFound(true)
      alangEvents.foundAuto(slug)
    }
  }, [found, slug])

  const handleGpsError = useCallback(() => {
    Taro.showToast({ title: '定位暂时不可用，请稍后重试', icon: 'none' })
  }, [])

  const { distance, accuracy, nodeId: gpsNodeId, position } = useAlangGps({
    slug,
    targetLat: config?.target?.lat,
    targetLng: config?.target?.lng,
    radiusMeters: config?.radius ?? ALANG_ARRIVAL_RADIUS_METERS,
    enabled: !!slug && !found,
    onArrival: handleArrival,
    onError: handleGpsError,
  })

  const handleShowMap = () => {
    alangEvents.mapViewTap(slug)
    if (!position) {
      Taro.showToast({ title: '定位中，请稍后再试', icon: 'none' })
      return
    }
    setShowMap(true)
  }

  useEffect(() => {
    if (found && gpsNodeId) {
      // Navigate to the updated node (found_scene or dialogue)
      const timer = setTimeout(() => {
        Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangDialogue}?slug=${slug}&nodeId=${gpsNodeId}` })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [found, gpsNodeId, slug])

  if (found) {
    return (
      <View className='alang-search__found'>
        <Text className='alang-search__found-title'>你找到了阿浪</Text>
        <Text className='alang-search__found-sub'>他就在附近…</Text>
      </View>
    )
  }

  if (showMap && position) {
    return (
      <View className='alang-search__map-full'>
        <Map
          className="alang-search__map-full-map"
          latitude={position.lat}
          longitude={position.lng}
          onError={() => {}}
          showLocation
        />
        <View className='alang-search__map-back' onClick={() => setShowMap(false)}>
          <Text className='alang-search__map-back-text'>返回</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='alang-search'>
      <View className='alang-search__distance-ring'>
        <Text className='alang-search__distance-value'>
          {distance !== null ? `${Math.round(distance)}` : '—'}
        </Text>
        <Text className='alang-search__distance-unit'>米</Text>
      </View>
      <View className='alang-search__hint'>
        <Text className='alang-search__hint-text'>
          {distance !== null && distance <= (config?.radius ?? ALANG_DEFAULT_SEARCH_RADIUS_METERS)
            ? '已经很近了，再走走…'
            : '阿浪就在这片区域里'}
        </Text>
        {accuracy !== null && (
          <Text className='alang-search__hint-accuracy'>定位精度 ±{Math.round(accuracy)} 米</Text>
        )}
      </View>
      <View className='alang-search__actions'>
        <View className='alang-search__map-btn' onClick={handleShowMap}>
          <Text className='alang-search__map-btn-text'>查看地图</Text>
        </View>
      </View>
    </View>
  )
}
