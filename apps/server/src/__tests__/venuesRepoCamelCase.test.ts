import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guardrail: venues repository must map raw PostgreSQL snake_case rows
 * to the camelCase API contract used by the shared schema and admin client.
 * Returning snake_case broke admin portal badges, filters, and actions
 * (e.g. venue.type, venue.isActive, venue.onboardingStatus).
 */

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");
const REPO_PATH = "apps/server/src/repositories/venuesRepo.ts";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("venuesRepo camelCase contract", () => {
  it("defines a venue row mapper", () => {
    const source = readRepoFile(REPO_PATH);
    expect(source).toContain("function mapVenueRowToCamelCase");
    expect(source).toContain("type: row.venue_type");
    expect(source).toContain("isActive: row.is_active");
    expect(source).toContain("onboardingStatus: row.onboarding_status");
    expect(source).toContain("maxConcurrentEvents: row.capacity");
    expect(source).toContain("district: row.area");
    expect(source).toContain("bookingCount: row.booking_count");
    expect(source).toContain("brandName: row.brand_name");
  });

  it("applies the mapper to all venue read/write return paths", () => {
    const source = readRepoFile(REPO_PATH);

    const functionNames = ["getAllVenues", "getVenue", "getVenueByName", "createVenue", "updateVenue"];

    for (const fnName of functionNames) {
      // Find the function body by locating "async <fnName>" and the next "async " or "};".
      const fnStart = source.indexOf(`async ${fnName}`);
      expect(fnStart).toBeGreaterThan(-1);

      const nextFnStart = source.indexOf("async ", fnStart + 1);
      const fnEnd = nextFnStart === -1 ? source.length : nextFnStart;
      const fnBody = source.slice(fnStart, fnEnd);

      expect(fnBody).toContain("mapVenueRowToCamelCase");
    }
  });

  it("does not return raw result.rows from venue accessors", () => {
    const source = readRepoFile(REPO_PATH);
    // After mapping, no venue accessor should end with "return result.rows;" or "return result.rows[0];"
    const venueAccessPattern = /async\s+(getAllVenues|getVenue|getVenueByName|createVenue|updateVenue)\b[\s\S]*?\n\s*\},?/g;
    const matches = source.match(venueAccessPattern) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);

    for (const fnBlock of matches) {
      const functionName = fnBlock.match(/async\s+(\w+)/)?.[1] ?? "unknown";
      expect({
        functionName,
        returnsRawRows: /return\s+result\.rows\s*;/.test(fnBlock),
        returnsRawRowZero: /return\s+result\.rows\[0\]\s*;/.test(fnBlock),
      }).toEqual({
        functionName,
        returnsRawRows: false,
        returnsRawRowZero: false,
      });
    }
  });
});
