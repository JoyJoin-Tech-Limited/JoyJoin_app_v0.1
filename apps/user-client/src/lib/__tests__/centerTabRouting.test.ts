import { describe, expect, it } from "vitest";
import {
  getCenterButtonLabel,
  shouldShowCenterButtonBadge,
} from "@shared/centerTabRouting";
import {
  CENTER_TAB_EMPTY_STATE_ROUTE,
  DISCOVER_ROUTE,
  getCenterButtonDestination,
} from "../centerTabRouting";

describe("getCenterButtonDestination", () => {
  const referenceTime = new Date("2026-03-27T08:00:00.000Z");

  it("preserves the discover fallback while activity data is still loading", () => {
    expect(getCenterButtonDestination(undefined, undefined)).toBe(DISCOVER_ROUTE);
  });

  it("routes to the dedicated empty state when no activity exists", () => {
    expect(getCenterButtonDestination([], [], referenceTime)).toBe(
      CENTER_TAB_EMPTY_STATE_ROUTE,
    );
  });

  it("keeps pending matches routed to matching status", () => {
    expect(
      getCenterButtonDestination(
        [
          {
            id: "registration-1",
            matchStatus: "pending",
            assignedGroupId: null,
            poolDateTime: "2026-03-28T12:00:00.000Z",
          },
        ],
        [],
        referenceTime,
      ),
    ).toBe("/pool-matching/registration-1");
  });

  it("routes to the soonest venue-unlocked matched group", () => {
    expect(
      getCenterButtonDestination(
        [
          {
            id: "registration-2",
            matchStatus: "matched",
            assignedGroupId: "group-2",
            poolDateTime: "2026-03-27T23:00:00.000Z",
          },
          {
            id: "registration-1",
            matchStatus: "matched",
            assignedGroupId: "group-1",
            poolDateTime: "2026-03-27T20:00:00.000Z",
          },
        ],
        [],
        referenceTime,
      ),
    ).toBe("/pool-groups/group-1");
  });

  it("routes to the earliest matched event happening today", () => {
    expect(
      getCenterButtonDestination(
        [],
        [
          {
            id: "event-2",
            status: "matched",
            dateTime: "2026-03-27T18:00:00.000Z",
          },
          {
            id: "event-1",
            status: "matched",
            dateTime: "2026-03-27T10:00:00.000Z",
          },
        ],
        referenceTime,
      ),
    ).toBe("/blind-box-events/event-1");
  });

  it("routes to the soonest future matched group when venue is not yet unlocked", () => {
    expect(
      getCenterButtonDestination(
        [
          {
            id: "registration-2",
            matchStatus: "matched",
            assignedGroupId: "group-2",
            poolDateTime: "2026-03-31T12:00:00.000Z",
          },
          {
            id: "registration-1",
            matchStatus: "matched",
            assignedGroupId: "group-1",
            poolDateTime: "2026-03-29T12:00:00.000Z",
          },
        ],
        [],
        referenceTime,
      ),
    ).toBe("/squad-unboxing/group-1");
  });

  it("routes to the earliest future matched event when no matched groups are available", () => {
    expect(
      getCenterButtonDestination(
        [],
        [
          {
            id: "event-2",
            status: "matched",
            dateTime: "2026-03-29T12:00:00.000Z",
          },
          {
            id: "event-1",
            status: "matched",
            dateTime: "2026-03-28T09:00:00.000Z",
          },
        ],
        referenceTime,
      ),
    ).toBe("/blind-box-events/event-1");
  });

  it("routes pending matches deterministically to the soonest pending registration", () => {
    expect(
      getCenterButtonDestination(
        [
          {
            id: "registration-2",
            matchStatus: "pending",
            assignedGroupId: null,
            poolDateTime: "2026-03-30T12:00:00.000Z",
          },
          {
            id: "registration-1",
            matchStatus: "pending",
            assignedGroupId: null,
            poolDateTime: "2026-03-28T12:00:00.000Z",
          },
        ],
        [],
        referenceTime,
      ),
    ).toBe("/pool-matching/registration-1");
  });

  it("keeps the shared center-button label aligned with venue-unlocked groups", () => {
    expect(
      getCenterButtonLabel(
        [
          {
            id: "registration-1",
            matchStatus: "matched",
            assignedGroupId: "group-1",
            poolDateTime: "2026-03-27T20:00:00.000Z",
          },
        ],
        [],
        referenceTime,
      ),
    ).toBe("查看场地 📍");
  });

  it("preserves the discover label while activity data is still loading", () => {
    expect(getCenterButtonLabel(undefined, undefined)).toBe("去参与");
  });

  it("shows the shared center-button badge for pending or matched activity", () => {
    expect(
      shouldShowCenterButtonBadge(
        [
          {
            id: "registration-1",
            matchStatus: "pending",
            assignedGroupId: null,
            poolDateTime: "2026-03-28T12:00:00.000Z",
          },
        ],
        [],
      ),
    ).toBe(true);

    expect(shouldShowCenterButtonBadge([], [])).toBe(false);
  });
});
