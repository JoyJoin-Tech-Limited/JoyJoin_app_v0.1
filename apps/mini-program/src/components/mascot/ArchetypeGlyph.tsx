import { View, Image } from '@tarojs/components'
import React from 'react'
import { cdnAsset } from '@/lib/utils/cdnAssets'

/**
 * ArchetypeGlyph — proprietary micro glyph icons for the 12 JoyJoin archetypes.
 *
 * Replaces abstract geometric shapes with actual character silhouettes
 * derived from the existing full-body illustrations. Each glyph is a
 * monochrome filled shape at 16×16 viewBox, recognizable at ~16rpx scale.
 *
 * Assets live in: assets/archetypes/
 * Naming: archetype-{key}.webp
 *
 * Bundled locally — assets copied to dist/assets/archetypes/ by the build.
 */

export type ArchetypeFamily = 'warm' | 'cool' | 'fire' | 'calm'

interface ArchetypeGlyphProps {
  archetype: string
  family?: ArchetypeFamily
  size?: number // rpx
  highlighted?: boolean // paint-only ring highlight (Oracle Card)
  highlightColor?: string // hex color for ring
  /** Optional class for H5-safe sizing (inline rpx is ignored by the H5
   *  preview — postcss transforms stylesheets only). Pair with an SCSS class
   *  that sets width/height + inner img sizing. */
  className?: string
}

const GLYPH_PATHS: Record<string, string> = {
  'corgi': cdnAsset('/assets/personality/archetypes/archetype-corgi.webp'),
  'rooster': cdnAsset('/assets/personality/archetypes/archetype-rooster.webp'),
  'hamster_praise': cdnAsset('/assets/personality/archetypes/archetype-hamster_praise.webp'),
  'fox': cdnAsset('/assets/personality/archetypes/archetype-fox.webp'),
  'dolphin_calm': cdnAsset('/assets/personality/archetypes/archetype-dolphin_calm.webp'),
  'spider': cdnAsset('/assets/personality/archetypes/archetype-spider.webp'),
  'koala': cdnAsset('/assets/personality/archetypes/archetype-koala.webp'),
  'octopus': cdnAsset('/assets/personality/archetypes/archetype-octopus.webp'),
  'owl': cdnAsset('/assets/personality/archetypes/archetype-owl.webp'),
  'elephant': cdnAsset('/assets/personality/archetypes/archetype-elephant.webp'),
  'turtle': cdnAsset('/assets/personality/archetypes/archetype-turtle.webp'),
  'cat': cdnAsset('/assets/personality/archetypes/archetype-cat.webp'),
}

const FALLBACK_PATH = cdnAsset('/assets/personality/archetypes/archetype-corgi.webp')

export default function ArchetypeGlyph({
  archetype,
  size = 16,
  highlighted = false,
  highlightColor = '#A86BFF',
  className,
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
    <View className={`archetype-glyph${className ? ` ${className}` : ''}`} style={wrapperStyle}>
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
