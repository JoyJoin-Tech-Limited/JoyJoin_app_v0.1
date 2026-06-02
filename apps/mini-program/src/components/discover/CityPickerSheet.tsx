import { View, Text, Input, ScrollView } from '@tarojs/components'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { apiRequest } from '../../lib/api/api'
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

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('')
      setSelectedCity(null)
      setLoading(false)
    }
  }, [visible])

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return ALL_CITIES
    const q = searchQuery.trim().toLowerCase()
    return ALL_CITIES.filter((city) =>
      city.toLowerCase().includes(q) ||
      getPinyinInitial(city).includes(q)
    )
  }, [searchQuery])

  const handleSelectCity = useCallback((city: string) => {
    setSelectedCity(city)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selectedCity || loading) return

    setLoading(true)
    try {
      await apiRequest({
        method: 'POST',
        path: '/api/cities/interest',
        data: { city: selectedCity, source: 'floating_banner' },
      })

      Taro.showToast({
        title: '登记成功！',
        icon: 'success',
        duration: 1500,
      })

      onSuccess(selectedCity)
    } catch (err) {
      Taro.showToast({
        title: '网络开小差了',
        icon: 'none',
        duration: 2000,
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCity, loading, onSuccess])

  if (!visible) return null

  return (
    <View className='city-picker-overlay' onClick={onClose}>
      <View
        className='city-picker-sheet'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <View className='city-picker-sheet__handle' />

        {/* Title */}
        <View className='city-picker-sheet__header'>
          <Text className='city-picker-sheet__title'>你想在哪个城市</Text>
          <Text className='city-picker-sheet__title'>遇到有趣的人？</Text>
        </View>

        {/* Search */}
        <View className='city-picker-sheet__search'>
          <JoyJoinIcon emoji='🔍' size={28} className='city-picker-sheet__search-icon' />
          <Input
            className='city-picker-sheet__search-input'
            placeholder='搜索城市'
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.detail.value)}
          />
        </View>

        {/* Hot cities */}
        {!searchQuery.trim() && (
          <>
            <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
              <JoyJoinIcon emoji='🔥' size={28} />
              <Text className='city-picker-sheet__section-title'>热门城市</Text>
            </View>
            <View className='city-picker-sheet__hot-grid'>
              {HOT_CITIES.map((city) => (
                <View
                  key={city}
                  className={`city-picker-sheet__hot-item ${selectedCity === city ? 'city-picker-sheet__hot-item--selected' : ''}`}
                  onClick={() => handleSelectCity(city)}
                >
                  <Text className='city-picker-sheet__hot-item-text'>{city.replace('市', '')}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* City list */}
        <ScrollView
          className='city-picker-sheet__list'
          scrollY
          scrollWithAnimation
          enableFlex
        >
          {filteredCities.map((city) => (
            <View
              key={city}
              className={`city-picker-sheet__list-item ${selectedCity === city ? 'city-picker-sheet__list-item--selected' : ''}`}
              onClick={() => handleSelectCity(city)}
            >
              <Text className='city-picker-sheet__list-item-text'>{city}</Text>
              {selectedCity === city && (
                <Text className='city-picker-sheet__list-item-check'>✓</Text>
              )}
            </View>
          ))}
          {filteredCities.length === 0 && (
            <View className='city-picker-sheet__empty'>
              <Text className='city-picker-sheet__empty-text'>没有找到相关城市</Text>
            </View>
          )}
        </ScrollView>

        {/* Confirm button */}
        <View className='city-picker-sheet__footer'>
          <View
            className={`city-picker-sheet__confirm ${!selectedCity || loading ? 'city-picker-sheet__confirm--disabled' : ''}`}
            onClick={handleConfirm}
          >
            <Text className='city-picker-sheet__confirm-text'>
              {loading ? '登记中...' : selectedCity ? `确认选择 ${selectedCity.replace('市', '')}` : '请选择城市'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// Simple pinyin initial helper (limited, covers common cities)
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
