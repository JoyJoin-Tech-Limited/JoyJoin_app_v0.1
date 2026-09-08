import { describe, expect, it } from "vitest";
import {
  ALL_NAV_ITEMS,
  DAILY_OPS_ITEMS,
  canAccessAdminPath,
  filterNavByRole,
} from "../adminNavConfig";

describe("canAccessAdminPath", () => {
  it("grants super_admin access to every route", () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(canAccessAdminPath(item.url, "super_admin")).toBe(true);
    }
  });

  it("blocks viewer from SUPER_ONLY routes", () => {
    expect(canAccessAdminPath("/admin/audit-logs", "viewer")).toBe(false);
    expect(canAccessAdminPath("/admin/pricing", "viewer")).toBe(false);
    expect(canAccessAdminPath("/admin/feature-flags", "viewer")).toBe(false);
  });

  it("blocks viewer from SUPER_OPERATOR routes", () => {
    expect(canAccessAdminPath("/admin/moderation", "viewer")).toBe(false);
    expect(canAccessAdminPath("/admin/war-room", "viewer")).toBe(false);
    expect(canAccessAdminPath("/admin/feedback", "viewer")).toBe(false);
  });

  it("allows viewer on ALL_ROLES routes, including sub-paths", () => {
    expect(canAccessAdminPath("/admin/users", "viewer")).toBe(true);
    expect(canAccessAdminPath("/admin/users/123", "viewer")).toBe(true);
    expect(canAccessAdminPath("/admin/dashboard", "viewer")).toBe(true);
  });

  it("uses longest-prefix matching so /admin/matching-config is not shadowed by /admin/matching", () => {
    // /admin/matching-config is SUPER_ONLY; if it were shadowed by a broader
    // entry the resolution would differ. Operator is denied on both, but the
    // SUPER_OPERATOR /admin/matching-reviews must NOT be shadowed by the
    // SUPER_ONLY /admin/matching prefix.
    expect(canAccessAdminPath("/admin/matching-config", "operator")).toBe(false);
    expect(canAccessAdminPath("/admin/matching", "operator")).toBe(false);
    expect(canAccessAdminPath("/admin/matching-reviews", "operator")).toBe(true);
    expect(canAccessAdminPath("/admin/matching-config/sub", "super_admin")).toBe(true);
  });

  it("defaults to allow for routes with no nav entry", () => {
    expect(canAccessAdminPath("/admin/no-such-page", "viewer")).toBe(true);
    expect(canAccessAdminPath("/admin/no-such-page", undefined)).toBe(true);
  });

  it("denies known restricted routes when role is missing", () => {
    expect(canAccessAdminPath("/admin/audit-logs", undefined)).toBe(false);
  });
});

describe("filterNavByRole", () => {
  it("keeps only items the role may see", () => {
    const viewerItems = filterNavByRole(DAILY_OPS_ITEMS, "viewer");
    expect(viewerItems.map((i) => i.url)).not.toContain("/admin/war-room");
    expect(viewerItems.map((i) => i.url)).toContain("/admin/users");

    const operatorItems = filterNavByRole(DAILY_OPS_ITEMS, "operator");
    expect(operatorItems.map((i) => i.url)).toContain("/admin/war-room");
  });

  it("returns nothing for a missing role", () => {
    expect(filterNavByRole(DAILY_OPS_ITEMS, undefined)).toEqual([]);
  });
});
