import { View } from '@tarojs/components'

/**
 * ArchetypeGlyph — minimal inline SVG icons for the 12 JoyJoin archetypes.
 *
 * Each glyph is a simple geometric shape (~16×16 viewBox) designed to be
 * recognizable at 4–6px scale. Fill color is driven by the parent CSS
 * family class (warm / cool / fire / calm).
 *
 * Taro/WeChat safe: only basic SVG shapes (circle, rect, ellipse, polygon, path).
 */

export type ArchetypeFamily = 'warm' | 'cool' | 'fire' | 'calm'

interface ArchetypeGlyphProps {
  archetype: string
  family: ArchetypeFamily
  size?: number // rpx
}

const GLYPH_SIZE = 16 // viewBox size

const SHAPE_MAP: Record<string, JSX.Element> = {
  '开心柯基': (
    <circle cx='8' cy='8' r='6' />
  ),
  '太阳鸡': (
    <polygon points='8,1 9.8,5.7 15,6.2 11,9.8 12.2,15 8,12 3.8,15 5,9.8 1,6.2 6.2,5.7' />
  ),
  '夸夸豚': (
    <path d='M8 14.5C8 14.5 2.5 10.5 2.5 6.5C2.5 4 4.5 2 7 2C7.8 2 8.5 2.3 9 2.7C9.5 2.3 10.2 2 11 2C13.5 2 15.5 4 15.5 6.5C15.5 10.5 10 14.5 8 14.5Z' />
  ),
  '机智狐': (
    <polygon points='8,1 15,8 8,15 1,8' />
  ),
  '淡定海豚': (
    <ellipse cx='8' cy='8' rx='7' ry='4.5' />
  ),
  '织网蛛': (
    <polygon points='8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5' />
  ),
  '暖心熊': (
    <rect x='2' y='2' width='12' height='12' rx='3' />
  ),
  '灵感章鱼': (
    <path d='M9 1L5 8H9L7 15L13 7H9L11 1H9Z' />
  ),
  '沉思猫头鹰': (
    <path d='M2 8C2 4.5 4.5 2 8 2C8 2 6 4 6 8C6 12 8 14 8 14C4.5 14 2 11.5 2 8Z' />
  ),
  '定心大象': (
    <rect x='2' y='2' width='12' height='12' />
  ),
  '稳如龟': (
    <path d='M8 1C11 1 14 3 14 7C14 11 11 15 8 15C5 15 2 11 2 7C2 3 5 1 8 1Z' />
  ),
  '隐身猫': (
    <ellipse cx='8' cy='8' rx='7' ry='4' transform='rotate(-30 8 8)' />
  ),
}

export default function ArchetypeGlyph({ archetype, family, size = 16 }: ArchetypeGlyphProps) {
  const shape = SHAPE_MAP[archetype] ?? SHAPE_MAP['开心柯基']
  const sizeStr = `${size}rpx`

  return (
    <View className={`archetype-glyph archetype-glyph--${family}`}>
      <svg
        width={sizeStr}
        height={sizeStr}
        viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
        fill='currentColor'
      >
        {shape}
      </svg>
    </View>
  )
}
