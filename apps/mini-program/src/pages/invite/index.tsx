import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

interface ReferralStats {
  referralCode?: string
  successfulInvites?: number
  platformTotal?: number
  [key: string]: unknown
}

const REWARD_TIERS = [
  { count: 1, reward: '7折优惠券 ×1', emoji: '🎫' },
  { count: 3, reward: '5折优惠券 ×2', emoji: '🎁' },
  { count: 5, reward: '免费月卡 ×1', emoji: '🏆' },
]

export default function InvitePage() {
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['mini-program', 'referral-stats'],
    queryFn: () => apiRequest<ReferralStats>({ path: '/api/referrals/stats' }),
    enabled: !authLoading,
  })

  if (authLoading || isLoading) {
    return <LoadingScreen />
  }

  const referralCode = stats?.referralCode || (user as any)?.referralCode || '—'
  const invitedCount = stats?.successfulInvites ?? 0

  const handleCopy = () => {
    Taro.setClipboardData({
      data: referralCode,
      success: () => Taro.showToast({ title: '已复制', icon: 'success' }),
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
        <Button variant='primary' className='invite-page__copy-btn' onClick={handleCopy}>
          复制邀请码
        </Button>
      </Card>

      {/* Stats */}
      <View className='invite-page__stats'>
        <Card className='invite-page__stat'>
          <Text className='invite-page__stat-value'>{invitedCount}</Text>
          <Text className='invite-page__stat-label'>已邀请</Text>
        </Card>
        <Card className='invite-page__stat'>
          <Text className='invite-page__stat-value'>{successful}</Text>
          <Text className='invite-page__stat-label'>已注册</Text>
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
