/**
 * Haptic Feedback Utility
 * 
 * Provides consistent haptic feedback patterns across the app.
 * Uses the Web Vibration API where supported.
 */
export const haptics = {
  /** Light tap - for subtle confirmations */
  light: () => navigator.vibrate?.(10),
  /** Medium tap - for selections and actions */
  medium: () => navigator.vibrate?.(50),
  /** Heavy tap - for important actions */
  heavy: () => navigator.vibrate?.([50, 30, 50]),
  /** Success pattern - for completions */
  success: () => navigator.vibrate?.([30, 50, 100]),
  /** Error pattern - for errors */
  error: () => navigator.vibrate?.([100, 30, 100]),
};

export default haptics;
