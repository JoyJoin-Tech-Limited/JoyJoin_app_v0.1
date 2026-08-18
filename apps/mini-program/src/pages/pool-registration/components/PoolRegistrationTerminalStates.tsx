import { useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { haptics } from '../../../lib/utils/haptics'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import StatusCard from '../../../components/ui/StatusCard'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import EventSummaryCard from '../../../components/events/EventSummaryCard'
import type { PoolEventType } from '../flowConfig'

interface LoadingStateProps {
  isStale: boolean
  onRetry: () => void
  onBack: () => void
}

export function PoolRegistrationLoading({ isStale, onRetry, onBack }: LoadingStateProps) {
  if (!isStale) {
    return <LoadingScreen message='正在加载报名信息…' />
  }

  return (
    <View className='pool-reg'>
      <StatusCard
        tone='error'
        title='加载有点慢'
        description='网络或服务器响应超时，刷新一下再试试'
        action={{
          label: '重新加载',
          onClick: onRetry,
          variant: 'primary',
        }}
        footer={
          <Button variant='secondary' onClick={onBack}>
            返回上一页
          </Button>
        }
      />
    </View>
  )
}

interface EmptyStateProps {
  errorMessage?: string
  onRetry: () => void
  onBack: () => void
}

export function PoolRegistrationEmpty({ errorMessage, onRetry, onBack }: EmptyStateProps) {
  return (
    <View className='pool-reg'>
      <Card className='pool-reg__empty'>
        <Image
          className='pool-reg__empty-hero'
          src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
          mode='aspectFit'
          lazyLoad
        />
        <Text className='pool-reg__empty-title'>这场活动暂时打不开</Text>
        <Text className='pool-reg__empty-text'>
          {errorMessage || '悦仔正在努力同步这场活动的最新信息，稍后再试就好。'}
        </Text>
        <Button variant='primary' className='pool-reg__single-action' onClick={onRetry}>
          重试
        </Button>
        <Button variant='secondary' className='pool-reg__single-action' onClick={onBack}>
          返回上一页
        </Button>
      </Card>
    </View>
  )
}

interface AlreadyJoinedStateProps {
  poolId: string
  poolTitle?: string
  eventType: PoolEventType
  poolArea: string
  poolDateTime?: string | null
  /** Set when the user's duo is bound (spec §D boundary matrix). */
  duoPartnerName?: string
}

export function PoolRegistrationAlreadyJoined({
  poolId,
  poolTitle,
  eventType,
  poolArea,
  poolDateTime,
  duoPartnerName,
}: AlreadyJoinedStateProps) {
  useEffect(() => {
    discoverAnalytics.track('registration_terminal_state_view', poolId, {
      variant: 'already-joined',
    })
  }, [poolId])

  const handleGoToFootprint = () => {
    haptics('medium')
    discoverAnalytics.track('registration_terminal_cta_tap', poolId, {
      variant: 'already-joined',
      target: 'footprint',
    })
    Taro.switchTab({ url: '/pages/events/index' })
  }

  return (
    <View className='pool-reg'>
      <ScrollView className='pool-reg__scroll' scrollY enhanced showScrollbar={false}>
        <View className='pool-reg__terminal-center'>
          <Card className='pool-reg__already-joined'>
            <Image
              className='pool-reg__already-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('homeWelcome')}
              ariaLabel='已报名'
            />
            <Text className='pool-reg__already-title'>你已经加入这场{eventType}了</Text>
            <Text className='pool-reg__already-text'>
              你的预算和期待已经收到，悦仔正在帮你挑同频的桌友，有结果会第一时间通知你。
            </Text>
            {duoPartnerName ? (
              <Text className='pool-reg__already-text'>你和 {duoPartnerName} 的双人成行已生效</Text>
            ) : null}
            <EventSummaryCard
              className='pool-reg__terminal-card'
              title={poolTitle}
              eventType={eventType}
              dateTime={poolDateTime}
              district={poolArea}
              status='registered'
            />
            <Button
              variant='primary'
              className='pool-reg__already-cta'
              onClick={handleGoToFootprint}
            >
              查看我的局
            </Button>
          </Card>
        </View>
      </ScrollView>
    </View>
  )
}

