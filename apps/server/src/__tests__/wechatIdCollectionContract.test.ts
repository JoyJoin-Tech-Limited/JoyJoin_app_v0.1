import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ERROR_CODE_GENERIC_FALLBACK,
  getErrorMessage,
} from "@shared/copy/errorBaselines";

/**
 * WeChat-ID collection chain contract (2026-10-16, spec
 * docs/design/wechat-id-collection-spec-20261016.md).
 *
 * Recurrence lock across the five files that must stay in lock-step for the
 * post-event feedback collection step (A) + revealed-page remedy card (C):
 *   - flag registration + auth exposure (kill switch must ship dark)
 *   - feedback-POST backfill hardening (invalid value never 400s the
 *     submission — the ID is an accessory field)
 *   - set-once self-service endpoint (C 通路, governed error codes)
 *   - connections read-path COALESCE fallback (a remedy save must become
 *     visible in the 连接 tab, not just the reveal response)
 *   - analytics allowlist (the six funnel events; client-union parity is
 *     enforced separately by feedbackAnalyticsAllowlistContract.test.ts)
 *
 * Same source-scan pattern as socialComplianceWriteFreezes.test.ts and
 * registrationErrorCodes.test.ts.
 */

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const FEATURE_FLAGS = "apps/server/src/lib/featureFlags.ts";
const AUTH_RESPONSE = "apps/server/src/lib/buildAuthUserResponse.ts";
const SOCIAL_ROUTE = "apps/server/src/routes/domains/social.ts";
const PROFILE_ROUTE = "apps/server/src/routes/domains/profile.ts";
const CONNECTIONS_REPO = "apps/server/src/repositories/connectionsRepo.ts";
const ANALYTICS_ROUTE = "apps/server/src/routes/domains/analytics.ts";

const WECHAT_EVENTS = [
  "feedback_wechat_step_shown",
  "feedback_wechat_saved",
  "feedback_wechat_skipped",
  "feedback_wechat_invalid",
  "feedback_wechat_remedy_saved",
  "feedback_wechat_remedy_failed",
] as const;

describe("wechat-id collection chain contract", () => {
  it("registers the kill switch and ships it dark", () => {
    const source = readRepoFile(FEATURE_FLAGS);
    expect(source).toContain(
      'wechatIdCollectionEnabled: "WECHAT_ID_COLLECTION_ENABLED"',
    );
    // DEFAULT_FLAG_VALUES must pin false: the flag is flipped only after the
    // pre-launch baseline SQL (spec §8) is captured.
    expect(source).toMatch(/DEFAULT_FLAG_VALUES[\s\S]*wechatIdCollectionEnabled: false/);
  });

  it("exposes the flag on the auth payload (destructure + resolve + features)", () => {
    const source = readRepoFile(AUTH_RESPONSE);
    const occurrences = source.match(/wechatIdCollectionEnabled/g) ?? [];
    // Once in the Promise.all destructure, once in the getFeatureFlag call,
    // once in the features object. Fewer means exposure is half-wired.
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("getFeatureFlag('wechatIdCollectionEnabled', false)");
  });

  it("keeps the feedback backfill format-hardened and never able to 400 the submission", () => {
    const source = readRepoFile(SOCIAL_ROUTE);
    expect(source).toContain("validateWechatContactId");
    expect(source).toContain("storage.updateUserWechatId(");
    // The feedback route must never surface INVALID_WECHAT_CONTACT_ID: an
    // invalid accessory value is skipped with a warn, never a rejection.
    // (The code belongs to the set-once endpoint in profile.ts.)
    expect(source).not.toContain("INVALID_WECHAT_CONTACT_ID");
  });

  it("keeps the set-once endpoint flagged, validated, and idempotent", () => {
    const source = readRepoFile(PROFILE_ROUTE);
    expect(source).toContain("'/api/user/wechat-contact'");
    expect(source).toContain("WECHAT_ID_COLLECTION_DISABLED");
    expect(source).toContain("validateWechatContactId");
    expect(source).toContain("INVALID_WECHAT_CONTACT_ID");
    expect(source).toContain("unchanged: true");
    expect(source).toContain("storage.updateUserWechatId(");
  });

  it("keeps the connections read path COALESCE-fallbacking to the live value", () => {
    const source = readRepoFile(CONNECTIONS_REPO);
    // Without the fallback, a remedy-card save (set after the mutual flip)
    // stays invisible in the 连接 tab forever — the dead-end C was fixed for.
    expect(source).toMatch(/peerWechatId:[\s\S]{0,220}COALESCE/);
    expect(source).toContain("users.wechatContactId");
  });

  it("registers all six collection events in the analytics allowlist", () => {
    const source = readRepoFile(ANALYTICS_ROUTE);
    const missing = WECHAT_EVENTS.filter(
      (eventType) => !source.includes(`"${eventType}"`),
    );
    expect(missing).toEqual([]);
  });

  it("ships a governed error template for INVALID_WECHAT_CONTACT_ID", () => {
    // Without a template the client collapses to the generic
    // "出了点问题，稍后再试" toast (2026-09-10 error-code contract class).
    expect(getErrorMessage("INVALID_WECHAT_CONTACT_ID")).not.toBe(
      ERROR_CODE_GENERIC_FALLBACK,
    );
  });
});
