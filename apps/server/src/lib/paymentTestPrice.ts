/**
 * Pure helper for resolving the optional test payment price override.
 *
 * Safety rule: the override is NEVER applied when NODE_ENV=production,
 * so a stray TEST_PAYMENT_PRICE_IN_CENTS value cannot accidentally charge
 * production users a test price. In any other environment (development,
 * staging, test, etc.) the override is honored when set.
 */
export function getTestPriceCents(): number | null {
  if (process.env.NODE_ENV === "production") return null;

  const raw = process.env.TEST_PAYMENT_PRICE_IN_CENTS;
  if (!raw) return null;

  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;

  return n;
}
