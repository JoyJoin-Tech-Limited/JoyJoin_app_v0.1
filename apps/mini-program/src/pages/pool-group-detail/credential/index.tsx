import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPoolGroupDetails, type PoolGroupDetailsResponse } from '@shared/api'
import {
  VENUE_DEAL_BACK,
  VENUE_DEAL_CODE_HINT,
  VENUE_DEAL_CODE_PLAQUE_LABEL,
  VENUE_DEAL_COPIED_ACTION,
  VENUE_DEAL_COPY_CODE,
  VENUE_DEAL_CREDENTIAL_TITLE,
  VENUE_DEAL_CREDENTIAL_WORDMARK,
  VENUE_DEAL_RULE_LINE,
  VENUE_DEAL_FEE_BOUNDARY_LINE,
  VENUE_DEAL_SEAL_TEXT,
  VENUE_DEAL_SEAL_COPIED_TEXT,
  VENUE_DEAL_SET_MENU_CREDENTIAL_PRICE_NOTE,
  VENUE_DEAL_SET_MENU_PLAQUE_LABEL,
  VENUE_DEAL_SHOW_PAGE_HINT,
  VENUE_DEAL_SHOW_PAGE_SUBTITLE,
  VENUE_DEAL_SHOW_PAGE_DISCOUNT_SUBTITLE,
  VENUE_DEAL_SHOW_PAGE_PLAQUE_LABEL,
  VENUE_DEAL_UNAVAILABLE_HINT,
  VENUE_DEAL_UNAVAILABLE_TITLE,
  VENUE_DEAL_LOAD_ERROR_TITLE,
  VENUE_DEAL_LOAD_ERROR_HINT,
  VENUE_DEAL_CARD_RETRY,
  formatDiscountLabel,
  formatSetMenuPriceLabel,
  formatVenueDealCopyFailure,
  getVenueDealSetMenuOriginalText,
  getVenueDealTableText,
  getVenueDealValueText,
} from '@shared/copy/venueDealCopy'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { apiRequest } from '../../../lib/api/api'
import {
  trackVenueDealCredentialPresent,
  trackVenueDealRedeemPageOpen,
} from '../../../lib/analytics/venueDealAnalytics'
import { formatEventFactDateTime } from '../../../lib/utils/eventDisplay'
import { getSystemReducedMotionCompat } from '../../../lib/utils/systemInfo'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import useCredentialScreen from './useCredentialScreen'
import './index.scss'

