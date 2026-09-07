/**
 * Convert a hex accent color to rgba() for inline shadows/glows.
 * Avoids 8-digit hex alpha, which older WeChat base libraries may not parse.
 * Handles both `#RGB` and `#RRGGBB`.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const bigint = parseInt(full, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
