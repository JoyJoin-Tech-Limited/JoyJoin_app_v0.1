import { View, Image } from '@tarojs/components'
import React from 'react'

/**
 * ArchetypeGlyph — proprietary micro glyph icons for the 12 JoyJoin archetypes.
 *
 * Replaces abstract geometric shapes with actual character silhouettes
 * derived from the existing full-body illustrations. Each glyph is a
 * monochrome filled shape at 16×16 viewBox, recognizable at ~16rpx scale.
 *
 * Assets live in: assets/icons/archetype-glyphs/
 * Naming: archetype-{key}-glyph{@2x|@3x}.png
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
  'corgi': '/assets/icons/archetype-glyphs/archetype-corgi-glyph@3x.png',
  'rooster': '/assets/icons/archetype-glyphs/archetype-rooster-glyph@3x.png',
  'hamster_praise': '/assets/icons/archetype-glyphs/archetype-hamster_praise-glyph@3x.png',
  'fox': '/assets/icons/archetype-glyphs/archetype-fox-glyph@3x.png',
  'dolphin_calm': '/assets/icons/archetype-glyphs/archetype-dolphin_calm-glyph@3x.png',
  'spider': '/assets/icons/archetype-glyphs/archetype-spider-glyph@3x.png',
  'koala': '/assets/icons/archetype-glyphs/archetype-koala-glyph@3x.png',
  'octopus': '/assets/icons/archetype-glyphs/archetype-octopus-glyph@3x.png',
  'owl': '/assets/icons/archetype-glyphs/archetype-owl-glyph@3x.png',
  'elephant': '/assets/icons/archetype-glyphs/archetype-elephant-glyph@3x.png',
  'turtle': '/assets/icons/archetype-glyphs/archetype-turtle-glyph@3x.png',
  'cat': '/assets/icons/archetype-glyphs/archetype-cat-glyph@3x.png',
}

const FALLBACK_PATH = '/assets/icons/archetype-glyphs/archetype-corgi-glyph@3x.png'

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
