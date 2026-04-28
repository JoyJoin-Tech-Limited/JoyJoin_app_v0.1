/**
 * emojiToIconMap — Central registry mapping Unicode emoji to proprietary
 * JoyJoin icon assets.
 *
 * This is the single source of truth for the icon system. When the server
 * sends an emoji, the client looks it up here and renders the matching
 * proprietary icon. Unknown emoji fall back to native rendering.
 *
 * @see JoyJoinIcon (mini-program component) for the renderer
 */

export type IconTier = 'expression' | 'semantic' | 'mood' | 'chemistry' | 'phase' | 'status'

export interface IconMapping {
  /** Asset base name (without .png or @2x/@3x suffix) */
  assetKey: string
  /** Semantic tier for styling context */
  tier: IconTier
  /** Display size in rpx */
  size: number
  /** Original emoji — used as fallback if asset fails to load */
  fallbackEmoji: string
  /** Optional CSS color override for tinting */
  tint?: string
}

// ═══════════════════════════════════════════════════════════════════
// RATING FACES — Expression tier (premium centerpiece)
// ═══════════════════════════════════════════════════════════════════

export const RATING_FACE_MAP: Record<string, IconMapping> = {
  '😕': { assetKey: 'rating-1-disappointed', tier: 'expression', size: 64, fallbackEmoji: '😕' },
  '🙁': { assetKey: 'rating-2-sad', tier: 'expression', size: 64, fallbackEmoji: '🙁' },
  '😐': { assetKey: 'rating-3-neutral', tier: 'expression', size: 64, fallbackEmoji: '😐' },
  '🙂': { assetKey: 'rating-4-happy', tier: 'expression', size: 64, fallbackEmoji: '🙂' },
  '🤩': { assetKey: 'rating-5-ecstatic', tier: 'expression', size: 64, fallbackEmoji: '🤩' },
}

export const RATING_FACES_ORDERED: IconMapping[] = [
  RATING_FACE_MAP['😕'],
  RATING_FACE_MAP['🙁'],
  RATING_FACE_MAP['😐'],
  RATING_FACE_MAP['🙂'],
  RATING_FACE_MAP['🤩'],
]

// ═══════════════════════════════════════════════════════════════════
// INFO LABELS — Semantic tier (functional affordances)
// ═══════════════════════════════════════════════════════════════════

export const INFO_LABEL_MAP: Record<string, IconMapping> = {
  '📅': { assetKey: 'label-calendar', tier: 'semantic', size: 24, fallbackEmoji: '📅' },
  '📍': { assetKey: 'label-location', tier: 'semantic', size: 24, fallbackEmoji: '📍' },
  '👥': { assetKey: 'label-people', tier: 'semantic', size: 24, fallbackEmoji: '👥' },
  '🎯': { assetKey: 'label-target', tier: 'semantic', size: 24, fallbackEmoji: '🎯' },
  // Discover page mappings
  '🤝': { assetKey: 'label-people', tier: 'semantic', size: 32, fallbackEmoji: '🤝' },
}

// ═══════════════════════════════════════════════════════════════════
// MOOD ICONS — Mood tier (icebreaker atmosphere)
// ═══════════════════════════════════════════════════════════════════

export const MOOD_ICON_MAP: Record<string, IconMapping> = {
  '😂': { assetKey: 'mood-funny', tier: 'mood', size: 32, fallbackEmoji: '😂', tint: '#C79450' },
  '☕': { assetKey: 'mood-life', tier: 'mood', size: 32, fallbackEmoji: '☕', tint: '#8E8E88' },
  '✨': { assetKey: 'mood-relaxed', tier: 'mood', size: 32, fallbackEmoji: '✨', tint: '#877B93' },
  '💫': { assetKey: 'mood-emotional', tier: 'mood', size: 32, fallbackEmoji: '💫', tint: '#C0A17B' },
}

// ═══════════════════════════════════════════════════════════════════
// CHEMISTRY BADGES — Chemistry tier (matching status)
// ═══════════════════════════════════════════════════════════════════

