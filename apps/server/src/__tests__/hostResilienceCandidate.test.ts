import { describe, expect, it } from "vitest";
import { pickAutoHostCandidate } from "../lib/socialIcebreakerHostResilience";

// Admin force-transfer auto-pick (2026-11-02).
//
// The console button posts an empty body, so the server chooses the successor.
// Two invariants matter and are locked here:
//   1. a simulated bot is never promoted — bots cannot advance a phase, so
//      handing them host authority freezes the room for the rest of its TTL;
//   2. the current host is never re-picked (a no-op transfer would look like
//      success in the console while the table stays stuck).
//
// Mirrors the invariant `reassignOrTombstoneHostedSessions` already enforces.

const host = { userId: "host-1", lastSeenAt: "2026-11-02T09:00:00.000Z" };

describe("pickAutoHostCandidate", () => {
  it("picks the most recently seen participant", () => {
    const roster = [
      { userId: "a", lastSeenAt: "2026-11-02T09:01:00.000Z" },
      { userId: "b", lastSeenAt: "2026-11-02T09:05:00.000Z" },
      { userId: "c", lastSeenAt: "2026-11-02T09:03:00.000Z" },
    ];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("b");
  });

  it("never re-picks the current host, even when they are the most recent", () => {
    const roster = [host, { userId: "a", lastSeenAt: "2026-11-02T08:00:00.000Z" }];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("a");
  });

  it("skips a simulated bot that is the most recently seen", () => {
    const roster = [
      { userId: "bot-1", lastSeenAt: "2026-11-02T09:30:00.000Z", isTestBot: true },
      { userId: "a", lastSeenAt: "2026-11-02T09:01:00.000Z", isTestBot: false },
    ];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("a");
  });

  it("returns null when only the current host and bots remain", () => {
    const roster = [host, { userId: "bot-1", lastSeenAt: "2026-11-02T09:30:00.000Z", isTestBot: true }];

    expect(pickAutoHostCandidate(roster, "host-1")).toBeNull();
  });

  it("treats a missing isTestBot flag as a human (older roster rows)", () => {
    const roster = [{ userId: "a", lastSeenAt: "2026-11-02T09:01:00.000Z" }];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("a");
  });

  it("is deterministic on ties — earliest roster entry wins", () => {
    const roster = [
      { userId: "first", lastSeenAt: "2026-11-02T09:01:00.000Z" },
      { userId: "second", lastSeenAt: "2026-11-02T09:01:00.000Z" },
    ];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("first");
    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("first");
  });

  it("tolerates missing or malformed timestamps instead of throwing", () => {
    const roster = [
      { userId: "a", lastSeenAt: null },
      { userId: "b", lastSeenAt: "not-a-date" },
      { userId: "c", lastSeenAt: "2026-11-02T09:01:00.000Z" },
    ];

    expect(pickAutoHostCandidate(roster, "host-1")?.userId).toBe("c");
  });

  it("returns null for an empty roster", () => {
    expect(pickAutoHostCandidate([], "host-1")).toBeNull();
  });
});
