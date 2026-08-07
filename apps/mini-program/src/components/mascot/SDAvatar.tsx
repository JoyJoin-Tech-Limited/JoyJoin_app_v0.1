import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { getSdAvatarAsset } from '../../lib/profile/sdAvatarAssets'
import ArchetypeHead from './ArchetypeHead'
import './SDAvatar.scss'

/**
 * SDAvatar — SD pixel sprite avatar for the 12 JoyJoin archetypes.
 *
 * Renders the finished front-view chibi sprite (集结房间 SD 形象) at the
 * frozen integer size buckets 96/64/48/32px (style guide T6). Used in
 * 40rpx+ roster/list slots via `ArchetypeHead variant='sd'` once the
 * `sdAvatarEnabled` feature flag is on.
 *
 * Loading strategy mirrors ArchetypeHead exactly: local bundled WebP is the
 * primary src; onError swaps to the CDN mirror; a second failure degrades to
 * the requested fallback. WeChat downscales the bucket asset to the display
 * size; no @2x/@3x suffixes are used (avoids the @3x@3x double-suffix bug).
 *
 * Circular import note: SDAvatar renders ArchetypeHead for fallback='head'
 * and ArchetypeHead renders SDAvatar for variant='sd'. Both references are
 * render-time only, so the ESM live bindings resolve safely.
 */

interface SDAvatarProps {
  archetype?: string | null
  size?: number // rpx
  fallback?: 'head' | 'initial' | 'none'
  fallbackText?: string
  className?: string
  /** Circle-crop container (default true for list usage). */
  circle?: boolean
}

/**
 * Per-archetype visual-centre correction, expressed in source pixels on the
 * 128px master canvas and rescaled by bucket / 128 at render time (same
 * contract as ArchetypeHead's VISUAL_CENTRE_SOURCE_OFFSET).
 *
 * TODO(sd-art): all zero until the Lovart SD art lands — tune per archetype
 * with the opacity-weighted centroid pass once real sprites exist.
 */
const VISUAL_CENTRE_SOURCE_OFFSET: Record<string, { dx: number; dy: number }> = {
  cat:            { dx: 0, dy: 0 },
  corgi:          { dx: 0, dy: 0 },
  dolphin_calm:   { dx: 0, dy: 0 },
  elephant:       { dx: 0, dy: 0 },
  fox:            { dx: 0, dy: 0 },
  hamster_praise: { dx: 0, dy: 0 },
  koala:          { dx: 0, dy: 0 },
  octopus:        { dx: 0, dy: 0 },
  owl:            { dx: 0, dy: 0 },
  rooster:        { dx: 0, dy: 0 },
  spider:         { dx: 0, dy: 0 },
  turtle:         { dx: 0, dy: 0 },
}

const MASTER_CANVAS_SIZE = 128

function getFallbackInitial(text?: string): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}

export default function SDAvatar({
  archetype,
  size = 80,
  fallback = 'head',
  fallbackText,
  className = '',
  circle = true,
}: SDAvatarProps) {
  const sizeStr = `${size}rpx`
  const asset = getSdAvatarAsset(archetype, size)
  const [hasLocalError, setHasLocalError] = useState(false)
  const [hasCdnError, setHasCdnError] = useState(false)

  const handleLocalError = useCallback(() => {
    setHasLocalError(true)
  }, [])

  const handleCdnError = useCallback(() => {
    setHasCdnError(true)
  }, [])

  if (!asset || (hasLocalError && hasCdnError)) {
    if (fallback === 'none') return null
    if (fallback === 'head') {
      return (
        <ArchetypeHead
          archetype={archetype}
          size={size}
          fallback='initial'
          fallbackText={fallbackText}
          className={className}
        />
      )
    }
    return (
      <View
        className={`sd-avatar sd-avatar--fallback ${className}`}
        style={{ width: sizeStr, height: sizeStr }}
      >
        <Text style={{ fontSize: `${size * 0.4}rpx` }}>{getFallbackInitial(fallbackText)}</Text>
      </View>
    )
  }

  const src = hasLocalError ? asset.cdnUrl : asset.localPath
  const onError = hasLocalError ? handleCdnError : handleLocalError

  // Counter the per-asset visual-centre drift so the character lands
  // dead-centre in the clip. The wrapping View owns the transform because
  // WeChat <Image> style does not reliably accept 'transform'.
  const correction = archetype ? VISUAL_CENTRE_SOURCE_OFFSET[archetype] : undefined
  const scale = asset.bucket / MASTER_CANVAS_SIZE
  const tx = correction ? Math.round(-correction.dx * scale) : 0
  const ty = correction ? Math.round(-correction.dy * scale) : 0

  return (
    <View
      className={`sd-avatar${circle ? ' sd-avatar--circle' : ''} ${className}`}
      style={{ width: sizeStr, height: sizeStr }}
    >
      <View
        className='sd-avatar__inner'
        style={{ transform: `translateX(${tx}rpx) translateY(${ty}rpx)` }}
      >
        <Image
          className='sd-avatar__image'
          src={src}
          mode='aspectFit'
          style={{ width: sizeStr, height: sizeStr }}
          lazyLoad={false}
          onError={onError}
        />
      </View>
    </View>
  )
}
