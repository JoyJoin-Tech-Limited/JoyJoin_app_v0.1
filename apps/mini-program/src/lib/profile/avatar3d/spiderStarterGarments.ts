import type { EquipmentSlot3D, SpiderStarterGarmentKind } from './avatar3dTypes'

/**
 * Spider starter garment registry — the single source of truth that ties one
 * starter assetKey to one unique 3D garment (kind + recognizable detail mesh
 * names). Both the mapping layer (descriptors) and the model layer (pre-built
 * mesh groups) consume this registry, so a card picture, its descriptor and its
 * 3D garment can never drift apart.
 *
 * Phase 1 scope: ONLY the four spider starter garments exist as real 3D. Every
 * other starter assetKey (11 other archetypes) resolves to null here and keeps
 * the V2 thumbnail + permanent underwear.
 */

export interface SpiderStarterGarmentSpec {
  slot: EquipmentSlot3D
  assetKey: string
  garmentKind: SpiderStarterGarmentKind
  /** Mesh names that must exist inside the pre-built garment group. */
  detailMeshes: readonly string[]
}

const BOMBER_DETAILS = [
  'bomber-body',
  'bomber-sleeve-left',
  'bomber-sleeve-right',
  'bomber-cuff-left',
  'bomber-cuff-right',
  'bomber-hem',
  'bomber-collar',
  'bomber-zipper-front',
  'bomber-zipper-pull',
  'bomber-sleeve-pocket-left',
  'bomber-sleeve-pocket-zipper-left',
  'bomber-pocket-seam-left',
  'bomber-pocket-seam-right',
] as const

const CARGO_DETAILS = [
  'cargo-shorts-body',
  'cargo-leg-left',
  'cargo-leg-right',
  'cargo-leg-cuff-left',
  'cargo-leg-cuff-right',
  'cargo-waistband',
  'cargo-button',
  'cargo-fly',
  'cargo-belt-loop-0',
  'cargo-belt-loop-1',
  'cargo-belt-loop-2',
  'cargo-belt-loop-3',
  'cargo-front-pocket-seam-left',
  'cargo-front-pocket-seam-right',
  'cargo-pocket-right',
  'cargo-pocket-flap-right',
  'cargo-pocket-strap-right',
  'cargo-pocket-buckle-right',
] as const

const HIGHTOP_DETAILS = [
  'hightop-left-body',
  'hightop-left-ankle-collar',
  'hightop-left-toe-cap',
  'hightop-left-ankle-panel',
  'hightop-left-tongue',
  'hightop-left-laces-0',
  'hightop-left-laces-1',
  'hightop-left-laces-2',
  'hightop-left-sole-base',
  'hightop-left-sole-mid',
  'hightop-right-body',
  'hightop-right-ankle-collar',
  'hightop-right-toe-cap',
  'hightop-right-ankle-panel',
  'hightop-right-tongue',
  'hightop-right-laces-0',
  'hightop-right-laces-1',
  'hightop-right-laces-2',
  'hightop-right-sole-base',
  'hightop-right-sole-mid',
] as const

const WEB_DEVICE_DETAILS = [
  'web-center-gem',
  'web-ring-inner',
  'web-ring-outer',
  'web-spoke-0',
  'web-spoke-1',
  'web-spoke-2',
  'web-spoke-3',
  'web-spoke-4',
  'web-spoke-5',
  'web-spoke-6',
  'web-spoke-7',
  'comm-body',
  'comm-top-band',
  'comm-spider-body',
  'comm-spider-head',
  'comm-spider-leg-0',
  'comm-spider-leg-1',
  'comm-spider-leg-2',
  'comm-spider-leg-3',
  'comm-spider-leg-4',
  'comm-spider-leg-5',
  'comm-spider-leg-6',
  'comm-spider-leg-7',
] as const

export const SPIDER_STARTER_GARMENT_SPECS: readonly SpiderStarterGarmentSpec[] = [
  {
    slot: 'top',
    assetKey: 'equipment/starter/spider/top/v1',
    garmentKind: 'spider-bomber-jacket',
    detailMeshes: BOMBER_DETAILS,
  },
  {
    slot: 'bottom',
    assetKey: 'equipment/starter/spider/bottom/v1',
    garmentKind: 'spider-cargo-shorts',
    detailMeshes: CARGO_DETAILS,
  },
  {
    slot: 'shoes',
    assetKey: 'equipment/starter/spider/shoes/v1',
    garmentKind: 'spider-high-top-sneakers',
    detailMeshes: HIGHTOP_DETAILS,
  },
  {
    slot: 'accessory',
    assetKey: 'equipment/starter/spider/accessory/v1',
    garmentKind: 'spider-web-device',
    detailMeshes: WEB_DEVICE_DETAILS,
  },
] as const

const SPEC_BY_ASSET_KEY: ReadonlyMap<string, SpiderStarterGarmentSpec> = new Map(
  SPIDER_STARTER_GARMENT_SPECS.map((spec) => [spec.assetKey, spec]),
)

/** Resolve the unique 3D garment for a starter assetKey (null = no real 3D yet). */
export function getSpiderStarterGarmentSpec(assetKey: string): SpiderStarterGarmentSpec | null {
  return SPEC_BY_ASSET_KEY.get(assetKey) ?? null
}

/** Group name of the pre-built garment node inside its slot group. */
export function getGarmentGroupName(garmentKind: SpiderStarterGarmentKind): string {
  return `garment-${garmentKind}`
}
