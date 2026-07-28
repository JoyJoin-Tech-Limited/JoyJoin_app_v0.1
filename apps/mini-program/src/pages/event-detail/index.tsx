import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { type BlindBoxEventDetail, getJoinedEvents } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import { loadEventDetail } from './eventDetailData'
import { formatEventDateTime, getEventPoolStatusLabel } from '../../lib/utils/eventDisplay'
import './index.scss'

export default function EventDetailPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()
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

  // Pool events must enter the icebreaker via the user's assigned group id
  // (eventPoolGroups.id), not the pool id. Resolve the group from joined events
  // so the "进入破冰" button can route to the working tier-selector flow.
  const { data: joinedEvents } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: isPoolEvent && isActiveEvent,
    staleTime: 60_000,
  })

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
      <View className={pageClass}>
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
  const icebreakerTarget = !isActiveEvent
    ? undefined
    : isPoolEvent
      ? matchedGroupId
        ? `/pages/icebreaker-session/tier-selector/index?sessionId=${encodeURIComponent(matchedGroupId)}`
        : undefined
      : `/pages/icebreaker-session/index?eventId=${encodeURIComponent(event.id)}`

  return (
    <ScrollView className={pageClass} scrollY enhanced showScrollbar={false}>
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

      <View className='event-detail__actions'>
        {icebreakerTarget ? (
          <Button
            className='event-detail__icebreaker-btn'
            onClick={() => Taro.navigateTo({ url: icebreakerTarget })}
          >
            进入破冰
          </Button>
        ) : null}
        <Button
          className='event-detail__feedback-btn'
          onClick={() => Taro.navigateTo({ url: `/pages/event-feedback/index?id=${event.id}` })}
        >
          提交反馈
        </Button>
      </View>

      <View className='event-detail__spacer' />
    </ScrollView>
  )
}
