import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "../queryClient";

describe("resolveApiUrl", () => {
  it("keeps same-origin api paths when no base override is configured", () => {
    expect(resolveApiUrl("/api/auth/user", "")).toBe("/api/auth/user");
    expect(resolveApiUrl("api/auth/user", "")).toBe("/api/auth/user");
  });

  it("prefixes a custom origin override when one is configured", () => {
    expect(resolveApiUrl("/api/auth/user", "https://api.joyjoin.com")).toBe(
      "https://api.joyjoin.com/api/auth/user",
    );
  });

  it("avoids duplicating the api prefix for explicit /api base overrides", () => {
    expect(resolveApiUrl("/api/auth/user", "/api")).toBe("/api/auth/user");
  });

  it("preserves already-absolute urls", () => {
    expect(resolveApiUrl("https://example.com/api/auth/user", "")).toBe(
      "https://example.com/api/auth/user",
    );
  });
});
