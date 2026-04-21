import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboardingRoutes'
import LoadingScreen from '../../components/LoadingScreen'
import Button from '../../components/Button'
import Card from '../../components/Card'
import './index.scss'

interface EventSummary {
  id: string
  title?: string
  dateTime?: string
  location?: string
  status?: string
  description?: string
  [key: string]: unknown
}

const supportQrSrc = '/assets/qr/customer-service-support.png'

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

  const { data: joinedEvents = [], isLoading: eventsLoading } = useQuery<EventSummary[]>({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => apiRequest<EventSummary[]>({ path: '/api/events/joined' }),
    enabled: !authLoading,
  })

  const event = useMemo(
    () => joinedEvents.find((item) => item.id === eventId) ?? null,
    [joinedEvents, eventId],
  )

  const handlePreviewSupportQr = () => {
    void Taro.previewImage({
      current: supportQrSrc,
      urls: [supportQrSrc],
    })
  }

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
    return <LoadingScreen message='加载活动帮助…' />
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
          <Text className='coordination-help__event-meta'>📅 {formatEventDate(event.dateTime)}</Text>
          {event.location ? (
            <Text className='coordination-help__event-meta'>📍 {event.location}</Text>
          ) : null}
        </Card>
      ) : null}

      <Card className='coordination-help__support-card' onClick={handlePreviewSupportQr}>
        <View className='coordination-help__support-copy'>
          <Text className='coordination-help__section-label'>官方客服</Text>
          <Text className='coordination-help__support-title'>扫码联系悦聚客服</Text>
          <Text className='coordination-help__support-subtitle'>
            如需确认时间、集合地点、签到提醒或现场协助，请使用微信扫描二维码联系客服。
          </Text>
          <Text className='coordination-help__support-helper'>点击卡片可放大二维码，长按也可以保存。</Text>
        </View>
        <Image className='coordination-help__support-qr' src={supportQrSrc} mode='aspectFit' />
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
