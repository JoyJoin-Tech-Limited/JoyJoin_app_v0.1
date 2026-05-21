import { View, Image } from '@tarojs/components'
import React from 'react'

/**
 * ArchetypeGlyph — proprietary micro glyph icons for the 12 JoyJoin archetypes.
 *
 * Replaces abstract geometric shapes with actual character silhouettes
 * derived from the existing full-body illustrations. Each glyph is a
 * monochrome filled shape at 16×16 viewBox, recognizable at ~16rpx scale.
 *
 * Assets live in: assets/personality/archetypes/
 * Naming: archetype-{key}.webp
 *
 * Taro/WeChat safe: uses <Image> with local asset paths.
 */

export type ArchetypeFamily = 'warm' | 'cool' | 'fire' | 'calm'

interface ArchetypeGlyphProps {
  archetype: string
  family?: ArchetypeFamily
  size?: number // rpx
  highlighted?: boolean // paint-only ring highlight (Oracle Card)
  highlightColor?: string // hex color for ring
}

const GLYPH_PATHS: Record<string, string> = {
  'corgi': '/assets/archetypes/archetype-corgi.webp',
  'rooster': '/assets/archetypes/archetype-rooster.webp',
  'hamster_praise': '/assets/archetypes/archetype-hamster_praise.webp',
  'fox': '/assets/archetypes/archetype-fox.webp',
  'dolphin_calm': '/assets/archetypes/archetype-dolphin_calm.webp',
  'spider': '/assets/archetypes/archetype-spider.webp',
  'koala': '/assets/archetypes/archetype-koala.webp',
  'octopus': '/assets/archetypes/archetype-octopus.webp',
  'owl': '/assets/archetypes/archetype-owl.webp',
  'elephant': '/assets/archetypes/archetype-elephant.webp',
  'turtle': '/assets/archetypes/archetype-turtle.webp',
  'cat': '/assets/archetypes/archetype-cat.webp',
}

const FALLBACK_PATH = '/assets/archetypes/archetype-corgi.webp'

export default function ArchetypeGlyph({
  archetype,
  size = 16,
  highlighted = false,
  highlightColor = '#A86BFF',
}: ArchetypeGlyphProps) {
  const [src, setSrc] = React.useState(GLYPH_PATHS[archetype] ?? FALLBACK_PATH)
  const sizeStr = `${size}rpx`

  React.useEffect(() => {
    setSrc(GLYPH_PATHS[archetype] ?? FALLBACK_PATH)
  }, [archetype])

  const handleError = React.useCallback(() => {
    if (src !== FALLBACK_PATH) {
      setSrc(FALLBACK_PATH)
    }
  }, [src])

  const wrapperStyle: React.CSSProperties = highlighted
    ? {
        border: `2rpx solid ${highlightColor}`,
        borderRadius: '50%',
        padding: '2rpx',
        width: `calc(${sizeStr} + 8rpx)`,
        height: `calc(${sizeStr} + 8rpx)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {}

  return (
    <View className='archetype-glyph' style={wrapperStyle}>
      <Image
        src={src}
        mode='aspectFit'
        style={{ width: sizeStr, height: sizeStr, display: 'block' }}
        lazyLoad={false}
        onError={handleError}
      />
    </View>
  )
}
