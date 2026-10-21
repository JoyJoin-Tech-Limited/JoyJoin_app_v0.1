import { createHash } from "node:crypto";

/**
 * T46 P0d (2026-10-21) — deterministic 50/50 experiment bucketing.
 *
 * Used by the checkout refund-narrative 50/50灰度 (decision D1): the bucket
 * rides the event-ticket checkout first-screen payload
 * (GET /api/payments/ritual-context) and decides whether the client renders
 * the two-line refund-guarantee stack (bucket = 1) or the legacy single line
 * (bucket = 0). The `checkout_cancel_rate` guardrail is compared per bucket.
 *
 * Algorithm (documented, stable):
 *   bucket = parseInt(sha256(userId, utf8).hex.slice(0, 8), 16) % 2
 *
 * Stability argument:
 * - sha256 is a fixed NIST standard; Node's `node:crypto` implementation is
 *   not versioned by V8 or JS engine state, so the digest is identical across
 *   processes, restarts, and machines. No randomness, no time, no locale.
 * - Trimming to the first 8 hex chars yields a uniform 32-bit unsigned int
 *   for uniform input; `% 2` extracts bit 0, which stays uniform (mod-2 of a
 *   uniform int is unbiased — no low-bit correlation is known for SHA-2).
 * - Zero external dependencies (node:crypto only).
 *
 * Fail-closed: invalid input (empty/blank/non-string) never throws and always
 * maps to the control bucket 0 (status-quo single line), so a malformed id
 * can never silently promote a user into the treatment variant.
 */

export type ExperimentBucket = 0 | 1;

/** Control bucket: legacy single-line checkout rendering. */
export const EXPERIMENT_BUCKET_CONTROL: ExperimentBucket = 0;

function isValidUserId(userId: unknown): userId is string {
  return typeof userId === "string" && userId.trim().length > 0;
}

export function resolveExperimentBucket(userId: unknown): ExperimentBucket {
  if (!isValidUserId(userId)) {
    return EXPERIMENT_BUCKET_CONTROL;
  }
  const digest = createHash("sha256").update(userId, "utf8").digest("hex");
  const head32 = Number.parseInt(digest.slice(0, 8), 16);
  return head32 % 2 === 0 ? 0 : 1;
}
