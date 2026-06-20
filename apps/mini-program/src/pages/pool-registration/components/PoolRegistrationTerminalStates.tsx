import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { EventPoolSummary } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'

import { cdnAsset, localAsset } from '../../../lib/utils/cdnAssets'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import StatusCard from '../../../components/ui/StatusCard'
import ChemistryMiniGrid from '../../../components/discover/ChemistryMiniGrid'
import type { PoolEventType } from '../flowConfig'
import EventMetaIcon from './EventMetaIcon'

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
  eventType: PoolEventType
  poolDateTimeLabel: string
  poolArea: string
  poolDateTime?: string | null
}

export function PoolRegistrationAlreadyJoined({
  eventType,
  poolDateTimeLabel,
  poolArea,
  poolDateTime,
}: AlreadyJoinedStateProps) {
  return (
    <View className='pool-reg'>
      <Card className='pool-reg__already-joined'>
        <Image
          className='pool-reg__already-mascot'
          mode='aspectFit'
          src={localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.png')}
          ariaLabel='已报名'
        />
        <Text className='pool-reg__already-title'>你已经加入这场{eventType}了</Text>
        <Text className='pool-reg__already-text'>
          你的预算和社交期待已经在匹配引擎里跑着了，有结果会第一时间通知你。
        </Text>
        <View className='pool-reg__already-meta'>
          <View className='pool-reg__already-meta-row'>
            <EventMetaIcon kind='type' />
            <Text>{eventType}</Text>
          </View>
          {poolDateTime ? (
            <View className='pool-reg__already-meta-row'>
              <EventMetaIcon kind='calendar' />
              <Text>{poolDateTimeLabel}</Text>
            </View>
          ) : null}
          {poolArea ? (
            <View className='pool-reg__already-meta-row'>
              <EventMetaIcon kind='location' />
              <Text>{poolArea}</Text>
            </View>
          ) : null}
        </View>
        <Button
          variant='primary'
          className='pool-reg__already-cta'
          onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
        >
          去我的足迹查看状态
        </Button>
      </Card>
    </View>
  )
}

interface SuccessStateProps {
  eventType: PoolEventType
  highlights: string[]
  pool: EventPoolSummary
  userArchetype: string | null
  onEnableNotifications: () => void
}

export function PoolRegistrationSuccess({
  eventType,
  highlights,
  pool,
  userArchetype,
  onEnableNotifications,
}: SuccessStateProps) {
  return (
    <View className='pool-reg'>
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
        <Button variant='secondary' className='pool-reg__notify-btn' onClick={onEnableNotifications}>
          开启匹配结果通知
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
        <Button
          variant='primary'
          className='pool-reg__back-btn'
          onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
        >
          去看我的足迹
        </Button>
        <ChemistryMiniGrid pool={pool} userArchetype={userArchetype} />
      </Card>
    </View>
  )
}
