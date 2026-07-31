import type { EquipmentSlot } from '../equipmentApi'

/**
 * Shared types for the real WebGL 3D spider-persona avatar.
 *
 * The 3D system renders one procedural spider persona (JoyJoin black-purple style)
 * with independent scene groups for body parts and the four removable equipment
 * slots. Types here are renderer-agnostic so mapping/model/gesture modules stay
 * unit-testable without a GL context.
 */

/** The four removable equipment slots. `EquipmentSlot` from the server contract is the authority. */
export type EquipmentSlot3D = EquipmentSlot

export const EQUIPMENT_3D_SLOTS: readonly EquipmentSlot3D[] = ['top', 'bottom', 'shoes', 'accessory'] as const

/** RGB color triple in 0–1 float space (what three.js materials consume). */
export interface RgbColor {
  r: number
  g: number
  b: number
}

/** Material palette for one equipment mesh group. */
export interface Equipment3DPalette {
  /** Main garment color. */
  primary: RgbColor
  /** Secondary panels (ribbing, waistband, purple sneaker panels, device body). */
  secondary: RgbColor
  /** Trim accents (zipper, buttons, laces, soles, gem). */
  trim: RgbColor
}

/**
 * Named garment kinds for the four spider starter items in phase 1.
 */
export type SpiderStarterGarmentKind =
  | 'spider-bomber-jacket'
  | 'spider-cargo-shorts'
  | 'spider-high-top-sneakers'
  | 'spider-web-device'

export const SPIDER_STARTER_GARMENT_KINDS: readonly SpiderStarterGarmentKind[] = [
  'spider-bomber-jacket',
  'spider-cargo-shorts',
  'spider-high-top-sneakers',
  'spider-web-device',
] as const

/**
 * Resolved 3D descriptor for one inventory item. `assetKey` is kept verbatim so
 * the wardrobe artwork (`getPixelEquipmentLayerUrl`) and the controlled 3D group
 * always agree on the same key — see equipment3dMapping.test.ts.
 */
export interface Equipment3DDescriptor {
  slot: EquipmentSlot3D
  assetKey: string
  rarity: 'common' | 'rare'
  palette: Equipment3DPalette
  /** Unique garment identity — determines which pre-built mesh group is shown. */
  garmentKind: SpiderStarterGarmentKind
  /** Recognizable detail meshes the garment group must contain (QA + tests). */
  detailMeshes: readonly string[]
}

/** What the equipped state means for one slot's 3D group. */
export interface EquipmentSlotBinding {
  slot: EquipmentSlot3D
  /** Equipped item id from the authoritative outfit, or null when the slot is bare. */
  itemId: string | null
  /** Resolved visual descriptor when a known item is equipped. */
  descriptor: Equipment3DDescriptor | null
}

export type EquipmentVisibilityMap = Record<EquipmentSlot3D, EquipmentSlotBinding>

/** Spider persona palette — JoyJoin black-purple identity. */
export interface SpiderPersonaPalette {
  /** Body/torso/head base color (dark purple). */
  body: RgbColor
  /** Belly patch and inner-ear lighter tone. */
  belly: RgbColor
  /** Fur / hair tufts (near-black purple). */
  fur: RgbColor
  /** Spider legs (slightly lighter than fur for separation). */
  spiderLeg: RgbColor
  /** Spider leg joints + claws. */
  spiderLegJoint: RgbColor
  /** Eye white. */
  eyeWhite: RgbColor
  /** Iris — brand purple. */
  eyeIris: RgbColor
  /** Pupil — near black. */
  pupil: RgbColor
  /** Fangs / small claws — warm cream. */
  fang: RgbColor
  /** Cheek blush. */
  blush: RgbColor
  /** Permanent vest (non-removable). */
  underwearVest: RgbColor
  /** Permanent safety shorts (non-removable). */
  underwearShorts: RgbColor
  /** Underwear trim. */
  underwearTrim: RgbColor
}

/** Hex → float RGB helper kept here so palettes stay readable. */
export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '')
  const value = parseInt(
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized,
    16,
  )
  const toLinear = (channel: number) => {
    const srgb = channel / 255
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return {
    r: toLinear((value >> 16) & 0xff),
    g: toLinear((value >> 8) & 0xff),
    b: toLinear(value & 0xff),
  }
}

/** Multiply an RGB color toward black by `factor` (0–1). */
export function shadeColor(color: RgbColor, factor: number): RgbColor {
  const clamp = (v: number) => Math.min(1, Math.max(0, v * factor))
  return { r: clamp(color.r), g: clamp(color.g), b: clamp(color.b) }
}

/** Mix two colors; t=0 → a, t=1 → b. */
export function mixColor(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const k = Math.min(1, Math.max(0, t))
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k }
}
