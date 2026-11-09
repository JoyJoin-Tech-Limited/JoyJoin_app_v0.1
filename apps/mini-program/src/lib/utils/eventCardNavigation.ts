import Taro from '@tarojs/taro'
import type { JoinedEventSummary } from '@shared/api'
import { isJoinedEventTerminal } from './eventDisplay'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

export interface EventCardNavigationOptions {
  /** Past-day nonterminal records open their historical event detail. */
  isHistorical?: boolean
}

/**
 * Build the navigation URL for a joined-event card.
 *
 * Non-terminal events that still have an active registration route to the
 * matching-status page so the user can follow their match progress. Terminal or
 * registration-less events route to the event-detail page.
 */
export function buildEventCardUrl(
  event: JoinedEventSummary,
  options: EventCardNavigationOptions = {},
): string {
  const status = event.displayStatus ?? event.status ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)
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
