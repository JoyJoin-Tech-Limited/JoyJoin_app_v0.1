import Taro from '@tarojs/taro'
import type { JoinedEventSummary } from '@shared/api'
import { isJoinedEventTerminal } from './eventDisplay'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

/**
 * Build the navigation URL for a joined-event card.
 *
 * Non-terminal events that still have an active registration route to the
 * matching-status page so the user can follow their match progress. Terminal or
 * registration-less events route to the event-detail page.
 */
export function buildEventCardUrl(event: JoinedEventSummary): string {
  const status = event.displayStatus ?? event.status ?? 'upcoming'
  if (event.registrationId && !isJoinedEventTerminal(status)) {
    return `${MINI_PROGRAM_ROUTES.matchingStatus}?registrationId=${encodeURIComponent(event.registrationId)}`
  }
  return `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(event.id)}`
}

/**
 * Navigate to the correct detail page for a joined-event card.
 */
export function navigateToEventCard(event: JoinedEventSummary): void {
  Taro.navigateTo({ url: buildEventCardUrl(event) })
}
