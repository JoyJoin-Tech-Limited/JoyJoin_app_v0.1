import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getReferralStats, type ReferralStatsResponse } from '@shared/api'
import { apiRequest } from '../../../lib/api/api'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useAuth } from '../../../hooks/useAuth'
import { haptics } from '../../../lib/utils/haptics'
import { logError } from '../../../lib/utils/logger'
import LoadingScreen from '../../../components/loading/LoadingScreen'
import { usePageTTI } from '../../../hooks/usePageTTI'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import StatusCard from '../../../components/ui/StatusCard'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import './index.scss'

const REWARD_TIERS = [
  { count: 1, reward: '7折优惠券 ×1', emoji: '🎫' },
  { count: 3, reward: '5折优惠券 ×2', emoji: '🎁' },
  { count: 5, reward: '免费月卡 ×1', emoji: '🏆' },
]

function buildReferralMiniProgramPath(code: string): string {
  return `/subpackages/pool-registration/index?invitationCode=${encodeURIComponent(code)}`
}

export default function InvitePage() {
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [refresherTriggered, setRefresherTriggered] = useState(false)

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<ReferralStatsResponse>({
    queryKey: ['mini-program', 'referral-stats'],
    queryFn: () => getReferralStats(apiRequest),
    enabled: !authLoading,
  })

  usePageTTI({ pageName: 'invite', ready: !authLoading && !isLoading })

  useDidShow(() => {
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'referral-stats'] })
  })

  useShareAppMessage(() => {
    const code = stats?.referralCode || (user as any)?.referralCode || ''
    const path = code ? buildReferralMiniProgramPath(code) : '/pages/index/index'
    return {
      title: '和我一起加入 JoyJoin，遇见同频的人',
      path,
    }
  })

  const handleRefresh = useCallback(async () => {
    setRefresherTriggered(true)
    try {
      await refetch()
    } catch (err) {
      logError('[InvitePage] Refresh failed', { message: err instanceof Error ? err.message : String(err) })
    } finally {
      setRefresherTriggered(false)
    }
  }, [refetch])

  const referralCode = stats?.referralCode || (user as any)?.referralCode || '—'
  const invitedCount = stats?.successfulInvites ?? 0
  const platformTotal = stats?.platformTotal ?? 0
  const inviteLink = stats?.inviteLink ?? ''
  const miniProgramPath = referralCode !== '—' ? buildReferralMiniProgramPath(referralCode) : ''
  const nextTier = REWARD_TIERS.find((tier) => invitedCount < tier.count)

  const inviteCopy = useMemo(() => {
    const codeLine = `邀请码：${referralCode}`
    return `和我一起加入 JoyJoin，看看这场有趣的盲盒社交活动吧。\n${codeLine}\n打开小程序即可使用邀请码`
  }, [referralCode])

  if (authLoading || isLoading) {
    return <LoadingScreen message='正在加载邀请信息…' />
  }

  if (isError) {
    return (
      <View className='invite-page invite-page--error'>
        <StatusCard
          tone='error'
          title='加载失败'
          description='邀请信息暂时无法获取，请稍后重试'
          className='invite-page__error-card'
        />
        <View className='invite-page__error-action'>
          <Button variant='primary' onClick={() => { haptics('light'); refetch() }}>
            重试
          </Button>
        </View>
      </View>
    )
  }

  const handleCopyCode = () => {
    haptics('light')
    Taro.setClipboardData({
      data: referralCode,
      success: () => Taro.showToast({ title: '已复制', icon: 'success' }),
    })
  }

  const handleCopyLink = () => {
    haptics('light')
    const linkToCopy = inviteLink || miniProgramPath
    if (!linkToCopy) {
      Taro.showToast({ title: '邀请链接暂不可用', icon: 'none' })
      return
    }

    Taro.setClipboardData({
      data: linkToCopy,
      success: () => Taro.showToast({ title: '已复制链接', icon: 'success' }),
    })
  }

  const handleShareToWeChat = () => {
    haptics('light')
    if (!miniProgramPath) {
      Taro.showToast({ title: '邀请信息暂不可用', icon: 'none' })
      return
    }
    Taro.showShareMenu({ withShareTicket: true })
  }

  const handleCopyInviteText = () => {
    haptics('light')
    Taro.setClipboardData({
      data: inviteCopy,
      success: () => Taro.showToast({ title: '已复制文案', icon: 'success' }),
    })
  }

  return (
    <ScrollView
      className='invite-page'
      scrollY
      enhanced
      showScrollbar={false}
      refresherEnabled
      refresherTriggered={refresherTriggered}
      onRefresherRefresh={handleRefresh}
    >
      <View className='invite-page__hero'>
        <Image
          className='invite-page__hero-image'
          src={CEREMONY_HEROES.inviteHeader}
          mode='aspectFit'
          ariaLabel='邀请好友'
        />
        <Text className='invite-page__hero-title'>邀请好友，一起悦聚</Text>
        <Text className='invite-page__hero-subtitle'>邀请越多，奖励越丰厚</Text>
      </View>

      <Card className='invite-page__code-card'>
        <Text className='invite-page__code-label'>你的邀请码</Text>
        <Text className='invite-page__code-value'>{referralCode}</Text>
        <View className='invite-page__code-actions'>
          <Button variant='primary' className='invite-page__copy-btn' onClick={handleCopyCode} aria-label='复制邀请码'>
            复制邀请码
          </Button>
          <Button variant='secondary' className='invite-page__copy-btn' onClick={handleCopyInviteText} aria-label='复制邀请文案'>
            复制邀请文案
          </Button>
        </View>
      </Card>

      <View className='invite-page__stats'>
        <Card className='invite-page__stat'>
          <Text className='invite-page__stat-value'>{invitedCount}</Text>
          <Text className='invite-page__stat-label'>已邀请</Text>
        </Card>
        <Card className='invite-page__stat'>
          <Text className='invite-page__stat-value'>{platformTotal}</Text>
          <Text className='invite-page__stat-label'>平台累计</Text>
        </Card>
      </View>

      <View className='invite-page__section'>
        <Text className='invite-page__section-title'>分享给朋友</Text>
        <Card className='invite-page__link-card'>
          {/* C4 — Co-branded ceremony hero for the share-card section (Batch C) */}
          <Image
            className='invite-page__share-hero'
            mode='aspectFit'
            src={CEREMONY_HEROES.inviteCoBranded}
            ariaLabel=''
            lazyLoad
          />
          <Text className='invite-page__link-label'>专属邀请链接</Text>
          <Text className='invite-page__link-value'>{miniProgramPath || '当前先使用邀请码邀请好友加入'}</Text>
          <View className='invite-page__link-actions'>
            <Button variant='primary' className='invite-page__link-btn' onClick={handleShareToWeChat} aria-label='分享给微信好友'>
              分享给微信好友
            </Button>
            <Button variant='secondary' className='invite-page__link-btn' onClick={handleCopyLink} aria-label='复制邀请链接'>
              复制邀请链接
            </Button>
          </View>
          <Text className='invite-page__link-helper'>
            {nextTier
              ? `再邀请 ${nextTier.count - invitedCount} 人，就能解锁下一档奖励：${nextTier.reward}`
              : '所有邀请奖励已解锁，继续邀请还能持续累积平台战绩。'}
          </Text>
        </Card>
      </View>

      <View className='invite-page__section'>
        <Text className='invite-page__section-title'>奖励阶梯</Text>
        {REWARD_TIERS.map((tier) => (
          <Card
            key={tier.count}
            className={`invite-page__tier ${invitedCount >= tier.count ? 'invite-page__tier--unlocked' : ''}`}
          >
            <JoyJoinIcon emoji={tier.emoji} tier='ui' size={48} className='invite-page__tier-icon' />
            <View className='invite-page__tier-info'>
              <Text className='invite-page__tier-target'>邀请 {tier.count} 人</Text>
              <Text className='invite-page__tier-reward'>{tier.reward}</Text>
            </View>
            {invitedCount >= tier.count ? (
              <View className='invite-page__tier-status invite-page__tier-status--unlocked'>
                <JoyJoinIcon emoji='✅' tier='ui' size={20} className='invite-page__tier-check' />
                <Text className='invite-page__tier-status-text'>已达成</Text>
              </View>
            ) : (
              <Text className='invite-page__tier-status'>还差 {tier.count - invitedCount} 人</Text>
            )}
          </Card>
        ))}
      </View>

      <View className='invite-page__spacer' />
    </ScrollView>
  )
}
