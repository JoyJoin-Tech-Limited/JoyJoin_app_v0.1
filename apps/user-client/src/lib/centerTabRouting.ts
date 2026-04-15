import {
  MS_PER_HOUR,
  VENUE_UNLOCK_HOURS,
  resolveCenterTabDestination,
  type CenterTabEvent,
  type CenterTabPoolRegistration,
} from '@joyjoin/shared/centerTabRouting'

export { MS_PER_HOUR, VENUE_UNLOCK_HOURS }

export const DISCOVER_ROUTE = "/discover";
export const CENTER_TAB_EMPTY_STATE_ROUTE = "/center-tab/empty";

export function getCenterButtonDestination(
  poolRegistrations?: CenterTabPoolRegistration[],
  events?: CenterTabEvent[],
  referenceTime = new Date(),
) {
  const destination = resolveCenterTabDestination(poolRegistrations, events, referenceTime)

  switch (destination.kind) {
    case 'discover':
      return DISCOVER_ROUTE
    case 'empty':
      return CENTER_TAB_EMPTY_STATE_ROUTE
    case 'matched-event':
      return `/blind-box-events/${destination.eventId}`
    case 'matched-pool-unlocked':
      return `/pool-groups/${destination.groupId}`
    case 'pending-registration':
      return `/pool-matching/${destination.registrationId}`
    case 'matched-pool-future':
      return `/squad-unboxing/${destination.groupId}`
    default:
      return CENTER_TAB_EMPTY_STATE_ROUTE
  }
}
