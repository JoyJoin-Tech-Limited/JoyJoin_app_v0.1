import { useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { EventPoolSummary } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'

import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { haptics } from '../../../lib/utils/haptics'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import StatusCard from '../../../components/ui/StatusCard'
import ChemistryMiniGrid from '../../../components/discover/ChemistryMiniGrid'
import EventSummaryCard from '../../../components/events/EventSummaryCard'
import type { PoolEventType } from '../flowConfig'

interface LoadingStateProps {
  isStale: boolean
  onRetry: () => void
  onBack: () => void
}

export function PoolRegistrationLoading({ isStale, onRetry, onBack }: LoadingStateProps) {
  if (isStale) {
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

  return null
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
}

export function PoolRegistrationAlreadyJoined({
  poolId,
  poolTitle,
  eventType,
  poolArea,
  poolDateTime,
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
              去我的足迹查看状态
            </Button>
          </Card>
        </View>
      </ScrollView>
    </View>
  )
}

interface SuccessStateProps {
  poolId: string
  eventType: PoolEventType
  highlights: string[]
  pool: EventPoolSummary
  userArchetype: string | null
  onEnableNotifications: () => void
  isEnablingNotifications?: boolean
  notificationsEnabled?: boolean
}

export function PoolRegistrationSuccess({
  poolId,
  eventType,
  highlights,
  pool,
  userArchetype,
  onEnableNotifications,
  isEnablingNotifications = false,
  notificationsEnabled = false,
}: SuccessStateProps) {
  useEffect(() => {
    discoverAnalytics.track('registration_terminal_state_view', poolId, {
      variant: 'success',
    })
  }, [poolId])

  const handleEnableNotifications = () => {
    if (isEnablingNotifications || notificationsEnabled) return
    haptics('light')
    discoverAnalytics.track('registration_terminal_notify_tap', poolId, {
      variant: 'success',
    })
    onEnableNotifications()
  }

  const handleGoToFootprint = () => {
    haptics('medium')
    discoverAnalytics.track('registration_terminal_cta_tap', poolId, {
      variant: 'success',
      target: 'footprint',
    })
    Taro.switchTab({ url: '/pages/events/index' })
  }

  return (
    <View className='pool-reg'>
      <ScrollView className='pool-reg__scroll' scrollY enhanced showScrollbar={false}>
        <View className='pool-reg__terminal-center'>
          <Card className='pool-reg__success'>
            <Image
              className='pool-reg__success-hero'
              mode='aspectFit'
              src={CEREMONY_HEROES.poolRegistrationSuccess}
              ariaLabel='已加入活动池'
            />
            <Text className='pool-reg__success-title'>已加入这场{eventType}</Text>
            <Text className='pool-reg__success-text'>
              我们会按照你刚刚填写的预算、社交期待和偏好完成匹配，有结果会第一时间通知你。
            </Text>
            <Text className='pool-reg__success-notify-hint'>
              {`想在${DEFAULT_MASCOT_DISPLAY_NAME}帮你匹配成功时收到微信提醒？点一下授权（可在微信授权弹窗中选择）。`}
            </Text>
            <Button
              variant='secondary'
              className='pool-reg__notify-btn'
              onClick={handleEnableNotifications}
              loading={isEnablingNotifications}
              disabled={notificationsEnabled}
            >
              {notificationsEnabled ? '已开启提醒' : '开启匹配结果通知'}
            </Button>
            {highlights.length > 0 ? (
              <View className='pool-reg__success-pills'>
                {highlights.map((item) => (
                  <Text key={item} className='pool-reg__success-pill'>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
            <EventSummaryCard
              className='pool-reg__terminal-card'
              title={pool.title}
              eventType={eventType}
              dateTime={pool.dateTime}
              city={pool.city}
              district={pool.district}
              status='registered'
            />
            <Button
              variant='primary'
              className='pool-reg__back-btn'
              onClick={handleGoToFootprint}
            >
              去我的足迹查看状态
            </Button>
            <ChemistryMiniGrid pool={pool} userArchetype={userArchetype} />
          </Card>
        </View>
      </ScrollView>
    </View>
  )
}
