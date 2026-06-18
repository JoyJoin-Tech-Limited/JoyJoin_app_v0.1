import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import './ArchetypeHead.scss'

/**
 * ArchetypeHead — proprietary head icon for the 12 JoyJoin archetypes.
 *
 * Replaces user initials in avatar contexts. Shows the character's head
 * extracted from the full-body illustration at 240×240px WebP.
 *
 * The 240px source gives @2x crispness at 120rpx display size and
 * acceptable quality at 180rpx (@3x). WeChat downscales automatically;
 * no @2x/@3x suffixes are used (avoids the @3x@3x double-suffix bug).
 *
 * Assets: assets/icons/archetype/archetype-{key}-head.webp
 */

interface ArchetypeHeadProps {
  archetype?: string | null
  size?: number // rpx
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

/** CDN fallback for archetype heads — mirrors the bundled file layout. */
function getCdnHeadPath(archetype: string): string {
  return cdnAsset(`/assets/icons/archetype/archetype-${archetype}-head.webp`)
}

function getFallbackInitial(text?: string): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}

export default function ArchetypeHead({
  archetype,
  size = 80,
  fallback = 'initial',
  fallbackText,
  className = '',
}: ArchetypeHeadProps) {
  const localSrc = archetype ? HEAD_PATHS[archetype] : undefined
  const sizeStr = `${size}rpx`
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

  // Try local bundled WebP first; fall back to CDN WebP if the bundled copy
  // is missing or stale (e.g. after a subpackage update or cache mismatch).
  const src = hasLocalError && archetype ? getCdnHeadPath(archetype) : localSrc
  const onError = hasLocalError ? handleCdnError : handleLocalError

  return (
    <View className={`archetype-head ${className}`} style={{ width: sizeStr, height: sizeStr }}>
      <Image
        src={src}
        mode='aspectFit'
        style={{ width: sizeStr, height: sizeStr }}
        lazyLoad={false}
        onError={onError}
      />
    </View>
  )
}
