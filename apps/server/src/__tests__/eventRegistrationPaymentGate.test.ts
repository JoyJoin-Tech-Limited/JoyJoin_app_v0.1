import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("event registration payment gate", () => {
  it("does not let staging single-test mode bypass event payment entitlements", () => {
    const source = readRepoFile("apps/server/src/routes/domains/userEventPools.ts");

    expect(source).not.toContain("isSingleTestMode()");
    expect(source).toContain('(process.env.APP_MODE ?? "production") === "test"');
    expect(source).toContain("Staging single-test mode must still exercise the real payment path.");
  });

  it("counts only active registrations when deciding whether a pool is full", () => {
    const userEventPoolsSource = readRepoFile("apps/server/src/routes/domains/userEventPools.ts");
    const paymentsSource = readRepoFile("apps/server/src/routes/domains/payments.ts");

    const activeRegistrationFilters = userEventPoolsSource.match(
      /inArray\(eventPoolRegistrations\.matchStatus, \["pending", "matched"\]\)/g,
    ) ?? [];

    expect(activeRegistrationFilters.length).toBeGreaterThanOrEqual(3);
    expect(paymentsSource).toContain('inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"])');
  });
});
