import { describe, expect, it } from 'vitest'
import type { EquipmentItem, EquipmentOutfit } from '../equipmentApi'
import {
  PIXEL_AVATAR_ARCHETYPE_IDS,
  PIXEL_AVATAR_EQUIPMENT_SLOTS,
  getPixelEquipmentAsset,
  getPixelEquipmentLayerUrl,
  parseStarterPixelEquipmentAssetKey,
} from '../pixelAvatarAssets'
import {
  computeEquipmentVisibility,
  describeThumbnailDrift,
  getEquipmentVisibilitySignature,
  getOutfitSlotItemId,
  resolveEquipment3DDescriptor,
} from './equipment3dMapping'
import { EQUIPMENT_3D_SLOTS, SPIDER_STARTER_GARMENT_KINDS } from './avatar3dTypes'
import { SPIDER_STARTER_GARMENT_SPECS } from './spiderStarterGarments'

function makeItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item-1',
    slug: 'starter-top',
    name: 'Starter Top',
    description: '',
    slot: 'top',
    rarity: 'common',
    assetKey: 'equipment/starter/spider/top/v1',
    compatibleArchetypes: null,
    ...overrides,
  } as EquipmentItem
}

function makeOutfit(overrides: Partial<EquipmentOutfit> = {}): EquipmentOutfit {
  return {
    topItemId: null,
    bottomItemId: null,
    shoesItemId: null,
    accessoryItemId: null,
    version: 1,
    ...overrides,
  } as EquipmentOutfit
}

describe('resolveEquipment3DDescriptor — spider starter garments', () => {
  it('maps each spider starter assetKey to a UNIQUE garment kind + detail meshes', () => {
    const kinds = new Set<string>()
    for (const spec of SPIDER_STARTER_GARMENT_SPECS) {
      const descriptor = resolveEquipment3DDescriptor({
        assetKey: spec.assetKey,
        slot: spec.slot,
        rarity: 'common',
      })
      expect(descriptor, `${spec.assetKey} descriptor missing`).not.toBeNull()
      expect(descriptor!.slot).toBe(spec.slot)
      expect(descriptor!.assetKey).toBe(spec.assetKey)
      // Unique garment kind per assetKey — never a shared recolor.
      expect(kinds.has(descriptor!.garmentKind)).toBe(false)
      kinds.add(descriptor!.garmentKind)
      // Detail meshes must be named and garment-prefixed, so the recognizable
      // parts (zipper, cargo pocket, laces, web spokes…) are assertable.
      expect(descriptor!.detailMeshes.length).toBeGreaterThanOrEqual(8)
      for (const meshName of descriptor!.detailMeshes) {
        expect(meshName.length).toBeGreaterThan(0)
      }
      expect(new Set(descriptor!.detailMeshes).size).toBe(descriptor!.detailMeshes.length)
    }
    expect(kinds.size).toBe(4)
    expect([...kinds].sort()).toEqual([...SPIDER_STARTER_GARMENT_KINDS].sort())
  })

  it('names the recognizable details of the V2 card art on each garment', () => {
    const bySlot = Object.fromEntries(
      SPIDER_STARTER_GARMENT_SPECS.map((spec) => [spec.slot, spec]),
    )
    // Bomber jacket: full sleeves, front zipper, ribbed collar/cuffs/hem, sleeve pocket.
    expect(bySlot.top.detailMeshes).toEqual(expect.arrayContaining([
      'bomber-body', 'bomber-sleeve-left', 'bomber-sleeve-right',
      'bomber-zipper-front', 'bomber-collar', 'bomber-cuff-left', 'bomber-cuff-right',
      'bomber-hem', 'bomber-sleeve-pocket-left', 'bomber-pocket-seam-left',
    ]))
    // Cargo shorts: waistband/button/fly, belt loops, 3D right cargo pocket.
    expect(bySlot.bottom.detailMeshes).toEqual(expect.arrayContaining([
      'cargo-waistband', 'cargo-button', 'cargo-fly',
      'cargo-belt-loop-0', 'cargo-pocket-right', 'cargo-pocket-flap-right',
      'cargo-pocket-strap-right', 'cargo-pocket-buckle-right',
    ]))
    // High-tops: ankle collar, toe cap, tongue, laces, layered soles (both feet).
    for (const side of ['left', 'right'] as const) {
      expect(bySlot.shoes.detailMeshes).toEqual(expect.arrayContaining([
        `hightop-${side}-ankle-collar`, `hightop-${side}-toe-cap`,
        `hightop-${side}-tongue`, `hightop-${side}-laces-0`,
        `hightop-${side}-sole-base`, `hightop-${side}-sole-mid`,
      ]))
    }
    // Web + comm device: spokes/rings/gem + device body with a spider emblem.
    expect(bySlot.accessory.detailMeshes).toEqual(expect.arrayContaining([
      'web-center-gem', 'web-ring-inner', 'web-ring-outer', 'web-spoke-0',
      'comm-body', 'comm-spider-body', 'comm-spider-head',
      'comm-spider-leg-0', 'comm-spider-leg-7',
    ]))
  })

  it('rejects slot/assetKey mismatches so thumbnails and 3D groups cannot drift', () => {
    const descriptor = resolveEquipment3DDescriptor(makeItem({
      slot: 'bottom',
      assetKey: 'equipment/starter/spider/top/v1',
    }))
    expect(descriptor).toBeNull()
  })

  it('normalizes unknown rarity to common', () => {
    const descriptor = resolveEquipment3DDescriptor(makeItem({ rarity: 'legendary' as any }))
    expect(descriptor!.rarity).toBe('common')
  })

  it('tints rare items toward gold trim', () => {
    const common = resolveEquipment3DDescriptor(makeItem())!
    const rare = resolveEquipment3DDescriptor(makeItem({ rarity: 'rare' }))!
    expect(rare.palette.trim).not.toEqual(common.palette.trim)
    // …but rarity never changes the garment identity.
    expect(rare.garmentKind).toBe(common.garmentKind)
  })
})

