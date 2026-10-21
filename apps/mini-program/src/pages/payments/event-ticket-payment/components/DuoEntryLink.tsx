import { useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getDuoStatus } from '../../../../lib/api/duo'
import { apiRequest } from '../../../../lib/api/api'
import { haptics } from '../../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../../lib/analytics/discoverAnalytics'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboarding/onboardingRoutes'

interface DuoEntryLinkProps {
  poolId: string
  /**
   * Page-level gate (T46 P1a, AC-07): logged-in + pool checkout scenario +
   * duo flag on. When false the duo-status read never fires and the row
   * renders nothing.
   */
  enabled: boolean
}

/**
 * T46 P1a (AC-07) checkout duo entry — a quiet text-link row in the trust
 * cluster (trust row → duo entry → refund policy link), same register as
 * `ticket-refund-link`: one line of text + › + hoverClass tint. Not a card,
 * not a button, not a badge — the single solid primary CTA keeps the only
 * visual weight on this screen. Zero amounts and zero urgency copy: the
 * reward rules live only on the invite landing page.
 *
 * Fail-closed visibility: an independent duo-status read gates the row. While
 * loading, on error, or whenever the reader already has a duo lane in flight
 * (state `waiting` / `bound`), the row renders NOTHING — no skeleton, no
 * placeholder — and never blocks the checkout first paint. Only a clean
 * `none` state reveals the row.
 */
export default function DuoEntryLink({ poolId, enabled }: DuoEntryLinkProps) {
  const { data, isSuccess } = useQuery({
    queryKey: ['mini-program', 'duo-status', poolId],
    queryFn: () => getDuoStatus(apiRequest, poolId),
    enabled: enabled && Boolean(poolId),
    staleTime: 60 * 1000,
    retry: false,
  })

  const visible = isSuccess && data?.state === 'none'
  const impressionTrackedRef = useRef(false)

  // Row impression — once per page visit (ref dedup, same discipline as the
  // refund-guarantee meter), and only when the row is actually rendered.
  useEffect(() => {
    if (!visible || impressionTrackedRef.current) return
    impressionTrackedRef.current = true
    discoverAnalytics.trackDuoEntryLinkImpression({ poolId })
  }, [visible, poolId])

  const handleTap = () => {
    haptics('light')
    discoverAnalytics.trackDuoEntryLinkTap({ poolId })
    Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })
  }

  if (!visible) return null

  return (
    <View
      className='ticket-duo-link'
      hoverClass='ticket-duo-link--pressed'
      role='button'
      aria-label='和朋友一起？邀 TA 同行，排进同一桌'
      onClick={handleTap}
    >
      <Text className='ticket-duo-link__text'>和朋友一起？邀 TA 同行，排进同一桌</Text>
      <Text className='ticket-duo-link__hint'>同行有奖励</Text>
      <Text className='ticket-duo-link__arrow'>›</Text>
    </View>
  )
}
