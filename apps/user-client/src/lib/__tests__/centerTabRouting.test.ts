import { describe, expect, it } from "vitest";
import { CENTER_TAB_EMPTY_STATE_ROUTE, getCenterButtonDestination } from "../centerTabRouting";

describe("getCenterButtonDestination", () => {
  it("preserves the discover fallback while activity data is still loading", () => {
    expect(getCenterButtonDestination(undefined, undefined)).toBe("/discover");
  });

  it("routes to the dedicated empty state when no activity exists", () => {
    expect(getCenterButtonDestination([], [], new Date("2026-03-27T08:00:00.000Z"))).toBe(
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
        new Date("2026-03-27T08:00:00.000Z"),
      ),
    ).toBe("/pool-matching/registration-1");
  });

  it("keeps matched groups routed to their active destination", () => {
    expect(
      getCenterButtonDestination(
        [
          {
            id: "registration-1",
            matchStatus: "matched",
            assignedGroupId: "group-1",
            poolDateTime: "2026-03-27T20:00:00.000Z",
          },
        ],
        [],
        new Date("2026-03-27T08:00:00.000Z"),
      ),
    ).toBe("/pool-groups/group-1");
  });
});
