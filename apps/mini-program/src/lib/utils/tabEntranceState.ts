/**
 * Tracks whether the tab-page entrance animation has already played.
 *
 * WeChat tab pages are unmounted/remounted on every switch, so applying the
 * entrance class unconditionally makes each switch fade in from opacity 0.
 * This module lets the first tab shown after app launch keep the animation,
* while subsequent switches render instantly.
 */
let hasPlayedTabEntrance = false

/**
 * Consume the one-time tab entrance animation flag.
 * Returns true only on the first call in the current JS context (i.e. the
 * first tab page rendered after app cold start).
 */
export function consumeTabEntrance(): boolean {
  if (hasPlayedTabEntrance) return false
  hasPlayedTabEntrance = true
  return true
}

/**
 * Reset the flag. Useful for tests or when explicitly reloading the tab bar.
 */
export function resetTabEntranceState(): void {
  hasPlayedTabEntrance = false
}
