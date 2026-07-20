import { cdnAsset } from './cdnAssets'

export interface ArchetypeAssetPaths {
  webp: string
  png: string
}

/** CDN base for full-size archetype hero images. */
export const ASSET_BASE_WEBP = cdnAsset('/assets/personality/archetypes')
export const ASSET_BASE_PNG = cdnAsset('/assets/personality/archetypes')

/** Onboarding subpackage local paths (used by subpackage pages). */
export const ASSET_BASE_WEBP_LOCAL = '/subpackages/onboarding/assets/archetypes'
export const ASSET_BASE_PNG_LOCAL = '/subpackages/onboarding/assets/archetypes'

/** Local spritesheet path — bundled in the preloaded onboarding subpackage.
 *  Use this for the slot animation so the spritesheet is guaranteed to match
 *  the local manifest (eliminates CDN staleness as a source of split-brain). */
export const ASSET_BASE_SPRITESHEET_LOCAL = '/subpackages/onboarding/assets/archetypes'

export const ARCHETYPE_ASSET_MAP: Record<string, ArchetypeAssetPaths> = {
  corgi:         { webp: `${ASSET_BASE_WEBP}/archetype-corgi.webp`,         png: `${ASSET_BASE_PNG}/archetype-corgi.png` },
  rooster:       { webp: `${ASSET_BASE_WEBP}/archetype-rooster.webp`,       png: `${ASSET_BASE_PNG}/archetype-rooster.png` },
  hamster_praise:{ webp: `${ASSET_BASE_WEBP}/archetype-hamster_praise.webp`, png: `${ASSET_BASE_PNG}/archetype-hamster_praise.png` },
  fox:           { webp: `${ASSET_BASE_WEBP}/archetype-fox.webp`,           png: `${ASSET_BASE_PNG}/archetype-fox.png` },
  dolphin_calm:  { webp: `${ASSET_BASE_WEBP}/archetype-dolphin_calm.webp`,  png: `${ASSET_BASE_PNG}/archetype-dolphin_calm.png` },
  spider:        { webp: `${ASSET_BASE_WEBP}/archetype-spider.webp`,        png: `${ASSET_BASE_PNG}/archetype-spider.png` },
  koala:         { webp: `${ASSET_BASE_WEBP}/archetype-koala.webp`,         png: `${ASSET_BASE_PNG}/archetype-koala.png` },
  octopus:       { webp: `${ASSET_BASE_WEBP}/archetype-octopus.webp`,       png: `${ASSET_BASE_PNG}/archetype-octopus.png` },
  owl:           { webp: `${ASSET_BASE_WEBP}/archetype-owl.webp`,           png: `${ASSET_BASE_PNG}/archetype-owl.png` },
  elephant:      { webp: `${ASSET_BASE_WEBP}/archetype-elephant.webp`,      png: `${ASSET_BASE_PNG}/archetype-elephant.png` },
  turtle:        { webp: `${ASSET_BASE_WEBP}/archetype-turtle.webp`,        png: `${ASSET_BASE_PNG}/archetype-turtle.png` },
  cat:           { webp: `${ASSET_BASE_WEBP}/archetype-cat.webp`,           png: `${ASSET_BASE_PNG}/archetype-cat.png` },
}

/** All archetype WebP asset URLs for bulk preloading. */
export function getAllArchetypeAssetUrls(): string[] {
  return Object.values(ARCHETYPE_ASSET_MAP).map((a) => a.webp)
}

/** Spritesheet CDN URL for cache priming via getImageInfo. */
export function getArchetypeSpritesheetUrl(): string {
  return `${ASSET_BASE_WEBP}/archetype-spritesheet.webp`
}

/** Local spritesheet path for direct rendering (bundled in onboarding subpackage).
 *  Returns the on-device path so the slot animation is immune to CDN staleness.
 *  The CDN path is still available via {@link getArchetypeSpritesheetCdnPath} as a fallback. */
export function getArchetypeSpritesheetLocalPath(): string {
  return `${ASSET_BASE_SPRITESHEET_LOCAL}/archetype-spritesheet.webp`
}

/** CDN fallback path used by CSS background-image fallback chain. */
export function getArchetypeSpritesheetCdnPath(): string {
  return `${ASSET_BASE_WEBP}/archetype-spritesheet.webp`
}

/** Resolve the local bundled spritesheet URL for getImageInfo preloading.
 *  On-device root-relative paths are not supported by localAsset(); pass them
 *  through directly. */
export function getArchetypeSpritesheetLocalUrl(): string {
  return getArchetypeSpritesheetLocalPath()
}
