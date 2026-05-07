import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReferralStats, type ReferralStatsResponse } from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import './index.scss'

const REWARD_TIERS = [
  { count: 1, reward: '7折优惠券 ×1', emoji: '🎫' },
  { count: 3, reward: '5折优惠券 ×2', emoji: '🎁' },
  { count: 5, reward: '免费月卡 ×1', emoji: '🏆' },
]

export default function InvitePage() {
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery<ReferralStatsResponse>({
    queryKey: ['mini-program', 'referral-stats'],
    queryFn: () => getReferralStats(apiRequest),
    enabled: !authLoading,
  })

  if (authLoading || isLoading) {
    return <LoadingScreen message='正在加载邀请信息…' />
  }

  const referralCode = stats?.referralCode || (user as any)?.referralCode || '—'
  const invitedCount = stats?.successfulInvites ?? 0
  const platformTotal = stats?.platformTotal ?? 0
  const inviteLink = stats?.inviteLink ?? ''
  const nextTier = REWARD_TIERS.find((tier) => invitedCount < tier.count)

  const inviteCopy = useMemo(() => {
    const codeLine = `邀请码：${referralCode}`

    if (inviteLink) {
      return `和我一起加入 JoyJoin，看看这场有趣的盲盒社交活动吧。\n${inviteLink}\n${codeLine}`
    }

    return `和我一起加入 JoyJoin，注册时填写我的邀请码即可。\n${codeLine}`
  }, [inviteLink, referralCode])

  const handleCopyCode = () => {
    Taro.setClipboardData({
      data: referralCode,
      success: () => Taro.showToast({ title: '已复制', icon: 'success' }),
    })
  }

  const handleCopyLink = () => {
    if (!inviteLink) {
      Taro.showToast({ title: '邀请链接暂不可用', icon: 'none' })
      return
    }

    Taro.setClipboardData({
      data: inviteLink,
      success: () => Taro.showToast({ title: '已复制链接', icon: 'success' }),
    })
  }

  const handleCopyInviteText = () => {
    Taro.setClipboardData({
      data: inviteCopy,
      success: () => Taro.showToast({ title: '已复制文案', icon: 'success' }),
    })
  }

  return (
    <ScrollView className='invite-page' scrollY enhanced showScrollbar={false}>
      <View className='invite-page__hero'>
        <Text className='invite-page__hero-emoji'>🎉</Text>
        <Text className='invite-page__hero-title'>邀请好友，一起悦聚</Text>
        <Text className='invite-page__hero-subtitle'>邀请越多，奖励越丰厚</Text>
      </View>

      {/* Referral code */}
      <Card className='invite-page__code-card'>
        <Text className='invite-page__code-label'>你的邀请码</Text>
        <Text className='invite-page__code-value'>{referralCode}</Text>
        <View className='invite-page__code-actions'>
          <Button variant='primary' className='invite-page__copy-btn' onClick={handleCopyCode}>
            复制邀请码
          </Button>
          <Button variant='secondary' className='invite-page__copy-btn' onClick={handleCopyInviteText}>
            复制邀请文案
          </Button>
        </View>
      </Card>

      {/* Stats */}
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
          <Text className='invite-page__link-label'>专属邀请链接</Text>
          <Text className='invite-page__link-value'>{inviteLink || '当前先使用邀请码邀请好友加入'}</Text>
          <View className='invite-page__link-actions'>
            <Button variant='primary' className='invite-page__link-btn' onClick={handleCopyLink}>
              复制邀请链接
            </Button>
            <Button variant='secondary' className='invite-page__link-btn' onClick={handleCopyInviteText}>
              复制完整文案
            </Button>
          </View>
          <Text className='invite-page__link-helper'>
            {nextTier
              ? `再邀请 ${nextTier.count - invitedCount} 人，就能解锁下一档奖励：${nextTier.reward}`
              : '所有邀请奖励已解锁，继续邀请还能持续累积平台战绩。'}
          </Text>
        </Card>
      </View>

      {/* Reward tiers */}
      <View className='invite-page__section'>
        <Text className='invite-page__section-title'>奖励阶梯</Text>
        {REWARD_TIERS.map((tier) => (
          <Card
            key={tier.count}
            className={`invite-page__tier ${invitedCount >= tier.count ? 'invite-page__tier--unlocked' : ''}`}
          >
            <Text className='invite-page__tier-emoji'>{tier.emoji}</Text>
            <View className='invite-page__tier-info'>
              <Text className='invite-page__tier-target'>邀请 {tier.count} 人</Text>
              <Text className='invite-page__tier-reward'>{tier.reward}</Text>
            </View>
            <Text className='invite-page__tier-status'>
              {invitedCount >= tier.count ? '✅ 已达成' : `还差 ${tier.count - invitedCount} 人`}
            </Text>
          </Card>
        ))}
      </View>

      <View className='invite-page__spacer' />
    </ScrollView>
  )
}
