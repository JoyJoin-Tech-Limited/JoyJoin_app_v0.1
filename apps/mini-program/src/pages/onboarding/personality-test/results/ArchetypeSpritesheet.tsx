import { View } from '@tarojs/components'
import spritesheetManifest from '../../assets/archetypes/archetype-spritesheet.json'
import { cdnAsset } from '../../../../lib/utils/cdnAssets'

const SHEET_PATH = cdnAsset('/pages/onboarding/assets/archetypes/archetype-spritesheet.webp')

type ArchetypeName =
  | 'corgi' | 'rooster' | 'hamster_praise' | 'fox' | 'dolphin_calm' | 'spider'
  | 'koala' | 'octopus' | 'owl' | 'elephant' | 'turtle' | 'cat'

interface ArchetypeSpritesheetProps {
  archetype: ArchetypeName | string
  size?: string
  className?: string
}

/**
 * Render a single archetype thumbnail from the spritesheet.
 *
 * Uses background-image + background-position to avoid loading 12 separate
 * full-size textures into GPU memory during the slot animation.
 */
export default function ArchetypeSpritesheet({ archetype, size = '132rpx', className = '' }: ArchetypeSpritesheetProps) {
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

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET_PATH})`,
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
        backgroundRepeat: 'no-repeat',
        borderRadius: '50%',
      }}
    />
  )
}
