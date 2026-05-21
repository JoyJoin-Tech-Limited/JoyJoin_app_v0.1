import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'

const DEFAULT_EXIT_DELAY_MS = 220

export interface UseJoyJoinNavigationResult {
  /** True while the exit transition is playing; use to apply CSS exit classes. */
  isExiting: boolean
  /** Navigate back with exit transition. Falls back to switchTab on empty stack. */
  navigateBack: (fallbackUrl?: string) => Promise<void>
  /** Redirect with exit transition. */
  redirectTo: (url: string) => Promise<void>
  /** Navigate to with exit transition. */
  navigateTo: (url: string) => Promise<void>
  /** Switch tab with exit transition. */
  switchTab: (url: string) => Promise<void>
}

/**
 * Standardised navigation hook that plays a CSS exit transition
 * before invoking the native Taro navigation API.
 *
 * Usage:
 *   const { isExiting, navigateBack } = useJoyJoinNavigation()
 *   <View className={`my-page ${isExiting ? 'my-page--exiting' : ''}`}>
 */
export function useJoyJoinNavigation(
  delayMs: number = DEFAULT_EXIT_DELAY_MS,
): UseJoyJoinNavigationResult {
  const [isExiting, setIsExiting] = useState(false)

  useDidShow(() => setIsExiting(false))

  const runWithExit = useCallback(
    async (action: () => unknown | Promise<unknown>) => {
      setIsExiting(true)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await Promise.resolve(action())
    },
    [delayMs],
  )

  const navigateBack = useCallback(
    async (fallbackUrl?: string) => {
      await runWithExit(() => {
        void Taro.navigateBack({
          fail: () => {
            if (fallbackUrl) {
              void Taro.switchTab({ url: fallbackUrl })
            }
          },
        })
      })
    },
    [runWithExit],
  )

  const redirectTo = useCallback(
    async (url: string) => {
      await runWithExit(() => Taro.redirectTo({ url }))
    },
    [runWithExit],
  )

  const navigateTo = useCallback(
    async (url: string) => {
      await runWithExit(() => Taro.navigateTo({ url }))
    },
    [runWithExit],
  )

  const switchTab = useCallback(
    async (url: string) => {
      await runWithExit(() => Taro.switchTab({ url }))
    },
    [runWithExit],
  )

  return { isExiting, navigateBack, redirectTo, navigateTo, switchTab }
}
