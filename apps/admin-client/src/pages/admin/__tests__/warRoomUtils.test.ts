import { describe, expect, it } from "vitest";
import {
  deriveIcebreakerStatus,
  filterPoolsClosingWithin24h,
  findSessionForEvent,
  summarizeAttendees,
  type IcebreakerSessionInfo,
  type WarRoomPool,
} from "../warRoomUtils";

describe("summarizeAttendees", () => {
  it("counts each status bucket and derives arrived", () => {
    const counts = summarizeAttendees([
      { userId: "1", displayName: "A", archetype: null, status: "confirmed", estimatedLateMinutes: null, absentReason: null },
      { userId: "2", displayName: "B", archetype: null, status: "late", estimatedLateMinutes: 10, absentReason: null },
      { userId: "3", displayName: "C", archetype: null, status: "absent", estimatedLateMinutes: null, absentReason: "sick" },
      { userId: "4", displayName: "D", archetype: null, status: "pending", estimatedLateMinutes: null, absentReason: null },
      { userId: "5", displayName: "E", archetype: null, status: "unknown", estimatedLateMinutes: null, absentReason: null },
    ]);
    expect(counts).toEqual({ confirmed: 1, late: 1, absent: 1, pending: 2, arrived: 2 });
  });

  it("handles empty input", () => {
    expect(summarizeAttendees(undefined)).toEqual({ confirmed: 0, late: 0, absent: 0, pending: 0, arrived: 0 });
  });
});

const baseSession: IcebreakerSessionInfo = {
  id: "s1",
  eventId: "bb1",
  currentPhase: "warmup",
  phaseStartedAt: "2026-09-07T18:00:00Z",
  phaseDurationMinutes: 5,
  expectedAttendees: 6,
  checkedInCount: 4,
  hostUserId: null,
  hostName: null,
  eventTitle: "海底捞局",
  startedAt: "2026-09-07T18:00:00Z",
};

describe("deriveIcebreakerStatus", () => {
  it("returns null when no session exists", () => {
    expect(deriveIcebreakerStatus(undefined)).toBeNull();
  });

  it("returns not-started when startedAt is missing", () => {
    expect(deriveIcebreakerStatus({ ...baseSession, startedAt: null })).toBe("not-started");
  });

  it("returns stalled when the phase has run past the threshold", () => {
    expect(deriveIcebreakerStatus({ ...baseSession, phaseDurationMinutes: 25 })).toBe("stalled");
  });

  it("returns active for a recently started session", () => {
    expect(deriveIcebreakerStatus(baseSession)).toBe("active");
  });
});

describe("findSessionForEvent", () => {
  const event = { id: "bb1", title: "海底捞局" };

  it("matches a session by eventId first", () => {
    expect(findSessionForEvent([baseSession], event)?.id).toBe("s1");
    expect(findSessionForEvent([baseSession], { id: "other", title: "海底捞局" })).toBeUndefined();
    expect(findSessionForEvent(undefined, event)).toBeUndefined();
  });

  it("prefers an eventId match over a conflicting title match", () => {
    const titleOnly: IcebreakerSessionInfo = {
      ...baseSession,
      id: "s2",
      eventId: null,
      eventTitle: "海底捞局",
    };
    const idMatch: IcebreakerSessionInfo = { ...baseSession, id: "s3", eventTitle: "别的局" };
    expect(findSessionForEvent([titleOnly, idMatch], event)?.id).toBe("s3");
  });

  it("falls back to title only for sessions without an eventId", () => {
    const legacy: IcebreakerSessionInfo = { ...baseSession, id: "s4", eventId: undefined };
    expect(findSessionForEvent([legacy], { id: "no-match", title: "海底捞局" })?.id).toBe("s4");
    // a session that DOES carry an eventId must not title-match a different event
    expect(findSessionForEvent([baseSession], { id: "no-match", title: "海底捞局" })).toBeUndefined();
  });
});

const pool: WarRoomPool = {
  id: "p1",
  title: "周五破冰局",
  city: "上海",
  district: "静安",
  dateTime: "2026-09-08T19:00:00Z",
  registrationDeadline: "2026-09-07T20:00:00Z",
  minGroupSize: 4,
  status: "open",
  registrationCount: 3,
};

describe("filterPoolsClosingWithin24h", () => {
  const now = new Date("2026-09-07T12:00:00Z");

  it("keeps pools closing inside the 24h window and flags low fill", () => {
    const result = filterPoolsClosingWithin24h([pool], now);
    expect(result).toHaveLength(1);
    expect(result[0].isLowFill).toBe(true);
  });

  it("drops pools whose deadline already passed or is beyond 24h", () => {
    const past = { ...pool, id: "p2", registrationDeadline: "2026-09-07T11:00:00Z" };
    const far = { ...pool, id: "p3", registrationDeadline: "2026-09-09T12:00:00Z" };
    expect(filterPoolsClosingWithin24h([past, far], now)).toHaveLength(0);
  });

  it("marks pools at or above minGroupSize as healthy and sorts by deadline", () => {
    const healthyLate = {
      ...pool,
      id: "p4",
      registrationCount: 6,
      registrationDeadline: "2026-09-07T22:00:00Z",
    };
    const result = filterPoolsClosingWithin24h([healthyLate, pool], now);
    expect(result.map((p) => p.id)).toEqual(["p1", "p4"]);
    expect(result[1].isLowFill).toBe(false);
  });

  it("handles invalid deadlines and empty input", () => {
    expect(filterPoolsClosingWithin24h([{ ...pool, registrationDeadline: "not-a-date" }], now)).toHaveLength(0);
    expect(filterPoolsClosingWithin24h(undefined, now)).toEqual([]);
  });
});
