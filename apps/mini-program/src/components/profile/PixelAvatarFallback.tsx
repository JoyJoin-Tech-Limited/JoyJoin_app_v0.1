import { Text, View } from '@tarojs/components'
import './PixelAvatarFallback.scss'

export const PIXEL_AVATAR_ARCHETYPE_IDS = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
] as const

export type PixelAvatarArchetypeId = (typeof PIXEL_AVATAR_ARCHETYPE_IDS)[number]

export interface PixelAvatarFallbackProps {
  /** Canonical V4 archetype ID. Unknown runtime values use the neutral owl fallback. */
  archetypeId: PixelAvatarArchetypeId | string
  variant?: 'compact' | 'full'
  className?: string
}

const ARCHETYPE_LABELS: Record<PixelAvatarArchetypeId, string> = {
  corgi: '社牛柯基',
  rooster: '小太阳鸡',
  hamster_praise: '夸夸仓鼠',
  fox: '寻宝狐',
  dolphin_calm: '机灵海豚',
  spider: '人脉蛛',
  koala: '树洞考拉',
  octopus: '脑洞章鱼',
  owl: '好奇猫头鹰',
  elephant: '靠谱大象',
  turtle: '慢热龟',
  cat: '小透明猫',
}

export function isPixelAvatarArchetypeId(value: string): value is PixelAvatarArchetypeId {
  return (PIXEL_AVATAR_ARCHETYPE_IDS as readonly string[]).includes(value)
}

function normalizeArchetypeId(value: string): PixelAvatarArchetypeId {
  return isPixelAvatarArchetypeId(value) ? value : 'owl'
}

/**
 * Code-native literal pixel-art fallback for Profile V1.7.
 *
 * It intentionally avoids image requests, so a missing or still-unapproved CDN asset never
 * leaves the user with an empty avatar. All shapes are decorative; assistive technology gets
 * one concise description on the root image role.
 */
export default function PixelAvatarFallback({
  archetypeId,
  variant = 'full',
  className = '',
}: PixelAvatarFallbackProps) {
  const normalizedId = normalizeArchetypeId(archetypeId)
  const archetypeLabel = ARCHETYPE_LABELS[normalizedId]
  const runtimeFallbackLabel = archetypeId === normalizedId ? '' : '，使用默认形象'

  return (
    <View
      className={`pixel-avatar pixel-avatar--${variant} pixel-avatar--${normalizedId} ${className}`.trim()}
      data-archetype={normalizedId}
      role='img'
      aria-label={`${archetypeLabel}像素伙伴，仅保留不可脱的基础背心与安全短裤${runtimeFallbackLabel}`}
    >
      <View className='pixel-avatar__figure' aria-hidden='true'>
        <View className='pixel-avatar__shell' />
        <View className='pixel-avatar__tail pixel-avatar__tail--back' />
        <View className='pixel-avatar__plume pixel-avatar__plume--one' />
        <View className='pixel-avatar__plume pixel-avatar__plume--two' />
        <View className='pixel-avatar__plume pixel-avatar__plume--three' />

        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--left-one' />
        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--left-two' />
        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--left-three' />
        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--right-one' />
        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--right-two' />
        <View className='pixel-avatar__extra-limb pixel-avatar__extra-limb--right-three' />

        <View className='pixel-avatar__leg pixel-avatar__leg--left' />
        <View className='pixel-avatar__leg pixel-avatar__leg--right' />
        <View className='pixel-avatar__body' />
        <View className='pixel-avatar__base-top'>
          <View className='pixel-avatar__base-top-mark' />
        </View>
        <View className='pixel-avatar__base-bottom' />
        <View className='pixel-avatar__arm pixel-avatar__arm--left' />
        <View className='pixel-avatar__arm pixel-avatar__arm--right' />

        <View className='pixel-avatar__head'>
          <View className='pixel-avatar__ear pixel-avatar__ear--left' />
          <View className='pixel-avatar__ear pixel-avatar__ear--right' />
          <View className='pixel-avatar__comb pixel-avatar__comb--left' />
          <View className='pixel-avatar__comb pixel-avatar__comb--middle' />
          <View className='pixel-avatar__comb pixel-avatar__comb--right' />
          <View className='pixel-avatar__dorsal' />
          <View className='pixel-avatar__eye-disc pixel-avatar__eye-disc--left' />
          <View className='pixel-avatar__eye-disc pixel-avatar__eye-disc--right' />
          <View className='pixel-avatar__eye pixel-avatar__eye--left' />
          <View className='pixel-avatar__eye pixel-avatar__eye--right' />
          <View className='pixel-avatar__spider-eye pixel-avatar__spider-eye--left' />
          <View className='pixel-avatar__spider-eye pixel-avatar__spider-eye--right' />
          <View className='pixel-avatar__cheek pixel-avatar__cheek--left' />
          <View className='pixel-avatar__cheek pixel-avatar__cheek--right' />
          <View className='pixel-avatar__muzzle' />
          <View className='pixel-avatar__beak' />
          <View className='pixel-avatar__nose' />
          <View className='pixel-avatar__snout' />
          <View className='pixel-avatar__trunk pixel-avatar__trunk--top' />
          <View className='pixel-avatar__trunk pixel-avatar__trunk--bottom' />
          <View className='pixel-avatar__whisker pixel-avatar__whisker--left-one' />
          <View className='pixel-avatar__whisker pixel-avatar__whisker--left-two' />
          <View className='pixel-avatar__whisker pixel-avatar__whisker--right-one' />
          <View className='pixel-avatar__whisker pixel-avatar__whisker--right-two' />
        </View>
      </View>

      <Text className='pixel-avatar__accessible-copy'>
        {archetypeLabel}，基础内搭不可脱
      </Text>
    </View>
  )
}
