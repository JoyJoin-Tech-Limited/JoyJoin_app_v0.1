import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import './index.scss'

interface EventDetail {
  id: string
  title?: string
  dateTime?: string
  location?: string
  type?: string
  status?: string
  attendeeCount?: number
  description?: string
  [key: string]: unknown
}

export default function EventDetailPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()
  const supportQrSrc = '/assets/qr/customer-service-support.png'

  const { data: event, isLoading, error } = useQuery<EventDetail>({
    queryKey: ['mini-program', 'event-detail', eventId],
    queryFn: () => apiRequest<EventDetail>({ path: `/api/blind-box-events/${encodeURIComponent(eventId)}` }),
    enabled: !!eventId && !authLoading,
  })

  if (authLoading || isLoading) {
    return (
      <View className='event-detail'>
        <View className='event-detail__loading'>
          <Text className='event-detail__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (error || !event) {
    return (
      <View className='event-detail'>
        <View className='event-detail__error'>
          <Text className='event-detail__error-text'>加载活动详情失败</Text>
          <Button className='event-detail__retry-btn' onClick={() => Taro.navigateBack()}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  const handlePreviewSupportQr = () => {
    void Taro.previewImage({
      current: supportQrSrc,
      urls: [supportQrSrc],
    })
  }

  return (
    <ScrollView className='event-detail' scrollY enhanced showScrollbar={false}>
      <View className='event-detail__header'>
        <Text className='event-detail__title'>{event.title ?? '悦聚活动'}</Text>
        {event.type ? <Text className='event-detail__type-badge'>{event.type}</Text> : null}
      </View>

      <View className='event-detail__card'>
        <View className='event-detail__info-row'>
          <Text className='event-detail__info-label'>📅 时间</Text>
          <Text className='event-detail__info-value'>{event.dateTime ?? '时间待定'}</Text>
        </View>
        {event.location ? (
          <View className='event-detail__info-row'>
            <Text className='event-detail__info-label'>📍 地点</Text>
            <Text className='event-detail__info-value'>{event.location}</Text>
          </View>
        ) : null}
        {event.attendeeCount ? (
          <View className='event-detail__info-row'>
            <Text className='event-detail__info-label'>👥 人数</Text>
            <Text className='event-detail__info-value'>{event.attendeeCount} 人</Text>
          </View>
        ) : null}
        {event.status ? (
          <View className='event-detail__info-row'>
            <Text className='event-detail__info-label'>状态</Text>
            <Text className='event-detail__info-value'>{event.status}</Text>
          </View>
        ) : null}
      </View>

      {event.description ? (
        <View className='event-detail__card'>
          <Text className='event-detail__description-title'>活动介绍</Text>
          <Text className='event-detail__description'>{event.description}</Text>
        </View>
      ) : null}

      <View className='event-detail__card event-detail__support-card' onClick={handlePreviewSupportQr}>
        <View className='event-detail__support-copy'>
          <Text className='event-detail__support-title'>加入我们的智能客服</Text>
          <Text className='event-detail__support-subtitle'>使用微信扫描二维码联系客服</Text>
          <Text className='event-detail__support-helper'>长按保存二维码</Text>
        </View>
        <Image className='event-detail__support-qr' src={supportQrSrc} mode='aspectFit' />
      </View>

      <View className='event-detail__actions'>
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
