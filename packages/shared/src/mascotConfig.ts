/**
 * Mascot Display Configuration
 *
 * Machine ID (`xiaoyue`) is frozen across code, DB, and wire protocol.
 * Display names and backstory are server-driven and killable without deploy.
 *
 * China market: 悦仔 (evolution of 小悦, preserves 悦聚 lineage)
 * International: Yue (from 悦, pronounceable globally, "sounds like You")
 */

export const DEFAULT_MASCOT_DISPLAY_NAME = '悦仔'
export const DEFAULT_MASCOT_DISPLAY_NAME_EN = 'Yue'

export interface MascotBackstory {
  enabled: boolean
  /** Primary backstory text. */
  text: string
  /** Original name for lineage continuity (e.g., "小悦"). */
  originName?: string
  /** Lore explaining the name evolution. */
  originStory?: string
}

export interface MascotDisplayConfig {
  /** Immutable machine identifier — never shown to users. */
  machineId: 'xiaoyue'
  /** Active display name for the China market. */
  displayName: string
  /** Active display name for international markets. */
  displayNameEn: string
  /** Optional backstory / lore. */
  backstory?: MascotBackstory
}

export const DEFAULT_MASCOT_CONFIG: MascotDisplayConfig = {
  machineId: 'xiaoyue',
  displayName: DEFAULT_MASCOT_DISPLAY_NAME,
  displayNameEn: DEFAULT_MASCOT_DISPLAY_NAME_EN,
}

/**
 * Build a mascot display config from environment variables.
 *
 * @param env — partial env var mapping
 * @returns resolved MascotDisplayConfig
 */
export function buildMascotConfigFromEnv(env: {
  MASCOT_DISPLAY_NAME?: string
  MASCOT_BACKSTORY_ENABLED?: string
  MASCOT_ORIGIN_LORE_ENABLED?: string
}): MascotDisplayConfig {
  const rawDisplayName = env.MASCOT_DISPLAY_NAME?.trim() || ''
  // Cap length to prevent UI breakage or accidental abuse
  const displayName = rawDisplayName.slice(0, 20) || DEFAULT_MASCOT_DISPLAY_NAME
  const backstoryEnabled = env.MASCOT_BACKSTORY_ENABLED === 'true'
  const originLoreEnabled = env.MASCOT_ORIGIN_LORE_ENABLED === 'true'

  const backstory: MascotBackstory | undefined = backstoryEnabled
    ? {
        enabled: true,
        text: '悦仔来自悦聚，是你的聚会小向导。',
        ...(originLoreEnabled
          ? {
              originName: '小悦',
              originStory:
                '从前大家都叫我小悦，因为我是悦聚的小精灵。后来我觉得，只做一个安静的小精灵太无聊了，所以我现在是悦仔 — 想给你的社交加一点薄荷味的惊喜。',
            }
          : {}),
      }
    : undefined

  return {
    machineId: 'xiaoyue',
    displayName,
    displayNameEn: DEFAULT_MASCOT_DISPLAY_NAME_EN,
    backstory,
  }
}
