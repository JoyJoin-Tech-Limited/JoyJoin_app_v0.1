import { View, Text } from '@tarojs/components'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import './CityUnlockBanner.scss'

const BANNER_DISMISS_KEY = 'city_unlock_banner_dismissed'
const BANNER_COOLDOWN_DAYS = 7

interface CityUnlockBannerProps {
  onSelectCity: () => void
}

function isBannerDismissed(): boolean {
  try {
    const raw = Taro.getStorageSync(BANNER_DISMISS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const ageMs = Date.now() - (parsed.timestamp || 0)
    return ageMs < BANNER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function dismissBanner() {
  Taro.setStorageSync(BANNER_DISMISS_KEY, JSON.stringify({ timestamp: Date.now() }))
}

/**
 * Gentle banner for non-Shenzhen users on the Discover page.
 *
 * - Appears with a soft slide-in animation
 * - Can be dismissed (7-day cooldown)
 * - Does NOT block the main flow
 */
export default function CityUnlockBanner({ onSelectCity }: CityUnlockBannerProps) {
  const [visible, setVisible] = useState(false)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (isBannerDismissed()) return

    // Delay appearance by 2s for a gentle feel
    const timer = setTimeout(() => {
      setVisible(true)
      // Trigger animation after state flush (setTimeout 0 is safer than rAF in Taro)
      setTimeout(() => setAnimated(true), 50)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const handleDismiss = (e: any) => {
    e.stopPropagation()
    dismissBanner()
    setAnimated(false)
    setTimeout(() => setVisible(false), 300)
  }

  const handleTap = () => {
    onSelectCity()
  }

  return (
    <View
      className={`city-unlock-banner ${animated ? 'city-unlock-banner--visible' : ''}`}
      onClick={handleTap}
    >
      <View className='city-unlock-banner__content'>
        <JoyJoinIcon emoji='🌏' size={40} className='city-unlock-banner__icon' />
        <View className='city-unlock-banner__text'>
          <Text className='city-unlock-banner__title'>你看起来不在深圳？</Text>
          <Text className='city-unlock-banner__subtitle'>告诉我们你想在哪个城市遇到有趣的人 👉</Text>
        </View>
      </View>
      <View className='city-unlock-banner__dismiss' onClick={handleDismiss}>
        <Text className='city-unlock-banner__dismiss-icon'>✕</Text>
      </View>
    </View>
  )
}
