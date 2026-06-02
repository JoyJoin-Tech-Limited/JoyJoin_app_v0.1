import { Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  getIconMapping,
  getIconAssetPath,
  CDN_ICON_TIERS,
  type IconMapping,
  type IconTier,
} from '@joyjoin/shared/iconSystem'
import { cdnAsset } from '../../lib/utils/cdnAssets'

interface JoyJoinIconProps {
  /** The original emoji character — used for lookup and fallback */
  emoji: string
  /** Override display size in rpx (defaults to mapped size) */
  size?: number
  /** Optional tier override for context-specific assets (e.g. 'reaction') */
  tier?: IconTier
  /** Additional CSS class */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

/**
 * JoyJoinIcon — Universal proprietary icon renderer.
 *
 * Looks up the emoji in the centralized mapping registry and renders
 * the matching proprietary PNG icon. If no mapping exists or the image
 * fails to load, falls back gracefully to native emoji text rendering.
 *
 * WeChat mini-program automatically picks @2x/@3x variants when files
 * are named with those suffixes in the same folder. We only need to
 * reference the 1x source in the src attribute.
 *
 * Usage:
 *   <JoyJoinIcon emoji="📅" size={32} />
 *   <JoyJoinIcon emoji="😂" />
 *   <JoyJoinIcon emoji="🔥" tier="reaction" size={48} />
 */
function getReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    return (info as any).reduceMotion ?? false
  } catch {
    return false
  }
}

const REDUCED_MOTION = getReducedMotion()

export default function JoyJoinIcon({
  emoji,
  size,
  tier,
  className = '',
  style = {},
}: JoyJoinIconProps) {
  const mapping: IconMapping | undefined = getIconMapping(emoji, tier)
  const [hasError, setHasError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const transition = useMemo(() => {
    if (REDUCED_MOTION) return 'none'
    return 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
  }, [])

  // No mapping — render native emoji immediately
  if (!mapping) {
    return (
      <Text className={className} style={style}>
        {emoji}
      </Text>
    )
  }

  const displaySize = size ?? mapping.size
  const sizeStr = `${displaySize}rpx`

  // Image failed to load — render fallback emoji
  if (hasError) {
    return (
      <Text
        className={`${className} ${!loaded ? 'jj-icon-loading' : ''}`}
        style={{ fontSize: sizeStr, lineHeight: sizeStr, ...style }}
      >
        {mapping.fallbackEmoji}
      </Text>
    )
  }

  // Resolve asset path — CDN tiers use cdnAsset(), local tiers use require()
  let src: string
  try {
    const assetPath = getIconAssetPath(mapping.assetKey, mapping.tier, 1)
    if (CDN_ICON_TIERS.has(mapping.tier)) {
      src = cdnAsset(assetPath)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      src = require(assetPath) as string
    }
  } catch {
    // If resolution fails (asset missing or CDN unreachable), fall back to emoji
    return (
      <Text
        className={`${className} ${!loaded ? 'jj-icon-loading' : ''}`}
        style={{ fontSize: sizeStr, lineHeight: sizeStr, ...style }}
      >
        {mapping.fallbackEmoji}
      </Text>
    )
  }

  return (
    <Image
      className={className}
      src={src}
      style={{
        width: sizeStr,
        height: sizeStr,
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'scale(1)' : 'scale(0.85)',
        transition,
        backgroundColor: loaded
          ? 'transparent'
          : mapping.tint
            ? `${mapping.tint}1A`
            : 'rgba(0,0,0,0.04)',
        ...style,
      }}
      mode='aspectFit'
      lazyLoad
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}
