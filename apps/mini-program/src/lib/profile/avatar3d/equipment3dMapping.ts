import type { EquipmentItem, EquipmentOutfit } from '../equipmentApi'
import {
  parseStarterPixelEquipmentAssetKey,
  normalizePixelEquipmentAssetKey,
} from '../pixelAvatarAssets'
import {
  EQUIPMENT_3D_SLOTS,
  type Equipment3DDescriptor,
  type EquipmentSlot3D,
  type EquipmentSlotBinding,
  type EquipmentVisibilityMap,
} from './avatar3dTypes'
import { resolveEquipmentPalette } from './avatar3dPalettes'
import { getSpiderStarterGarmentSpec } from './spiderStarterGarments'

/**
 * Equipment ↔ 3D mapping. The server outfit (item ids per slot) is the
 * authority; this module resolves each equipped item to a 3D descriptor keyed
 * by the SAME assetKey that drives the wardrobe thumbnail
 * (`getPixelEquipmentLayerUrl`), so the card picture and the 3D group can never
 * drift apart.
 *
 * Phase 1 scope: the four approved spider starter items each have one real,
 * pre-built garment. Other archetypes remain on their safe clothed base image
 * rather than receiving an invented 3D item.
 */

export function getOutfitSlotItemId(outfit: EquipmentOutfit, slot: EquipmentSlot3D): string | null {
  return (outfit[`${slot}ItemId` as keyof EquipmentOutfit] as string | null) ?? null
}

const VALID_RARITIES = new Set(['common', 'rare'])

/**
 * Resolve the visual descriptor for an item. Returns null unless its assetKey
 * has a registered spider garment. A key whose parsed slot contradicts the
 * item's slot is rejected so thumbnail and 3D garment always agree.
 */
export function resolveEquipment3DDescriptor(
  item: Pick<EquipmentItem, 'assetKey' | 'slot' | 'rarity'>,
): Equipment3DDescriptor | null {
  const slot = item.slot as EquipmentSlot3D
  if (!EQUIPMENT_3D_SLOTS.includes(slot)) return null

  const assetKey = normalizePixelEquipmentAssetKey(item.assetKey)
  const parsed = parseStarterPixelEquipmentAssetKey(assetKey)
  if (parsed && parsed.slot !== slot) return null

  const spec = getSpiderStarterGarmentSpec(assetKey)
  if (!spec || spec.slot !== slot) return null

  const rarity = VALID_RARITIES.has(item.rarity) ? item.rarity as 'common' | 'rare' : 'common'

  return {
    slot,
    assetKey,
    rarity,
    palette: resolveEquipmentPalette({ assetKey, slot, rarity }),
    garmentKind: spec.garmentKind,
    detailMeshes: spec.detailMeshes,
  }
}

/**
 * Compute per-slot 3D bindings from the authoritative outfit + inventory map.
 * Missing/unknown items produce `descriptor: null` — every garment of that
 * slot hides and the permanent underwear keeps the model decent.
 */
export function computeEquipmentVisibility(
  outfit: EquipmentOutfit,
  itemsById: ReadonlyMap<string, Pick<EquipmentItem, 'id' | 'assetKey' | 'slot' | 'rarity'>>,
): EquipmentVisibilityMap {
  const result = {} as EquipmentVisibilityMap
  for (const slot of EQUIPMENT_3D_SLOTS) {
    const itemId = getOutfitSlotItemId(outfit, slot)
    const item = itemId ? itemsById.get(itemId) : undefined
    const binding: EquipmentSlotBinding = { slot, itemId: item ? item.id : null, descriptor: null }
    if (item && item.slot === slot) {
      binding.descriptor = resolveEquipment3DDescriptor(item)
    }
    result[slot] = binding
  }
  return result
}

/**
 * Stable signature for change detection — equipment changes must trigger a
 * re-render (and garment visibility flip) without rebuilding the scene.
 */
export function getEquipmentVisibilitySignature(visibility: EquipmentVisibilityMap): string {
  return EQUIPMENT_3D_SLOTS
    .map((slot) => {
      const binding = visibility[slot]
      return `${slot}:${binding.itemId ?? 'none'}:${binding.descriptor?.assetKey ?? 'none'}`
    })
    .join('|')
}

/**
 * Consistency contract used by tests. Registered spider garments must resolve
 * to the SAME slot as their thumbnail. Unsupported items remain absent from
 * the 3D mapping. Returns null when consistent, otherwise a readable drift.
 */
export function describeThumbnailDrift(
  item: Pick<EquipmentItem, 'assetKey' | 'slot'>,
  thumbnailSlot: EquipmentSlot3D | null,
): string | null {
  if (!thumbnailSlot) return `item assetKey '${item.assetKey}' has no thumbnail`
  const descriptor = resolveEquipment3DDescriptor({
    assetKey: item.assetKey,
    slot: item.slot as EquipmentSlot3D,
    rarity: 'common',
  })
  if (!descriptor) {
    // Unsupported starters intentionally have no 3D garment in phase 1.
    return getSpiderStarterGarmentSpec(normalizePixelEquipmentAssetKey(item.assetKey))
      ? `spider starter assetKey '${item.assetKey}' lost its 3D descriptor`
      : null
  }
  if (descriptor.slot !== thumbnailSlot) {
    return `assetKey '${item.assetKey}': 3D slot ${descriptor.slot} != thumbnail slot ${thumbnailSlot}`
  }
  if (descriptor.detailMeshes.length === 0) {
    return `assetKey '${item.assetKey}': garment '${descriptor.garmentKind}' has no detail meshes`
  }
  return null
}
