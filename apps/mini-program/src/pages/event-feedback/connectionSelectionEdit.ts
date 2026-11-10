import { getErrorMessage } from '@shared/copy/errorBaselines'

/**
 * G0 selection-edit authority helpers (2026-11-10).
 *
 * The 24h mutual-selection window is server-owned: the client never derives
 * `open` from a clock, and the edit affordance exists only because a write
 * response said `state === 'open'`. Everything here is pure so the privacy and
 * wire-contract rules are unit-testable without mounting the Taro page.
 *
 * Privacy: nothing in this module may carry peer identities. The edit request
 * carries the viewer's own choices (required by the endpoint); analytics and
 * user-facing copy carry counts + server window state only.
 */

/**
 * Structural mirror of the server's `ConnectionSelectionSummary`
 * (`apps/server/src/lib/connectionSelectionWindow.ts`). Declared locally on
 * purpose — packages/shared is not owned by the mini-program workspace.
 */
export interface ConnectionSelectionSummaryLike {
  /** Server-owned window verdict. Absent = `mutualSelectionV2Enabled` OFF. */
  state?: string
  opensAt?: string | null
  closesAt?: string | null
  revealAt?: string | null
  selectedCount?: number
  /**
   * The caller's OWN selections (G0 closeout, 2026-11-10). IDs only — the
   * server never returns names, and these are only ever rendered as pressed
   * tiles, never as peer identities.
   */
  selectedUserIds?: string[]
}

export type ConnectionSelectionWindowState = 'not_open' | 'open' | 'closed' | 'legacy'

/**
 * The edit surface is allowed only while the server's last write said `open`.
 * `closed`, `not_open`, a missing summary (legacy / flag OFF) and any unknown
 * string all keep it hidden — fail-closed.
 */
export function isConnectionSelectionEditable(
  summary: ConnectionSelectionSummaryLike | null | undefined,
): boolean {
  return summary?.state === 'open'
}

/**
 * How the edit step must present the roster.
 *
 *   hidden    — no edit affordance at all (closed / not_open / legacy).
 *   prefilled — the server returned the caller's own `selectedUserIds` (or this
 *               visit wrote the selection, so the IDs are in memory): the grid
 *               opens with those tiles pressed.
 *   replace   — a partial/legacy payload with no IDs: the grid must start EMPTY
 *               and the copy must say the save replaces the old set. Never
 *               fabricate IDs.
 */
export type SelectionEditMode = 'hidden' | 'prefilled' | 'replace'

export function resolveSelectionEditMode(
  summary: ConnectionSelectionSummaryLike | null | undefined,
  selectionIdsKnown: boolean,
): SelectionEditMode {
  if (!isConnectionSelectionEditable(summary)) return 'hidden'
  const serverIds = summary?.selectedUserIds
  if (Array.isArray(serverIds)) {
    // `[]` + a positive count is a partial/legacy payload: the server withholds
    // the IDs, so trust the count and fall back to replace rather than letting
    // an empty-looking grid silently wipe a real selection.
    if (serverIds.length === 0 && (summary?.selectedCount ?? 0) > 0) return 'replace'
    return 'prefilled'
  }
  // No IDs on the payload at all: the in-session write still knows them.
  return selectionIdsKnown ? 'prefilled' : 'replace'
}

