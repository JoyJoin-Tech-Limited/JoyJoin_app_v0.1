import type { MiniScriptPresentedEvidence, MiniScriptVote } from '@shared/socialIcebreaker'
import type {
  MiniScriptEvidencePublic,
  MiniScriptStoryFrameworkPublic,
} from '@shared/miniscriptStoryFramework'

/**
 * MiniScript V2 P2 client-side derivations (sprint contract AC-08/09/13).
 *
 * Pure module — no Taro/React imports — so the evidence visibility rules, the
 * clue-drawer grouping, and the per-round vote filters are unit-testable
 * without rendering. Every rule here mirrors the server's sanitize/guard
 * semantics exactly; the server remains the authority, these only shape what
 * an already-sanitized payload renders.
 */

// ── Evidence visibility (AC-08) ──────────────────────────────────────────────

export interface RevealedEvidenceItem {
  evidence: MiniScriptEvidencePublic
  actNumber: number
}

/** Evidence from acts 1..currentAct only — future acts never render (the
 *  server also rejects presenting them with EVIDENCE_NOT_REVEALED, so a
 *  crafted client cannot leak them either). */
export function resolveRevealedEvidence(
  framework: MiniScriptStoryFrameworkPublic | undefined,
  currentAct: number,
): RevealedEvidenceItem[] {
  if (!framework || currentAct <= 0) return []
  const items: RevealedEvidenceItem[] = []
  for (const act of framework.act_flow) {
    if (act.actNumber > currentAct) continue
    for (const evidence of act.evidence ?? []) {
      items.push({ evidence, actNumber: act.actNumber })
    }
  }
  return items
}

/** Whether ANY act in the framework carries evidence — the tray hides itself
 *  entirely for pre-V2 frameworks (graceful degrade, contract AC-08 edge). */
export function frameworkHasAnyEvidence(framework: MiniScriptStoryFrameworkPublic | undefined): boolean {
  return (framework?.act_flow ?? []).some((act) => (act.evidence?.length ?? 0) > 0)
}

export function presentedComboKey(evidenceId: string, targetRoleSlot: number): string {
  return `${evidenceId}:${targetRoleSlot}`
}

/** Already-presented (evidenceId, targetRoleSlot) combos — greyed out in the
 *  target picker; the server is idempotent on repeats (AC-02d). */
export function buildPresentedComboSet(entries: MiniScriptPresentedEvidence[]): Set<string> {
  return new Set(entries.map((entry) => presentedComboKey(entry.evidenceId, entry.targetRoleSlot)))
}

/** Per-player per-act presentation count (budget ≤2, AC-02c). */
export function countMyPresentsInAct(
  entries: MiniScriptPresentedEvidence[],
  userId: string,
  actNo: number,
): number {
  return entries.filter((entry) => entry.presentedBy === userId && entry.actNo === actNo).length
}

/** Server-gated reaction visibility (V2 P3 contract): sanitizeStateForClient
 *  omits `reactionText` for non-presenters until the server-side 8s window
 *  elapses OR `readConfirmedAt` is set (POST /api/miniscript/confirm-read);
 *  the presenter always receives their own entries. The field's presence is
 *  the ONLY reveal signal — never compare presentedAt against a device clock
 *  (2026-08-13 clock-skew canon). Polling alone is sufficient. */
export function isReactionRevealed(entry: MiniScriptPresentedEvidence): boolean {
  return entry.reactionText != null
}

/** Entries still inside the server gate — the tray renders one subtle
 *  pending line for these so the table doesn't read the pause as a stall. */
export function pendingReactionEntries(
  entries: MiniScriptPresentedEvidence[],
): MiniScriptPresentedEvidence[] {
  return entries.filter((entry) => !isReactionRevealed(entry))
}

// ── Two-round vote filters (AC-13 client half) ───────────────────────────────
// Semantics mirror sanitizeStateForClient exactly: a ballot without voteRound
// is a legacy round-1 ballot; round 2 requires an explicit voteRound === 2.

export function roundOneVotes(votes: MiniScriptVote[] | undefined): MiniScriptVote[] {
  return (votes ?? []).filter((vote) => (vote.voteRound ?? 1) === 1)
}

export function roundTwoVotes(votes: MiniScriptVote[] | undefined): MiniScriptVote[] {
  return (votes ?? []).filter((vote) => vote.voteRound === 2)
}

