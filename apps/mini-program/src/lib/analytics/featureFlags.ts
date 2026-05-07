/**
 * Mini-program feature flags read from build-time env (defineConstants).
 * All flags default to OFF for safe rollout.
 */

/** Xiaoyue connection reactions overlay (Phase 3+). Default: false. */
export function isXiaoyueConnectionReactionsEnabled(): boolean {
  return process.env.TARO_APP_XIAOYUE_CONNECTION_REACTIONS_ENABLED === 'true'
}
