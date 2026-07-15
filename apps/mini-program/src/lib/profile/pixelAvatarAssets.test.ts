import { describe, expect, it } from 'vitest'
import {
  getPixelAvatarBaseUrl,
  getPixelEquipmentLayerUrl,
  normalizePixelArchetypeId,
  normalizePixelEquipmentAssetKey,
} from './pixelAvatarAssets'

describe('pixelAvatarAssets', () => {
  it('maps every base image to the CDN-only profile pixel tree', () => {
    expect(getPixelAvatarBaseUrl('corgi')).toContain(
      '/assets/profile-pixel/archetypes/corgi/base-v1.webp',
    )
  })

  it('falls back to a canonical archetype for unknown runtime values', () => {
    expect(normalizePixelArchetypeId('legacy-bear')).toBe('cat')
    expect(getPixelAvatarBaseUrl('legacy-bear')).toContain(
      '/assets/profile-pixel/archetypes/cat/base-v1.webp',
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

  it('does not request unapproved equipment raster layers', () => {
    expect(getPixelEquipmentLayerUrl('equipment/starter/corgi/top/v1', 'corgi')).toBeNull()
  })
})
