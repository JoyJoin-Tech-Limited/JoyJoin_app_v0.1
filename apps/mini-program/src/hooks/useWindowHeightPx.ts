import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'

function readWindowHeightPx(): number {
  try {
    const wi = Taro.getWindowInfo?.()
    if (wi && typeof wi.windowHeight === 'number') {
      return wi.windowHeight
    }
  } catch {
    /* ignore */
  }
  try {
    const s = Taro.getSystemInfoSync()
    if (typeof s.windowHeight === 'number') {
      return s.windowHeight
    }
  } catch {
    /* ignore */
  }
  // Fail-open: unknown viewport = treat as tall enough (ResponsiveSpacer
  // convention — never hide content when the height cannot be read).
  return 9999
}

/**
 * useWindowHeightPx — live window height in px, refreshed on show + resize.
 *
 * Mirrors the read logic inside `components/ui/ResponsiveSpacer.tsx` so pages
 * can apply the same `collapseBelow` convention to conditional sections (not
 * just spacers). Fail-open to a tall viewport when the API is unavailable.
 */
export function useWindowHeightPx(): number {
  const [heightPx, setHeightPx] = useState(readWindowHeightPx)

  const refresh = useCallback(() => {
    setHeightPx(readWindowHeightPx())
  }, [])

  useDidShow(refresh)

  useEffect(() => {
    if (typeof Taro.onWindowResize === 'function') {
      Taro.onWindowResize(refresh)
      return () => {
        if (typeof Taro.offWindowResize === 'function') {
          Taro.offWindowResize(refresh)
        }
      }
    }
    return undefined
  }, [refresh])

  return heightPx
}
