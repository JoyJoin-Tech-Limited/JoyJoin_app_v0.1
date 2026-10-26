import { describe, expect, it } from "vitest";

import { countGatheringRoomAttendance } from "../lib/gatheringRoomAttendance";

describe("countGatheringRoomAttendance", () => {
  it("counts confirmed and late as commitments, tracking late separately", () => {
    const counts = countGatheringRoomAttendance([
      { status: "confirmed" },
      { status: "late" },
      { status: "pending" },
      { status: "absent" },
    ]);

    expect(counts).toEqual({ confirmedCount: 2, arrivingLateCount: 1 });
  });

  it("returns zeros for an empty or non-committed roster", () => {
    expect(countGatheringRoomAttendance([])).toEqual({
      confirmedCount: 0,
      arrivingLateCount: 0,
    });
    expect(
      countGatheringRoomAttendance([
        { status: "pending" },
        { status: "absent" },
        { status: "unknown" },
      ]),
    ).toEqual({ confirmedCount: 0, arrivingLateCount: 0 });
  });

  it("is idempotent for repeated late rows", () => {
    expect(
      countGatheringRoomAttendance([
        { status: "late" },
        { status: "late" },
      ]),
    ).toEqual({ confirmedCount: 2, arrivingLateCount: 2 });
  });
});
