/**
 * Session Glow view-model — Wave 4 高光值 (sprint wave4-sessionGlow,
 * locked contract AC-12…AC-17, spec D2/D3/D4).
 *
 * Pure functions only: roster-ordered card assembly, self detection, tier
 * word mapping (from the shared copy module), reveal timing, and defensive
 * payload readers. Server-authoritative canon: the client NEVER computes
 * points, tiers, or medal awards — it renders what the server derived.
 *
 * ANTI-PRESSURE (contract AC-14, spec D4, psychological-safety canon):
 * this module's public API deliberately exposes
 *   - NO cross-player numeric values (own-breakdown numbers never leave
 *     `buildGlowCards` — they become count-free narrative labels),
 *   - NO cross-player aggregation of any kind,
 *   - NO ordering/comparison helpers — cards pass through in ROSTER order,
 *     never glow order.
 * The contract test greps this file for aggregation/comparison helpers and
 * asserts none exist (grep-level proof, AC-14).
 */

import type {
  GlowPointBreakdown,
  GlowTier,
  Medal,
  SocialSessionState,
} from '@shared/socialIcebreaker'
import { GLOW_SOURCE_LABELS, GLOW_TIER_WORDS } from '@shared/copy/sessionGlow'

/** recapSnapshot.glow shape (server-derived, word-level only). */
export type SessionGlowSnapshot = NonNullable<
  NonNullable<SocialSessionState['recapSnapshot']>['glow']
>

/** Minimal roster shape the model needs (SessionParticipant-compatible). */
export interface GlowRosterEntry {
  userId: string
  displayName?: string
}

/** One per-person card in the 「今晚的高光」 block. */
export interface GlowCardView {
  userId: string
  displayName: string
  tier: GlowTier
  tierWord: string
  isSelf: boolean
  /** This person's data-derived medals (may be empty — honest zero state). */
  medals: Medal[]
  /**
   * SELF CARD ONLY: narrative labels of the sources that contributed to the
   * viewer's own glow — names stand alone, NEVER counts (numbers never on
   * screen, contract AC-17; shared copy module pins the same rule).
   * Undefined for every other player's card.
   */
  ownSourceLabels?: string[]
}

/** Per-card stagger interval for the reveal rhythm (spec D3). */
export const GLOW_CARD_STAGGER_MS = 180

/** Fixed source ordering for the self-breakdown label list (stable, copy-led). */
const GLOW_SOURCE_ORDER: ReadonlyArray<keyof GlowPointBreakdown> = [
  'quip',
  'mirror',
  'auction',
  'miniscript',
  'undercover',
  'challenge',
  'dice',
  'lie',
]

const FALLBACK_DISPLAY_NAME = '同桌伙伴'

/**
 * Flag branch resolver (contract AC-12/AC-08): a present glow snapshot means
 * the session ran with sessionGlowEnabled → render the glow block; otherwise
 * the recap renders today's standalone medal grid byte-identical.
 */
export function resolveRecapAwardsMode(
  glow: SessionGlowSnapshot | undefined | null,
): 'glow' | 'legacy' {
  return glow ? 'glow' : 'legacy'
}

/**
 * Build the per-person cards in ROSTER ORDER (never glow order — AC-12/D3).
 * Medals embed in the recipient's card, matched by display name (the locked
 * Medal shape carries no userId); each medal is consumed at most once.
 * The viewer's own card is flagged for the highlight outline and is the only
 * card eligible to carry the per-source narrative labels (AC-14/D4).
 */
