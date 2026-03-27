import { getHongKongDateForComparison } from "@/lib/hongKongTime";

export const MS_PER_HOUR = 1000 * 60 * 60;
export const VENUE_UNLOCK_HOURS = 24;

export const DISCOVER_ROUTE = "/discover";
export const CENTER_TAB_EMPTY_STATE_ROUTE = "/center-tab/empty";

function getComparableTime(value: string) {
  return getHongKongDateForComparison(value).getTime();
}

function getHoursUntilEvent(value: string, now: Date) {
  return (getComparableTime(value) - now.getTime()) / MS_PER_HOUR;
}

function selectEarliestByTime<T>(items: T[], getTime: (item: T) => number) {
  return items.reduce<T | undefined>((earliest, item) => {
    if (!earliest) {
      return item;
    }

    return getTime(item) < getTime(earliest) ? item : earliest;
  }, undefined);
}

export function getCenterButtonDestination(
  poolRegistrations?: Array<{
    id: string;
    matchStatus: "pending" | "matched" | "completed";
    assignedGroupId: string | null;
    poolDateTime: string;
  }>,
  events?: Array<{
    id: string;
    status: string;
    dateTime: string;
  }>,
  referenceTime = new Date(),
) {
  if (!poolRegistrations || !events) {
    return DISCOVER_ROUTE;
  }

  const now = getHongKongDateForComparison(referenceTime);
  const matchedEvents = events.filter((event) => event.status === "matched");
  const matchedPoolRegistrations = poolRegistrations.filter(
    (registration) => registration.matchStatus === "matched",
  );

  const todayMatchedEvent = selectEarliestByTime(matchedEvents.filter((event) => {
    const eventDate = getHongKongDateForComparison(event.dateTime);
    return eventDate.toISOString().split("T")[0] === now.toISOString().split("T")[0];
  }), (event) => getComparableTime(event.dateTime));

  if (todayMatchedEvent) {
    return `/blind-box-events/${todayMatchedEvent.id}`;
  }

  const upcomingMatchedPool = selectEarliestByTime(matchedPoolRegistrations.filter((registration) => {
    const hoursUntil = getHoursUntilEvent(registration.poolDateTime, now);
    return registration.assignedGroupId && hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0;
  }), (registration) => getComparableTime(registration.poolDateTime));

  if (upcomingMatchedPool?.assignedGroupId) {
    return `/pool-groups/${upcomingMatchedPool.assignedGroupId}`;
  }

  const pendingRegistration = selectEarliestByTime(
    poolRegistrations.filter((registration) => registration.matchStatus === "pending"),
    (registration) => getComparableTime(registration.poolDateTime),
  );

  if (pendingRegistration) {
    return `/pool-matching/${pendingRegistration.id}`;
  }

  const futureMatchedPool = selectEarliestByTime(matchedPoolRegistrations.filter((registration) => {
    const hoursUntil = getHoursUntilEvent(registration.poolDateTime, now);
    return registration.assignedGroupId && hoursUntil >= VENUE_UNLOCK_HOURS;
  }), (registration) => getComparableTime(registration.poolDateTime));

  if (futureMatchedPool?.assignedGroupId) {
    return `/squad-unboxing/${futureMatchedPool.assignedGroupId}`;
  }

  const futureMatchedEvent = selectEarliestByTime(matchedEvents.filter((event) => {
    const eventDate = getHongKongDateForComparison(event.dateTime);
    return eventDate > now;
  }), (event) => getComparableTime(event.dateTime));

  if (futureMatchedEvent) {
    return `/blind-box-events/${futureMatchedEvent.id}`;
  }

  return CENTER_TAB_EMPTY_STATE_ROUTE;
}
