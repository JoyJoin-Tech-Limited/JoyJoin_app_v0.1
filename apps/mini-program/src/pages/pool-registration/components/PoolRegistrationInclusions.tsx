import { Image, Text, View } from '@tarojs/components'
import { useState } from 'react'
import {
  POOL_INCLUSION_TILES,
  type PoolInclusionIcon,
  type PoolInclusionTileCopy,
  type PoolInclusionTileId,
} from '@shared/copy/poolRegistrationInclusionsCopy'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { localAsset } from '../../../lib/utils/cdnAssets'

/**
 * 费用包含 strip height budget: the page hides this whole section when the
 * window is shorter than this (px) — same collapseBelow convention as
 * ResponsiveSpacer, so the strip never competes with the footer CTA on short
 * phones. The page owns the gate (it also gates the impression analytics).
 */
export const POOL_INCLUSIONS_COLLAPSE_BELOW_PX = 640

interface PoolRegistrationInclusionsProps {
  visible: boolean
  reduceMotion: boolean
}

// Fallback glyph if a bundled Lovart WebP ever fails to load (packaging
// regression, corrupted file, etc.). Keeps the badge from looking empty while
// still following the no-inline-emoji rule via JoyJoinIcon.
const IMAGE_FALLBACK_GLYPHS: Record<
  PoolInclusionTileId,
  Extract<PoolInclusionIcon, { kind: 'glyph' }>
> = {
  icebreaker_hosting: { kind: 'glyph', emoji: '🎮', tier: 'category' },
  curated_tablemates: { kind: 'glyph', emoji: '🤝', tier: 'semantic' },
  smart_venue: { kind: 'glyph', emoji: '📍', tier: 'ui' },
  full_refund_guarantee: { kind: 'glyph', emoji: '🛡️', tier: 'ui' },
}

export function InclusionTileIcon({ tile }: { tile: PoolInclusionTileCopy }) {
  // Icon swap point: Lovart art replaces the glyph entry in
  // packages/shared/src/copy/poolRegistrationInclusionsCopy.ts with
  // `{ kind: 'image', src, alt }` — no component change needed.
  const [imageFailed, setImageFailed] = useState(false)
  if (tile.icon.kind === 'image') {
    if (imageFailed) {
      // Degrade to a JoyJoinIcon glyph so the badge never looks empty.
      const fallback = IMAGE_FALLBACK_GLYPHS[tile.id]
      return (
        <JoyJoinIcon
          emoji={fallback.emoji}
          tier={fallback.tier}
          size={36}
          className='pool-reg-inclusions__icon-glyph'
        />
      )
    }
    const src = tile.icon.src.startsWith('/assets/')
      ? localAsset(tile.icon.src)
      : tile.icon.src
    return (
      <Image
        className='pool-reg-inclusions__icon-image'
        src={src}
        mode='aspectFit'
        aria-label={tile.icon.alt}
        onError={() => setImageFailed(true)}
      />
    )
  }
  return (
    <JoyJoinIcon
      emoji={tile.icon.emoji}
      tier={tile.icon.tier}
      size={36}
      className='pool-reg-inclusions__icon-glyph'
    />
  )
}

/**
 * PoolRegistrationInclusions — 费用包含 value strip for Step 0 (2026-08-31).
 *
 * A single fixed-height, non-scrollable row of 4 icon+label tiles mounted as a
 * sibling directly under the hero (the price pill sits in the hero meta band).
 * Copy lives in the shared copy layer; the page hides the section on short
 * viewports via POOL_INCLUSIONS_COLLAPSE_BELOW_PX.
 *
 * NOTE: no `import './PoolRegistrationInclusions.scss'` here — the SCSS is
 * @use'd by the page SCSS so its rules compile into the pool-registration
 * subpackage page WXSS (subpackage style-splitting gate).
 */
export default function PoolRegistrationInclusions({
  visible,
  reduceMotion,
}: PoolRegistrationInclusionsProps) {
  const deviceTier = useDeviceTier()
  const staticRender = reduceMotion || deviceTier.isDegradation

  const rootClasses = [
    'pool-reg-inclusions',
    visible ? 'pool-reg-inclusions--enter' : 'pool-reg-inclusions--hidden',
    staticRender ? 'pool-reg-inclusions--static' : '',
  ].join(' ')

  return (
    <View className={rootClasses} aria-label='费用包含'>
      {POOL_INCLUSION_TILES.map((tile) => (
        <View className='pool-reg-inclusions__tile' key={tile.id}>
          <View className='pool-reg-inclusions__icon-badge'>
            <InclusionTileIcon tile={tile} />
          </View>
          <Text className='pool-reg-inclusions__title'>{tile.title}</Text>
          <Text className='pool-reg-inclusions__subtitle'>{tile.subtitle}</Text>
        </View>
      ))}
    </View>
  )
}
