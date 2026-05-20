import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "../queryClient";

describe("resolveApiUrl", () => {
  it("keeps same-origin api paths when no base override is configured", () => {
    expect(resolveApiUrl("/api/admin/stats", "")).toBe("/api/admin/stats");
    expect(resolveApiUrl("api/admin/stats", "")).toBe("/api/admin/stats");
  });

  it("prefixes a custom origin override when one is configured", () => {
    expect(resolveApiUrl("/api/admin/stats", "https://api.joyjoinapp.com")).toBe(
      "https://api.joyjoinapp.com/api/admin/stats",
    );
  });

  it("avoids duplicating the api prefix for explicit /api base overrides", () => {
    expect(resolveApiUrl("/api/admin/stats", "/api")).toBe("/api/admin/stats");
  });

  it("preserves already-absolute urls", () => {
    expect(resolveApiUrl("https://example.com/api/admin/stats", "")).toBe(
      "https://example.com/api/admin/stats",
    );
  });
});
