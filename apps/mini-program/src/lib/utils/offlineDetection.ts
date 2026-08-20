/**
 * Connectivity heuristics shared across onboarding surfaces (2026-08-18).
 * Mirrors the offline branch used by the personality-test ErrorStage so all
 * three onboarding pages classify "network gone" the same way: explicit
 * networkType checks for pre-flight, message heuristics for catch blocks.
 */

/** Unified pre-flight offline toast copy (personality-test norm). */
export const OFFLINE_PREFLIGHT_COPY = '网络好像断开了，连上后再试试'

/**
 * Heuristic: is the error most plausibly a connectivity failure rather than
 * a server-side rejection? Keep in sync with the ErrorStage logic.
 */
export function looksLikeOfflineError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : ''
  return /network|offline|timeout|abort|failed to fetch|网络|超时|断/i.test(message)
}
