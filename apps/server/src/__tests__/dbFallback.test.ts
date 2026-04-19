import { afterEach, describe, expect, it, vi } from "vitest";

describe("db fallback", () => {
  const originalEnv = process.env.DATABASE_URL;

  afterEach(() => {
    vi.resetModules();

    if (originalEnv === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  it("does not throw during import when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const { db, pool } = await import("../db");

    expect(pool).toBeNull();
    expect(() => (db as any).execute()).toThrow("DATABASE_URL must be set");
  });
});
