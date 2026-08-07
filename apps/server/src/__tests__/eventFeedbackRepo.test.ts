import { describe, expect, it, vi } from "vitest";
import { resolveCanonicalFeedbackEventId } from "../repositories/eventFeedbackRepo";

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

describe("resolveCanonicalFeedbackEventId", () => {
  it("keeps a canonical events.id unchanged", async () => {
    const db = createDbMock([[{ id: "event-1" }]]);
    await expect(resolveCanonicalFeedbackEventId("event-1", "user-1", db as never))
      .resolves.toBe("event-1");
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("resolves a blind-box id through its matched group", async () => {
    const db = createDbMock([[], [{ eventId: "event-2" }]]);
    await expect(resolveCanonicalFeedbackEventId("blind-box-1", "user-1", db as never))
      .resolves.toBe("event-2");
  });

  it("resolves a pool id through the submitter's assigned group", async () => {
    const db = createDbMock([[], [], [{ assignedGroupId: "group-1" }], [{ eventId: "event-3" }]]);
    await expect(resolveCanonicalFeedbackEventId("pool-1", "user-1", db as never))
      .resolves.toBe("event-3");
  });

  it("returns undefined when the id has no canonical event for this user", async () => {
    const db = createDbMock([[], [], []]);
    await expect(resolveCanonicalFeedbackEventId("missing", "user-1", db as never))
      .resolves.toBeUndefined();
  });
});
