import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'
import './TabPageNav.scss'

// 88rpx title row, matching the Profile bar that defined this pattern and the
// native WeChat navigation bar it replaces on every tab page.
const TITLE_ROW_HEIGHT_RPX = 88
const DESIGN_WIDTH_RPX = 750
const FALLBACK_WINDOW_WIDTH = 375
// Gap between the right-slot edge and the WeChat capsule's left edge.
const CAPSULE_GAP_PX = 12

interface WindowMetrics {
  statusBarHeight: number
  windowWidth: number
}

function resolveWindowMetrics(): WindowMetrics {
  const info = getWindowInfoCompat()
  const windowWidth =
    typeof info.windowWidth === 'number' && info.windowWidth > 0
      ? info.windowWidth
      : FALLBACK_WINDOW_WIDTH
  const statusBarHeight =
    typeof info.statusBarHeight === 'number' && info.statusBarHeight > 0
      ? info.statusBarHeight
      : 0
  return { statusBarHeight, windowWidth }
}

/**
 * Right inset (px) that clears the WeChat capsule. Returns null outside
 * WeChat (H5/tests), where the stylesheet's capsule-safe fallback applies.
 * `getMenuButtonBoundingClientRect` is optional-called because some runtimes
 * (and the global Taro test mock) do not implement it.
 */
function resolveCapsuleRightInset(windowWidth: number): number | null {
  try {
    const rect = Taro.getMenuButtonBoundingClientRect?.()
    if (!rect || typeof rect.left !== 'number' || rect.left <= 0) return null
    return Math.max(0, windowWidth - rect.left + CAPSULE_GAP_PX)
  } catch {
    return null
  }
}

/** Total nav height in px — used by page-level scroll views/padding. */
export function getTabPageNavHeightPx(): number {
  const { statusBarHeight, windowWidth } = resolveWindowMetrics()
  return statusBarHeight + (TITLE_ROW_HEIGHT_RPX * windowWidth) / DESIGN_WIDTH_RPX
}

export interface TabPageNavProps {
  title: string
  /** Firm up the chrome after the page scrolls (Profile parity). */
  condensed?: boolean
  /** Viewport-fixed mode for page-level scroll screens (Discover). */
  fixed?: boolean
  /** Right-side affordance; positioned clear of the WeChat capsule. */
  right?: ReactNode
  testId?: string
  className?: string
}

/**
 * TabPageNav — the shared tab-page title bar.
 *
 * 2026-11-25 title parity: 我的 established the pattern (brand display font,
 * 88rpx centered title row under the status bar) while Discover/Events/
 * Connections/Center Hub still fell back to the native WeChat bar, which
 * renders the system font. Every tab page now owns the same custom bar.
 *
 * The right slot is optional; when present it is measured against
 * `getMenuButtonBoundingClientRect()` so a bell never hides under the capsule.
 */
export default function TabPageNav({
  title,
  condensed = false,
  fixed = false,
  right,
  testId,
  className,
}: TabPageNavProps) {
  const [metrics] = useState(() => {
    const windowMetrics = resolveWindowMetrics()
    return {
      ...windowMetrics,
      capsuleRightInset: resolveCapsuleRightInset(windowMetrics.windowWidth),
    }
  })

  const classes = [
    'tab-page-nav',
    condensed ? 'tab-page-nav--condensed' : '',
    fixed ? 'tab-page-nav--fixed' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      className={classes}
      data-testid={testId}
      // Android runtimes can report 0 for env(safe-area-inset-top); the
      // measured status bar height wins when available. In H5/tests the
      // inline value is omitted so the stylesheet fallback applies.
      style={metrics.statusBarHeight > 0 ? { paddingTop: `${metrics.statusBarHeight}px` } : undefined}
    >
      <View className='tab-page-nav__content'>
        <Text className='tab-page-nav__title'>{title}</Text>
        {right ? (
          <View
            className='tab-page-nav__right'
            style={
              metrics.capsuleRightInset != null
                ? { right: `${metrics.capsuleRightInset}px` }
                : undefined
            }
          >
            {right}
          </View>
        ) : null}
      </View>
    </View>
  )
}
