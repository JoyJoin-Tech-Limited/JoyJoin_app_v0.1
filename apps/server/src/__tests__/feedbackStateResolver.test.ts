import { describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_OPEN_OFFSET_MS,
  resolveFeedbackState,
} from "../lib/feedbackStateResolver";

/**
 * feedbackStateResolver — the single source of truth for the per-viewer
 * feedback lifecycle (2026-10-16 activation, plan D1/D5).
 *
 * The db mock mirrors the eventFeedbackRepo.test.ts queue pattern: every
 * resolver query is a `select → from → where → limit(1)` chain, and each
 * entry in the queue is the row set returned by the next query in order.
 * Query order per family (documented in the resolver header):
 *
 *   pool id       → eventPools, eventPoolRegistrations, eventPoolGroups, eventFeedback
 *   events.id     → eventPools ✗, events, eventPoolGroups(by eventId), …
 *   blind-box id  → eventPools ✗, events ✗, eventPoolGroups(by blindBoxEventId), …
 */
function createDbMock(results: unknown[][]) {
  const queue = [...results];
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => queue.shift() ?? []),
        })),
      })),
    })),
  };
}

const EVENT_TIME = new Date("2026-10-15T11:30:00.000Z"); // 19:30 CST
const OPENS_AT = EVENT_TIME.getTime() + FEEDBACK_OPEN_OFFSET_MS;

const MATCHED_POOL = { id: "pool-1", status: "matched", dateTime: EVENT_TIME };
const MATCHED_REGISTRATION = { matchStatus: "matched", assignedGroupId: "group-1" };
const GROUP_WITH_EVENT = { eventId: "event-1" };

function poolDb(overrides: {
  pool?: unknown[];
  registration?: unknown[];
  group?: unknown[];
  feedback?: unknown[];
}) {
  return createDbMock([
    overrides.pool ?? [MATCHED_POOL],
    overrides.registration ?? [MATCHED_REGISTRATION],
    overrides.group ?? [GROUP_WITH_EVENT],
    overrides.feedback ?? [],
  ]);
}

describe("resolveFeedbackState — pool id family", () => {
  it("is locked 1 minute before the +3h open boundary", async () => {
    const db = poolDb({});
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT - 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "locked", canonicalEventId: "event-1" });
  });

  it("opens exactly at the +3h boundary (>= rule)", async () => {
    const db = poolDb({});
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT),
      database: db as never,
    });
    expect(result).toEqual({ state: "open", canonicalEventId: "event-1" });
  });

  it("is open 1 minute after the boundary", async () => {
    const db = poolDb({});
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("open");
  });

  it("treats completed registrations as eligible (post-sweep status)", async () => {
    const db = poolDb({
      pool: [{ ...MATCHED_POOL, status: "completed" }],
      registration: [{ matchStatus: "completed", assignedGroupId: "group-1" }],
    });
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("open");
  });

  it("is ineligible for pending / unmatched registrations and missing rows", async () => {
    for (const registration of [
      [{ matchStatus: "pending", assignedGroupId: null }],
      [{ matchStatus: "unmatched", assignedGroupId: null }],
      [], // refunded/cancelled registrations are deleted — no row at all
    ]) {
      const db = poolDb({ registration });
      const result = await resolveFeedbackState("pool-1", "user-1", {
        now: new Date(OPENS_AT + 60_000),
        database: db as never,
      });
      expect(result?.state).toBe("ineligible");
      expect(result?.canonicalEventId).toBeNull();
    }
  });

  it("is ineligible for cancelled and archived pools", async () => {
    for (const status of ["cancelled", "archived"]) {
      const db = poolDb({ pool: [{ ...MATCHED_POOL, status }] });
      const result = await resolveFeedbackState("pool-1", "user-1", {
        now: new Date(OPENS_AT + 60_000),
        database: db as never,
      });
      expect(result?.state).toBe("ineligible");
    }
  });

  it("is ineligible when the matched registration has no group projection", async () => {
    const db = poolDb({
      registration: [{ matchStatus: "matched", assignedGroupId: null }],
    });
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("ineligible");
  });

  it("is ineligible when the group never derived an events row", async () => {
    const db = poolDb({ group: [{ eventId: null }] });
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("ineligible");
  });

  it("is submitted when a feedback row already exists (duplicate guard)", async () => {
    const db = poolDb({ feedback: [{ id: "fb-1" }] });
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "submitted", canonicalEventId: "event-1" });
  });

  it("submitted wins over locked — legacy pre-gate submissions stay truthful", async () => {
    // Before the 2026-10-16 gate, feedback could be submitted pre-open. A
    // repeat attempt must read ALREADY_SUBMITTED, not NOT_OPEN.
    const db = poolDb({ feedback: [{ id: "fb-legacy" }] });
    const result = await resolveFeedbackState("pool-1", "user-1", {
      now: new Date(EVENT_TIME.getTime() + 60 * 60 * 1000), // only +1h
      database: db as never,
    });
    expect(result?.state).toBe("submitted");
  });
});

