import { View, Text } from '@tarojs/components'
import { useEffect, useCallback } from 'react'
import { useAchievements } from '../providers/AchievementProvider'
import { getRarityClassName } from '@shared/achievements'
import './AchievementPopup.scss'

const AUTO_DISMISS_MS = 3500

/**
 * AchievementPopup — toast-style popup for unlocked achievements.
 *
 * Mount this once at the app level (e.g. inside AuthProvider or the root
 * layout).  It reads from AchievementContext and auto-dismisses after 3.5 s.
 */
export default function AchievementPopup() {
  const { currentAchievement, dismissCurrent } = useAchievements()

  useEffect(() => {
    if (!currentAchievement) return
    const timer = setTimeout(dismissCurrent, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [currentAchievement, dismissCurrent])

  const handleDismiss = useCallback(() => {
    dismissCurrent()
  }, [dismissCurrent])

  if (!currentAchievement) return null

  const rarityClass = getRarityClassName(currentAchievement.rarity)

  return (
    <View className={`achievement-popup achievement-popup--${rarityClass}`}>
      <View className='achievement-popup__content'>
        <Text className='achievement-popup__emoji'>{currentAchievement.emoji}</Text>
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