export function buildGlowCards(params: {
  glow: SessionGlowSnapshot
  roster: ReadonlyArray<GlowRosterEntry>
  currentUserId?: string
  ownBreakdown?: GlowPointBreakdown
}): GlowCardView[] {
  const { glow, roster, currentUserId, ownBreakdown } = params
  const unassignedMedalIndexes = new Set(glow.medals.map((_, index) => index))

  return roster.map((entry) => {
    const displayName =
      entry.displayName && entry.displayName.trim() !== ''
        ? entry.displayName
        : FALLBACK_DISPLAY_NAME
    const isSelf = Boolean(currentUserId) && entry.userId === currentUserId
    const tier: GlowTier = glow.tiers[entry.userId] ?? 'ember'

    const medals: Medal[] = []
    for (const index of unassignedMedalIndexes) {
      if (glow.medals[index]?.recipientDisplayName === displayName) {
        medals.push(glow.medals[index])
        unassignedMedalIndexes.delete(index)
      }
    }

    const card: GlowCardView = {
      userId: entry.userId,
      displayName,
      tier,
      tierWord: GLOW_TIER_WORDS[tier],
      isSelf,
      medals,
    }

    if (isSelf && ownBreakdown) {
      const labels = GLOW_SOURCE_ORDER.filter(
        (key) => ownBreakdown[key] > 0,
      ).map((key) => GLOW_SOURCE_LABELS[key])
      if (labels.length > 0) {
        card.ownSourceLabels = labels
      }
    }

    return card
  })
}

/**
 * Honest all-zero table detection (spec D5): every card sits on the 微光
 * floor AND no medals were awarded. Drives the positive empty-state framing
 * (「静静发光也是光」 direction) — never fabricates highlights.
 */
export function isFloorOnlyTable(cards: ReadonlyArray<GlowCardView>): boolean {
  return (
    cards.length > 0 &&
    cards.every((card) => card.tier === 'ember' && card.medals.length === 0)
  )
}

/**
 * Reveal timing (spec D3 / contract AC-13): stagger fade-in per card under
 * full motion; prefers-reduced-motion renders every card statically (delay 0
 * and the stagger class is dropped by the caller).
 */
export function resolveGlowCardRevealDelayMs(
  cardIndex: number,
  shouldReduceMotion: boolean,
): number {
  return shouldReduceMotion ? 0 : cardIndex * GLOW_CARD_STAGGER_MS
}

/**
 * Analytics source tag for a data-derived medal title (contract AC-10:
 * glow_medal_awarded carries medal id + dataDerived + source). The four new
 * data medals map to their glow source; the three reworked legacy medals map
 * to their existing chains. Unknown titles fall back to 'legacy'.
 */
export function resolveGlowMedalSource(title: string): string {
  switch (title) {
    case '接梗王':
      return 'quip'
    case '暖心雷达':
      return 'mirror'
    case '豪气担当':
      return 'auction'
    case '全勤小可爱':
      return 'participation'
    case '最佳侦探':
      return 'lie_detective'
    case '挑战先锋':
      return 'micro_challenge'
    case '话题王':
      return 'warmup'
    default:
      return 'legacy'
  }
}

/**
 * Defensive reader for recapSnapshot.glow (integration drift guard): returns
 * the snapshot only when the shape is right, else undefined — which the flag
 * branch treats as "legacy recap", fail-open to today's UI.
 */
export function readRecapGlow(snapshot: unknown): SessionGlowSnapshot | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined
  const glow = (snapshot as { glow?: unknown }).glow
  if (!glow || typeof glow !== 'object') return undefined
  const candidate = glow as Partial<SessionGlowSnapshot>
  if (
    !candidate.tiers ||
    typeof candidate.tiers !== 'object' ||
    !Array.isArray(candidate.medals) ||
    typeof candidate.tableLine !== 'string'
  ) {
    return undefined
  }
  return candidate as SessionGlowSnapshot
}

/**
 * Defensive reader for the VIEWER'S OWN glow breakdown. The server projects
 * glowPoints to the requesting user's entry only (contract AC-09) — everyone
 * else's breakdown is absent from the payload by the time this runs. Returns
 * undefined unless all eight source fields are finite numbers.
 */
export function readOwnGlowBreakdown(
  state: unknown,
  userId?: string,
): GlowPointBreakdown | undefined {
  if (!state || typeof state !== 'object' || !userId) return undefined
  const glowPoints = (state as { glowPoints?: unknown }).glowPoints
  if (!glowPoints || typeof glowPoints !== 'object') return undefined
  const entry = (glowPoints as Record<string, unknown>)[userId]
  if (!entry || typeof entry !== 'object') return undefined
  const breakdown = entry as GlowPointBreakdown
  const valid = GLOW_SOURCE_ORDER.every(
    (key) =>
      typeof breakdown[key] === 'number' && Number.isFinite(breakdown[key]),
  )
  return valid ? breakdown : undefined
}
