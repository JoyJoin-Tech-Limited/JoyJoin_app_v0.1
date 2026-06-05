import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { localAsset } from '../../lib/utils/cdnAssets'

/**
 * ArchetypeHead — proprietary head icon for the 12 JoyJoin archetypes.
 *
 * Replaces user initials in avatar contexts. Shows the character's head
 * extracted from the full-body illustration at 40/80/120px (1×/2×/3×).
 *
 * Assets: assets/icons/archetype/archetype-{key}-head{@2x|@3x}.png
 */

interface ArchetypeHeadProps {
  archetype?: string | null
  size?: number // rpx
  fallback?: 'initial' | 'none'
  fallbackText?: string
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

function getFallbackInitial(text?: string): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}

export default function ArchetypeHead({
  archetype,
  size = 80,
  fallback = 'initial',
  fallbackText,
}: ArchetypeHeadProps) {
  const src = archetype ? HEAD_PATHS[archetype] : undefined
  const sizeStr = `${size}rpx`
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  if (!src || hasError) {
    if (fallback === 'none') return null
    return (
      <View
        className='archetype-head archetype-head--fallback'
        style={{ width: sizeStr, height: sizeStr }}
      >
        <Text>{getFallbackInitial(fallbackText)}</Text>
      </View>
    )
  }

  return (
    <View className='archetype-head'>
      <Image
        src={src}
        mode='aspectFit'
        style={{ width: sizeStr, height: sizeStr }}
        lazyLoad={false}
        onError={handleError}
      />
    </View>
  )
}
