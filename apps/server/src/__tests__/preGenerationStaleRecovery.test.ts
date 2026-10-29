import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    update: mocks.update,
  },
}));

const { recoverStalePreGenerationJobs } = await import("../lib/socialIcebreakerStore");

describe("pre-generation stale running-job recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.returning.mockResolvedValue([]);
  });

  it("terminally fails only running claims older than the supplied cutoff in one UPDATE", async () => {
    const staleBefore = new Date("2026-10-29T11:50:00.000Z");
    mocks.returning.mockResolvedValue([{ id: "job-stale" }]);

    await expect(recoverStalePreGenerationJobs(staleBefore)).resolves.toBe(1);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith({
      status: "failed",
      errorCode: "stale_running",
      updatedAt: expect.any(Date),
    });
    expect(mocks.where).toHaveBeenCalledTimes(1);

    const predicate = mocks.where.mock.calls[0][0] as SQL;
    const query = new PgDialect().sqlToQuery(predicate);
    expect(query.sql).toContain('"status" =');
    expect(query.sql).toContain('"updated_at" <');
    expect(query.params).toEqual(["running", staleBefore.toISOString()]);
  });

  it("is idempotent when a second replica finds the rows already recovered", async () => {
    const staleBefore = new Date("2026-10-29T11:50:00.000Z");
    mocks.returning
      .mockResolvedValueOnce([{ id: "job-stale" }])
      .mockResolvedValueOnce([]);

    await expect(recoverStalePreGenerationJobs(staleBefore)).resolves.toBe(1);
    await expect(recoverStalePreGenerationJobs(staleBefore)).resolves.toBe(0);

    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.where).toHaveBeenCalledTimes(2);
  });
});
