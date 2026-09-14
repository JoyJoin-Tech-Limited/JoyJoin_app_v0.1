import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

const { resolveCanonicalEventId, canonicalEventIdGuard } = await import("../lib/resolveCanonicalEventId");
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

/**
 * W8 (AC-W8.8) — canonicalization is centralized as a route guard so write
 * routes cannot forget it (the single-test 局 FK violation). New event write
 * routes mount `canonicalEventIdGuard()` and read `req.canonicalEventId`.
 */
describe("canonicalEventIdGuard (W8 AC-W8.8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRes() {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  }

  it("resolves the id, attaches it to the request, and calls next()", async () => {
    buildDbMock([[{ id: "event-abc" }]]);
    const req: any = {
      params: { eventId: "event-abc" },
      session: { userId: "user-1" },
      originalUrl: "/api/events/event-abc/feedback",
    };
    const res = makeRes();
    const next = vi.fn();

    await canonicalEventIdGuard()(req, res, next);

    expect(req.canonicalEventId).toBe("event-abc");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("404s an unresolvable id and never calls next()", async () => {
    buildDbMock([[], [], [], []]);
    const req: any = {
      params: { eventId: "ghost-id" },
      session: { userId: "user-1" },
      originalUrl: "/api/events/ghost-id/feedback",
    };
    const res = makeRes();
    const next = vi.fn();

    await canonicalEventIdGuard()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when there is no authenticated session", async () => {
    const req: any = { params: { eventId: "event-abc" } };
    const res = makeRes();
    const next = vi.fn();

    await canonicalEventIdGuard()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("regression: social.ts feedback route uses the guard, not per-route canonicalization", () => {
    const socialSrc = readFileSync(
      fileURLToPath(new URL("../routes/domains/social.ts", import.meta.url)),
      "utf8",
    );
    expect(socialSrc).toContain(
      "app.post('/api/events/:eventId/feedback', requireAuth, canonicalEventIdGuard()",
    );
    // Per-route discipline is gone: the raw helper is no longer imported/called
    // in the route module — the guard is the single canonicalization entry.
    expect(socialSrc).not.toMatch(/resolveCanonicalEventId\s*\(/);
  });
});
