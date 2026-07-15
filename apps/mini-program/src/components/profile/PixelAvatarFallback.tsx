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
export type PixelAvatarEquipmentSlot = 'top' | 'bottom' | 'shoes' | 'accessory'

export interface PixelAvatarEquipmentSummary {
  id: string
  name: string
  slot: PixelAvatarEquipmentSlot
  rarity?: 'common' | 'rare'
}

export interface PixelAvatarFallbackProps {
  /** Canonical V4 archetype ID. Unknown runtime values use the neutral owl fallback. */
  archetypeId: PixelAvatarArchetypeId | string
  /** Equipped summaries are visual-only; the persisted outfit remains server authority. */
  equippedItems?: readonly PixelAvatarEquipmentSummary[]
  variant?: 'compact' | 'full'
  className?: string
}

export interface PixelAvatarEquipmentFallbackProps {
  equippedItems: readonly PixelAvatarEquipmentSummary[]
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

const SLOT_ORDER: PixelAvatarEquipmentSlot[] = ['top', 'bottom', 'shoes', 'accessory']

export function isPixelAvatarArchetypeId(value: string): value is PixelAvatarArchetypeId {
  return (PIXEL_AVATAR_ARCHETYPE_IDS as readonly string[]).includes(value)
}

function normalizeArchetypeId(value: string): PixelAvatarArchetypeId {
  return isPixelAvatarArchetypeId(value) ? value : 'owl'
}

function renderEquipmentLayers(
  equippedItems: readonly PixelAvatarEquipmentSummary[],
) {
  const equippedBySlot = new Map<PixelAvatarEquipmentSlot, PixelAvatarEquipmentSummary>()
  for (const item of equippedItems) {
    if (SLOT_ORDER.includes(item.slot)) equippedBySlot.set(item.slot, item)
  }

  return SLOT_ORDER.map((slot) => {
    const item = equippedBySlot.get(slot)
    if (!item) return null
    return (
      <View
        key={slot}
        className={`pixel-avatar__equipment pixel-avatar__equipment--${slot} pixel-avatar__equipment--${item.rarity ?? 'common'}`}
        data-slot={slot}
        data-item-id={item.id}
      >
        {slot === 'accessory' && <View className='pixel-avatar__accessory-spark' />}
      </View>
    )
  })
}

/**
 * Visible code-native safety layer for equipment whose optional CDN raster is unavailable.
 * It intentionally contains no character or scene, so the approved base character stays visible.
 */
export function PixelAvatarEquipmentFallback({
  equippedItems,
  variant = 'full',
  className = '',
}: PixelAvatarEquipmentFallbackProps) {
  if (equippedItems.length === 0) return null

  return (
    <View
      className={`pixel-equipment-fallback pixel-equipment-fallback--${variant} ${className}`.trim()}
      aria-hidden='true'
    >
      <View className='pixel-avatar__figure pixel-avatar__figure--equipment-only'>
        {renderEquipmentLayers(equippedItems)}
      </View>
    </View>
  )
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
  equippedItems = [],
  variant = 'full',
  className = '',
}: PixelAvatarFallbackProps) {
  const normalizedId = normalizeArchetypeId(archetypeId)
  const archetypeLabel = ARCHETYPE_LABELS[normalizedId]
  const equippedBySlot = new Map<PixelAvatarEquipmentSlot, PixelAvatarEquipmentSummary>()

  for (const item of equippedItems) {
    if (SLOT_ORDER.includes(item.slot)) equippedBySlot.set(item.slot, item)
  }

  const equippedNames = SLOT_ORDER
    .map((slot) => equippedBySlot.get(slot)?.name.trim())
    .filter((name): name is string => Boolean(name))
  const equipmentLabel = equippedNames.length > 0
    ? `，已穿戴${equippedNames.join('、')}`
    : '，穿着初始服装'
  const runtimeFallbackLabel = archetypeId === normalizedId ? '' : '，使用默认形象'

  return (
    <View
      className={`pixel-avatar pixel-avatar--${variant} pixel-avatar--${normalizedId} ${className}`.trim()}
      data-archetype={normalizedId}
      role='img'
      aria-label={`${archetypeLabel}像素伙伴${equipmentLabel}${runtimeFallbackLabel}`}
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
        <View className='pixel-avatar__base-shoe pixel-avatar__base-shoe--left' />
        <View className='pixel-avatar__base-shoe pixel-avatar__base-shoe--right' />
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

        {renderEquipmentLayers(equippedItems)}
      </View>

      <Text className='pixel-avatar__accessible-copy'>
        {archetypeLabel}{equippedNames.length > 0 ? `，穿戴${equippedNames.join('、')}` : '，初始服装'}
      </Text>
    </View>
  )
}
