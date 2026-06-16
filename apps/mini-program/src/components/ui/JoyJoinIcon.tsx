import { Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import {
  getIconMapping,
  getLocalIconAssetPath,
  CDN_ICON_TIERS,
  type IconMapping,
  type IconTier,
} from '@joyjoin/shared/iconSystem'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'

interface JoyJoinIconProps {
  emoji: string
  size?: number
  tier?: IconTier
  className?: string
  style?: React.CSSProperties
}

/**
 * JoyJoinIcon — Universal proprietary icon renderer.
 *
 * Looks up the emoji in the centralized mapping registry and renders
 * the matching proprietary icon. If no mapping exists or the image
 * fails to load, falls back gracefully to native emoji text rendering.
 *
 * WeChat mini-program automatically picks @2x/@3x variants when the
 * src does NOT already contain a density suffix. Hardcoding @3x causes
 * the runtime to try `asset@3x@3x.webp`, a 404. Always request the
 * bare 1x filename.
 *
 * @see AGENTS.md §4 — "WeChat @3x image pitfall"
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

/** Append a hex alpha channel safely; fall back to the original colour if not hex. */
function hexWithAlpha(hex: string | undefined, alphaHex: string): string {
  if (!hex || !hex.startsWith('#')) return hex ?? 'transparent'
  return hex + alphaHex
}

/** Fallback placeholder background for loading icons.
 *  Mirrors the SCSS token `rgba($color-text-primary, 0.04)` (#2D3142 at 4% opacity).
 *  Keep in sync with `apps/mini-program/src/styles/_variables.scss`.
 */
const DEFAULT_ICON_PLACEHOLDER_BG = 'rgba(45, 49, 66, 0.04)'

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
    return 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'
  }, [])

  if (!mapping) {
    return (
      <Text className={className} style={style}>
        {emoji}
      </Text>
    )
  }

  const displaySize = size ?? mapping.size
  const sizeStr = `${displaySize}rpx`

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

  let src: string
  try {
    const assetPath = getLocalIconAssetPath(mapping.assetKey, mapping.tier, 1)
    if (CDN_ICON_TIERS.has(mapping.tier)) {
      src = cdnAsset(assetPath)
    } else {
      // Local bundled assets are served from the mini-program root.
      // Avoid runtime require() of non-JS assets — it crashes in subpackages.
      src = localAsset(assetPath)
    }
  } catch {
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
            ? hexWithAlpha(mapping.tint, '1A')
            : DEFAULT_ICON_PLACEHOLDER_BG,
        ...style,
      }}
      mode='aspectFit'
      lazyLoad
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}
