import { describe, expect, it } from 'vitest'
import {
  PIXEL_AVATAR_ARCHETYPE_IDS,
  PIXEL_AVATAR_EQUIPMENT_SLOTS,
  getPixelAvatarBaseUrl,
  getPixelAvatarBodyFrameUrl,
  getPixelAvatarBodyUrl,
  getPixelAvatarScenePose,
  getPixelEquipmentAsset,
  getPixelEquipmentLayerUrl,
  getPixelEquipmentThumbnailUrl,
  normalizePixelArchetypeId,
  normalizePixelEquipmentAssetKey,
  parseStarterPixelEquipmentAssetKey,
} from './pixelAvatarAssets'

describe('pixelAvatarAssets', () => {
  it('maps the body to the single V2 front asset with permanent base clothing', () => {
    expect(getPixelAvatarBodyUrl('corgi')).toContain(
      '/assets/profile-pixel/v2/archetypes/corgi/body-front-v2.',
    )
    expect(getPixelAvatarBodyUrl('corgi')).toMatch(/body-front-v2\.[a-f0-9]{12}\.webp/)
    expect(getPixelAvatarBaseUrl('corgi')).toBe(getPixelAvatarBodyUrl('corgi'))
    expect(getPixelAvatarBodyFrameUrl('corgi', 'left-far'))
      .toBe(getPixelAvatarBodyFrameUrl('corgi', 'right-far'))
  })

  it('falls back to a canonical archetype for unknown runtime values', () => {
    expect(normalizePixelArchetypeId('legacy-bear')).toBe('cat')
    expect(getPixelAvatarBaseUrl('legacy-bear')).toContain(
      '/assets/profile-pixel/v2/archetypes/cat/body-front-v2.',
    )
  })

  it('preserves safe asset-key path segments used by the seeded equipment catalog', () => {
    expect(normalizePixelEquipmentAssetKey('equipment/starter/corgi/top/v1'))
      .toBe('equipment/starter/corgi/top/v1')
  })

  it('cannot traverse outside the profile-pixel CDN tree', () => {
    expect(normalizePixelEquipmentAssetKey('../../equipment/pools/demo/rare-top/v1'))
      .toBe('equipment/pools/demo/rare-top/v1')
  })

  it('parses only canonical starter equipment keys', () => {
    expect(parseStarterPixelEquipmentAssetKey('equipment/starter/corgi/top/v1')).toEqual({
      archetypeId: 'corgi',
      slot: 'top',
    })
    expect(parseStarterPixelEquipmentAssetKey('equipment/pools/demo/top/v1')).toBeNull()
    expect(parseStarterPixelEquipmentAssetKey('equipment/starter/corgi/top/v2')).toBeNull()
  })

  it('publishes one cropped layer for every archetype starter slot', () => {
    for (const archetypeId of PIXEL_AVATAR_ARCHETYPE_IDS) {
      for (const slot of PIXEL_AVATAR_EQUIPMENT_SLOTS) {
        const assetKey = `equipment/starter/${archetypeId}/${slot}/v1`
        const asset = getPixelEquipmentAsset(assetKey, archetypeId, 'right-near')
        expect(asset).toMatchObject({ slot })
        expect(asset?.url).toContain(
          `/assets/profile-pixel/v2/equipment/starter/${archetypeId}/${slot}/layer-v2.`,
        )
        expect(asset?.url).toMatch(/layer-v2\.[a-f0-9]{12}\.webp/)
        expect(asset?.placement.width).toBeGreaterThan(0)
        expect(asset?.placement.height).toBeGreaterThan(0)
        expect(asset?.depth).toBeGreaterThanOrEqual(0)
        expect(asset?.depth).toBeLessThanOrEqual(1)
        expect(getPixelEquipmentLayerUrl(assetKey, archetypeId, 'left-far')).toBe(asset?.url)
        expect(getPixelEquipmentThumbnailUrl(assetKey, archetypeId)).toBe(asset?.url)
      }
    }
  })

  it('rejects starter layers that belong to another archetype and non-starter pool art', () => {
    expect(getPixelEquipmentAsset('equipment/starter/corgi/top/v1', 'cat')).toBeNull()
    expect(getPixelEquipmentAsset('equipment/pools/demo/rare-top/v1', 'corgi')).toBeNull()
  })

  it('provides symmetric five-stop paper-doll scene poses', () => {
    expect(getPixelAvatarScenePose('front')).toMatchObject({ yaw: 0, scaleX: 1 })
    expect(getPixelAvatarScenePose('left-far').yaw)
      .toBe(-getPixelAvatarScenePose('right-far').yaw)
    expect(getPixelAvatarScenePose('left-far').scaleX)
      .toBe(getPixelAvatarScenePose('right-far').scaleX)
    expect(getPixelAvatarScenePose('unknown').frameId).toBe('front')
  })
})
