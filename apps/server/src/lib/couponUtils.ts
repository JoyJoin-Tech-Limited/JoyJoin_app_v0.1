/**
 * Normalize a DB timestamp into an ISO-8601 string.
 * Accepts Date, string, number, or null/undefined and returns a safe fallback.
 */
export function normalizeCouponTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  return new Date().toISOString()
}
