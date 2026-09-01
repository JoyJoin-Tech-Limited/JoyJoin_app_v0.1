import { View } from '@tarojs/components'
import { useWindowHeightPx } from '../../hooks/useWindowHeightPx'

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

  return (
    <View
      className={className}
      style={{ height: `${heightRpx}rpx`, width: '100%', flexShrink: 0 }}
    />
  )
}
