import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ERROR_CODE_GENERIC_FALLBACK,
  getErrorMessage,
} from "@shared/copy/errorBaselines";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const SOCIAL_ROUTE_SOURCE_PATH = "apps/server/src/routes/domains/social.ts";

const FEEDBACK_GATE_CODES = [
  "FEEDBACK_NOT_OPEN",
  "FEEDBACK_NOT_ELIGIBLE",
  "FEEDBACK_ALREADY_SUBMITTED",
] as const;

/**
 * Feedback-activation error-code contract (2026-10-16, plan §4) — same
 * recurrence-lock pattern as registrationErrorCodes.test.ts.
 *
 * POST /api/events/:eventId/feedback rejects with three machine-readable
 * codes. Without a governed template each would collapse to the generic
 * "出了点问题，稍后再试" toast in the mini-program resolveMessage() — wrong
 * for every one of them (not-open is a timing state, ineligible is terminal
 * for this event, already-submitted is a success-adjacent terminal state).
 * The scan is scoped to the FEEDBACK_* codes: unrelated UPPER_SNAKE literals
 * in social.ts (e.g. CONTENT_VIOLATION) carry their own response shape and
 * live outside the ErrorCode union by design.
 */
describe("feedback error-code contract", () => {
  const routeSource = readRepoFile(SOCIAL_ROUTE_SOURCE_PATH);

  it("the POST feedback gate emits all three coded rejections", () => {
    for (const code of FEEDBACK_GATE_CODES) {
      expect(routeSource).toContain(`code: "${code}"`);
    }
  });

  it("each feedback code maps to governed copy, not the generic fallback", () => {
    for (const code of FEEDBACK_GATE_CODES) {
      expect(getErrorMessage(code)).not.toBe(ERROR_CODE_GENERIC_FALLBACK);
    }
  });

  it("governed copy stays in the locked 排桌/合拍 vocabulary", () => {
    expect(getErrorMessage("FEEDBACK_NOT_OPEN")).toBe("活动还没结束，结束后再来聊聊感受吧");
    expect(getErrorMessage("FEEDBACK_NOT_ELIGIBLE")).toBe("这场活动未成行，无法评价");
    expect(getErrorMessage("FEEDBACK_ALREADY_SUBMITTED")).toBe("你已经评价过这场活动啦");
  });

  it("route messages mirror the shared templates verbatim (no server/client drift)", () => {
    for (const code of FEEDBACK_GATE_CODES) {
      expect(routeSource).toContain(`code: "${code}", message: "${getErrorMessage(code)}"`);
    }
  });

  it("the feedback-state GET route exists and its 500 carries a code", () => {
    // Fail-closed-to-ineligible on transport errors would hide the CTA for
    // eligible users; the contract is a coded 500 the client can retry.
    expect(routeSource).toContain("app.get('/api/events/:eventId/feedback-state'");
    expect(routeSource).toContain('code: "server"');
    expect(getErrorMessage("server")).not.toBe(ERROR_CODE_GENERIC_FALLBACK);
  });

  it("the POST gate runs before content moderation (rejections never burn tier-1 budget)", () => {
    const gateIndex = routeSource.indexOf("resolveFeedbackState(routeEventId, userId)");
    const moderationIndex = routeSource.indexOf('validateContentSafe(fieldText, "eventFeedback")');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(moderationIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(moderationIndex);
  });
});
