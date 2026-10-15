import type { UserCouponSummary } from '@shared/api'

/**
 * Pure selector for the 成功遮罩 invite-reward arrival line (2026-10-14 PRD
 * E19). Kept dependency-free so it is unit-testable in a node environment
 * (the hook module pulls Taro/React and cannot be imported there).
 *
 * Window: a reward issued more than 72h ago no longer reads as "just
 * arrived" — showing it would be a stale claim, so the line fails closed.
 */
export const INVITE_REWARD_RECENT_WINDOW_MS = 72 * 60 * 60 * 1000

export function findRecentInviteReward(
  coupons: UserCouponSummary[],
  now: number,
  windowMs: number = INVITE_REWARD_RECENT_WINDOW_MS,
): UserCouponSummary | undefined {
  return coupons.find((coupon) => {
    if (coupon.source !== 'invitation_reward' || coupon.status !== 'available') return false
    const created = coupon.createdAt ? Date.parse(coupon.createdAt) : Number.NaN
    return Number.isFinite(created) && now - created < windowMs
  })
}