/** Round 2 only exists when the flag snapshot is on AND the framework carries
 *  public motiveOptions — otherwise the UI degrades to the single-step vote
 *  with no round-2 surface at all (contract AC-05/AC-10). */
export function resolveHasMotiveRound(
  v2Enabled: boolean,
  motiveOptions: string[] | undefined,
): boolean {
  return v2Enabled && (motiveOptions?.length ?? 0) > 0
}

// ── Clue drawer grouping (AC-09) ─────────────────────────────────────────────

export interface ClueDrawerActGroup {
  actNumber: number
  clues: Array<{ clueId: string; text: string }>
  evidence: MiniScriptEvidencePublic[]
}

/**
 * Group already-revealed clues + already-public evidence by act for the clue
 * drawer. Data sources are existing payloads only (zero new requests):
 * revealed clues come from session state (`miniScriptRevealedClues`, grouped
 * by their `revealedInAct`), evidence comes from the public framework's
 * `act_flow[].evidence` filtered to acts ≤ currentAct. Acts with nothing
 * revealed are omitted; future acts can never appear.
 */
export function buildClueDrawerGroups(params: {
  framework: MiniScriptStoryFrameworkPublic | undefined
  revealedClues: Array<{ clueId: string; text: string; revealedInAct?: number }>
  currentAct: number
}): ClueDrawerActGroup[] {
  const { framework, revealedClues, currentAct } = params
  if (!framework || currentAct <= 0) return []

  const groups = new Map<number, ClueDrawerActGroup>()
  const groupFor = (actNumber: number): ClueDrawerActGroup => {
    const existing = groups.get(actNumber)
    if (existing) return existing
    const created: ClueDrawerActGroup = { actNumber, clues: [], evidence: [] }
    groups.set(actNumber, created)
    return created
  }

  for (const clue of revealedClues) {
    // Pre-P2 payloads lack revealedInAct; bucket them under the current act
    // (they were revealed on the way here) rather than dropping them.
    const actNumber = clue.revealedInAct ?? currentAct
    if (actNumber < 1 || actNumber > currentAct) continue
    groupFor(actNumber).clues.push({ clueId: clue.clueId, text: clue.text })
  }

  for (const item of resolveRevealedEvidence(framework, currentAct)) {
    groupFor(item.actNumber).evidence.push(item.evidence)
  }

  return Array.from(groups.values()).sort((a, b) => a.actNumber - b.actNumber)
}

/** Total item count for the 「线索 N 条」 entry bar — clues + public evidence. */
export function countClueDrawerItems(groups: ClueDrawerActGroup[]): number {
  return groups.reduce((total, group) => total + group.clues.length + group.evidence.length, 0)
}

// ── Evidence icon mapping (MAI-02: JoyJoinIcon set, no new assets) ───────────

/**
 * Catalog iconKeys are short Chinese object names (信封/钥匙/手帕…, see
 * miniscriptPrompts.ts). Map the common ones onto emojis the JoyJoinIcon
 * registry already covers; anything unmapped falls back to 🔍 (which has a
 * proprietary ui-tier icon), never a raw emoji-less render.
 */
const EVIDENCE_ICON_EMOJI_BY_KEY: Record<string, string> = {
  信封: '✉️',
  信: '✉️',
  钥匙: '🔑',
  手帕: '🧣',
  照片: '📷',
  相机: '📷',
  票: '🎫',
  票根: '🎫',
  纸条: '📄',
  纸: '📄',
  文件: '📄',
  日记: '📓',
  本子: '📓',
  杯子: '☕',
  茶杯: '☕',
  钟: '⏰',
  表: '⏰',
  伞: '🌂',
  眼镜: '👓',
  手套: '🧤',
  盒子: '📦',
  礼物: '🎁',
  花: '🌸',
  瓶子: '🍾',
  手机: '📱',
  耳机: '🎧',
  书: '📖',
  笔: '🖊️',
  蜡烛: '🕯️',
}

export function resolveEvidenceIconEmoji(iconKey: string): string {
  const key = iconKey.trim()
  if (EVIDENCE_ICON_EMOJI_BY_KEY[key]) return EVIDENCE_ICON_EMOJI_BY_KEY[key]
  // Substring match so compound keys (「碎裂的茶杯」) still find an icon.
  for (const [name, emoji] of Object.entries(EVIDENCE_ICON_EMOJI_BY_KEY)) {
    if (name.length >= 2 && key.includes(name)) return emoji
  }
  return '🔍'
}
