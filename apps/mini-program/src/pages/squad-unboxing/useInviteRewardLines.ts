import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { getUserCoupons, type EntitlementMode } from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { switchToDiscoverTab } from '../../lib/navigation/matchingNavigation'
import { haptics } from '../../lib/utils/haptics'
import { findRecentInviteReward } from './inviteReward'

/**
 * 成功遮罩上的到账/权益行 (2026-10-14 PRD E19), extracted from the page so
 * `index.tsx` stays under the harness file-size warn band.
 *
 * - rewardLine: an available `invitation_reward` coupon issued within 72h —
 *   seeing that the last invite paid off is the strongest next-invite driver.
 *   Reuses the rewards page's shared query-cache key (['mini-program','coupons']).
 *   Selection logic lives in the pure `inviteReward.ts` (unit-tested).
 * - entitlementLine: pack/subscription users get a factual nudge back to
 *   Discover. Deliberately count-free — no client endpoint exposes the
 *   remaining credit count (PRD dependency clause, degraded).
 *
 * Fail-closed contract: any miss (no coupon / stale coupon / query error /
 * no entitlement) resolves to undefined — the overlay renders no placeholder.
 */
export interface InviteRewardLinesInput {
  /** Gate for the coupons query (reveal state up, auth settled). */
  enabled: boolean
  /** Lines only render once the success overlay is actually shown. */
  showSuccessOverlay: boolean
  entitlementMode?: EntitlementMode | null
}

export interface InviteRewardLines {
  rewardLine?: string
  entitlementLine?: string
  handleRewardTap: () => void
  handleEntitlementTap: () => void
}

export function useInviteRewardLines({
  enabled,
  showSuccessOverlay,
  entitlementMode,
}: InviteRewardLinesInput): InviteRewardLines {
  const couponsQuery = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled,
    staleTime: 30_000,
  })

  const rewardLine = useMemo(() => {
    if (!showSuccessOverlay) return undefined
    const recent = findRecentInviteReward(couponsQuery.data?.coupons ?? [], Date.now())
    if (!recent) return undefined
    const amount = recent.discountType === 'fixed_amount' && typeof recent.discountValue === 'number'
      ? ` ¥${Math.floor(recent.discountValue / 100)}`
      : ''
    return `你的同行邀请奖励${amount}券已放进卡包 · 去看看`
  }, [showSuccessOverlay, couponsQuery.data])

  const entitlementLine = useMemo(() => {
    if (!showSuccessOverlay) return undefined
    return entitlementMode === 'subscription' || entitlementMode === 'event_pack'
      ? '权益生效中 · 去挑下一场'
      : undefined
  }, [showSuccessOverlay, entitlementMode])

  const handleRewardTap = useCallback(() => {
    haptics('light')
    Taro.navigateTo({ url: '/pages/profile-linked/rewards/index' })
  }, [])

  const handleEntitlementTap = useCallback(() => {
    haptics('light')
    switchToDiscoverTab()
  }, [])

  return { rewardLine, entitlementLine, handleRewardTap, handleEntitlementTap }
}
