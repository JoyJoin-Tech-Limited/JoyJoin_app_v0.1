import { View } from '@tarojs/components'
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
  return 9999
}

export type ResponsiveSpacerProps = {
  /** Vertical gap in rpx when not collapsed */
  heightRpx: number
  /** When window height (px) is below this, render nothing — keeps fixed CTAs reachable on short phones */
  collapseBelow?: number
  className?: string
}

/**
 * Taro equivalent of web `@shared/ui/ResponsiveSpacer` — see `.cursor/skills/viewport-zero-scroll/SKILL.md`.
 */
export function ResponsiveSpacer({
  heightRpx,
  collapseBelow,
  className,
}: ResponsiveSpacerProps) {
  const [innerPx, setInnerPx] = useState(readWindowHeightPx)

  const refresh = useCallback(() => {
    setInnerPx(readWindowHeightPx())
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

  if (collapseBelow !== undefined && innerPx < collapseBelow) {
    return null
  }

  return (
    <View
      className={className}
      style={{ height: `${heightRpx}rpx`, width: '100%', flexShrink: 0 }}
    />
  )
}
