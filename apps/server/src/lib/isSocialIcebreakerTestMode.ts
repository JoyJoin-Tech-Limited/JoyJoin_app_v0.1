/**
 * Fail-closed gate for Social Icebreaker test-mode bot simulation.
 *
 * Returns true only when ALL of the following hold:
 *  - APP_MODE is not 'production'
 *  - single-test mode is active (isSingleTestMode())
 *  - SOCIAL_ICEBREAKER_TEST_MODE_ENABLED is 'true'
 *
 * This is intentionally stricter than isSingleTestMode() so that the
 * single-test debug surface (pool, registrations, SingleTestBanner) can be
 * enabled in staging without automatically exposing the bot-simulation
 * harness that lets virtual users participate in real phase engines.
 */
import { isSingleTestMode } from "./isSingleTestMode";

export function isSocialIcebreakerTestMode(): boolean {
  if (process.env.APP_MODE === "production") {
    return false;
  }
  if (!isSingleTestMode()) {
    return false;
  }
  return process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED === "true";
}
