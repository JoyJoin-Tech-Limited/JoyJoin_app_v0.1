import { cdnAsset } from '../utils/cdnAssets'

const SAFE_ARCHETYPE_IDS = new Set([
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
])

// Equipment raster layers have not been approved yet. Keep an explicit
// publication registry so the clients never issue known-404 requests. The
// approved base character already carries its initial clothes; unpublished
// layers are not replaced with misleading geometric placeholder art.
const PUBLISHED_EQUIPMENT_LAYERS = new Set<string>()

export function normalizePixelArchetypeId(value?: string | null): string {
  return value && SAFE_ARCHETYPE_IDS.has(value) ? value : 'cat'
}

export function getPixelAvatarBaseUrl(archetypeId?: string | null): string {
  const safeId = normalizePixelArchetypeId(archetypeId)
  return cdnAsset(`/assets/profile-pixel/archetypes/${safeId}/base-v1.webp`)
}

export function normalizePixelEquipmentAssetKey(assetKey: string): string {
  const safeSegments = assetKey
    .split('/')
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
  return safeSegments.length > 0
    ? safeSegments.join('/')
    : 'equipment/missing/v1'
}

export function getPixelEquipmentLayerUrl(
  assetKey: string,
  archetypeId?: string | null,
): string | null {
  const safeId = normalizePixelArchetypeId(archetypeId)
  const safeAssetKey = normalizePixelEquipmentAssetKey(assetKey)
  if (!PUBLISHED_EQUIPMENT_LAYERS.has(`${safeAssetKey}:${safeId}`)) return null

  return cdnAsset(`/assets/profile-pixel/${safeAssetKey}/${safeId}-v1.webp`)
}