export default function PoolGroupCredentialPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const flagEnabled = currentUser?.features?.venueDealsEnabled === true
  const { data, error, isLoading, refetch } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: Boolean(groupId) && flagEnabled && !authLoading,
    staleTime: 30_000,
  })

  const group = data?.group
  const pool = data?.pool
  const deal = group?.venueDeal ?? null
  const canPresent = Boolean(
    flagEnabled
      && !error
      && groupId
      && group
      && group.venueAssignmentStatus === 'assigned'
      && deal
      && getVenueDealValueText(deal)
      && (deal.method !== 'code' || Boolean(deal.code?.trim())),
  )

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copied = copyState === 'copied'
  const screenStatus = useCredentialScreen(canPresent)
  const { isDegradation } = useDeviceTier()
  const reduceMotion = isDegradation || getSystemReducedMotionCompat()
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedAtRef = useRef<number | null>(null)
  const redeemOpenTrackedRef = useRef(false)
  const credentialPresentTrackedRef = useRef(false)

  useEffect(() => {
    setCopyState('idle')
    credentialPresentTrackedRef.current = false
  }, [groupId, deal?.id])

  useEffect(() => {
    if (!canPresent || reduceMotion) return undefined
    hapticTimer.current = setTimeout(() => {
      try {
        void Taro.vibrateShort?.({ type: 'light' })?.catch(() => {})
      } catch {
        // 触觉只是仪式感增强，失败不影响出示
      }
    }, 240)
    return () => {
      if (hapticTimer.current) clearTimeout(hapticTimer.current)
    }
  }, [canPresent, reduceMotion])

  useEffect(() => {
    if (!canPresent || !deal || !pool?.id) return
    if (openedAtRef.current === null) openedAtRef.current = Date.now()
    const input = { poolId: pool.id, groupId, deal }
    if (!redeemOpenTrackedRef.current) {
      redeemOpenTrackedRef.current = true
      trackVenueDealRedeemPageOpen(input)
    }
    if (deal.method === 'show_page' && !credentialPresentTrackedRef.current) {
      credentialPresentTrackedRef.current = true
      trackVenueDealCredentialPresent(input, (Date.now() - openedAtRef.current) / 1000)
    }
  }, [canPresent, deal, pool?.id, groupId])

  const dateTime = group?.finalDateTime ?? pool?.dateTime ?? null
  const dateText = dateTime ? formatEventFactDateTime(dateTime) : ''
  const isSetMenu = deal?.kind === 'set_menu'
  const isCode = deal?.method === 'code'
  const plaqueText = isSetMenu ? deal?.title ?? '' : isCode ? deal?.code ?? '' : deal?.title ?? ''
  const benefitText = useMemo(() => {
    if (!deal) return ''
    if (isSetMenu) {
      return `${formatSetMenuPriceLabel(deal.setMenuPriceCents ?? Number.NaN)} · ${VENUE_DEAL_SET_MENU_CREDENTIAL_PRICE_NOTE}`
    }
    const discount = formatDiscountLabel(deal.valueOffPercent ?? Number.NaN)
    return isCode ? `${deal.title} · ${discount}` : discount
  }, [deal, isCode, isSetMenu])
  const ruleText = isSetMenu
    ? `${getVenueDealSetMenuOriginalText(deal?.setMenuOriginalPriceCents ?? Number.NaN)} · ${VENUE_DEAL_RULE_LINE}`
    : VENUE_DEAL_RULE_LINE

  const close = () => {
    void Taro.navigateBack().catch(() => {
      if (groupId) {
        void Taro.redirectTo({ url: `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}` })
      }
    })
  }

  const copyCode = async () => {
    if (!deal || !isCode || !deal.code?.trim()) return
    const code = deal.code.trim()
    try {
      await Taro.setClipboardData({ data: code })
      setCopyState('copied')
      if (pool?.id && !credentialPresentTrackedRef.current) {
        credentialPresentTrackedRef.current = true
        const openedAt = openedAtRef.current ?? Date.now()
        trackVenueDealCredentialPresent(
          { poolId: pool.id, groupId, deal },
          (Date.now() - openedAt) / 1000,
        )
      }
    } catch {
      setCopyState('failed')
    }
  }

  if (authLoading || (flagEnabled && Boolean(groupId) && isLoading)) {
    return <LoadingScreen />
  }

  return (
    <View className={`deal-credential${reduceMotion ? ' deal-credential--still' : ''}`}>
      <View className='deal-credential__nav'>
        <View
          className='deal-credential__close'
          role='button'
          aria-label={VENUE_DEAL_BACK}
          data-testid='credential-close'
          onClick={close}
        >
          <Text className='deal-credential__close-glyph' aria-hidden='true'>‹</Text>
        </View>
        <Text className='deal-credential__wordmark'>{VENUE_DEAL_CREDENTIAL_WORDMARK}</Text>
      </View>

      {!canPresent || !deal || !group ? (
        <View className='deal-credential__unavailable'>
          <Text className='deal-credential__unavailable-title'>
            {error ? VENUE_DEAL_LOAD_ERROR_TITLE : VENUE_DEAL_UNAVAILABLE_TITLE}
          </Text>
          <Text className='deal-credential__unavailable-hint'>
            {error ? VENUE_DEAL_LOAD_ERROR_HINT : VENUE_DEAL_UNAVAILABLE_HINT}
          </Text>
          {error ? (
            <View
              className='deal-credential__unavailable-action'
              role='button'
              data-testid='credential-retry'
              onClick={() => { void refetch() }}
            >
              <Text>{VENUE_DEAL_CARD_RETRY}</Text>
            </View>
          ) : null}
          <View className='deal-credential__unavailable-action' role='button' onClick={close}>
            <Text>{VENUE_DEAL_BACK}</Text>
          </View>
        </View>
      ) : (
        <>
          <Text className='deal-credential__title'>{VENUE_DEAL_CREDENTIAL_TITLE}</Text>
          <View className='deal-credential__paper'>
            <View className='deal-credential__meta'>
              <Text className='deal-credential__venue'>{deal.venueName}</Text>
              <Text className='deal-credential__meta-sub'>
                {dateText} · {getVenueDealTableText(group.memberCount)}
              </Text>
            </View>
            <View className='deal-credential__code'>
              <Text className='deal-credential__code-label'>
                {isSetMenu
                  ? VENUE_DEAL_SET_MENU_PLAQUE_LABEL
                  : isCode
                    ? VENUE_DEAL_CODE_PLAQUE_LABEL
                    : VENUE_DEAL_SHOW_PAGE_PLAQUE_LABEL}
              </Text>
              <Text
                className={`deal-credential__code-text${isSetMenu ? ' deal-credential__code-text--set-menu' : ''}`}
                data-testid='credential-code'
              >
                {plaqueText}
              </Text>
            </View>
            <View className='deal-credential__value'>
              <Text className='deal-credential__value-main'>{benefitText}</Text>
              <Text className='deal-credential__value-sub'>{ruleText}</Text>
            </View>
            <View className={`deal-credential__seal${copied ? ' deal-credential__seal--done' : ''}`} aria-hidden='true'>
              <Text className='deal-credential__seal-text'>{copied ? VENUE_DEAL_SEAL_COPIED_TEXT : VENUE_DEAL_SEAL_TEXT}</Text>
            </View>
          </View>

          {isCode ? (
            <View className='deal-credential__action-block'>
              <View
                className={`deal-credential__copy${copied ? ' deal-credential__copy--done' : ''}`}
                role='button'
                aria-label={copied ? VENUE_DEAL_COPIED_ACTION : VENUE_DEAL_COPY_CODE}
                data-testid='credential-copy'
                onClick={() => { void copyCode() }}
              >
                <Text>{copied ? VENUE_DEAL_COPIED_ACTION : VENUE_DEAL_COPY_CODE}</Text>
              </View>
              <Text className='deal-credential__hint'>
                {copyState === 'failed'
                  ? formatVenueDealCopyFailure(deal.code?.trim() ?? '')
                  : copied
                    ? VENUE_DEAL_CODE_HINT
                    : VENUE_DEAL_CODE_HINT}
              </Text>
            </View>
          ) : (
            <View className='deal-credential__action-block'>
              <Text className='deal-credential__show-note'>{VENUE_DEAL_SHOW_PAGE_HINT}</Text>
              <Text className='deal-credential__hint'>
                {isSetMenu ? VENUE_DEAL_SHOW_PAGE_SUBTITLE : VENUE_DEAL_SHOW_PAGE_DISCOUNT_SUBTITLE}
              </Text>
            </View>
          )}

          <Text className='deal-credential__rule'>{VENUE_DEAL_FEE_BOUNDARY_LINE}</Text>
          {screenStatus ? (
            <View className='deal-credential__screen-status'>
              <Text className='deal-credential__screen-dot' aria-hidden='true' />
              <Text>{screenStatus}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}
