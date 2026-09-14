import { View } from '@tarojs/components'
import { useWindowHeightPx } from '../../hooks/useWindowHeightPx'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'

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
  const innerPx = useWindowHeightPx()

  if (collapseBelow !== undefined && innerPx < collapseBelow) {
    return null
  }

  // H5's style parser silently drops inline rpx (AGENTS.md §3), collapsing the
  // spacer to zero height. Emit computed px instead — px = rpx × windowWidth /
  // 750 is pixel-identical on WeChat native at any device width. Same
  // convention as JoyJoinIcon (2026-09-14): fresh getWindowInfoCompat() read
  // per render — window metrics are intentionally not memoized.
  const windowWidth = getWindowInfoCompat().windowWidth || 375
  const heightPx = `${Math.round((heightRpx * windowWidth) / 750)}px`

  return (
    <View
      className={className}
      style={{ height: heightPx, width: '100%', flexShrink: 0 }}
    />
  )
}