describe('resolveEquipment3DDescriptor — phase-1 spider-only scope', () => {
  it('returns null for every non-spider starter item (no fake 3D claim)', () => {
    const nonSpider = PIXEL_AVATAR_ARCHETYPE_IDS.filter((id) => id !== 'spider')
    expect(nonSpider.length).toBe(11)
    for (const archetypeId of nonSpider) {
      for (const slot of PIXEL_AVATAR_EQUIPMENT_SLOTS) {
        const descriptor = resolveEquipment3DDescriptor({
          assetKey: `equipment/starter/${archetypeId}/${slot}/v1`,
          slot,
          rarity: 'common',
        })
        expect(descriptor, `${archetypeId}/${slot} must NOT claim a 3D garment`).toBeNull()
      }
    }
  })

  it('returns null for non-starter keys even on the spider slot', () => {
    expect(resolveEquipment3DDescriptor(makeItem({ assetKey: 'equipment/future/spider/top/v1' }))).toBeNull()
    expect(resolveEquipment3DDescriptor(makeItem({ assetKey: 'equipment/starter/top/v1' }))).toBeNull()
  })
})

describe('computeEquipmentVisibility', () => {
  it('maps all four slots from the authoritative outfit', () => {
    const items = new Map<string, EquipmentItem>([
      ['top-1', makeItem({ id: 'top-1' })],
      ['shoe-1', makeItem({ id: 'shoe-1', slot: 'shoes', assetKey: 'equipment/starter/spider/shoes/v1' })],
    ])
    const visibility = computeEquipmentVisibility(
      makeOutfit({ topItemId: 'top-1', shoesItemId: 'shoe-1' }),
      items,
    )
    expect(EQUIPMENT_3D_SLOTS).toEqual(['top', 'bottom', 'shoes', 'accessory'])
    expect(visibility.top.itemId).toBe('top-1')
    expect(visibility.top.descriptor!.assetKey).toBe('equipment/starter/spider/top/v1')
    expect(visibility.top.descriptor!.garmentKind).toBe('spider-bomber-jacket')
    expect(visibility.shoes.descriptor!.garmentKind).toBe('spider-high-top-sneakers')
    expect(visibility.bottom.itemId).toBeNull()
    expect(visibility.bottom.descriptor).toBeNull()
    expect(visibility.accessory.itemId).toBeNull()
  })

  it('hides the slot when the item is missing from inventory', () => {
    const visibility = computeEquipmentVisibility(makeOutfit({ topItemId: 'ghost-item' }), new Map())
    expect(visibility.top.itemId).toBeNull()
    expect(visibility.top.descriptor).toBeNull()
  })

  it('produces a change-sensitive signature', () => {
    const items = new Map<string, EquipmentItem>([['top-1', makeItem({ id: 'top-1' })]])
    const bare = computeEquipmentVisibility(makeOutfit(), items)
    const dressed = computeEquipmentVisibility(makeOutfit({ topItemId: 'top-1' }), items)
    expect(getEquipmentVisibilitySignature(bare)).not.toBe(getEquipmentVisibilitySignature(dressed))
    expect(getEquipmentVisibilitySignature(bare)).toBe(getEquipmentVisibilitySignature(
      computeEquipmentVisibility(makeOutfit(), items),
    ))
  })

  it('getOutfitSlotItemId reads the per-slot field', () => {
    expect(getOutfitSlotItemId(makeOutfit({ shoesItemId: 'x' }), 'shoes')).toBe('x')
    expect(getOutfitSlotItemId(makeOutfit(), 'top')).toBeNull()
  })
})

