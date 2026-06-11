import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("db fallback", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("pg", () => ({
      Pool: class Pool {
        constructor() {
          throw new Error("Pool should not be instantiated without DATABASE_URL");
        }
      },
    }));
    vi.doMock("drizzle-orm/node-postgres", () => ({
      drizzle: () => ({}),
    }));
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  it("throws during import when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await expect(() => import("../db")).rejects.toThrow("Pool should not be instantiated without DATABASE_URL");
  });

  it("throws during import when APP_MODE=test but TEST_DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.APP_MODE = "test";
    delete process.env.TEST_DATABASE_URL;
    await expect(() => import("../db")).rejects.toThrow("Pool should not be instantiated without DATABASE_URL");
  });
});
