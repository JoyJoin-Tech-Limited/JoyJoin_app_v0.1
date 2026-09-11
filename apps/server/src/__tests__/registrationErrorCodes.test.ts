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

/**
 * Duplicate-registration error contract (2026-09-10 duplicate-submit trap fix).
 *
 * Root cause regression: POST /api/event-pools/:id/register returned its
 * "already registered" 400s with NO machine-readable code, while the sibling
 * register-with-payment route already used code ALREADY_REGISTERED. The
 * mini-program resolveMessage() maps any code-less/unmapped error to the
 * generic "出了点问题，稍后再试" toast + "提交没成功 / 重新提交" error card —
 * a dead-end, because the retry can never succeed (the row exists). The
 * trap is reachable via double-confirm (optimistic coalescing re-fires a
 * held duplicate), a retry after a network-swallowed success, or a
 * payment-fulfillment-created registration missed by a stale cache.
 */
describe("duplicate pool registration error contract", () => {
  const routeSource = readRepoFile("apps/server/src/routes/domains/userEventPools.ts");

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

  it("every machine code emitted by the register routes has a copy template", () => {
    // Systemic guard for the swallowed-error class: any server code without a
    // template collapses to "出了点问题，稍后再试" in the client even when the
    // body carries a human message. Adding a new code here without a template
    // fails this test, forcing the copy contract to stay complete.
    const codes = new Set(
      (routeSource.match(/code:\s*"([A-Z][A-Z0-9_]*)"/g) ?? []).map((m) =>
        m.replace(/code:\s*"/, "").replace(/"$/, ""),
      ),
    );
    expect(codes.size).toBeGreaterThan(0);
    const unmapped = [...codes].filter(
      (code) => getErrorMessage(code as ErrorCode) === ERROR_CODE_GENERIC_FALLBACK,
    );
    expect(unmapped).toEqual([]);
  });
});
