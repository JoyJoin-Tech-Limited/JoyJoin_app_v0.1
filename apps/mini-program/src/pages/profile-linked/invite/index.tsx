import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getReferralStats, getMyPoolRegistrations, type ReferralStatsResponse, type PoolRegistrationSummary } from '@shared/api'
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
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import './index.scss'

// Truthful invite mechanics (2026-10-12, code-review BLOCKING fix): this page
// shares the permanent referral code — referral registrations write
// referral_conversions (attribution only). The INVITE_REWARD coupon is issued
// only for per-pool invitation codes (invitation_uses), which this page never
// mints, so no coupon promise may appear here. Same-table pairing bias is
// invitation-code-scoped too — never promise "同一桌" from a referral share.
const INVITE_STEPS = [
  { step: '1', title: '分享邀请链接', detail: '把链接或邀请码发给想一起玩的朋友' },
  { step: '2', title: '朋友注册并完成人格测试', detail: '新朋友也会领到新人见面礼' },
  { step: '3', title: '一起报名同一场局', detail: '现场见' },
]

function buildReferralMiniProgramPath(code: string, poolId?: string): string {
  // Dead-link fix (spec §G.1): include the pool id whenever the inviter has an
  // active registration, so a logged-in invitee lands on that pool instead of
  // the PoolRegistrationEmpty error page.
  const base = '/pages/pool-registration/index'
  const query = poolId
    ? `id=${encodeURIComponent(poolId)}&invitationCode=${encodeURIComponent(code)}`
    : `invitationCode=${encodeURIComponent(code)}`
  return `${base}?${query}`
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

  // Active registration drives the share path's pool id (spec §G.1).
  const { data: myRegistrations } = useQuery<PoolRegistrationSummary[]>({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !authLoading,
    staleTime: 30_000,
  })
  const activeSharePoolId = myRegistrations?.[0]?.poolId

  usePageTTI({ pageName: 'invite', ready: !authLoading && !isLoading })

  useDidShow(() => {
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'referral-stats'] })
  })

  useShareAppMessage(() => {
    const code = stats?.referralCode || (user as any)?.referralCode || ''
    const path = code ? buildReferralMiniProgramPath(code, activeSharePoolId) : '/pages/index/index'
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
  const miniProgramPath = referralCode !== '—' ? buildReferralMiniProgramPath(referralCode, activeSharePoolId) : ''

  const inviteCopy = useMemo(() => {
    const codeLine = `邀请码：${referralCode}`
    return `和我一起加入 JoyJoin，看看这场有趣的盲盒活动吧。\n${codeLine}\n打开小程序即可使用邀请码`
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
        <Text className='invite-page__hero-subtitle'>朋友用你的邀请码加入，新人也能领见面礼</Text>
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
            {/* Real share button (spec §G.3): openType='share' actually opens
                the forward panel; the old Taro.showShareMenu call could not. */}
            <Button
              variant='primary'
              className='invite-page__link-btn'
              openType='share'
              disabled={!miniProgramPath}
              onClick={() => haptics('light')}
              aria-label='分享给微信好友'
            >
              分享给微信好友
            </Button>
            <Button variant='secondary' className='invite-page__link-btn' onClick={handleCopyLink} aria-label='复制邀请链接'>
              复制邀请链接
            </Button>
          </View>
          <Text className='invite-page__link-helper'>
            邀请链接长期有效，分享给朋友即可。
          </Text>
        </Card>
      </View>

      <View className='invite-page__section'>
        <Text className='invite-page__section-title'>邀请怎么生效</Text>
        {INVITE_STEPS.map((item) => (
          <Card key={item.step} className='invite-page__tier'>
            <View className='invite-page__tier-info'>
              <Text className='invite-page__tier-target'>{item.title}</Text>
              <Text className='invite-page__tier-reward'>{item.detail}</Text>
            </View>
          </Card>
        ))}
      </View>

      <View className='invite-page__spacer' />
    </ScrollView>
  )
}
