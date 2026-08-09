import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const adminPage = fs.readFileSync(
  path.resolve(__dirname, "../pages/admin/AdminFlashPage.tsx"),
  "utf-8",
);
const adminRoute = fs.readFileSync(
  path.resolve(__dirname, "../../../server/src/routes/domains/adminAlang.ts"),
  "utf-8",
);
const arrivalRoute = fs.readFileSync(
  path.resolve(__dirname, "../../../server/src/routes/domains/alangFlash.ts"),
  "utf-8",
);
const mapPage = fs.readFileSync(
  path.resolve(__dirname, "../../../mini-program/src/pages/alang/search/index.tsx"),
  "utf-8",
);

describe("Flash any-location arrival test control", () => {
  it("keeps the operator control wired to the dedicated audited admin route", () => {
    expect(adminPage).toContain('queryKey: ["/api/admin/alang/test-arrival"]');
    expect(adminPage).toContain('apiRequest("PUT", "/api/admin/alang/test-arrival", { enabled })');
    expect(adminPage).toContain('data-testid="switch-flash-any-location-arrival"');

    expect(adminRoute).toMatch(
      /app\.put\("\/api\/admin\/alang\/test-arrival", requireAdmin, requireOperatorOrAbove/,
    );
    expect(adminRoute).toContain('audit(req, "FEATURE_FLAG_UPDATED"');
    expect(adminRoute).toContain('await refreshFeatureFlag(key)');
  });

  it("keeps production fail-closed and the map-to-story continuation intact", () => {
    expect(adminRoute).toContain('(process.env.APP_MODE ?? "production") === "production"');
    expect(arrivalRoute).toContain('if ((process.env.APP_MODE ?? "production") === "production") return false');
    expect(arrivalRoute).toContain("forceArrivalForTesting");
    expect(mapPage).toContain("if (response.withinRange)");
    expect(mapPage).toContain("redirectToFlashCanonical(response, MINI_PROGRAM_ROUTES.alangSearch)");
  });
});
