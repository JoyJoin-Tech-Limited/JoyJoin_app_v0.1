/**
 * Shared 「有效期至 M月D日」 label for coupon surfaces (WelcomeGiftCard,
 * UnboxingCeremony gift row, FirstTimeCouponBanner precedent).
 *
 * Formatting matches FirstTimeCouponBanner exactly: local-timezone month/day,
 * no year. Fail-closed — absent or unparseable input returns null so callers
 * render nothing rather than inventing an expiry.
 */
export function formatCouponValidUntilLabel(validUntil?: string | null): string | null {
  if (!validUntil) return null
  try {
    const d = new Date(validUntil)
    if (Number.isNaN(d.getTime())) return null
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return null
  }
}
