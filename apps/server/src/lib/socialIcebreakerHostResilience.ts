/**
 * Social Icebreaker host-resilience config + pure eligibility math (W1).
 *
 * Host loss must never freeze a session: once the designated host has been
 * silent past a bounded grace window, any remaining participant may claim the
 * host role through `POST /api/social-icebreaker/:id/transfer-host`.
 *
 * This module is intentionally dependency-free so the grace window can be
 * unit-tested deterministically. It deliberately does NOT read from
 * `featureFlags.ts` (owned elsewhere); the window is a dedicated env var.
 */

/** Default host heartbeat silence before a claim is allowed: 3 minutes. */
export const SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS = 180_000;

/**
 * Resolve the claim grace window from the environment.
 *
 * Malformed / non-positive values fall back to the default rather than
 * disabling the safety window (fail-safe, never fail-open).
 */
export function getHostClaimGraceMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS;
  if (raw === undefined || raw === '') return SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS;
  return parsed;
}

export interface HostClaimEligibility {
  /** True when the host has been silent for at least `graceMs`. */
  eligible: boolean;
  /** Observed host silence in ms (floored at 0). */
  hostSilenceMs: number;
  /** The timestamp the silence was measured from (host heartbeat, else session start). */
  referenceAtMs: number;
  /** The grace window the decision used. */
  graceMs: number;
}

/**
 * Decide whether a host claim is allowed.
 *
 * `hostLastSeenAtMs` is the host's latest heartbeat. When the host has never
 * joined (no participant row) we fall back to the session start, so a session
 * whose host never showed up becomes claimable after the same bounded grace —
 * it can never be claimed instantly.
 */
export function evaluateHostClaimEligibility(input: {
  hostLastSeenAtMs: number | null;
  sessionStartedAtMs: number;
  now: number;
  graceMs: number;
}): HostClaimEligibility {
  const referenceAtMs = input.hostLastSeenAtMs ?? input.sessionStartedAtMs;
  const hostSilenceMs = Math.max(0, input.now - referenceAtMs);
  return {
    eligible: hostSilenceMs >= input.graceMs,
    hostSilenceMs,
    referenceAtMs,
    graceMs: input.graceMs,
  };
}
