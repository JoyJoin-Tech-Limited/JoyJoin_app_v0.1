import Taro from '@tarojs/taro'
import type { JoinedEventSummary } from '@shared/api'
import { isJoinedEventTerminal } from './eventDisplay'
import { hasOpenedTable } from './tableRevealState'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

export interface EventCardNavigationOptions {
  /** Past-day nonterminal records open their historical event detail. */
  isHistorical?: boolean
  /**
   * Resolved by the card that rendered the tap. Passing it keeps the tap
   * destination identical to the affinity the card promised, even if storage
   * changes between render and tap.
   */
  tableEntryState?: TableEntryState
}

/**
 * What the viewer can do with a formed table on this card.
 *
 * `sealed`   — the table is formed and the box is still closed here.
 * `revealed` — the box was already opened on this device; the card is a record.
 * `none`     — no formed-table entry applies (waiting, terminal, historical…).
 */
export type TableEntryState = 'sealed' | 'revealed' | 'none'

/**
 * Formed-table statuses. `pending`/`registered` stay on the waiting room and
 * terminal rows open the event record; only a formed table has something to
 * open.
 */
const TABLE_ENTRY_STATUSES = new Set(['matched', 'confirmed', 'venue_unlocked'])

export interface TableEntryResolverOptions {
  openBoxEntryEnabled?: boolean
  isHistorical?: boolean
  /**
   * Local cache fallback, used only when the list payload did not carry the
   * server fact. Injectable for tests.
   */
  hasOpened?: (groupId: string) => boolean
  /** Injectable for tests. */
  now?: number
}

/**
 * Single source of truth for "does this card offer an unopened table?".
 *
 * The card renders its seal and capsule from this answer and the tap routes
 * from the same answer, so the promise and the destination cannot diverge.
 */
export function resolveTableEntryState(
  event: JoinedEventSummary,
  options: TableEntryResolverOptions = {},
): TableEntryState {
  if (options.openBoxEntryEnabled !== true) return 'none'
  if (options.isHistorical) return 'none'

  const status = event.displayStatus ?? event.status ?? 'upcoming'
  if (isJoinedEventTerminal(status)) return 'none'
  if (!TABLE_ENTRY_STATUSES.has(status)) return 'none'
  if (!event.groupId) return 'none'
  if (typeof event.groupSize !== 'number' || event.groupSize <= 0) return 'none'

  // A ceremony offered after the night has started is false urgency: once the
  // table is happening or past, the card is a record.
  const startAt = event.finalDateTime ?? event.dateTime
  if (startAt) {
    const startsAtMs = new Date(startAt).getTime()
    if (Number.isFinite(startsAtMs) && startsAtMs <= (options.now ?? Date.now())) return 'none'
  }

  // Server truth wins: `revealedAt` is stamped by the reveal endpoint and rides
  // on the joined-events payload, so a second device sees the settled card
  // instead of being offered the ceremony again. The local flag is only a cache
  // for the frames before that payload arrives (and for offline re-renders);
  // `null` and `undefined` both mean "still sealed" only when the server had no
  // answer either — an explicit non-null value is the answer.
  if (typeof event.revealedAt === 'string' && event.revealedAt.length > 0) return 'revealed'
  const hasOpened = options.hasOpened ?? hasOpenedTable
  return hasOpened(event.groupId) ? 'revealed' : 'sealed'
}

/**
 * Build the navigation URL for a joined-event card.
 *
 * A formed, still-sealed table opens the box ceremony directly — the waiting
 * room the viewer already left is not a meaningful detour. Once the box has
 * been opened (or no table is formed) the previous contract applies:
 * waiting-status registrations follow their match progress, everything else
 * opens the event record.
 */
export function buildEventCardUrl(
  event: JoinedEventSummary,
  options: EventCardNavigationOptions = {},
): string {
  const status = event.displayStatus ?? event.status ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)

  if (options.tableEntryState === 'sealed' && event.groupId) {
    return `${MINI_PROGRAM_ROUTES.squadUnboxing}?groupId=${encodeURIComponent(event.groupId)}&from=card`
  }
  if (options.tableEntryState === 'revealed' && event.groupId) {
    return `${MINI_PROGRAM_ROUTES.poolGroupDetail}?groupId=${encodeURIComponent(event.groupId)}`
  }

  if (!options.isHistorical && event.registrationId && !isTerminal) {
    return `${MINI_PROGRAM_ROUTES.matchingStatus}?registrationId=${encodeURIComponent(event.registrationId)}`
  }
  return `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(event.id)}`
}

/**
 * Navigate to the correct detail page for a joined-event card.
 */
export function navigateToEventCard(
  event: JoinedEventSummary,
  options: EventCardNavigationOptions = {},
): void {
  Taro.navigateTo({ url: buildEventCardUrl(event, options) })
}
