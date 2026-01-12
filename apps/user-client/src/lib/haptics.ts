/**
 * Haptic Feedback Utility
 * 
 * Provides consistent haptic feedback patterns across the app.
 * Uses the Web Vibration API where supported.
 */

/**
 * Safe vibrate wrapper that checks for navigator and vibrate function availability
 */
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  /** Light tap - for subtle confirmations */
  light: () => vibrate(10),
  /** Medium tap - for selections and actions */
  medium: () => vibrate(50),
  /** Heavy tap - for important actions */
  heavy: () => vibrate([50, 30, 50]),
  /** Success pattern - for completions */
  success: () => vibrate([30, 50, 100]),
  /** Error pattern - for errors */
  error: () => vibrate([100, 30, 100]),
};

export default haptics;
