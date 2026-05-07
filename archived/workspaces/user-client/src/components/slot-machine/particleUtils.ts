/**
 * Shared particle animation utilities for slot machine and unlock overlay
 */

export interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
  type?: 'confetti' | 'star' | 'spark';
}

export const CELEBRATION_COLORS = [
  "#a855f7", // purple
  "#ec4899", // pink  
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#facc15", // yellow
  "#f43f5e", // rose
  "#06b6d4", // cyan
];

/**
 * Helper function to convert HSL color to HSLA with alpha channel
 * @param color - HSL color string (e.g., "hsl(220, 50%, 45%)")
 * @param alpha - Alpha value between 0 and 1
 * @returns HSLA color string
 */
export function accentWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }
  return color;
}
