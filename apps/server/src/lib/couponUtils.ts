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

/**
 * Normalize an optional DB timestamp into an ISO-8601 string, preserving
 * absence: null/undefined/unparseable values return null (no "now" fallback).
 * Used for informational fields like coupon `valid_until` where inventing a
 * timestamp would mislead the client.
 */
export function normalizeOptionalCouponTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
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
  return null
}