describe('thumbnail ↔ 3D contract (all 48 starter items)', () => {
  const cases = PIXEL_AVATAR_ARCHETYPE_IDS.flatMap((archetypeId) =>
    PIXEL_AVATAR_EQUIPMENT_SLOTS.map((slot) => ({
      archetypeId,
      slot,
      assetKey: `equipment/starter/${archetypeId}/${slot}/v1` as const,
    })),
  )

  it.each(cases)('$assetKey → thumbnail resolves; 3D only for spider', ({ archetypeId, slot, assetKey }) => {
    // Thumbnail source of truth (V2 layer art used by the wardrobe cards).
    const thumbnail = getPixelEquipmentAsset(assetKey, archetypeId)
    expect(thumbnail, `${assetKey} thumbnail missing`).not.toBeNull()
    expect(thumbnail!.slot).toBe(slot)
    expect(getPixelEquipmentLayerUrl(assetKey, archetypeId)).toBeTruthy()

    const descriptor = resolveEquipment3DDescriptor({ assetKey, slot, rarity: 'common' })
    if (archetypeId === 'spider') {
      // Spider starter → unique 3D garment keyed by the SAME assetKey.
      expect(descriptor, `${assetKey} 3D descriptor missing`).not.toBeNull()
      expect(descriptor!.slot).toBe(slot)
      expect(descriptor!.assetKey).toBe(assetKey)
    } else {
      // Every other archetype keeps V2 thumbnails only — no 3D claim.
      expect(descriptor).toBeNull()
    }

    // And the drift reporter stays quiet for both shapes.
    expect(describeThumbnailDrift({ assetKey, slot }, thumbnail!.slot)).toBeNull()
  })

  it('reports drift when a spider garment key is registered against a different slot', () => {
    const drift = describeThumbnailDrift(
      { assetKey: 'equipment/starter/spider/top/v1', slot: 'top' },
      'bottom',
    )
    expect(drift).toContain('equipment/starter/spider/top/v1')
  })

  it('reports drift when a registered spider garment loses its descriptor', () => {
    // A registered spider garment evaluated under the WRONG declared slot is a
    // real drift (descriptor rejected by the slot guard), not an expected null.
    const drift = describeThumbnailDrift(
      { assetKey: 'equipment/starter/spider/top/v1', slot: 'bottom' },
      'bottom',
    )
    expect(drift).toContain('equipment/starter/spider/top/v1')
  })

  it('parses every starter key back to its archetype + slot', () => {
    for (const archetypeId of PIXEL_AVATAR_ARCHETYPE_IDS) {
      for (const slot of PIXEL_AVATAR_EQUIPMENT_SLOTS) {
        const parsed = parseStarterPixelEquipmentAssetKey(`equipment/starter/${archetypeId}/${slot}/v1`)
        expect(parsed).toEqual({ archetypeId, slot })
      }
    }
  })
})