export const CHEMISTRY_BADGE_MAP: Record<string, IconMapping> = {
  '🔥': { assetKey: 'chem-fire', tier: 'chemistry', size: 32, fallbackEmoji: '🔥', tint: '#C79450' },
  '✨': { assetKey: 'chem-warm', tier: 'chemistry', size: 32, fallbackEmoji: '✨', tint: '#E4C76B' },
  '🌱': { assetKey: 'chem-sprout', tier: 'chemistry', size: 32, fallbackEmoji: '🌱', tint: '#8E8E88' },
  '💬': { assetKey: 'chem-chat', tier: 'chemistry', size: 32, fallbackEmoji: '💬', tint: '#C0A17B' },
}

// ═══════════════════════════════════════════════════════════════════
// PHASE EMBLEMS — Phase tier (icebreaker game modes)
// ═══════════════════════════════════════════════════════════════════

export const PHASE_EMBLEM_MAP: Record<string, IconMapping> = {
  '🌅': { assetKey: 'phase-warmup', tier: 'phase', size: 80, fallbackEmoji: '🌅' },
  '⚡': { assetKey: 'phase-challenge', tier: 'phase', size: 80, fallbackEmoji: '⚡' },
  '🕵️': { assetKey: 'phase-detective', tier: 'phase', size: 80, fallbackEmoji: '🕵️' },
  '🎲': { assetKey: 'phase-dice', tier: 'phase', size: 80, fallbackEmoji: '🎲' },
  '🎪': { assetKey: 'phase-auction', tier: 'phase', size: 80, fallbackEmoji: '🎪' },
  '🎭': { assetKey: 'phase-script', tier: 'phase', size: 80, fallbackEmoji: '🎭' },
}

// ═══════════════════════════════════════════════════════════════════
// STATUS ICONS — Status tier (misc UI states)
// ═══════════════════════════════════════════════════════════════════

export const STATUS_ICON_MAP: Record<string, IconMapping> = {
  '👑': { assetKey: 'status-crown', tier: 'status', size: 24, fallbackEmoji: '👑', tint: '#8B5CF6' },
  '⏳': { assetKey: 'status-waiting', tier: 'status', size: 80, fallbackEmoji: '⏳' },
  'ℹ️': { assetKey: 'status-info', tier: 'status', size: 48, fallbackEmoji: 'ℹ️' },
}

// ═══════════════════════════════════════════════════════════════════
// MASTER MAP — All emoji → icon mappings
// ═══════════════════════════════════════════════════════════════════

export const EMOJI_TO_ICON_MAP: Record<string, IconMapping> = {
  ...RATING_FACE_MAP,
  ...INFO_LABEL_MAP,
  ...MOOD_ICON_MAP,
  ...CHEMISTRY_BADGE_MAP,
  ...PHASE_EMBLEM_MAP,
  ...STATUS_ICON_MAP,
}

/**
 * Look up an icon mapping by emoji character.
 * Returns undefined if no proprietary icon exists — caller should
 * fall back to native emoji rendering.
 */
export function getIconMapping(emoji: string): IconMapping | undefined {
  return EMOJI_TO_ICON_MAP[emoji]
}

/**
 * Check if a given emoji has a proprietary icon replacement.
 */
export function hasIconMapping(emoji: string): boolean {
  return emoji in EMOJI_TO_ICON_MAP
}

/**
 * Build a Taro/WeChat require() path for an icon asset.
 *
 * @param assetKey — e.g. 'rating-1-disappointed'
 * @param tier — determines the asset folder
 * @param density — 1, 2, or 3 for @1x/@2x/@3x
 */
export function getIconAssetPath(
  assetKey: string,
  tier: IconTier,
  density: 1 | 2 | 3 = 1,
): string {
  const folderMap: Record<IconTier, string> = {
    expression: 'rating-faces',
    semantic: 'info-labels',
    mood: 'mood-icons',
    chemistry: 'chemistry-badges',
    phase: 'phase-icons',
    status: 'status-icons',
  }
  const folder = folderMap[tier]
  const suffix = density === 1 ? '' : `@${density}x`
  return `../../assets/icons/${folder}/${assetKey}${suffix}.png`
}
