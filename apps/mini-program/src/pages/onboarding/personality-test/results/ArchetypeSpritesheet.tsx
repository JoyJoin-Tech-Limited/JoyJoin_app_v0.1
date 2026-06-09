import { Image, View } from '@tarojs/components'
import { memo, useState } from 'react'
import spritesheetManifest from '../../assets/archetypes/archetype-spritesheet.json'
import { getArchetypeVisual, getArchetypeSpritesheetLocalPath, getArchetypeSpritesheetCdnPath } from '../visuals'

/** Local path (primary) — bundled in the preloaded onboarding subpackage. */
const LOCAL_SHEET = getArchetypeSpritesheetLocalPath()
/** CDN path (fallback) — loaded automatically if local path fails. */
const CDN_SHEET = getArchetypeSpritesheetCdnPath()
/**
 * Total spritesheet dimensions in logical pixels.
 * Used to scale the full spritesheet so each cell fills the container.
 */
const SHEET_W = spritesheetManifest.sheet.width
const SHEET_H = spritesheetManifest.sheet.height

type ArchetypeName =
  | 'corgi' | 'rooster' | 'hamster_praise' | 'fox' | 'dolphin_calm' | 'spider'
  | 'koala' | 'octopus' | 'owl' | 'elephant' | 'turtle' | 'cat'

interface ArchetypeSpritesheetProps {
  archetype: ArchetypeName | string
  size?: string
  className?: string
  fallbackColor?: string
}

/**
 * Render a single archetype thumbnail from the spritesheet.
 *
 * APPROACH: WeChat Mini Program CSS `backgroundImage` is unreliable —
 * it silently fails to render CDN/local URLs in many runtime versions,
 * leaving blank circles instead of archetype thumbnails during the slot
 * animation. This component uses a WeChat-safe overflow:hidden container
 * with a positioned <Image> element to crop the correct region from the
 * spritesheet. The <Image> component is the only reliably-loaded image
 * primitive in WeChat's rendering pipeline.
 *
 * FALLBACK CHAIN:
 * 1. Local bundled spritesheet (on-device, always available)
 * 2. CDN spritesheet (if local path errors)
 * 3. Soft coloured circle from archetype palette (visible while decoding)
 *
 * Note: The <Image> mode='aspectFill' ensures the image fills its
 * allocated dimensions. Combined with overflow:hidden on the container
 * and transform:translate, this crops the exact archetype region.
 */
function ArchetypeSpritesheet({
  archetype,
  size = '132rpx',
  className = '',
  fallbackColor,
}: ArchetypeSpritesheetProps) {
  const region = spritesheetManifest.mapping[archetype as ArchetypeName]
  const [imgError, setImgError] = useState(false)
  const softColor = fallbackColor ?? getArchetypeVisual(archetype).accentSoft

  if (!region) {
    return (
      <View
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(139, 92, 246, 0.08)',
        }}
      />
    )
  }

  const { x, y, width, height } = region
  const src = imgError ? CDN_SHEET : LOCAL_SHEET

  /**
   * Scale the full spritesheet so that each archetype cell exactly fills
   * the container. The container is `sizeNum` rpx wide, each cell is
   * `width` px in the sheet → scale = sizeNum / width rpx-per-px.
   * The full image dimensions in rpx are sheet_dimensions × scale.
   * Translate by -(x, y) × scale to position the correct cell in view.
   */
  const sizeNum = parseInt(size, 10) || 132
  const scale = sizeNum / width
  const imgW = Math.round(SHEET_W * scale)
  const imgH = Math.round(SHEET_H * scale)
  const translateX = Math.round(-x * scale)
  const translateY = Math.round(-y * scale)

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: softColor,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        mode='aspectFill'
        style={{
          width: `${imgW}rpx`,
          height: `${imgH}rpx`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${translateX}rpx, ${translateY}rpx)`,
        }}
        onError={() => setImgError(true)}
      />
    </View>
  )
}

export default memo(ArchetypeSpritesheet)