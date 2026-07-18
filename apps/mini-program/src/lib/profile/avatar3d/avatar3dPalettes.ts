import {
  hexToRgb,
  mixColor,
  shadeColor,
  type Equipment3DPalette,
  type EquipmentSlot3D,
  type SpiderPersonaPalette,
} from './avatar3dTypes'

/**
 * Central color + material configuration for the spider persona 3D model.
 *
 * Model builders consume these palettes; adding a new garment means adding one
 * descriptor palette entry, never duplicating the character.
 */

/** JoyJoin black-purple spider persona. */
export const SPIDER_PERSONA_PALETTE: SpiderPersonaPalette = {
  body: hexToRgb('#242128'),        // reference near-black charcoal skin
  belly: hexToRgb('#5A5560'),       // muted grey chest plane
  fur: hexToRgb('#171419'),         // near-black fuzzy head
  spiderLeg: hexToRgb('#1B181F'),   // near-black articulated back limbs
  spiderLegJoint: hexToRgb('#443D4C'),
  eyeWhite: hexToRgb('#E8DEFF'),    // luminous lavender eye shells
  eyeIris: hexToRgb('#A78BFA'),     // violet iris survives pixel sampling
  pupil: hexToRgb('#151119'),
  fang: hexToRgb('#F5EDDD'),        // warm cream fangs
  blush: hexToRgb('#765B72'),       // subtle, not toy-like
  underwearVest: hexToRgb('#39353D'),   // permanent fitted grey tank
  underwearShorts: hexToRgb('#28262C'), // permanent charcoal safety shorts
  underwearTrim: hexToRgb('#71687B'),
}

const WHITE = hexToRgb('#FFFFFF')
const GOLD = hexToRgb('#D9A62E')

/** Slot-level default garment palettes (unused fallback — kept for non-starter keys). */
export const EQUIPMENT_SLOT_DEFAULT_PALETTES: Record<EquipmentSlot3D, Equipment3DPalette> = {
  top: {
    primary: hexToRgb('#F5F1FA'),   // warm-white tee
    secondary: hexToRgb('#8B5CF6'), // purple sleeves
    trim: hexToRgb('#5B21B6'),      // deep collar
  },
  bottom: {
    primary: hexToRgb('#3F3552'),   // slate shorts
    secondary: hexToRgb('#2E263E'),
    trim: hexToRgb('#C4B5FD'),
  },
  shoes: {
    primary: hexToRgb('#F7F4FC'),   // white sneakers
    secondary: hexToRgb('#4A3B52'), // dark sole
    trim: hexToRgb('#8B5CF6'),      // purple laces
  },
  accessory: {
    primary: hexToRgb('#F0C75E'),   // gold badge
    secondary: hexToRgb('#8B5CF6'),
    trim: hexToRgb('#FFF3D6'),
  },
}

/**
 * Spider starter garment palettes, sampled from the approved V2 layer art so
 * the 3D garment and the wardrobe card read as the same item:
 * - top: deep-eggplant bomber jacket, near-black ribbing, pale zipper
 * - bottom: black-grey cargo shorts, darker waistband, silver hardware
 * - shoes: black high-tops, light-purple panels/laces, cream layered soles
 * - accessory: silver web, purple-black comm device, brand-purple gem
 */
const EQUIPMENT_ASSET_PALETTE_OVERRIDES: Record<string, Partial<Equipment3DPalette>> = {
  'equipment/starter/spider/top/v1': {
    primary: hexToRgb('#59356B'),   // rich eggplant jacket body + sleeves
    secondary: hexToRgb('#21152B'), // ink ribbing / pocket panels
    trim: hexToRgb('#D8C8E8'),      // pale zipper + stitching
  },
  'equipment/starter/spider/bottom/v1': {
    primary: hexToRgb('#3B3B42'),   // cargo short body
    secondary: hexToRgb('#2A2A31'), // waistband, fly, belt loops, pocket flap/strap
    trim: hexToRgb('#B9B9C4'),      // button + buckle hardware
  },
  'equipment/starter/spider/shoes/v1': {
    primary: hexToRgb('#1D1725'),   // black shoe body + ankle collar
    secondary: hexToRgb('#9A76D2'), // purple toe cap / ankle panel / tongue / laces
    trim: hexToRgb('#EFE6D4'),      // cream layered soles
  },
  'equipment/starter/spider/accessory/v1': {
    primary: hexToRgb('#D9D9E4'),   // silver web spokes/rings + spider emblem
    secondary: hexToRgb('#3A2450'), // purple-black comm device body
    trim: hexToRgb('#8B5CF6'),      // center gem + top band
  },
}

export interface EquipmentPaletteInput {
  assetKey: string
  slot: EquipmentSlot3D
  rarity: 'common' | 'rare'
}

/** Resolve the final palette for an item: asset override → slot default → rarity accent. */
export function resolveEquipmentPalette(input: EquipmentPaletteInput): Equipment3DPalette {
  const base = EQUIPMENT_SLOT_DEFAULT_PALETTES[input.slot]
  const override = EQUIPMENT_ASSET_PALETTE_OVERRIDES[input.assetKey] ?? {}
  const merged: Equipment3DPalette = {
    primary: override.primary ?? base.primary,
    secondary: override.secondary ?? base.secondary,
    trim: override.trim ?? base.trim,
  }
  if (input.rarity === 'rare') {
    return {
      primary: mixColor(merged.primary, WHITE, 0.08),
      secondary: merged.secondary,
      trim: mixColor(merged.trim, GOLD, 0.65),
    }
  }
  return merged
}

/** Slightly darker copy used for mesh undersides so shells read as cloth, not plastic. */
export function garmentShadow(color: Equipment3DPalette['primary']): Equipment3DPalette['primary'] {
  return shadeColor(color, 0.72)
}
