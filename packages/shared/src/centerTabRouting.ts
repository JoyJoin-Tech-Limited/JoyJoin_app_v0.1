import { getHongKongDateForComparison } from './hongKongTime'

export const MS_PER_HOUR = 1000 * 60 * 60
export const VENUE_UNLOCK_HOURS = 24

export type CenterTabPoolMatchStatus = 'pending' | 'matched' | 'completed' | 'unmatched'

export interface CenterTabPoolRegistration {
  id: string
  matchStatus?: CenterTabPoolMatchStatus
  assignedGroupId?: string | null
  poolDateTime?: string | null
}

export interface CenterTabEvent {
  id: string
  status?: string
  dateTime?: string
}

export type CenterTabDestination =
  | { kind: 'discover' }
  | { kind: 'empty' }
  | { kind: 'matched-event'; eventId: string }
  | { kind: 'matched-pool-unlocked'; groupId: string }
  | { kind: 'pending-registration'; registrationId: string }
  | { kind: 'matched-pool-future'; groupId: string }

function getComparableTime(value?: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  return getHongKongDateForComparison(value).getTime()
}

function getHoursUntilEvent(value: string | undefined, now: Date) {
  return (getComparableTime(value) - now.getTime()) / MS_PER_HOUR
}

function selectEarliestByTime<T>(items: T[], getTime: (item: T) => number) {
  return items.reduce<T | undefined>((earliest, item) => {
    if (!earliest) {
      return item
    }

    return getTime(item) < getTime(earliest) ? item : earliest
  }, undefined)
}

function isSameHongKongDay(left: string | undefined, right: Date) {
  if (!left) {
    return false
  }

  return (
    getHongKongDateForComparison(left).toISOString().split('T')[0] ===
    right.toISOString().split('T')[0]
  )
}

export function resolveCenterTabDestination(
  poolRegistrations?: CenterTabPoolRegistration[],
  events?: CenterTabEvent[],
  referenceTime = new Date()
): CenterTabDestination {
  if (!poolRegistrations || !events) {
    return { kind: 'discover' }
  }

  const now = getHongKongDateForComparison(referenceTime)
  const matchedEvents = events.filter(
    (event): event is CenterTabEvent & { dateTime: string } =>
      event.status === 'matched' && typeof event.dateTime === 'string'
  )
  const matchedPoolRegistrations = poolRegistrations.filter(
    (
      registration
    ): registration is CenterTabPoolRegistration & { assignedGroupId: string; poolDateTime: string } =>
      registration.matchStatus === 'matched' &&
      typeof registration.assignedGroupId === 'string' &&
      registration.assignedGroupId.length > 0 &&
      typeof registration.poolDateTime === 'string'
  )

  const todayMatchedEvent = selectEarliestByTime(
    matchedEvents.filter((event) => isSameHongKongDay(event.dateTime, now)),
    (event) => getComparableTime(event.dateTime)
  )

  if (todayMatchedEvent) {
    return { kind: 'matched-event', eventId: todayMatchedEvent.id }
  }

  const upcomingMatchedPool = selectEarliestByTime(
    matchedPoolRegistrations.filter((registration) => {
      const hoursUntil = getHoursUntilEvent(registration.poolDateTime, now)
      return hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0
    }),
    (registration) => getComparableTime(registration.poolDateTime)
  )

  if (upcomingMatchedPool) {
    return { kind: 'matched-pool-unlocked', groupId: upcomingMatchedPool.assignedGroupId }
  }

  const pendingRegistration = selectEarliestByTime(
    poolRegistrations.filter(
      (
        registration
      ): registration is CenterTabPoolRegistration & { poolDateTime: string } =>
        registration.matchStatus === 'pending' && typeof registration.poolDateTime === 'string'
    ),
    (registration) => getComparableTime(registration.poolDateTime)
  )

  if (pendingRegistration) {
    return { kind: 'pending-registration', registrationId: pendingRegistration.id }
  }

  const futureMatchedPool = selectEarliestByTime(
    matchedPoolRegistrations.filter((registration) => {
      const hoursUntil = getHoursUntilEvent(registration.poolDateTime, now)
      return hoursUntil >= VENUE_UNLOCK_HOURS
    }),
    (registration) => getComparableTime(registration.poolDateTime)
  )

  if (futureMatchedPool) {
    return { kind: 'matched-pool-future', groupId: futureMatchedPool.assignedGroupId }
  }

  const futureMatchedEvent = selectEarliestByTime(
    matchedEvents.filter((event) => getHongKongDateForComparison(event.dateTime) > now),
    (event) => getComparableTime(event.dateTime)
  )

  if (futureMatchedEvent) {
    return { kind: 'matched-event', eventId: futureMatchedEvent.id }
  }

  return { kind: 'empty' }
}

export function getCenterButtonLabel(
  poolRegistrations?: CenterTabPoolRegistration[],
  events?: CenterTabEvent[],
  referenceTime = new Date()
) {
  if (!poolRegistrations || !events) {
    return '去参与'
  }

  const now = getHongKongDateForComparison(referenceTime)
  const todayEvent = events.find(
    (event) =>
      event.status === 'matched' &&
      typeof event.dateTime === 'string' &&
      isSameHongKongDay(event.dateTime, now)
  )

  if (todayEvent?.dateTime) {
    const hasStarted = now >= getHongKongDateForComparison(todayEvent.dateTime)
    return hasStarted ? '🎲 破冰进行中！' : '今日出发！🎉'
  }

  const upcomingPool = poolRegistrations.find((registration) => {
    if (
      registration.matchStatus !== 'matched' ||
      typeof registration.assignedGroupId !== 'string' ||
      !registration.assignedGroupId ||
      typeof registration.poolDateTime !== 'string'
    ) {
      return false
    }

    const hoursUntil = getHoursUntilEvent(registration.poolDateTime, now)
    return hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0
  })

  if (upcomingPool) {
    return '查看场地 📍'
  }

  const pendingRegistration = poolRegistrations.find(
    (registration) => registration.matchStatus === 'pending'
  )

  if (pendingRegistration) {
    return '匹配中…'
  }

  const matchedPool = poolRegistrations.find(
    (registration) => registration.matchStatus === 'matched' && registration.assignedGroupId
  )

  if (matchedPool) {
    return '查看桌友 👥'
  }

  return '去发现'
}

export function shouldShowCenterButtonBadge(
  poolRegistrations?: CenterTabPoolRegistration[],
  events?: CenterTabEvent[]
) {
  if (!poolRegistrations || !events) {
    return false
  }

  const hasPendingMatch = poolRegistrations.some(
    (registration) => registration.matchStatus === 'pending'
  )
  const hasMatchedActivity =
    poolRegistrations.some((registration) => registration.matchStatus === 'matched') ||
    events.some((event) => event.status === 'matched')

  return hasPendingMatch || hasMatchedActivity
}