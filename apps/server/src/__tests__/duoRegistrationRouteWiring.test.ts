/**
 * 双人成行 S1 (one-partner-per-pool) — free-registration route wiring contract.
 *
 * The free registration handler in routes/domains/userEventPools.ts is too
 * heavy to exercise over HTTP without mocking half the server, so the S1
 * call-site invariants are locked structurally here (same pattern as
 * eventRegistrationPaymentGate.test.ts). Behavioural coverage lives in:
 *   - duoRegistrationAttribution.test.ts  (pure resolver rules)
 *   - duoBindingRepo.test.ts              (availability probe semantics)
 *   - paymentFulfillmentRepo.test.ts      (paid path, mocked tx harness)
 *   - duoMatching.test.ts                 (pool-formation overlap backstop)
 *
 * What this file pins (sprint-contract duo-s1-one-partner-per-pool):
 *   AC-1/AC-2 — the duo availability pre-fetch runs BEFORE the attribution
 *               decision, the decision runs BEFORE the registration
 *               transaction, and the response carries the `duoBinding` field.
 *   AC-7      — the invitations.total_acceptances increment stays inside the
 *               `if (!existingUse)` block, itself gated by
 *               `attribution.kind === "invitation"` (a refused binding never
 *               reaches the write).
 *   Maintainability pillar — both call sites resolve through the SAME pure
 *               resolver + the SAME availability repo (one rule point).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const FREE_ROUTE = "apps/server/src/routes/domains/userEventPools.ts";
const PAID_REPO = "apps/server/src/repositories/paymentFulfillmentRepo.ts";

/** Ordered index assertion — every needle must appear, in order. */
function expectOrdered(haystack: string, needles: string[], label: string) {
  let cursor = -1;
  for (const needle of needles) {
    const at = haystack.indexOf(needle, cursor + 1);
    expect(
      at,
      `${label}: expected ${JSON.stringify(needle)} after index ${cursor}`,
    ).toBeGreaterThan(cursor);
    cursor = at;
  }
}

describe("duo S1 free-registration route wiring (userEventPools.ts)", () => {
  const source = readRepoFile(FREE_ROUTE);

  it("resolves duo availability BEFORE the attribution decision, BEFORE the registration transaction (AC-1/AC-2, Reliability)", () => {
    expectOrdered(
      source,
      [
        "resolveDuoBindingAvailability(db, {",
        "resolveOptionalRegistrationAttribution({",
        "duoBinding = resolveDuoBindingResult({",
        "const registration = await db.transaction(",
      ],
      "free-route ordering",
    );
  });

  it("scopes the availability probes to duo invitations of THIS pool only", () => {
    expect(source).toContain('invitation.invitationType === "duo"');
    expect(source).toContain("invitation.poolId === poolId");
    expect(source).toContain('from "../../repositories/duoBindingRepo"');
  });

  it("surfaces the duoBinding outcome on the registration response (AC-2)", () => {
    expectOrdered(
      source,
      ["res.json({", "entitlementMode,", "duoBinding,"],
      "response shape",
    );
  });

  it("keeps the invitation_uses write + total_acceptances increment behind the accepted-attribution gate (AC-7)", () => {
    // invitationId is assigned ONLY in the accepted branch…
    expectOrdered(
      source,
      ['if (attribution.kind === "invitation")', "invitationId = attribution.invitationId;"],
      "accepted-branch gating",
    );

    // …and the use-row insert + acceptances increment live inside
    // `if (invitationId && inviterId)` → `if (!existingUse)`, before the
    // referral branch starts.
    const writeBlockStart = source.indexOf("if (invitationId && inviterId) {");
    const writeBlockEnd = source.indexOf("if (referralCodeId) {");
    expect(writeBlockStart).toBeGreaterThan(-1);
    expect(writeBlockEnd).toBeGreaterThan(writeBlockStart);
    const writeBlock = source.slice(writeBlockStart, writeBlockEnd);
    expectOrdered(
      writeBlock,
      ["if (!existingUse)", "insert(invitationUses)", "totalAcceptances"],
      "use-row write block",
    );
  });
});

describe("duo S1 payment-fulfillment wiring (paymentFulfillmentRepo.ts)", () => {
  const source = readRepoFile(PAID_REPO);

  it("resolves duo availability BEFORE the attribution decision (AC-3)", () => {
    expectOrdered(
      source,
      ["resolveDuoBindingAvailability(tx, {", "resolveOptionalRegistrationAttribution({"],
      "paid-path ordering",
    );
  });

  it("keeps the invitation_uses write + total_acceptances increment behind the accepted-attribution gate (AC-3/AC-7)", () => {
    const acceptedStart = source.indexOf('if (attribution.kind === "invitation") {');
    const discardMarker = '} else if (attribution.kind === "discard")';
    const acceptedEnd = source.indexOf(discardMarker);
    expect(acceptedStart).toBeGreaterThan(-1);
    expect(acceptedEnd).toBeGreaterThan(acceptedStart);
    const acceptedBlock = source.slice(acceptedStart, acceptedEnd);
    expectOrdered(
      acceptedBlock,
      ["if (!existingUse)", "insert(invitationUses)", "totalAcceptances"],
      "paid use-row write block",
    );
  });

  it("logs refused duo bindings with a countable reason (Observability)", () => {
    expect(source).toContain("Discarding unusable invitation during payment fulfillment");
    expect(source).toContain("reason: attribution.reason");
  });
});
