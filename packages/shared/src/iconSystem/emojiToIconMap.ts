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

export type IconTier =
  | 'expression'
  | 'semantic'
  | 'mood'
  | 'chemistry'
  | 'phase'
  | 'status'
  | 'reaction'
  | 'category'
  | 'intent'
  | 'reveal'
  | 'achievement'

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
  '⚡': { assetKey: 'phase-micro-challenge', tier: 'phase', size: 80, fallbackEmoji: '⚡' },
  '🕵️': { assetKey: 'phase-lie-detective', tier: 'phase', size: 80, fallbackEmoji: '🕵️' },
  '🎲': { assetKey: 'phase-personality-dice', tier: 'phase', size: 80, fallbackEmoji: '🎲' },
  '🎪': { assetKey: 'phase-auction', tier: 'phase', size: 80, fallbackEmoji: '🎪' },
  '🎭': { assetKey: 'phase-mini-script', tier: 'phase', size: 80, fallbackEmoji: '🎭' },
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY ICONS — Category tier (interest category labels)
// ═══════════════════════════════════════════════════════════════════

export const CATEGORY_MAP: Record<string, IconMapping> = {
  '🍜': { assetKey: 'category-food', tier: 'category', size: 32, fallbackEmoji: '🍜' },
  '🎮': { assetKey: 'category-entertainment', tier: 'category', size: 32, fallbackEmoji: '🎮' },
  '🌿': { assetKey: 'category-lifestyle', tier: 'category', size: 32, fallbackEmoji: '🌿' },
  '🎭': { assetKey: 'category-culture', tier: 'category', size: 32, fallbackEmoji: '🎭' },
  '👥': { assetKey: 'category-social', tier: 'category', size: 32, fallbackEmoji: '👥' },
}

// ═══════════════════════════════════════════════════════════════════
// INTENT ICONS — Intent tier (social intent selectors)
// ═══════════════════════════════════════════════════════════════════

export const INTENT_MAP: Record<string, IconMapping> = {
  '👋': { assetKey: 'intent-friends', tier: 'intent', size: 48, fallbackEmoji: '👋' },
  '🤝': { assetKey: 'intent-networking', tier: 'intent', size: 48, fallbackEmoji: '🤝' },
  '💬': { assetKey: 'intent-discussion', tier: 'intent', size: 48, fallbackEmoji: '💬' },
  '🎉': { assetKey: 'intent-fun', tier: 'intent', size: 48, fallbackEmoji: '🎉' },
  '💕': { assetKey: 'intent-romance', tier: 'intent', size: 48, fallbackEmoji: '💕' },
  '🎲': { assetKey: 'intent-flexible', tier: 'intent', size: 48, fallbackEmoji: '🎲' },
}

// ═══════════════════════════════════════════════════════════════════
// REACTION ICONS — Reaction tier (icebreaker phase reactions)
// ═══════════════════════════════════════════════════════════════════

export const REACTION_MAP: Record<string, IconMapping> = {
  '😂': { assetKey: 'reaction-funny', tier: 'reaction', size: 56, fallbackEmoji: '😂' },
  '🔥': { assetKey: 'reaction-fire', tier: 'reaction', size: 56, fallbackEmoji: '🔥' },
  '👏': { assetKey: 'reaction-clap', tier: 'reaction', size: 56, fallbackEmoji: '👏' },
  '🎉': { assetKey: 'reaction-celebrate', tier: 'reaction', size: 56, fallbackEmoji: '🎉' },
  '🌹': { assetKey: 'reaction-rose', tier: 'reaction', size: 56, fallbackEmoji: '🌹' },
  '🤔': { assetKey: 'reaction-think', tier: 'reaction', size: 56, fallbackEmoji: '🤔' },
  '😮': { assetKey: 'reaction-wow', tier: 'reaction', size: 56, fallbackEmoji: '😮' },
}

// ═══════════════════════════════════════════════════════════════════
// REVEAL ICONS — Reveal tier (matching common ground reveals)
// ═══════════════════════════════════════════════════════════════════

export const REVEAL_MAP: Record<string, IconMapping> = {
  '💫': { assetKey: 'reveal-same-relationship', tier: 'reveal', size: 96, fallbackEmoji: '💫' },
  '🎵': { assetKey: 'reveal-same-archetype-band', tier: 'reveal', size: 96, fallbackEmoji: '🎵' },
  '🤝': { assetKey: 'reveal-same-work-industry', tier: 'reveal', size: 96, fallbackEmoji: '🤝' },
  '✨': { assetKey: 'reveal-exact-archetype', tier: 'reveal', size: 96, fallbackEmoji: '✨' },
  '🔥': { assetKey: 'reveal-hometown-industry', tier: 'reveal', size: 96, fallbackEmoji: '🔥' },
}

// ═══════════════════════════════════════════════════════════════════
// ACHIEVEMENT BADGES — Achievement tier (personality test badges)
// ═══════════════════════════════════════════════════════════════════

