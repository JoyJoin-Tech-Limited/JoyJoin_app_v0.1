import { useDidShow, useDidHide } from '@tarojs/taro'
import { useState } from 'react'

/**
 * Page-level visibility for WeChat mini-program surfaces.
 *
 * WeChat has no `document.hidden`: TanStack Query's `refetchInterval`
 * auto-pause never fires, and JS/CSS animations keep running on pages that
 * are alive-but-hidden in the navigation stack. `useDidHide` fires on both
 * navigation-away and app-background, so this single hook covers both cases.
 *
 * Surfaces with no page context (e.g. the app-level notification-counts
 * hook) must use `Taro.onAppHide`/`Taro.onAppShow` instead.
 */
export function usePageVisibility(): { isPageVisible: boolean } {
  const [isPageVisible, setIsPageVisible] = useState(true)

  useDidShow(() => {
    setIsPageVisible(true)
  })

  useDidHide(() => {
    setIsPageVisible(false)
  })

  return { isPageVisible }
}