/** The caller's own selected IDs, filtered to usable strings. Never names. */
export function readEditableSelectionIds(
  summary: ConnectionSelectionSummaryLike | null | undefined,
): string[] | null {
  const ids = summary?.selectedUserIds
  if (!Array.isArray(ids)) return null
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/**
 * Replace-mode warning. Only meaningful when the server says the viewer already
 * holds a selection that this save will overwrite. Returns undefined when there
 * is nothing to lose (or the count is unusable) — no scary copy for nothing.
 */
export function buildReplaceSelectionWarning(existingCount: number | undefined): string | undefined {
  if (typeof existingCount !== 'number' || !Number.isFinite(existingCount)) return undefined
  const safeCount = Math.floor(existingCount)
  if (safeCount <= 0) return undefined
  return `你已选 ${safeCount} 位。重新选择会替换原来的选择，未重新选择的同桌会被移除。`
}

/**
 * PUT /api/events/:eventId/connection-selection — full replace of the caller's
 * 0–5 selection inside the open selection period. The server reads `selectedUserIds`
 * (NOT the feedback POST's `connections` key), so the two payloads must never
 * be conflated: `connections` on this endpoint is a 400 INVALID_SELECTION.
 */
export function buildConnectionSelectionEditRequest(
  eventId: string,
  selectedUserIds: readonly string[],
): {
  path: string
  method: 'PUT'
  data: { selectedUserIds: string[] }
} {
  return {
    path: `/api/events/${encodeURIComponent(eventId)}/connection-selection`,
    method: 'PUT',
    data: { selectedUserIds: [...selectedUserIds] },
  }
}

/** Analytics metadata for a successful edit — counts and window state only. */
export function buildSelectionEditedMetadata(
  eventId: string,
  count: number,
  windowState: string | undefined,
): { eventId: string; count: number; windowState: string } {
  return { eventId, count, windowState: windowState ?? 'legacy' }
}

/**
 * Server UTC instant → Asia/Shanghai `M月D日 HH:mm`, computed without trusting
 * the device timezone (same arithmetic as the Connections pending card).
 * Returns '' when the instant is missing or unparseable.
 */
export function formatRevealMomentLabel(revealAt: string | null | undefined): string {
  if (!revealAt) return ''
  const parsed = new Date(revealAt)
  if (Number.isNaN(parsed.getTime())) return ''
  const shanghai = new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
  const month = shanghai.getUTCMonth() + 1
  const day = shanghai.getUTCDate()
  const hours = String(shanghai.getUTCHours()).padStart(2, '0')
  const minutes = String(shanghai.getUTCMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes}`
}

/**
 * Post-save confirmation. Uses the server's own reveal instant when it sent one;
 * otherwise stays deliberately vague — never a fabricated 21:00 or a countdown.
 */
export function buildSelectionUpdatedNotice(revealAt: string | null | undefined): string {
  const label = formatRevealMomentLabel(revealAt)
  return label ? `选择已更新。${label} 回来看看。` : '选择已更新。明天回来看看。'
}

export interface SelectionEditError {
  message: string
  /**
   * True only for 409 SELECTION_WINDOW_CLOSED — the caller then returns to the
   * read-only post-submit state instead of leaving the user on a dead form.
   */
  windowClosed: boolean
}

/**
 * Coded-error → user copy. The server's own message wins when present (it is
 * the authority on "本轮互选已经结束"), with the shared template as fallback.
 */
export function resolveSelectionEditError(error: unknown): SelectionEditError {
  const data = (error as { data?: { code?: string; message?: string } } | null | undefined)?.data
  const code = data?.code
  const serverMessage =
    typeof data?.message === 'string' && data.message.trim() !== '' ? data.message.trim() : ''

  switch (code) {
    case 'SELECTION_WINDOW_CLOSED':
      return {
        message: serverMessage || getErrorMessage('SELECTION_WINDOW_CLOSED'),
        windowClosed: true,
      }
    case 'TOO_MANY_SELECTIONS':
      return {
        message: serverMessage || getErrorMessage('TOO_MANY_SELECTIONS'),
        windowClosed: false,
      }
    case 'INVALID_SELECTION':
      return {
        message: serverMessage || getErrorMessage('INVALID_SELECTION'),
        windowClosed: false,
      }
    case 'SELECTION_UNAVAILABLE':
      return {
        message: serverMessage || getErrorMessage('SELECTION_UNAVAILABLE'),
        windowClosed: false,
      }
    case 'FEEDBACK_NOT_ELIGIBLE':
      return {
        message: serverMessage || getErrorMessage('FEEDBACK_NOT_ELIGIBLE'),
        windowClosed: false,
      }
    default:
      return {
        message: serverMessage || getErrorMessage('submit-failed'),
        windowClosed: false,
      }
  }
}
