import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ERROR_CODE_GENERIC_FALLBACK,
  getErrorMessage,
  type ErrorCode,
} from "@shared/copy/errorBaselines";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const ROUTE_SOURCE_PATH = "apps/server/src/routes/domains/userEventPools.ts";
const FUNNEL_LIB_SOURCE_PATH = "apps/server/src/lib/eventPoolRegistration.ts";

/**
 * Registration error-code contract (2026-09-10 recurrence lock, scan scope
 * widened by T6-strict 2026-09-17).
 *
 * Root cause regression: POST /api/event-pools/:id/register returned
 * "already registered" 400s with NO machine-readable code, while the sibling
 * register-with-payment route already used code ALREADY_REGISTERED. The
 * mini-program resolveMessage() maps any code-less/unmapped error to the
 * generic "出了点问题，稍后再试" toast + a "提交没成功 / 重新提交" error card —
 * a dead-end, because the retry can never succeed (the row exists).
 *
 * T6-strict adds a second emission point: the registration FUNNEL
 * (`lib/eventPoolRegistration.ts`) throws coded budget validation errors. The
 * scan scope now covers both the register routes and the funnel lib, and any
 * quoted UPPER_SNAKE literal in either file is treated as a machine code that
 * MUST have a governed copy template — so a future code-less throw regresses
 * this test instead of silently falling through to the generic toast.
 */
describe("registration error-code contract", () => {
  const routeSource = readRepoFile(ROUTE_SOURCE_PATH);
  const funnelLibSource = readRepoFile(FUNNEL_LIB_SOURCE_PATH);
  const scannedSources = [routeSource, funnelLibSource];

  it("the /register pre-check duplicate branch carries code ALREADY_REGISTERED", () => {
    // Both /register (free path) and register-with-payment must speak the
    // same terminal-joined code so clients can map it to the joined surface.
    const occurrences = routeSource.match(/code: "ALREADY_REGISTERED"/g) ?? [];
    // 2 in /register (pre-check + 23505 catch) + 2 in register-with-payment.
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
  });

  it("no duplicate-registration 400 is left code-less in the register routes", () => {
    // The legacy English, code-less body was the swallowed-error source.
    expect(routeSource).not.toContain(
      'json({ message: "You have already registered for this event pool" })',
    );
  });

  it("ALREADY_REGISTERED maps to governed copy, not the generic fallback", () => {
    const message = getErrorMessage("ALREADY_REGISTERED");
    expect(message).not.toBe(ERROR_CODE_GENERIC_FALLBACK);
    expect(message).toBe("你已经报过名啦");
  });

  it("every machine code in the registration funnel (routes + lib) has a copy template", () => {
    // Systemic guard for the swallowed-error class: any server code without a
    // template collapses to "出了点问题，稍后再试" in the client even when the
    // body carries a human message. Adding a new code here without a template
    // fails this test, forcing the copy contract to stay complete.
    const codes = new Set<string>();
    for (const source of scannedSources) {
      for (const match of source.matchAll(/"([A-Z][A-Z0-9_]{3,})"/g)) {
        codes.add(match[1]);
      }
    }

    expect(codes.size).toBeGreaterThan(0);
    // Anti-vacuity: assert the funnel lib is actually in scope, so this test
    // cannot pass just because it only saw the routes.
    expect(codes.has("INVALID_BUDGET_TIER")).toBe(true);
    expect(codes.has("BUDGET_TIER_REQUIRED")).toBe(true);

    const unmapped = [...codes].filter(
      (code) => getErrorMessage(code as ErrorCode) === ERROR_CODE_GENERIC_FALLBACK,
    );
    expect(unmapped).toEqual([]);
  });

  it("budget-tier validation failures are thrown coded (no code-less budget throw)", () => {
    // The budget validators must throw BudgetTierValidationError with their
    // specific code — never a bare Error whose code falls through to the
    // generic toast. (The unrelated generic safeParse throw is out of scope:
    // the routes already map it to REGISTRATION_FAILED.)
    expect(funnelLibSource).toContain(
      'new BudgetTierValidationError("INVALID_BUDGET_TIER"',
    );
    expect(funnelLibSource).toContain(
      'new BudgetTierValidationError("BUDGET_TIER_REQUIRED"',
    );
  });

  it("both register routes map BudgetTierValidationError to its specific code", () => {
    const branches =
      routeSource.match(/instanceof BudgetTierValidationError/g) ?? [];
    // /register + register-with-payment each need their own catch branch, or
    // one of them falls through to a 500 with the wrong code.
    expect(branches.length).toBeGreaterThanOrEqual(2);
  });
});
