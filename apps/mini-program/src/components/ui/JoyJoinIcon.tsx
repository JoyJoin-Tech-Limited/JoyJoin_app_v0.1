import { Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import {
  getIconMapping,
  getIconAssetPath,
  type IconMapping,
} from '@joyjoin/shared/iconSystem'

interface JoyJoinIconProps {
  /** The original emoji character — used for lookup and fallback */
  emoji: string
  /** Override display size in rpx (defaults to mapped size) */
  size?: number
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
 */
export default function JoyJoinIcon({
  emoji,
  size,
  className = '',
  style = {},
}: JoyJoinIconProps) {
  const mapping: IconMapping | undefined = getIconMapping(emoji)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    setHasError(true)
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
        className={className}
        style={{ fontSize: sizeStr, lineHeight: sizeStr, ...style }}
      >
        {mapping.fallbackEmoji}
      </Text>
    )
  }

  // Resolve asset path using Taro require()
  let src: string
  try {
    const path1x = getIconAssetPath(mapping.assetKey, mapping.tier, 1)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    src = require(path1x) as string
  } catch {
    // If require fails (asset missing), fall back to emoji
    return (
      <Text
        className={className}
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
        ...style,
      }}
      lazyLoad
      onError={handleError}
    />
  )
}
