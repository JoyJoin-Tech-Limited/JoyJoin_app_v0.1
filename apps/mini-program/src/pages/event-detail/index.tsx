import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type BlindBoxEventDetail, getEventFeedbackState, getJoinedEvents } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { haptics } from '../../lib/utils/haptics'
import { TOAST_DEFAULT_MS } from '../../lib/utils/uiConstants'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import EventFlowStrip from '../../components/event-detail/EventFlowStrip'
import EventFaqAccordion from '../../components/event-detail/EventFaqAccordion'
import { loadEventDetail } from './eventDetailData'
import { formatEventDateTime, getEventPoolStatusLabel } from '../../lib/utils/eventDisplay'
import { isWithinPoolIcebreakerWindow } from '../../lib/utils/eventLiveWindow'
import './index.scss'

export default function EventDetailPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading, user } = useAuthGuard()
  const { isExiting, navigateBack } = useJoyJoinNavigation()
  const pageClass = `event-detail ${isExiting ? 'event-detail--exiting' : ''}`

  const { data: event, isLoading, error } = useQuery<BlindBoxEventDetail>({
    queryKey: ['mini-program', 'event-detail', eventId],
    queryFn: () => loadEventDetail(apiRequest, eventId),
    enabled: !!eventId && !authLoading,
  })

  const isPoolEvent = event?.source === 'event_pool'
  const isActiveEvent =
    event?.status === 'started' || event?.status === 'active' || event?.status === 'ongoing'

  // P0e FAQ refund-entry gate (承诺-行为顺序锁, 2026-10-20): the `cancel_refund`
  // Q&A states the PRD §1.5 pre-reveal full-refund promise, so the item renders
  // only once the server behavior is actually live — same fail-closed read the
  // checkout's RefundGuaranteeLine consumes. Absent/undefined reads as false.
  const preRevealRefundEnabled = user?.features?.preRevealRefundEnabled === true

  // Pool 进入破冰 window (2026-10-16 fix): the status gate above is unreachable
  // for pools — the server writes active/matching/matched/completed (never
  // started/ongoing) and a group id only exists AFTER matching, so the CTA
  // could only ever show for a test pool parked on `active`. Pools use a
  // dateTime window instead (start − 1h … start + 3h); blind-box events keep the
  // status gate. Rationale + boundaries: lib/utils/eventLiveWindow.ts.
  const poolIcebreakerOpen = isPoolEvent
    ? isWithinPoolIcebreakerWindow({ status: event?.status, dateTime: event?.dateTime })
    : false
  const icebreakerLive = isPoolEvent ? poolIcebreakerOpen : isActiveEvent

  // Pool events must enter the icebreaker via the user's assigned group id
  // (eventPoolGroups.id), not the pool id. Resolve the group from joined events
  // so the "进入破冰" button can route to the working tier-selector flow.
  const { data: joinedEvents } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: isPoolEvent && poolIcebreakerOpen,
    staleTime: 60_000,
  })

  // Feedback lifecycle gate (2026-10-16 activation, PM plan §3): the server is
  // the single source of truth — feedback opens at dateTime+3h with eligibility
  // checked server-side, and all three event id families (pool / blind-box /
  // legacy) canonicalize inside the route. Fail-CLOSED: when the request fails
  // we hide the feedback entry rather than fake-open a gate the POST would
  // reject anyway.
  const { data: feedbackStateData } = useQuery({
    queryKey: ['mini-program', 'event-feedback-state', eventId],
    queryFn: () => getEventFeedbackState(apiRequest, eventId),
    enabled: !!eventId && !authLoading,
    staleTime: 60_000,
    retry: 1,
  })
  const feedbackState = feedbackStateData?.state

  // feedback_entry_shown (PM plan §7): once per page visit when the lifecycle
  // state resolves and the entry actually renders. ineligible/closed render
  // nothing, so they are deliberately not metered as an "entry shown".
  const feedbackEntryTrackedRef = useRef(false)
  useEffect(() => {
    if (!feedbackState || feedbackEntryTrackedRef.current) return
    if (feedbackState === 'ineligible' || feedbackState === 'closed') return
    feedbackEntryTrackedRef.current = true
    trackFeedbackEvent('feedback_entry_shown', { eventId, state: feedbackState, surface: 'event_detail' })
  }, [feedbackState, eventId])

  if (authLoading || isLoading) {
    return (
      <JoyJoinLoadingScreen
        title='活动详情加载中…'
        subtitle={`${DEFAULT_MASCOT_DISPLAY_NAME}在帮你读取这场活动的信息`}
      />
    )
  }

  if (error || !event) {
    return (
      <View className={`${pageClass} event-detail--static`}>
        <View className='event-detail__error'>
          <Image
            className='event-detail__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='widthFix'
            lazyLoad
          />
          <Text className='event-detail__error-text'>加载活动详情没成功</Text>
          <Button className='event-detail__retry-btn' onClick={() => navigateBack()}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  const matchedGroupId = isPoolEvent
    ? joinedEvents?.find((joined) => joined.id === eventId)?.groupId ?? undefined
    : undefined

  // Pool events route to the proven tier-selector flow with the group id;
  // blind-box events keep the direct session link (server Path2).
  const icebreakerTarget = !icebreakerLive
    ? undefined
    : isPoolEvent
      ? matchedGroupId
        ? `/pages/icebreaker-session/tier-selector/index?sessionId=${encodeURIComponent(matchedGroupId)}`
        : undefined
      : `/pages/icebreaker-session/index?eventId=${encodeURIComponent(event.id)}`

  // ─── Action-bar state matrix (2026-10-16 redesign, design doc §4) ─────────
  // At most ONE solid-primary CTA on screen at any time: 进入破冰 owns the live
  // window, 去评价 owns the post-event window. The two windows can overlap (a
  // blind-box event still 'ongoing' past the +3h gate) — the render below then
  // demotes 去评价 to the `--secondary` outline instead of a second solid fill.
  // PM D3: recruiting (active) / matching (排桌中) phases hide the feedback
  // entry entirely — a weeks-long locked button reads as broken UI. The locked
  // teaching state appears only once the table is formed (已成局) through the
  // live window. Cancelled/closed events never render the bar (the server also
  // answers ineligible for them; this guard is defense-in-depth).
  const isCancelledEvent =
    event.status === 'cancelled' || event.status === 'declined' || event.status === 'archived'
  const isPreMatchPool = isPoolEvent && (event.status === 'active' || event.status === 'matching')
  const showLockedFeedback = feedbackState === 'locked' && !isPreMatchPool && !isCancelledEvent
  const showOpenFeedback = feedbackState === 'open' && !isCancelledEvent
  const showDoneFeedback = feedbackState === 'submitted' && !isCancelledEvent
  const showActionBar =
    Boolean(icebreakerTarget) || showLockedFeedback || showOpenFeedback || showDoneFeedback

  const handleIcebreakerTap = () => {
    if (!icebreakerTarget) return
    haptics('medium')
    Taro.navigateTo({ url: icebreakerTarget })
  }

  // Locked-but-tappable (PM reconciliation 2026-10-16): native `disabled` would
  // swallow the tap in WeChat, killing both the teaching toast and the
  // feedback_locked_tap signal. The grey style + aria-disabled carry the
  // "not yet" semantics; the tap teaches. No haptics on the locked state.
  const handleFeedbackTap = () => {
    if (feedbackState === 'locked') {
      trackFeedbackEvent('feedback_locked_tap', { eventId })
      Taro.showToast({ title: '活动结束后才能评价哦', icon: 'none', duration: TOAST_DEFAULT_MS })
      return
    }
    if (feedbackState !== 'open') return
    haptics('medium')
    Taro.navigateTo({
      url: `/pages/event-feedback/index?id=${encodeURIComponent(event.id)}&from=event_detail`,
    })
  }

  return (
    <View className={pageClass}>
      {/* ScrollView exception: variable-length event-detail content (see
          viewport-zero-scroll skill). The action bar is a flex sibling of the
          ScrollView (pool-registration footer pattern), so scrolled content
          can never slide beneath it. */}
      <ScrollView className='event-detail__scroll' scrollY enhanced showScrollbar={false}>
        <View className='event-detail__scroll-inner'>
      <View className='event-detail__hero event-detail__hero--animated'>
        <View className='event-detail__hero-content'>
          <Text className='event-detail__title'>{event.title ?? '悦聚活动'}</Text>
          {event.type ? <Text className='event-detail__type-badge'>{event.type}</Text> : null}
        </View>
      </View>

      <View className='event-detail__card'>
        <View className='event-detail__info-row'>
          <View className='event-detail__info-label'>
            <View className='event-detail__icon-slot'>
              <JoyJoinIcon emoji='📅' size={24} />
            </View>
            <Text>时间</Text>
          </View>
          <Text className='event-detail__info-value'>{formatEventDateTime(event.dateTime)}</Text>
        </View>
        {event.location ? (
          <View className='event-detail__info-row'>
            <View className='event-detail__info-label'>
              <View className='event-detail__icon-slot'>
                <JoyJoinIcon emoji='📍' size={24} />
              </View>
              <Text>地点</Text>
            </View>
            <Text className='event-detail__info-value'>{event.location}</Text>
          </View>
        ) : null}
        {event.attendeeCount ? (
          <View className='event-detail__info-row'>
            <View className='event-detail__info-label'>
              <View className='event-detail__icon-slot'>
                <JoyJoinIcon emoji='👥' size={24} />
              </View>
              <Text>人数</Text>
            </View>
            <Text className='event-detail__info-value'>{event.attendeeCount} 人</Text>
          </View>
        ) : null}
        {getEventPoolStatusLabel(event.status) ? (
          <View className='event-detail__info-row'>
            <View className='event-detail__info-label'>
              <View className='event-detail__icon-slot'>
                <JoyJoinIcon emoji='📊' size={24} />
              </View>
              <Text>状态</Text>
            </View>
            <Text className='event-detail__info-value'>{getEventPoolStatusLabel(event.status)}</Text>
          </View>
        ) : null}
      </View>

      {/* P0c trust layer (2026-10-20): 怎么参加 4 拍流程条 — answers「然后呢?」
          right after the info card. Pool events only: 订座/排桌/集结房间 are
          pool mechanics; a blind-box detail has no such journey, and a trust
          surface must never show steps that don't exist for the event being
          read (fail-closed = hide). No flag — full launch. */}
      {isPoolEvent ? (
        <View className='event-detail__card event-detail__flow-card'>
          <EventFlowStrip />
        </View>
      ) : null}

      {/* P0e trust layer (2026-10-20): 常见问题手风琴 — right after the flow
          strip, before 活动介绍, same ScrollView flow. Same isPoolEvent gate:
          the FAQ answers cover pool mechanics (排桌/集结/退款/同行), and a
          blind-box detail must not claim a journey its event doesn't have
          (fail-closed = hide). Full launch, no flag — the only gate is the
          promise-locked refund item inside the component. */}
      {isPoolEvent ? (
        <View className='event-detail__card event-detail__faq-card'>
          <EventFaqAccordion preRevealRefundEnabled={preRevealRefundEnabled} />
        </View>
      ) : null}

      {event.description ? (
        <View className='event-detail__card'>
          <View className='event-detail__tip'>
            <Image
              className='event-detail__tip-mascot'
              src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-event-detail-tip.webp')}
              mode='aspectFit'
              lazyLoad
            />
            <Text className='event-detail__tip-text'>活动现场氛围超棒，记得提前15分钟到哦～</Text>
          </View>
          <Text className='event-detail__description-title'>活动介绍</Text>
          <Text className='event-detail__description'>{event.description}</Text>
        </View>
      ) : null}

      <View className='event-detail__card event-detail__support-card'>
        <View className='event-detail__support-copy'>
          <Text className='event-detail__support-title'>需要帮忙？</Text>
          <Text className='event-detail__support-subtitle'>活动安排、签到或现场问题，点这里直接和悦聚客服聊</Text>
        </View>
        {/* Native WeChat customer-service session (open-type="contact") —
            no QR asset to maintain, user never leaves the mini program.
            sessionFrom carries the surface + event for agent context. */}
        <Button
          className='event-detail__support-btn'
          openType='contact'
          sessionFrom={`event-detail:${eventId}`}
          showMessageCard
          sendMessageTitle={event.title ?? '悦聚活动'}
          sendMessagePath={`/pages/event-detail/index?id=${eventId}`}
          onClick={() => eventsAnalytics.track('support_contact_tap', { location: 'event-detail', eventId })}
        >
          联系客服
        </Button>
      </View>

        </View>
      </ScrollView>

      {showActionBar ? (
        <View className='event-detail__action-bar'>
          <View className='event-detail__action-stack'>
            {icebreakerTarget ? (
              <Button
                className='event-detail__cta event-detail__cta--live'
                aria-label='进入破冰，活动进行中'
                onClick={handleIcebreakerTap}
              >
                <View className='event-detail__cta-icon-chip' aria-hidden='true'>
                  <JoyJoinIcon emoji='👥' size={24} />
                </View>
                <Text>进入破冰</Text>
                <View className='event-detail__cta-live-dot' aria-hidden='true' />
              </Button>
            ) : null}
            {showOpenFeedback ? (
              <Button
                className={`event-detail__cta${
                  icebreakerTarget ? ' event-detail__cta--secondary' : ''
                }`}
                aria-label='去评价这场活动'
                onClick={handleFeedbackTap}
              >
                去评价
              </Button>
            ) : null}
            {showDoneFeedback ? (
              <Button
                className='event-detail__cta event-detail__cta--done'
                aria-label='已评价'
                aria-disabled='true'
                disabled
              >
                <JoyJoinIcon emoji='✓' size={24} />
                <Text>已评价</Text>
              </Button>
            ) : null}
            {showLockedFeedback ? (
              <>
                <Button
                  className='event-detail__cta event-detail__cta--locked'
                  aria-label='去评价，活动结束后开放'
                  aria-disabled='true'
                  onClick={handleFeedbackTap}
                >
                  去评价
                </Button>
                <Text className='event-detail__action-hint'>活动结束后可填写反馈</Text>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}
