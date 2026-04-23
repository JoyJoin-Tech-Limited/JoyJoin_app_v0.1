import { View } from '@tarojs/components'
import spritesheetManifest from '../../../../../assets/personality/archetypes/archetype-spritesheet.json'

const SHEET_PATH = '/assets/personality/archetypes/archetype-spritesheet.webp'

type ArchetypeName =
  | '开心柯基' | '太阳鸡' | '夸夸豚' | '机智狐' | '淡定海豚' | '织网蛛'
  | '暖心熊' | '灵感章鱼' | '沉思猫头鹰' | '定心大象' | '稳如龟' | '隐身猫'

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
