import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type JoinedEventSummary } from '@shared/api'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { apiRequest } from '../../lib/api/api'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './index.scss'

function formatEventDate(dateTime?: string): string {
  if (!dateTime) {
    return '时间待定'
  }

  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) {
    return '时间待定'
  }

  return parsedDate.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EventCoordinationPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()

  const { data: joinedEvents = [], isLoading: eventsLoading } = useQuery<JoinedEventSummary[]>({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => apiRequest<JoinedEventSummary[]>({ path: '/api/events/joined' }),
    enabled: !authLoading,
  })

  const event = useMemo(
    () => joinedEvents.find((item: JoinedEventSummary) => item.id === eventId) ?? null,
    [joinedEvents, eventId],
  )

  const handleOpenEventDetail = () => {
    if (!eventId) {
      void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
      return
    }

    void Taro.navigateTo({
      url: `/pages/event-detail/index?id=${encodeURIComponent(eventId)}`,
    }).catch(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }))
  }

  const handleOpenEvents = () => {
    void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
  }

  if (authLoading || eventsLoading) {
    return <LoadingScreen message='正在读取活动指南…' />
  }

  return (
    <ScrollView className='coordination-help' scrollY enhanced showScrollbar={false}>
      <View className='coordination-help__hero'>
        <Text className='coordination-help__eyebrow'>活动帮助</Text>
        <Text className='coordination-help__title'>{event?.title ?? '活动帮助'}</Text>
        <Text className='coordination-help__subtitle'>
          这页已改为官方支持入口。需要确认活动安排、签到提醒或现场协助时，请直接联系悦聚客服。
        </Text>
      </View>

      <Card className='coordination-help__notice-card'>
        <Text className='coordination-help__section-label'>当前说明</Text>
        <Text className='coordination-help__notice-title'>小程序内自由群聊已关闭</Text>
        <Text className='coordination-help__notice-copy'>
          为了让活动协助更集中、更安心，活动相关问题统一改为官方客服支持。你仍然可以在活动详情里查看时间、地点与后续安排。
        </Text>
      </Card>

      {event ? (
        <Card className='coordination-help__event-card'>
          <Text className='coordination-help__section-label'>活动信息</Text>
          <View className='coordination-help__event-row'>
            <Text className='coordination-help__event-name'>{event.title ?? '悦聚活动'}</Text>
            <Text className='coordination-help__event-status'>{event.status ?? '待开始'}</Text>
          </View>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='📅' size={20} />
            <Text className='coordination-help__event-meta'>{formatEventDate(event.dateTime)}</Text>
          </View>
          {event.location ? (
            <View className='jj-icon-text'>
              <JoyJoinIcon emoji='📍' size={20} />
              <Text className='coordination-help__event-meta'>{event.location}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card className='coordination-help__support-card'>
        <View className='coordination-help__support-copy'>
          <Text className='coordination-help__section-label'>官方客服</Text>
          <Text className='coordination-help__support-title'>联系悦聚客服</Text>
          <Text className='coordination-help__support-subtitle'>
            如需确认时间、集合地点、签到提醒或现场协助，点下面按钮直接和客服聊。
          </Text>
        </View>
        {/* Native WeChat customer-service session (open-type="contact") —
            replaces the placeholder QR card; user never leaves the mini program. */}
        <Button
          className='coordination-help__support-btn'
          openType='contact'
          sessionFrom={`event-coordination:${eventId}`}
          showMessageCard
          sendMessageTitle={event?.title ?? '悦聚活动'}
          sendMessagePath={`/pages/event-coordination/index?id=${eventId}`}
          onClick={() => eventsAnalytics.track('support_contact_tap', { location: 'event-coordination', eventId })}
        >
          联系客服
        </Button>
      </Card>

      <View className='coordination-help__tips'>
        <Text className='coordination-help__tips-title'>客服更适合处理这些问题</Text>
        <View className='coordination-help__tips-list'>
          <Text className='coordination-help__tip'>1. 活动时间、地点、签到与迟到说明</Text>
          <Text className='coordination-help__tip'>2. 现场突发情况与帮助请求</Text>
          <Text className='coordination-help__tip'>3. 活动安排、规则与体验反馈</Text>
        </View>
      </View>

      <View className='coordination-help__actions'>
        <Button className='coordination-help__action' onClick={handleOpenEventDetail}>
          查看活动详情
        </Button>
        <Button variant='secondary' className='coordination-help__action' onClick={handleOpenEvents}>
          返回我的足迹
        </Button>
      </View>

      <View className='coordination-help__spacer' />
    </ScrollView>
  )
}
