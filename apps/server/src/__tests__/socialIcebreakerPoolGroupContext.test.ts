import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveRealPoolGroupContext } from "../lib/socialIcebreakerAccess";

describe("resolveRealPoolGroupContext", () => {
  it("returns server-confirmed attribution only for an explicitly real pool", () => {
    expect(resolveRealPoolGroupContext("group-1", "pool-1", false)).toEqual({
      eventPoolGroupId: "group-1",
      poolId: "pool-1",
    });
  });

  it("fails closed for test pools and missing pool rows", () => {
    expect(resolveRealPoolGroupContext("group-1", "pool-1", true)).toBeUndefined();
    expect(resolveRealPoolGroupContext("group-1", "pool-1", null)).toBeUndefined();
  });

  it("keeps /start creation and rejoin backfill wired to the access-confirmed context", () => {
    const route = readFileSync(
      resolve(__dirname, "../routes/socialIcebreaker.ts"),
      "utf8",
    );
    expect(route).toContain("state.poolGroupContext = access.poolGroupContext");
    expect(route).toContain("delete state.poolGroupContext");
    expect(route).toContain("poolGroupContextChanged");
    expect(route).toContain("...(access.poolGroupContext ? { poolGroupContext: access.poolGroupContext } : {})");
  });
});
