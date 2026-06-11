import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { apiRequest } from '../../lib/api/api'
import { haptics } from '../../lib/utils/haptics'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { logInfo } from '../../lib/utils/logger'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import './CityPickerSheet.scss'

// Static data — define outside component to avoid re-creation on every render
const HOT_CITIES = [
  '北京市', '上海市', '广州市', '深圳市',
  '杭州市', '成都市', '重庆市', '长沙市',
  '武汉市', '西安市', '南京市', '苏州市',
]

const ALL_CITIES = [
  '北京市', '上海市', '广州市', '深圳市', '杭州市', '南京市',
  '成都市', '重庆市', '武汉市', '西安市', '苏州市', '长沙市',
  '天津市', '郑州市', '东莞市', '佛山市', '宁波市', '青岛市',
  '沈阳市', '昆明市', '合肥市', '福州市', '厦门市', '济南市',
  '大连市', '哈尔滨市', '长春市', '石家庄市', '南宁市', '贵阳市',
  '兰州市', '海口市', '乌鲁木齐市', '呼和浩特市', '银川市', '西宁市',
  '拉萨市', '台北市', '香港', '澳门',
]

interface CityPickerSheetProps {
  visible: boolean
  onClose: () => void
  onSuccess: (city: string) => void
}

export default function CityPickerSheet({ visible, onClose, onSuccess }: CityPickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const [scrollToCity, setScrollToCity] = useState('')
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = null
      }
      setSearchQuery('')
      setSelectedCity(null)
      setLoading(false)
      setCelebrated(false)
      setScrollToCity('')
      discoverAnalytics.track('city_picker_open')
    }
  }, [visible])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = null
      }
      if (scrollClearTimerRef.current) {
        clearTimeout(scrollClearTimerRef.current)
        scrollClearTimerRef.current = null
      }
    }
  }, [])

  // Clear scroll target after animation completes to allow re-scroll
  useEffect(() => {
    if (scrollToCity) {
      scrollClearTimerRef.current = setTimeout(() => {
        setScrollToCity('')
        scrollClearTimerRef.current = null
      }, 600)
      return () => {
        if (scrollClearTimerRef.current) {
          clearTimeout(scrollClearTimerRef.current)
          scrollClearTimerRef.current = null
        }
      }
    }
  }, [scrollToCity])

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return ALL_CITIES
    const q = searchQuery.trim().toLowerCase()
    return ALL_CITIES.filter((city) =>
      city.toLowerCase().includes(q) ||
      getPinyinInitial(city).includes(q)
    )
  }, [searchQuery])

  const handleSelectCity = useCallback((city: string) => {
    haptics('light')
    setSelectedCity(city)
    discoverAnalytics.track('city_picker_select', undefined, { city })
    // Scroll to selected city in the list when viewing all cities (not searching)
    if (!searchQuery.trim()) {
      setScrollToCity(`city-${city}`)
    }
  }, [searchQuery])

  const handleClose = useCallback(() => {
    discoverAnalytics.track('city_picker_close')
    onClose()
  }, [onClose])

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    if (value.trim()) {
      discoverAnalytics.track('city_picker_search', undefined, { queryLength: value.trim().length })
    }
  }, [])

  const handleClearSearch = useCallback(() => {
    haptics('light')
    setSearchQuery('')
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selectedCity || loading) return
    haptics('medium')

    setLoading(true)
    discoverAnalytics.track('city_picker_confirm', undefined, { city: selectedCity })
    try {
      try {
        const networkRes = await Taro.getNetworkType()
        if (networkRes.networkType === 'none') {
          Taro.showToast({ title: '网络好像断开了，请检查连接', icon: 'none', duration: 2000 })
          discoverAnalytics.track('city_picker_offline_blocked', undefined, { city: selectedCity })
          return
        }
      } catch {
        // getNetworkType may fail on some devices; proceed optimistically
      }

      await apiRequest({
        method: 'POST',
        path: '/api/cities/interest',
        data: { city: selectedCity, source: 'floating_banner' },
      })

      haptics('success')
      setCelebrated(true)
      logInfo('[CityPicker] interest registered', { city: selectedCity })
      discoverAnalytics.track('city_picker_success', undefined, { city: selectedCity })
      celebrationTimerRef.current = setTimeout(() => {
        celebrationTimerRef.current = null
        onSuccess(selectedCity)
      }, 600)
    } catch (err) {
      logInfo('[CityPicker] interest register failed', { city: selectedCity, error: String(err) })
      discoverAnalytics.track('city_picker_error', undefined, { city: selectedCity, error: String(err) })
      Taro.showToast({
        title: '网络开小差了，请重试',
        icon: 'none',
        duration: 2000,
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCity, loading, onSuccess])

  if (!visible) return null

  const showHotCities = !searchQuery.trim()
  const displayName = (city: string) => city.replace('市', '')

  return (
    <View className='city-picker-overlay' onClick={handleClose} catchMove>
      <View
        className='city-picker-sheet'
        role='dialog'
        aria-modal='true'
        aria-label='城市选择'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <View className='city-picker-sheet__handle' />

        {/* Header with mascot */}
        <View className='city-picker-sheet__header'>
          <View className='city-picker-sheet__header-row'>
            <Image
              className='city-picker-sheet__mascot'
              src={getXiaoyueExpressionAsset('homeWelcome')}
              mode='aspectFit'
            />
            <Text className='city-picker-sheet__title'>你想在哪个城市遇到有趣的人？</Text>
          </View>
          <Text className='city-picker-sheet__subtitle'>告诉我们你的城市，人数够了悦仔就来安排</Text>
        </View>

        {/* Search */}
        <View className='city-picker-sheet__search'>
          <JoyJoinIcon emoji='🔍' size={28} className='city-picker-sheet__search-icon' />
          <Input
            className='city-picker-sheet__search-input'
            type='text'
            placeholder='搜索城市'
            value={searchQuery}
            onInput={(e) => handleSearch(e.detail.value)}
            onConfirm={() => {
              if (filteredCities.length === 1) {
                handleSelectCity(filteredCities[0])
              }
            }}
          />
          {searchQuery.trim() && (
            <View
              className='city-picker-sheet__search-clear'
              onClick={handleClearSearch}
              hoverClass='city-picker-sheet__search-clear--hover'
              aria-label='清除搜索'
            >
              <JoyJoinIcon emoji='✕' size={24} className='city-picker-sheet__search-clear-icon' />
            </View>
          )}
        </View>

        {/* Hot cities — shown when search is empty */}
        {showHotCities ? (
          <View className='city-picker-sheet__hot-section'>
            <View className='city-picker-sheet__section-label'>
              <JoyJoinIcon emoji='🔥' size={24} />
              <Text className='city-picker-sheet__section-title'>热门城市</Text>
            </View>
            <View className='city-picker-sheet__hot-grid'>
              {HOT_CITIES.map((city) => (
                <View
                  key={city}
                  className={`city-picker-sheet__hot-item ${selectedCity === city ? 'city-picker-sheet__hot-item--selected' : ''}`}
                  onClick={() => handleSelectCity(city)}
                  hoverClass='city-picker-sheet__tile--hover'
                  aria-label={`选择 ${displayName(city)}`}
                >
                  <Text className='city-picker-sheet__hot-item-text'>{displayName(city)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* Spacer to prevent layout jump when hot section hides */
          <View className='city-picker-sheet__hot-section-placeholder' />
        )}

        {/* City list */}
        <ScrollView
          className='city-picker-sheet__list'
          scrollY
          scrollWithAnimation
          enableFlex
          scrollIntoView={scrollToCity}
        >
          {filteredCities.map((city) => (
            <View
              key={city}
              id={`city-${city}`}
              className={`city-picker-sheet__list-item ${selectedCity === city ? 'city-picker-sheet__list-item--selected' : ''}`}
              onClick={() => handleSelectCity(city)}
              hoverClass='city-picker-sheet__list-item--hover'
              aria-label={`选择 ${displayName(city)}`}
            >
              <Text className='city-picker-sheet__list-item-text'>{displayName(city)}</Text>
              {selectedCity === city && (
                <JoyJoinIcon emoji='✓' size={28} className='city-picker-sheet__list-item-check' />
              )}
            </View>
          ))}
          {filteredCities.length === 0 && (
            <View className='city-picker-sheet__empty city-picker-sheet__empty--enter'>
              <Text className='city-picker-sheet__empty-text'>暂未收录这个城市，试试其他关键词</Text>
            </View>
          )}
          <View className='city-picker-sheet__list-safe-bottom' />
        </ScrollView>

        {/* Celebration overlay — shown on successful registration */}
        {celebrated && (
          <View className='city-picker-sheet__celebration'>
            <View className='city-picker-sheet__celebration-check'>
              <JoyJoinIcon emoji='✓' size={48} className='city-picker-sheet__celebration-icon' />
            </View>
            <Text className='city-picker-sheet__celebration-text'>已登记！</Text>
            <Text className='city-picker-sheet__celebration-sub'>悦仔会第一时间通知你</Text>
          </View>
        )}

        {/* Confirm button */}
        <View className='city-picker-sheet__footer'>
          <View
            className={`city-picker-sheet__confirm ${!selectedCity || loading ? 'city-picker-sheet__confirm--disabled' : ''} ${loading ? 'city-picker-sheet__confirm--loading' : ''}`}
            onClick={handleConfirm}
            hoverClass={selectedCity && !loading ? 'city-picker-sheet__confirm--hover' : ''}
          >
            <Text className='city-picker-sheet__confirm-text'>
              {loading ? '登记中...' : selectedCity ? `确认选择 ${displayName(selectedCity)}` : '请选择城市'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// Simple pinyin initial helper — covers all cities in ALL_CITIES
function getPinyinInitial(city: string): string {
  const map: Record<string, string> = {
    '北京市': 'bj', '上海市': 'sh', '广州市': 'gz', '深圳市': 'sz',
    '杭州市': 'hz', '成都市': 'cd', '重庆市': 'cq', '武汉市': 'wh',
    '西安市': 'xa', '苏州市': 'sz', '长沙市': 'cs', '南京市': 'nj',
    '天津市': 'tj', '郑州市': 'zz', '东莞市': 'dg', '佛山市': 'fs',
    '宁波市': 'nb', '青岛市': 'qd', '沈阳市': 'sy', '昆明市': 'km',
    '合肥市': 'hf', '福州市': 'fz', '厦门市': 'xm', '济南市': 'jn',
    '大连市': 'dl', '哈尔滨市': 'heb', '长春市': 'cc', '石家庄市': 'sjz',
    '南宁市': 'nn', '贵阳市': 'gy', '兰州市': 'lz', '海口市': 'hk',
    '乌鲁木齐市': 'wlmq', '呼和浩特市': 'hhht', '银川市': 'yc', '西宁市': 'xn',
    '拉萨市': 'ls', '台北市': 'tb', '香港': 'xg', '澳门': 'am',
  }
  return map[city] || ''
}
