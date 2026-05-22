import { Image } from '@tarojs/components'
import { cdnAsset } from '../../lib/utils/cdnAssets'

const LOCAL_LOGO_PATH = '/assets/box-logo.webp'

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

const SIZE_MAP: Record<BrandLogoSize, { width: string; height: string }> = {
  sm: { width: '74rpx', height: '74rpx' },
  md: { width: '152rpx', height: '152rpx' },
  lg: { width: '240rpx', height: '240rpx' },
  xl: { width: '520rpx', height: '520rpx' },
}

/**
 * BrandLogo — single-source-of-truth JoyJoin logo renderer.
 *
 * Use this instead of hardcoding `<Image src="/assets/box-logo.webp">`
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
  const style: React.CSSProperties =
    width !== undefined || height !== undefined
      ? {
          width: width !== undefined ? `${width}rpx` : dims.width,
          height: height !== undefined ? `${height}rpx` : dims.height,
        }
      : {
          width: dims.width,
          height: dims.height,
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
