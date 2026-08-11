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
    const gateSource = readRepoFile("apps/server/src/routes/domains/userEventPools.ts");
    const entitlementSource = readRepoFile("apps/server/src/lib/entitlement.ts");

    expect(gateSource).not.toContain("isSingleTestMode()");
    // The APP_MODE=test gate literal now lives in the shared entitlement
    // helper (single source of truth — Sprint Contract m4-optimistic-registration
    // AC-1); the route must delegate to it so the semantics cannot drift.
    expect(entitlementSource).toContain('(process.env.APP_MODE ?? "production") === "test"');
    expect(entitlementSource).toContain("Staging single-test mode must still exercise the real payment path.");
    expect(gateSource).toContain("resolveEntitlementMode");
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

  it("keeps legacy user event-credit caches valid for entitlement registration", () => {
    const creditsRepoSource = readRepoFile("apps/server/src/repositories/eventCreditsRepo.ts");
    const userEventPoolsSource = readRepoFile("apps/server/src/routes/domains/userEventPools.ts");

    expect(creditsRepoSource).toContain("consumeLegacyUserCreditForPoolRegistration");
    expect(creditsRepoSource).toContain("coalesce(${users.eventCredits}, 0)");
    expect(userEventPoolsSource).toContain("consumeLegacyUserCreditForPoolRegistration");
  });
});
