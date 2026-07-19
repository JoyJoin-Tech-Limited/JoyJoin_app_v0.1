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
  body: hexToRgb('#242129'),        // charcoal-violet skin sampled from the 2D profile body
  belly: hexToRgb('#3D3942'),       // muted grey face plane and tiny torso modelling detail
  fur: hexToRgb('#19161D'),         // fuzzy black-violet head ring
  spiderLeg: hexToRgb('#1D1921'),   // deep articulated back limbs
  spiderLegJoint: hexToRgb('#3A3342'),
  eyeWhite: hexToRgb('#F4EEE5'),    // warm glossy catchlights, never a white eye shell
  eyeIris: hexToRgb('#7752A5'),     // purple crescent around the large black eyes
  pupil: hexToRgb('#0C0A0E'),       // both large and six small eyes are predominantly black
  fang: hexToRgb('#F5EDDD'),        // warm cream fangs
  blush: hexToRgb('#59424F'),       // subtle, not toy-like
  underwearVest: hexToRgb('#4B4651'),   // permanent fitted grey tank from the 2D body
  underwearShorts: hexToRgb('#29262D'), // permanent charcoal safety shorts
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
    primary: hexToRgb('#302437'),   // near-black eggplant jacket body + sleeves
    secondary: hexToRgb('#18131D'), // ink ribbing / pocket panels
    trim: hexToRgb('#9D89AE'),      // quiet mauve zipper + stitching
  },
  'equipment/starter/spider/bottom/v1': {
    primary: hexToRgb('#303038'),   // cargo short body
    secondary: hexToRgb('#202027'), // waistband, fly, belt loops, pocket flap/strap
    trim: hexToRgb('#AAA5B4'),      // button + buckle hardware
  },
  'equipment/starter/spider/shoes/v1': {
    primary: hexToRgb('#18131E'),   // black shoe body + ankle collar
    secondary: hexToRgb('#8865BD'), // muted purple panels / tongue / laces
    trim: hexToRgb('#E8DECC'),      // warm cream layered soles
  },
  'equipment/starter/spider/accessory/v1': {
    primary: hexToRgb('#A8A1AE'),   // aged silver web spokes/rings + emblem
    secondary: hexToRgb('#211725'), // purple-black comm device body
    trim: hexToRgb('#8060AC'),      // restrained amethyst gem + accent band
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
