import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import SearchIcon from '../ui/SearchIcon'
import CloseIcon from '../ui/CloseIcon'
import { apiRequest } from '../../lib/api/api'
import { haptics } from '../../lib/utils/haptics'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { logInfo } from '../../lib/utils/logger'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import PickerShell from './PickerShell'
import SelectableTile from './SelectableTile'
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
  /** City to re-select when the sheet opens (e.g. previous user choice). */
  initialSelectedCity?: string | null
}

export default function CityPickerSheet({
  visible,
  onClose,
  onSuccess,
  initialSelectedCity = null,
}: CityPickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<string | null>(initialSelectedCity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [offline, setOffline] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const [scrollToCity, setScrollToCity] = useState('')
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittingRef = useRef(false)

  const { shouldReduceMotion: reduceMotion } = useMiniRevealMotion()

  // Reset transient state when the sheet opens; preserve the user's previous selection.
  useEffect(() => {
    if (visible) {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = null
      }
      setSearchQuery('')
      setLoading(false)
      setError(false)
      setOffline(false)
      setSearchFocused(false)
      setCelebrated(false)
      setScrollToCity('')
      submittingRef.current = false
      // Restore previous selection on reopen so users don't start from scratch.
      setSelectedCity(initialSelectedCity)
      discoverAnalytics.track('city_picker_open')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleClose = useCallback(() => {
    discoverAnalytics.track('city_picker_close')
    onClose()
  }, [onClose])

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    if (error) setError(false)
    if (offline) setOffline(false)
    if (value.trim()) {
      discoverAnalytics.track('city_picker_search', undefined, { queryLength: value.trim().length })
    }
  }, [error, offline])

  const handleClearSearch = useCallback(() => {
    haptics('light')
    setSearchQuery('')
  }, [])

  const submitCity = useCallback(async (city: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    haptics('medium')

    setLoading(true)
    setError(false)
    setOffline(false)
    discoverAnalytics.track('city_picker_confirm', undefined, { city })
    try {
      try {
        const networkRes = await Taro.getNetworkType()
        if (networkRes.networkType === 'none') {
          setOffline(true)
          discoverAnalytics.track('city_picker_offline_blocked', undefined, { city })
          return
        }
      } catch {
        // getNetworkType may fail on some devices; proceed optimistically
      }

      await apiRequest({
        method: 'POST',
        path: '/api/cities/interest',
        data: { city, source: 'city_feed_card' },
        timeout: 10000,
      })

      haptics('success')
      setCelebrated(true)
      logInfo('[CityPicker] interest registered', { city })
      discoverAnalytics.track('city_picker_success', undefined, { city })
      celebrationTimerRef.current = setTimeout(() => {
        celebrationTimerRef.current = null
        onSuccess(city)
      }, 600)
    } catch (err) {
      logInfo('[CityPicker] interest register failed', { city, error: String(err) })
      discoverAnalytics.track('city_picker_error', undefined, { city, error: String(err) })
      setError(true)
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }, [onSuccess])

  const handleSelectCity = useCallback((city: string) => {
    if (submittingRef.current || loading) return
    haptics('light')
    setSelectedCity(city)
    if (error) setError(false)
    if (offline) setOffline(false)
    discoverAnalytics.track('city_picker_select', undefined, { city })
    if (!searchQuery.trim()) {
      setScrollToCity(`city-${city}`)
    }
  }, [searchQuery, loading, error, offline])

  const handleConfirm = useCallback(() => {
    if (!selectedCity || loading) return
    void submitCity(selectedCity)
  }, [selectedCity, loading, submitCity])

  const handleRetry = useCallback(() => {
    if (!selectedCity || loading) return
    haptics('light')
    void submitCity(selectedCity)
  }, [selectedCity, loading, submitCity])

  const showHotCities = !searchQuery.trim()
  const displayName = (city: string) => city.replace('市', '')

  const footer = (
    <View className='city-picker__footer'>
      {offline && (
        <View className='city-picker__offline'>
          <Text className='city-picker__offline-text'>网络好像断开了，请检查连接后再试</Text>
          <View
            className='city-picker__offline-retry'
            onClick={handleRetry}
            hoverClass='city-picker__offline-retry--hover'
            role='button'
            aria-label='重试登记'
          >
            <Text className='city-picker__offline-retry-text'>重试</Text>
          </View>
        </View>
      )}
      {error && !offline && (
        <View className='city-picker__error'>
          <Text className='city-picker__error-text'>网络开小差了，登记没成功</Text>
          <View
            className='city-picker__error-retry'
            onClick={handleRetry}
            hoverClass='city-picker__error-retry--hover'
            role='button'
            aria-label='重试登记'
          >
            <Text className='city-picker__error-retry-text'>重试</Text>
          </View>
        </View>
      )}
      <View
        className={`city-picker__confirm ${!selectedCity || loading || offline ? 'city-picker__confirm--disabled' : ''} ${loading ? 'city-picker__confirm--loading' : ''}`}
        onClick={handleConfirm}
        hoverClass={selectedCity && !loading && !offline ? 'city-picker__confirm--hover' : ''}
        role='button'
        aria-label='确认选择城市'
      >
        <Text className='city-picker__confirm-text'>
          {offline ? '网络已断开' : loading ? '登记中...' : selectedCity ? `确认选择 ${displayName(selectedCity)}` : '请选择城市'}
        </Text>
      </View>
    </View>
  )

  const overlay = celebrated ? (
    <View className='city-picker__celebration'>
      <Image
        className='city-picker__celebration-mascot'
        src={getXiaoyueExpressionAsset('matchSuccess')}
        mode='aspectFit'
        aria-hidden='true'
      />
      <View className='city-picker__celebration-check'>
        <Text className='city-picker__celebration-icon'>✓</Text>
      </View>
      <Text className='city-picker__celebration-text'>已登记！</Text>
      <Text className='city-picker__celebration-sub'>悦仔会第一时间通知你</Text>
    </View>
  ) : null

  return (
    <PickerShell
      visible={visible}
      onClose={handleClose}
      mascotExpression='homeWelcome'
      title='你想在哪个城市遇到有趣的人？'
      subtitle='告诉我们你的城市，人数够了悦仔就来安排'
      showClose
      reduceMotion={reduceMotion}
      footer={footer}
      overlay={overlay}
      className='city-picker-shell'
    >
      <View className='city-picker'>
        {/* Search */}
        <View className={`city-picker__search ${searchFocused ? 'city-picker__search--focused' : ''}`}>
          <SearchIcon size={28} className='city-picker__search-icon' />
          <Input
            className='city-picker__search-input'
            type='text'
            placeholder='搜索你想解锁的城市'
            value={searchQuery}
            onInput={(e) => handleSearch(e.detail.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onConfirm={() => {
              if (filteredCities.length === 1) {
                handleSelectCity(filteredCities[0])
              }
            }}
          />
          {searchQuery.trim() && (
            <View
              className='city-picker__search-clear'
              onClick={handleClearSearch}
              hoverClass='city-picker__search-clear--hover'
              aria-label='清除搜索'
            >
              <CloseIcon size={24} className='city-picker__search-clear-icon' />
            </View>
          )}
        </View>

        {/* Unified scrollable area: hot cities + city list in one ScrollView */}
        <View className='city-picker-scroll'>
          <ScrollView
            className='city-picker-scroll__view'
            scrollY
            scrollWithAnimation
            enableFlex
            scrollIntoView={scrollToCity}
          >
            {/* Hot cities — shown when search is empty */}
            {showHotCities ? (
              <View className='city-picker__hot-section'>
                <Text className='city-picker__section-title'>热门城市</Text>
                <View className='city-picker__hot-grid'>
                  {HOT_CITIES.map((city) => (
                    <SelectableTile
                      key={city}
                      variant='compact'
                      label={displayName(city)}
                      selected={selectedCity === city}
                      onClick={() => handleSelectCity(city)}
                      ariaLabel={`选择 ${displayName(city)}`}
                    />
                  ))}
                </View>
              </View>
            ) : (
              /* Spacer to prevent layout jump when hot section hides */
              <View className='city-picker__hot-section-placeholder' />
            )}

            {/* City list */}
            {filteredCities.map((city) => (
              <SelectableTile
                key={city}
                id={`city-${city}`}
                variant='row'
                label={displayName(city)}
                selected={selectedCity === city}
                onClick={() => handleSelectCity(city)}
                ariaLabel={`选择 ${displayName(city)}`}
              />
            ))}
            {filteredCities.length === 0 && (
              <View className='city-picker__empty city-picker__empty--enter'>
                <Image
                  className='city-picker__empty-mascot'
                  src={getXiaoyueExpressionAsset('testCurious')}
                  mode='aspectFit'
                  aria-hidden='true'
                />
                <Text className='city-picker__empty-text'>悦仔还没去过这座城市</Text>
                <Text className='city-picker__empty-hint'>换个关键词试试，或者选一座热门城市</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </PickerShell>
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
