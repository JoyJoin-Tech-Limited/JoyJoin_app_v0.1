/**
 * Unified check for single-test debug mode.
 *
 * Returns true when ENABLE_SINGLE_TEST_MODE=true OR APP_MODE=test.
 * This decouples the single-test debug surface (virtual users, single-test pool,
 * SingleTestBanner) from the strict APP_MODE=test gate, allowing staging
 * (APP_MODE=staging) to enable single-test mode independently via the
 * ENABLE_SINGLE_TEST_MODE env var without affecting auth strategy, DB selection,
 * or other APP_MODE=test behaviour.
 */
export function isSingleTestMode(): boolean {
  if (process.env.ENABLE_SINGLE_TEST_MODE === 'true') {
    return true;
  }
  return (process.env.APP_MODE ?? 'production') === 'test';
}

/**
 * Strict gate for matching-test mode.
 *
 * Returns true only when single-test mode is active AND the explicit
 * ENABLE_MATCHING_TEST_MODE flag is set. Production is always false.
 */
export function isMatchingTestMode(): boolean {
  if (process.env.APP_MODE === 'production') {
    return false;
  }
  return isSingleTestMode() && process.env.ENABLE_MATCHING_TEST_MODE === 'true';
}

/**
 * Staging-only gate for lightweight bot fill on admin-marked test pools.
 */
export function isBotFillForTestingEnabled(): boolean {
  return process.env.APP_MODE !== 'production' && process.env.ENABLE_BOT_FILL_FOR_TESTING === 'true';
}
