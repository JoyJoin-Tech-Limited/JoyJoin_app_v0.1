import { Image } from '@tarojs/components'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'

const LOCAL_LOGO_PATH = '/assets/joyjoin-logo-tab.png'

export type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl'

interface BrandLogoProps {
  /** Preset size mapped to mini-program rpx dimensions.
   *  - `sm`:  74rpx  → tab bar center button
   *  - `md`:  152rpx → landing page
   *  - `lg`:  240rpx → entry screen splash
   *  - `xl`:  520rpx → full-screen loading overlay
   */
  size?: BrandLogoSize
  /** Override preset with explicit width in rpx (e.g. 120). */
  width?: number
  /** Override preset with explicit height in rpx (e.g. 120). */
  height?: number
  /** Additional CSS class */
  className?: string
  /** Image mode — defaults to aspectFit for logo safety */
  mode?: 'aspectFit' | 'aspectFill' | 'widthFix'
  /** Disable lazy load for above-the-fold logos (default true) */
  lazyLoad?: boolean
  /** Accessible label */
  ariaLabel?: string
}

/** Preset dimensions in rpx (converted to computed px at render — see below). */
const SIZE_MAP: Record<BrandLogoSize, { width: number; height: number }> = {
  sm: { width: 74, height: 74 },
  md: { width: 152, height: 152 },
  lg: { width: 240, height: 240 },
  xl: { width: 520, height: 520 },
}

/**
 * BrandLogo — single-source-of-truth JoyJoin logo renderer.
 *
 * Use this instead of hardcoding `<Image src="/assets/joyjoin-logo-tab.png">`
 * so asset path changes only require one edit.
 *
 * Usage:
 *   <BrandLogo size="md" />
 *   <BrandLogo size="sm" className="tab-bar-logo" />
 *   <BrandLogo width={120} height={120} mode="aspectFill" />
 */
export default function BrandLogo({
  size = 'md',
  width,
  height,
  className = '',
  mode = 'aspectFit',
  lazyLoad = false,
  ariaLabel = '悦聚 JoyJoin',
}: BrandLogoProps) {
  const dims = SIZE_MAP[size]
  // H5's style parser silently drops inline rpx (AGENTS.md §3), collapsing the
  // image to taro-image's 320×240 default. Emit computed px instead —
  // px = rpx × windowWidth / 750 is pixel-identical on WeChat native at any
  // device width. Same convention as JoyJoinIcon (2026-09-14): fresh
  // getWindowInfoCompat() read per render — window metrics are intentionally
  // not memoized; see lib/utils/systemInfo.ts.
  const windowWidth = getWindowInfoCompat().windowWidth || 375
  const rpxToPx = (rpx: number) => `${Math.round((rpx * windowWidth) / 750)}px`
  const style: React.CSSProperties =
    width !== undefined || height !== undefined
      ? {
          width: rpxToPx(width !== undefined ? width : dims.width),
          height: rpxToPx(height !== undefined ? height : dims.height),
        }
      : {
          width: rpxToPx(dims.width),
          height: rpxToPx(dims.height),
        }

  return (
    <Image
      className={`brand-logo ${className}`}
      src={LOCAL_LOGO_PATH}
      style={style}
      mode={mode}
      lazyLoad={lazyLoad}
      ariaLabel={ariaLabel}
    />
  )
}
