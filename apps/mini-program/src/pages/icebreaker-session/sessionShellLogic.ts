import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { resolveTierDisplay } from '@shared/socialIcebreakerTierManifest'
import type { VibeId } from '../../lib/vibeMapping'
import type { SessionPhase } from './phaseUtils'
import { TIER_PRESETS } from './tierPresets'

/**
 * Pure shell-layer resolvers for the icebreaker session page (PR1 壳层).
 *
 * Extracted from index.tsx so the ⋯ menu composition and the calm-by-default
 * sync-loss indicator are unit-testable without rendering Taro components.
 * No Taro / React imports — keep this module pure.
 */

/** Storage key for the one-time host ⋯ coachmark (persisted via Taro.setStorageSync). */
export const HOST_MENU_COACHMARK_STORAGE_KEY = 'jj_ib_host_menu_coachmark_seen_v1'

export type HostMenuItemId = 'change-tier' | 'suggestion' | 'early-end'

export interface HostMenuItem {
  id: HostMenuItemId
  label: string
}

/**
 * Phases where the tier sheet is reachable. Mirrors `canChangeTier` in index.tsx
 * (tier switching is server-locked to waiting/warmup).
 */
const TIER_MENU_PHASES: ReadonlySet<string> = new Set(['waiting', 'warmup'])

/**
 * Phases where the adaptive-suggestion entry is hidden.
 * Locked contract Q3⑩: suggestion item hidden in waiting / recap / ended;
 * the menu itself stays visible in all phases that have any valid action.
 */
const SUGGESTION_HIDDEN_PHASES: ReadonlySet<string> = new Set(['waiting', 'recap', 'ended'])

/**
 * Phases where 「提前进入总结」 is offered. Hidden in warmup (nothing to
 * summarize yet), phase_selection (custom mode's own end affordance lives in
 * the picker), and the terminal phases.
 */
const EARLY_END_PHASES: ReadonlySet<string> = new Set([
  'micro_challenge',
  'lie_detective',
  'personality_dice',
  'auction',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'speed_friending',
  'mini_script',
])

/**
 * Menu copy for the tier item, e.g. `更换模式（当前·深度畅聊·60min）`.
 * Falls back to the canonical tier display name for non-preset tier×vibe combos.
 */
export function buildChangeTierLabel(tier: TierMachineId | undefined, vibe?: VibeId): string {
  if (!tier || tier === 'custom') {
    return '更换模式（当前·自由局）'
  }
  const preset = TIER_PRESETS.find((p) => p.tier === tier && p.vibe === vibe)
  if (preset) {
    return `更换模式（当前·${preset.title}·${preset.duration}）`
  }
  return `更换模式（当前·${resolveTierDisplay(tier, { glowVariant: 'default' })}）`
}

export interface ResolveHostMenuItemsInput {
  phase: SessionPhase
  isHost: boolean
  tier?: TierMachineId
  vibe?: VibeId
}

/**
 * Contextual ⋯ menu items per phase. Host-only. Ordering is stable
 * (tier first, suggestion second, early-end last) so ActionSheet indices
 * are deterministic.
 */
export function resolveHostMenuItems(input: ResolveHostMenuItemsInput): HostMenuItem[] {
  if (!input.isHost) {
    return []
  }
  const items: HostMenuItem[] = []
  if (TIER_MENU_PHASES.has(input.phase)) {
    items.push({ id: 'change-tier', label: buildChangeTierLabel(input.tier, input.vibe) })
  }
  if (!SUGGESTION_HIDDEN_PHASES.has(input.phase)) {
    items.push({ id: 'suggestion', label: `${DEFAULT_MASCOT_DISPLAY_NAME}，给点建议？` })
  }
  if (EARLY_END_PHASES.has(input.phase)) {
    items.push({ id: 'early-end', label: '提前进入总结' })
  }
  return items
}

export interface ResolveSyncLossInput {
  /** True once a session has been bootstrapped (post-/start). */
  hasSession: boolean
  /** True when the 3s social-session poll is in an error state. */
  isPollError: boolean
}

/**
 * Calm-by-default sync-loss: the grey dot appears only when a LIVE session's
 * poll fails. Pre-bootstrap failures still route to the full-page error state
 * (handled by pageError in index.tsx), so they must not light the dot.
 */
export function resolveSyncLossVisible(input: ResolveSyncLossInput): boolean {
  return input.hasSession && input.isPollError
}

export interface ShouldNudgeHostForSuggestionInput {
  /** Host-only by construction: the suggestion is stripped server-side for
   *  non-hosts, but the role gate is re-checked here regardless. */
  isHost: boolean
  /** `generatedAt` of the suggestion already nudged (or null on first run). */
  lastNudgedGeneratedAt: string | null
  /** `generatedAt` of the currently visible suggestion, if any. */
  suggestionGeneratedAt: string | null | undefined
}

/**
 * S7 静默救援 (silent rescue): fire the host-only signal exactly once per
 * suggestion generation. A suggestion re-enters the polled state across
 * refreshes and reconnects — the generatedAt identity keeps the nudge
 * one-shot without any extra state on the server.
 */
export function shouldNudgeHostForSuggestion(
  input: ShouldNudgeHostForSuggestionInput,
): boolean {
  if (!input.isHost) return false
  if (!input.suggestionGeneratedAt) return false
  return input.suggestionGeneratedAt !== input.lastNudgedGeneratedAt
}
