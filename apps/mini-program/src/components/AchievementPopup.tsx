import { View, Text } from '@tarojs/components'
import { useEffect, useCallback, useState } from 'react'
import { getRarityClassName } from '@shared/achievements'
import { useAchievements } from '../providers/AchievementProvider'
import JoyJoinIcon from './ui/JoyJoinIcon'
import './AchievementPopup.scss'

const AUTO_DISMISS_MS = 3500
const EXIT_LEAD_MS = 300

/**
 * AchievementPopup — toast-style popup for unlocked achievements.
 *
 * Mount this once at the app level (e.g. inside AuthProvider or the root
 * layout). It reads from AchievementContext and auto-dismisses after 3.5 s
 * with a choreographed entrance / exit animation.
 */
export default function AchievementPopup() {
  const { currentAchievement, dismissCurrent } = useAchievements()
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (!currentAchievement) {
      setIsExiting(false)
      return
    }

    setIsExiting(false)
    const exitTimer = setTimeout(() => setIsExiting(true), AUTO_DISMISS_MS - EXIT_LEAD_MS)
    const dismissTimer = setTimeout(dismissCurrent, AUTO_DISMISS_MS)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(dismissTimer)
    }
  }, [currentAchievement, dismissCurrent])

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(dismissCurrent, EXIT_LEAD_MS)
  }, [dismissCurrent])

  if (!currentAchievement) return null

  const rarityClass = getRarityClassName(currentAchievement.rarity)
  const motionClass = isExiting
    ? 'achievement-popup--exiting'
    : 'achievement-popup--entering'

  return (
    <View className={`achievement-popup achievement-popup--${rarityClass} ${motionClass}`}>
      <View className='achievement-popup__content'>
        <JoyJoinIcon
          emoji={currentAchievement.emoji}
          tier='achievement'
          size={72}
          className='achievement-popup__emoji'
        />
        <View className='achievement-popup__text'>
          <Text className='achievement-popup__rarity'>
            {currentAchievement.rarity === 'legendary'
              ? '传说成就'
              : currentAchievement.rarity === 'epic'
                ? '史诗成就'
                : currentAchievement.rarity === 'rare'
                  ? '稀有成就'
                  : '成就解锁'}
          </Text>
          <Text className='achievement-popup__title'>{currentAchievement.title}</Text>
          <Text className='achievement-popup__description'>{currentAchievement.description}</Text>
        </View>
        <View className='achievement-popup__close' onClick={handleDismiss}>
          <Text className='achievement-popup__close-icon'>×</Text>
        </View>
      </View>
      <View className='achievement-popup__progress' />
    </View>
  )
}