export const ACHIEVEMENT_MAP: Record<string, IconMapping> = {
  '🎯': { assetKey: 'achievement-first-answer', tier: 'achievement', size: 72, fallbackEmoji: '🎯' },
  '⚡': { assetKey: 'achievement-quick-thinker', tier: 'achievement', size: 72, fallbackEmoji: '⚡' },
  '🏃': { assetKey: 'achievement-halfway-hero', tier: 'achievement', size: 72, fallbackEmoji: '🏃' },
  '🔍': { assetKey: 'achievement-explorer', tier: 'achievement', size: 72, fallbackEmoji: '🔍' },
  '✨': { assetKey: 'achievement-destined-match', tier: 'achievement', size: 72, fallbackEmoji: '✨' },
  '🦉': { assetKey: 'achievement-night-owl', tier: 'achievement', size: 72, fallbackEmoji: '🦉' },
  '💎': { assetKey: 'achievement-perfectionist', tier: 'achievement', size: 72, fallbackEmoji: '💎' },
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

/** Tier-specific maps for composite (emoji + tier) lookups. */
const TIER_MAPS: Record<IconTier, Record<string, IconMapping>> = {
  expression: RATING_FACE_MAP,
  semantic: INFO_LABEL_MAP,
  mood: MOOD_ICON_MAP,
  chemistry: CHEMISTRY_BADGE_MAP,
  phase: PHASE_EMBLEM_MAP,
  status: STATUS_ICON_MAP,
  reaction: REACTION_MAP,
  category: CATEGORY_MAP,
  intent: INTENT_MAP,
  reveal: REVEAL_MAP,
  achievement: ACHIEVEMENT_MAP,
}

/**
 * Look up an icon mapping by emoji character, with an optional tier override.
 *
 * When `tier` is provided, the lookup checks the tier-specific map first.
 * If no tier-specific match is found, it falls back to the global flat map.
 * This allows the same emoji to resolve to different assets depending on
 * context (e.g. 🔥 as a chemistry badge vs. an icebreaker reaction).
 */
export function getIconMapping(emoji: string, tier?: IconTier): IconMapping | undefined {
  if (tier) {
    const tierMatch = TIER_MAPS[tier][emoji]
    if (tierMatch) return tierMatch
  }
  return EMOJI_TO_ICON_MAP[emoji]
}

/**
 * Check if a given emoji has a proprietary icon replacement.
 */
export function hasIconMapping(emoji: string): boolean {
  return emoji in EMOJI_TO_ICON_MAP
}

/**
 * Tiers that load from CDN instead of local bundle.
 * These asset sets are too large for the 2MB main package limit.
 *
 * NOTE: The following tiers are bundled locally and must be kept OUT of this
 * set so subpackage pages never block on a network path:
 *   - expression (rating-faces)
 *   - semantic (info-labels)
 *   - mood
 *   - chemistry
 *   - status
 *   - category
 *   - intent
 *
 * 'phase' is CDN-only: only a curated landing-page subset is bundled locally
 * under /assets/landing-phase-icons/; the full set lives on CDN and the build
 * clean step removes dist/assets/icons/phase-icons to save package size.
 */
export const CDN_ICON_TIERS: ReadonlySet<IconTier> = new Set([
  'phase',
  'reaction',
  // 'category' is bundled locally; assets live in apps/mini-program/src/assets/icons/category-icons
  // and are copied to dist/assets/icons/category-icons via config/index.ts.
  'reveal',
  'achievement',
])

const ICON_FOLDER_MAP: Record<IconTier, string> = {
  expression: 'rating-faces',
  semantic: 'info-labels',
  mood: 'mood-icons',
  chemistry: 'chemistry-badges',
  phase: 'phase-icons',
  status: 'status-icons',
  reaction: 'reaction-icons',
  category: 'category-icons',
  intent: 'intent-icons',
  reveal: 'reveal-icons',
  achievement: 'achievement-badges',
}

/**
 * Build a root-relative asset path for an icon asset.
 *
 * Returns `/assets/icons/<folder>/<assetKey><suffix>.webp` for both CDN and
 * local tiers. Callers should wrap the result with `cdnAsset()` for CDN tiers
 * or `localAsset()` for bundled local tiers.
 *
 * Prefer this over `getIconAssetPath()` to avoid the legacy `../../assets/...`
 * require()-style path and the associated regex replacement in callers.
 *
 * @param assetKey — e.g. 'rating-1-disappointed'
 * @param tier — determines the asset folder
 * @param density — 1, 2, or 3 for @1x/@2x/@3x
 */
export function getLocalIconAssetPath(
  assetKey: string,
  tier: IconTier,
  density: 1 | 2 | 3 = 1,
): string {
  const folder = ICON_FOLDER_MAP[tier]
  const suffix = density === 1 ? '' : `@${density}x`
  return `/assets/icons/${folder}/${assetKey}${suffix}.webp`
}

/**
 * Build a Taro/WeChat asset path for an icon asset.
 *
 * For CDN tiers, returns an absolute path like `/assets/icons/...` that
 * should be wrapped with `cdnAsset()` at the call site.
 * For local tiers, returns an absolute path like `/assets/icons/...` that
 * should be wrapped with `localAsset()` at the call site.
 *
 * @deprecated Use `getLocalIconAssetPath()` plus `localAsset()`/`cdnAsset()`
 *   instead. `require()` of non-JS assets crashes in WeChat subpackages.
 * @param assetKey — e.g. 'rating-1-disappointed'
 * @param tier — determines the asset folder
 * @param density — 1, 2, or 3 for @1x/@2x/@3x
 */
export function getIconAssetPath(
  assetKey: string,
  tier: IconTier,
  density: 1 | 2 | 3 = 1,
): string {
  const localPath = getLocalIconAssetPath(assetKey, tier, density)
  if (CDN_ICON_TIERS.has(tier)) {
    return localPath
  }
  return localPath.replace(/^\/assets\//, '../../assets/')
}
