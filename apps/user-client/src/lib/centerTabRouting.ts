import { getHongKongDateForComparison } from "@/lib/hongKongTime";

export const MS_PER_HOUR = 1000 * 60 * 60;
export const VENUE_UNLOCK_HOURS = 24;

export const DISCOVER_ROUTE = "/discover";
export const CENTER_TAB_EMPTY_STATE_ROUTE = "/center-tab/empty";

function getComparableTime(value: string) {
  return getHongKongDateForComparison(value).getTime();
}

function pickEarliest<T>(items: T[], getTime: (item: T) => number) {
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

  const todayMatchedEvent = pickEarliest(matchedEvents.filter((event) => {
    const eventDate = getHongKongDateForComparison(event.dateTime);
    return eventDate.toISOString().split("T")[0] === now.toISOString().split("T")[0];
  }), (event) => getComparableTime(event.dateTime));

  if (todayMatchedEvent) {
    return `/blind-box-events/${todayMatchedEvent.id}`;
  }

  const upcomingMatchedPool = pickEarliest(matchedPoolRegistrations.filter((registration) => {
    const eventDate = getHongKongDateForComparison(registration.poolDateTime);
    const hoursUntil = (eventDate.getTime() - now.getTime()) / MS_PER_HOUR;
    return Boolean(registration.assignedGroupId) && hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0;
  }), (registration) => getComparableTime(registration.poolDateTime));

  if (upcomingMatchedPool?.assignedGroupId) {
    return `/pool-groups/${upcomingMatchedPool.assignedGroupId}`;
  }

  const pendingRegistration = pickEarliest(
    poolRegistrations.filter((registration) => registration.matchStatus === "pending"),
    (registration) => getComparableTime(registration.poolDateTime),
  );

  if (pendingRegistration) {
    return `/pool-matching/${pendingRegistration.id}`;
  }

  const futureMatchedPool = pickEarliest(matchedPoolRegistrations.filter((registration) => {
    const eventDate = getHongKongDateForComparison(registration.poolDateTime);
    const hoursUntil = (eventDate.getTime() - now.getTime()) / MS_PER_HOUR;
    return Boolean(registration.assignedGroupId) && hoursUntil >= VENUE_UNLOCK_HOURS;
  }), (registration) => getComparableTime(registration.poolDateTime));

  if (futureMatchedPool?.assignedGroupId) {
    return `/squad-unboxing/${futureMatchedPool.assignedGroupId}`;
  }

  const futureMatchedEvent = pickEarliest(matchedEvents.filter((event) => {
    const eventDate = getHongKongDateForComparison(event.dateTime);
    return eventDate > now;
  }), (event) => getComparableTime(event.dateTime));

  if (futureMatchedEvent) {
    return `/blind-box-events/${futureMatchedEvent.id}`;
  }

  return CENTER_TAB_EMPTY_STATE_ROUTE;
}
