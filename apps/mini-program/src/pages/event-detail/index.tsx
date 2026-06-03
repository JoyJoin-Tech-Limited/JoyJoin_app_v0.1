import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { type BlindBoxEventDetail } from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import './index.scss'

export default function EventDetailPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()
  const { isExiting, navigateBack } = useJoyJoinNavigation()
  const supportQrSrc = localAsset('/assets/qr/customer-service-support.png')
  const pageClass = `event-detail ${isExiting ? 'event-detail--exiting' : ''}`

  const { data: event, isLoading, error } = useQuery<BlindBoxEventDetail>({
    queryKey: ['mini-program', 'event-detail', eventId],
    queryFn: () => apiRequest<BlindBoxEventDetail>({ path: `/api/blind-box-events/${encodeURIComponent(eventId)}` }),
    enabled: !!eventId && !authLoading,
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
            src={localAsset('/assets/lovart-generic/lovart-generic-error.png')}
            mode='aspectFit'
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

  const handlePreviewSupportQr = () => {
    void Taro.previewImage({
      current: supportQrSrc,
      urls: [supportQrSrc],
    })
  }

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
          <Text className='event-detail__info-value'>{event.dateTime ?? '时间待定'}</Text>
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
        {event.status ? (
          <View className='event-detail__info-row'>
            <Text className='event-detail__info-label'>状态</Text>
            <Text className='event-detail__info-value'>{event.status}</Text>
          </View>
        ) : null}
      </View>

      {event.description ? (
        <View className='event-detail__card'>
          <View className='event-detail__tip'>
            <Image
              className='event-detail__tip-mascot'
              src={localAsset('/assets/xiaoyue-expressions/xiaoyue-event-detail-tip.webp')}
              mode='aspectFit'
              lazyLoad
            />
            <Text className='event-detail__tip-text'>活动现场氛围超棒，记得提前15分钟到哦～</Text>
          </View>
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
        {event.status === 'started' || event.status === 'active' || event.status === 'ongoing' ? (
          <Button
            className='event-detail__icebreaker-btn'
            onClick={() => Taro.navigateTo({ url: `/pages/icebreaker-session/index?eventId=${event.id}` })}
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
