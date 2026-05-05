/**
 * Social Icebreaker Tier Display Manifest
 *
 * Machine IDs (breeze / glow / blaze) are immutable and persisted in DB/JSONB.
 * Display names are ephemeral and resolved at runtime via this manifest.
 *
 * Rules:
 * - Machine IDs never change once persisted.
 * - Display names can be rebranded without code renames or DB migrations.
 * - Feature flags control which variant is active.
 * - Kill-switch fallback requires zero deploy (env var change).
 */

export type TierMachineId = 'breeze' | 'glow' | 'blaze'

export const TIER_MACHINE_IDS: TierMachineId[] = ['breeze', 'glow', 'blaze']

export interface TierDisplayEntry {
  /** Canonical display name for the China market. */
  default: string
  /** English display for international markets. */
  defaultEn: string
  /** Feature-flag gated variants (e.g., tipsy mood for glow). */
  variants: Record<string, string>
  /** Zero-risk fallback if primary display is retracted. */
  killSwitchFallback: string
}

export const TIER_DISPLAY_MANIFEST: Record<TierMachineId, TierDisplayEntry> = {
  breeze: {
    default: '破冰局',
    defaultEn: 'Breeze',
    variants: {},
    killSwitchFallback: '破冰局',
  },
  glow: {
    default: '畅聊局',
    defaultEn: 'Glow',
    variants: {
      tipsy: '朦胧局',
    },
    killSwitchFallback: '漫游局',
  },
  blaze: {
    default: '狂欢局',
    defaultEn: 'Blaze',
    variants: {},
    killSwitchFallback: '狂欢局',
  },
}

export type GlowTierVariant = 'default' | 'tipsy' | 'kill'

export interface TierDisplayFlags {
  glowVariant: GlowTierVariant
}

/**
 * Resolve the user-facing display name for a tier.
 *
 * @param machineId — immutable tier identifier
 * @param flags — runtime feature flags controlling variant selection
 * @returns localized display string
 */
export function resolveTierDisplay(
  machineId: TierMachineId,
  flags: TierDisplayFlags,
): string {
  const entry = TIER_DISPLAY_MANIFEST[machineId]
  if (machineId === 'glow') {
    if (flags.glowVariant === 'tipsy') {
      return entry.variants.tipsy ?? entry.default
    }
    if (flags.glowVariant === 'kill') {
      return entry.killSwitchFallback
    }
  }
  return entry.default
}

/**
 * Resolve the English display name for a tier.
 *
 * @param machineId — immutable tier identifier
 * @returns English display string
 */
export function resolveTierDisplayEn(machineId: TierMachineId): string {
  return TIER_DISPLAY_MANIFEST[machineId].defaultEn
}

export const LEGACY_TIER_MAP: Record<string, TierMachineId> = {
  standard: 'glow',
  premium: 'blaze',
  bar: 'breeze',
}

export function resolveLegacyTier(legacyTier: string | undefined): TierMachineId {
  if (!legacyTier) return 'breeze'
  return LEGACY_TIER_MAP[legacyTier] ?? (LEGACY_TIER_MAP as Record<string, TierMachineId>)[legacyTier] ?? 'breeze'
}