describe("resolveFeedbackState — events.id family", () => {
  const LEGACY_EVENT = { id: "event-9", dateTime: EVENT_TIME, status: "upcoming" };

  function legacyDb(overrides: {
    event?: unknown[];
    groupLink?: unknown[];
    attendance?: unknown[];
    feedback?: unknown[];
  }) {
    return createDbMock([
      [], // eventPools probe
      overrides.event ?? [LEGACY_EVENT],
      overrides.groupLink ?? [], // eventPoolGroups by eventId — no pool link
      overrides.attendance ?? [{ id: "att-1" }],
      overrides.feedback ?? [],
    ]);
  }

  it("opens for a legacy event with a non-cancelled attendance row", async () => {
    const db = legacyDb({});
    const result = await resolveFeedbackState("event-9", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "open", canonicalEventId: "event-9" });
  });

  it("locks a legacy event before the window even with attendance", async () => {
    const db = legacyDb({});
    const result = await resolveFeedbackState("event-9", "user-1", {
      now: new Date(OPENS_AT - 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("locked");
  });

  it("is ineligible for a cancelled legacy event", async () => {
    const db = legacyDb({ event: [{ ...LEGACY_EVENT, status: "cancelled" }] });
    const result = await resolveFeedbackState("event-9", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("ineligible");
  });

  it("is ineligible without an attendance row (or a cancelled one)", async () => {
    // The SQL filters cancelled attendance out, so both cases surface as [].
    const db = legacyDb({ attendance: [] });
    const result = await resolveFeedbackState("event-9", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("ineligible");
  });

  it("is submitted for a legacy event with existing feedback", async () => {
    const db = legacyDb({ feedback: [{ id: "fb-9" }] });
    const result = await resolveFeedbackState("event-9", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("submitted");
  });

  it("routes pool-derived events.id through the pool rule set", async () => {
    // The `<pool> - 第N组` derived events row: linked back to its pool, so
    // registration eligibility applies (not the attendance rule).
    const db = createDbMock([
      [], // eventPools probe (id is an events.id, not a pool id)
      [{ id: "event-1", dateTime: EVENT_TIME, status: "matched" }],
      [{ poolId: "pool-1" }], // eventPoolGroups by eventId
      [MATCHED_POOL], // pool row via the group link
      [MATCHED_REGISTRATION],
      [], // no feedback yet
    ]);
    const result = await resolveFeedbackState("event-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "open", canonicalEventId: "event-1" });
  });
});

describe("resolveFeedbackState — blind_box_events.id family", () => {
  it("resolves a group-linked blind-box id through the pool rule set", async () => {
    const db = createDbMock([
      [], // eventPools probe
      [], // events probe
      [{ poolId: "pool-1", eventId: "event-1" }], // group by blindBoxEventId
      [MATCHED_POOL],
      [MATCHED_REGISTRATION],
      [], // feedback
    ]);
    const result = await resolveFeedbackState("bb-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "open", canonicalEventId: "event-1" });
  });

  it("is ineligible for a group-linked blind box when the viewer is unmatched", async () => {
    const db = createDbMock([
      [],
      [],
      [{ poolId: "pool-1", eventId: "event-1" }],
      [MATCHED_POOL],
      [{ matchStatus: "unmatched", assignedGroupId: null }],
    ]);
    const result = await resolveFeedbackState("bb-1", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result?.state).toBe("ineligible");
  });

  it("is ineligible for a standalone blind-box event (未成行, no group)", async () => {
    const db = createDbMock([
      [], // eventPools
      [], // events
      [], // eventPoolGroups by blindBoxEventId
      [{ id: "bb-solo" }], // the blind_box_events row itself exists
    ]);
    const result = await resolveFeedbackState("bb-solo", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toEqual({ state: "ineligible", canonicalEventId: null });
  });
});

describe("resolveFeedbackState — unknown ids", () => {
  it("returns null when the id belongs to no family", async () => {
    const db = createDbMock([[], [], [], [], []]);
    const result = await resolveFeedbackState("nope", "user-1", {
      now: new Date(OPENS_AT + 60_000),
      database: db as never,
    });
    expect(result).toBeNull();
  });
});
