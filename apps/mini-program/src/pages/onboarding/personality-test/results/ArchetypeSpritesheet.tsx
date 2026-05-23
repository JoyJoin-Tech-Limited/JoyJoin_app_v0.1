import { View } from '@tarojs/components'
import spritesheetManifest from '../../assets/archetypes/archetype-spritesheet.json'
import { getArchetypeVisual, getArchetypeSpritesheetLocalPath, getArchetypeSpritesheetCdnPath } from '../visuals'

/** Local path (primary) — bundled in the preloaded onboarding subpackage. */
const LOCAL_SHEET = getArchetypeSpritesheetLocalPath()
/** CDN path (fallback) — loaded automatically if local path fails. */
const CDN_SHEET = getArchetypeSpritesheetCdnPath()
/**
 * CSS dual-path fallback: browser attempts local first, then CDN.
 * If the local file is missing in production, the CDN version renders
 * seamlessly with no blank-circle gap.
 */

type ArchetypeName =
  | 'corgi' | 'rooster' | 'hamster_praise' | 'fox' | 'dolphin_calm' | 'spider'
  | 'koala' | 'octopus' | 'owl' | 'elephant' | 'turtle' | 'cat'

interface ArchetypeSpritesheetProps {
  archetype: ArchetypeName | string
  size?: string
  className?: string
  /**
   * Optional fallback background colour shown while the spritesheet
   * image is decoding. Defaults to the archetype's accent soft colour.
   */
  fallbackColor?: string
}

/**
 * Render a single archetype thumbnail from the spritesheet.
 *
 * Uses background-image + background-position to avoid loading 12 separate
 * full-size textures into GPU memory during the slot animation.
 *
 * FALLBACK: If the spritesheet region isn't decoded yet, a soft coloured
 * circle (from the archetype's palette) is visible instead of a blank hole.
 */
export default function ArchetypeSpritesheet({
  archetype,
  size = '132rpx',
  className = '',
  fallbackColor,
}: ArchetypeSpritesheetProps) {
  const region = spritesheetManifest.mapping[archetype as ArchetypeName]

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
  const sheetW = spritesheetManifest.sheet.width
  const sheetH = spritesheetManifest.sheet.height

  // Calculate percentage positions for background-size/position
  const bgSizeX = (sheetW / width) * 100
  const bgSizeY = (sheetH / height) * 100
  const bgPosX = (x / (sheetW - width)) * 100
  const bgPosY = (y / (sheetH - height)) * 100

  // Use archetype accent colour as decode-time fallback so the slot
  // card never shows a blank transparent circle.
  const softColor = fallbackColor ?? getArchetypeVisual(archetype).accentSoft

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: softColor,
        backgroundImage: `url(${LOCAL_SHEET}), url(${CDN_SHEET})`,
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
        backgroundRepeat: 'no-repeat',
        borderRadius: '50%',
      }}
    />
  )
}
