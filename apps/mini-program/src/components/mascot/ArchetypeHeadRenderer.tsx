import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import './ArchetypeHead.scss'

/**
 * ArchetypeHeadRenderer — the head-crop / grid icon rendering core.
 *
 * Extracted from ArchetypeHead so the renderer stays reusable without
 * circular imports. This module intentionally renders only head/grid crops.
 */

interface ArchetypeHeadRendererProps {
  archetype?: string | null
  size?: number // rpx
  variant?: 'head' | 'grid'
  fallback?: 'initial' | 'none'
  fallbackText?: string
  className?: string
}

const HEAD_PATHS: Record<string, string> = {
  corgi: localAsset('/assets/icons/archetype/archetype-corgi-head.webp'),
  rooster: localAsset('/assets/icons/archetype/archetype-rooster-head.webp'),
  hamster_praise: localAsset('/assets/icons/archetype/archetype-hamster_praise-head.webp'),
  fox: localAsset('/assets/icons/archetype/archetype-fox-head.webp'),
  dolphin_calm: localAsset('/assets/icons/archetype/archetype-dolphin_calm-head.webp'),
  spider: localAsset('/assets/icons/archetype/archetype-spider-head.webp'),
  koala: localAsset('/assets/icons/archetype/archetype-koala-head.webp'),
  octopus: localAsset('/assets/icons/archetype/archetype-octopus-head.webp'),
  owl: localAsset('/assets/icons/archetype/archetype-owl-head.webp'),
  elephant: localAsset('/assets/icons/archetype/archetype-elephant-head.webp'),
  turtle: localAsset('/assets/icons/archetype/archetype-turtle-head.webp'),
  cat: localAsset('/assets/icons/archetype/archetype-cat-head.webp'),
}

const GRID_PATHS: Record<string, string> = {
  corgi: localAsset('/assets/icons/archetype-grid/archetype-corgi-grid.webp'),
  rooster: localAsset('/assets/icons/archetype-grid/archetype-rooster-grid.webp'),
  hamster_praise: localAsset('/assets/icons/archetype-grid/archetype-hamster_praise-grid.webp'),
  fox: localAsset('/assets/icons/archetype-grid/archetype-fox-grid.webp'),
  dolphin_calm: localAsset('/assets/icons/archetype-grid/archetype-dolphin_calm-grid.webp'),
  spider: localAsset('/assets/icons/archetype-grid/archetype-spider-grid.webp'),
  koala: localAsset('/assets/icons/archetype-grid/archetype-koala-grid.webp'),
  octopus: localAsset('/assets/icons/archetype-grid/archetype-octopus-grid.webp'),
  owl: localAsset('/assets/icons/archetype-grid/archetype-owl-grid.webp'),
  elephant: localAsset('/assets/icons/archetype-grid/archetype-elephant-grid.webp'),
  turtle: localAsset('/assets/icons/archetype-grid/archetype-turtle-grid.webp'),
  cat: localAsset('/assets/icons/archetype-grid/archetype-cat-grid.webp'),
}

function getCdnHeadPath(archetype: string): string {
  return cdnAsset(`/assets/icons/archetype/archetype-${archetype}-head.webp`)
}

function getCdnGridPath(archetype: string): string {
  return cdnAsset(`/assets/icons/archetype-grid/archetype-${archetype}-grid.webp`)
}

/**
 * Per-archetype visual-centre correction (source-pixel offsets vs geometric
 * centre 119.5,119.5 of the 240px canvas). At render time we rescale by
 * imageSize / 240 and negate so the character's face lands dead-centre in
 * the circular clip.
 *
 * Values tuned by opacity-weighted centroid analysis of the 240×240 head
 * assets plus manual face-centre polish. Positive dx = face sits right of
 * centre → image is shifted left; positive dy = face sits below centre →
 * image is shifted up. Rounded to one decimal place.
 */
const VISUAL_CENTRE_SOURCE_OFFSET: Record<string, { dx: number; dy: number }> = {
  cat:            { dx:   3.0, dy:   7.0 },
  corgi:          { dx:   0.0, dy:   2.0 },
  dolphin_calm:   { dx:  -9.5, dy:  16.0 },
  elephant:       { dx:   1.5, dy: -12.0 },
  fox:            { dx:  -2.5, dy:   8.0 },
  hamster_praise: { dx:   2.0, dy:   2.5 },
  koala:          { dx:   3.0, dy:  -7.0 },
  octopus:        { dx:   0.5, dy:  -1.5 },
  owl:            { dx:   3.0, dy:  -3.0 },
  rooster:        { dx:  -2.5, dy:   5.5 },
  spider:         { dx:   0.0, dy:   0.0 },
  turtle:         { dx:   4.0, dy: -11.0 },
}

function getFallbackInitial(text?: string): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}

export default function ArchetypeHeadRenderer({
  archetype,
  size = 80,
  variant = 'head',
  fallback = 'initial',
  fallbackText,
  className = '',
}: ArchetypeHeadRendererProps) {
  const paths = variant === 'grid' ? GRID_PATHS : HEAD_PATHS
  const localSrc = archetype ? paths[archetype] : undefined
  const sizeStr = `${size}rpx`
  const imageSize = variant === 'grid' ? size : Math.round(size * 0.9)
  const imageSizeStr = `${imageSize}rpx`
  const [hasLocalError, setHasLocalError] = useState(false)
  const [hasCdnError, setHasCdnError] = useState(false)

  const handleLocalError = useCallback(() => {
    setHasLocalError(true)
  }, [])

  const handleCdnError = useCallback(() => {
    setHasCdnError(true)
  }, [])

  if (!localSrc || (hasLocalError && hasCdnError)) {
    if (fallback === 'none') return null
    return (
      <View
        className={`archetype-head archetype-head--fallback ${className}`}
        style={{ width: sizeStr, height: sizeStr }}
      >
        <Text style={{ fontSize: `${size * 0.4}rpx` }}>{getFallbackInitial(fallbackText)}</Text>
      </View>
    )
  }

  const getCdnPath = variant === 'grid' ? getCdnGridPath : getCdnHeadPath
  const src = hasLocalError && archetype ? getCdnPath(archetype) : localSrc
  const onError = hasLocalError ? handleCdnError : handleLocalError

  const correction = variant === 'head' && archetype ? VISUAL_CENTRE_SOURCE_OFFSET[archetype] : undefined
  const scale = imageSize / 240
  const tx = correction ? Math.round(-correction.dx * scale) : 0
  const ty = correction ? Math.round(-correction.dy * scale) : 0

  return (
    <View className={`archetype-head ${className}`} style={{ width: sizeStr, height: sizeStr }}>
      <View
        className='archetype-head__inner'
        style={{ transform: `translateX(${tx}rpx) translateY(${ty}rpx)` }}
      >
        <Image
          className='archetype-head__image'
          src={src}
          mode='aspectFit'
          style={{ width: imageSizeStr, height: imageSizeStr }}
          lazyLoad={false}
          onError={onError}
        />
      </View>
    </View>
  )
}
