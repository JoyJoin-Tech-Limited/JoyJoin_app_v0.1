import { createContext, useContext, useState, useCallback, useEffect, type PropsWithChildren } from 'react'
import { ACHIEVEMENTS, type Achievement } from '@shared/achievements'

const STORAGE_KEY = 'joyjoin_achievements'

interface AchievementContextValue {
  /** All unlocked achievement IDs. */
  unlockedIds: string[]
  /** The achievement currently shown in the popup (or null). */
  currentAchievement: Achievement | null
  /** Unlock an achievement by ID. */
  unlock: (id: string) => void
  /** Check whether an achievement has already been unlocked. */
  isUnlocked: (id: string) => boolean
  /** Dismiss the current achievement popup. */
  dismissCurrent: () => void
}

const AchievementContext = createContext<AchievementContextValue | null>(null)

export function useAchievements(): AchievementContextValue {
  const context = useContext(AchievementContext)
  if (!context) {
    throw new Error('useAchievements must be used within AchievementProvider')
  }
  return context
}

/**
 * AchievementProvider — manages achievement unlock state and popup queue.
 *
 * Persists unlocked achievement IDs via `wx.setStorageSync` (the
 * mini-program equivalent of `localStorage`).
 */
export function AchievementProvider({ children }: PropsWithChildren) {
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => {
    try {
      const stored = wx.getStorageSync(STORAGE_KEY)
      return Array.isArray(stored) ? stored : []
    } catch {
      return []
    }
  })

  const [queue, setQueue] = useState<Achievement[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)

  // Persist to storage whenever the set of unlocked IDs changes.
  useEffect(() => {
    try {
      wx.setStorageSync(STORAGE_KEY, unlockedIds)
    } catch {
      // Ignore storage errors on older runtimes.
    }
  }, [unlockedIds])

  // Process the popup queue: show the next achievement when the current one
  // is dismissed.
  useEffect(() => {
    if (!currentAchievement && queue.length > 0) {
      const [next, ...rest] = queue
      setCurrentAchievement(next)
      setQueue(rest)

      // Mini-program vibrate API (equivalent of navigator.vibrate)
      try {
        wx.vibrateShort({ type: 'medium' })
      } catch {
        // Ignore if vibrate is unsupported.
      }
    }
  }, [currentAchievement, queue])

  const unlock = useCallback((id: string) => {
    if (unlockedIds.includes(id)) return
    const achievement = ACHIEVEMENTS[id]
    if (!achievement) return

    setUnlockedIds((prev) => [...prev, id])
    setQueue((prev) => [...prev, achievement])
  }, [unlockedIds])

  const isUnlocked = useCallback((id: string) => {
    return unlockedIds.includes(id)
  }, [unlockedIds])

  const dismissCurrent = useCallback(() => {
    setCurrentAchievement(null)
  }, [])

  return (
    <AchievementContext.Provider
      value={{ unlockedIds, currentAchievement, unlock, isUnlocked, dismissCurrent }}
    >
      {children}
    </AchievementContext.Provider>
  )
}
