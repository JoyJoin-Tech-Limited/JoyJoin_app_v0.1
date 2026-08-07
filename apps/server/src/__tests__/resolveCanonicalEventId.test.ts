import { describe, it, expect, vi, beforeEach } from "vitest";
import { events, eventPoolGroups, eventPoolRegistrations } from "@shared/schema";

/**
 * resolveCanonicalEventId — three id families (events.id / blind_box_events.id
 * via group back-link / event_pools.id via registration → group) must all
 * resolve to the canonical events.id. Regression for the single-test 局
 * feedback FK violation (event_feedback_event_id_events_id_fk).
 */

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db", () => ({ db: mockDb }));

const { resolveCanonicalEventId } = await import("../lib/resolveCanonicalEventId");

type Row = Record<string, unknown>;
type QueryBuilder = {
  from: ReturnType<typeof vi.fn>;
};

function buildDbMock(plan: Row[][]): void {
  const fromFn = vi.fn((table: unknown) => {
    const builder = { from: fromFn };
    builder.from = fromFn;
    return {
      where: vi.fn(() => {
        const rows = plan.shift() ?? [];
        const pending = Promise.resolve(rows) as Promise<Row[]> & { limit: unknown };
        pending.limit = vi.fn(() => Promise.resolve(rows));
        return pending;
      }),
    };
  });
  mockDb.select.mockImplementation(() => ({ from: fromFn }));
}

describe("resolveCanonicalEventId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("family 1: direct events.id passes through unchanged", async () => {
    buildDbMock([[{ id: "event-abc" }]]);
    const result = await resolveCanonicalEventId("event-abc", "user-1");
    expect(result).toBe("event-abc");
  });

  it("family 2: blind_box_events.id resolves via group.eventId back-link", async () => {
    buildDbMock([[], [{ eventId: "event-xyz" }]]);
    const result = await resolveCanonicalEventId("blindbox-1", "user-1");
    expect(result).toBe("event-xyz");
  });

  it("family 3: event_pools.id resolves via registration.assignedGroupId → group.eventId", async () => {
    buildDbMock([[], [], [{ assignedGroupId: "group-9" }], [{ eventId: "event-pooled" }]]);
    const result = await resolveCanonicalEventId("pool-1", "user-1");
    expect(result).toBe("event-pooled");
  });

  it("unresolvable id → null (route 404s)", async () => {
    buildDbMock([[], [], [], []]);
    const result = await resolveCanonicalEventId("ghost-id", "user-1");
    expect(result).toBeNull();
  });
});
