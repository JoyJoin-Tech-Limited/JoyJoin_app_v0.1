import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(TEST_FILE_DIR, "../repositories");

function readRepo(fileName: string): string {
  return readFileSync(path.join(REPO_DIR, fileName), "utf8");
}

describe("repository independence regression guards", () => {
  it("keeps migrated repositories independent from legacyStorageRepo delegation", () => {
    const migratedFiles = [
      "adminAccountsRepo.ts",
      "attendanceRepo.ts",
      "blindBoxEventsRepo.ts",
      "matchingConfigRepo.ts",
      "moderationRepo.ts",
      "pricingRepo.ts",
      "registrationTelemetryRepo.ts",
      "shareCardRepo.ts",
      "venuesRepo.ts",
    ];

    for (const file of migratedFiles) {
      const source = readRepo(file);
      expect(source).not.toContain("legacyStorageRepo");
      expect(source).toContain('from "../db"');
    }
  });

  it("keeps venue and blind-box repositories as real query implementations", () => {
    const venuesSource = readRepo("venuesRepo.ts");
    const blindBoxSource = readRepo("blindBoxEventsRepo.ts");

    expect(venuesSource).toContain("INSERT INTO venue_bookings");
    expect(venuesSource).toContain("getAvailableVenuesForDateTime");
    expect(blindBoxSource).toContain(".insert(blindBoxEvents)");
    expect(blindBoxSource).toContain("getAllBlindBoxEventsAdmin");
  });
});
