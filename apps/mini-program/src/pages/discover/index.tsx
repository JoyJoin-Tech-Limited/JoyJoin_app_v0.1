import { View, Text, Image, Button, Navigator, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getPricing, getUserCoupons, getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import './index.scss'
import logoImage from '../../assets/box_logo_archetypes.png'
import matchCardImg from '../../assets/match.png'
import dinnerImg from '../../assets/dinner.png'
import continueImg from '../../assets/continue.png'

function AuthenticatedDiscover() {
  const { user } = useAuth()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
  })

  const handleEventTap = (event: JoinedEventSummary) => {
    Taro.navigateTo({ url: `/pages/event-detail/index?id=${event.id}` })
  }

  return (
    <ScrollView className='discover-auth' scrollY enhanced showScrollbar={false}>
      <View className='discover-auth__hero'>
        <Text className='discover-auth__greeting'>你好，{displayName} 👋</Text>
        <Text className='discover-auth__subtitle'>探索你的下一场悦聚</Text>
      </View>

      {/* Quick actions */}
      <View className='discover-auth__actions'>
        <Card className='discover-auth__action-card' onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}>
          <Text className='discover-auth__action-emoji'>🎁</Text>
          <Text className='discover-auth__action-label'>开通权益</Text>
        </Card>
        <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/events/index' })}>
          <Text className='discover-auth__action-emoji'>📅</Text>
          <Text className='discover-auth__action-label'>我的活动</Text>
        </Card>
        <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/connections/index' })}>
          <Text className='discover-auth__action-emoji'>🤝</Text>
          <Text className='discover-auth__action-label'>我的连接</Text>
        </Card>
      </View>

      {/* Recent events */}
      <View className='discover-auth__section'>
        <Text className='discover-auth__section-title'>近期活动</Text>
        {eventsLoading ? (
          <Text className='discover-auth__empty'>加载中…</Text>
        ) : events.length > 0 ? (
          <View className='discover-auth__event-list'>
            {events.slice(0, 5).map((event) => (
              <Card
                key={String(event.id)}
                className='discover-auth__event-card'
                onClick={() => handleEventTap(event)}
              >
                <Text className='discover-auth__event-title'>{event.title ?? '悦聚活动'}</Text>
                <Text className='discover-auth__event-date'>{event.dateTime ?? '时间待定'}</Text>
              </Card>
            ))}
          </View>
        ) : (
          <Card className='discover-auth__empty-state'>
            <Text className='discover-auth__empty-emoji'>✨</Text>
            <Text className='discover-auth__empty'>还没有参加过活动</Text>
            <Text className='discover-auth__empty-hint'>开通权益后即可报名参加活动</Text>
          </Card>
        )}
      </View>

      <View className='discover-auth__spacer' />
    </ScrollView>
  )
}

function UnauthenticatedLanding() {
  const { data: pricing = [] } = useQuery({
    queryKey: ['mini-program', 'pricing'],
    queryFn: () => getPricing(apiRequest),
  })
  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
  })

  const featuredPlan = pricing.find((plan) => plan.planType === 'vip_quarterly') ?? pricing[0]

  return (
    <View className='landing-page'>
      <View className='content-zone'>
        <View className='logo-container'>
          <View className='logo-bg'></View>
          <Image src={logoImage} className='logo-img' mode='aspectFit' />
        </View>

        <View className='hero-cards'>
          <View className='card card-left'>
            <View className='card-img-wrap'>
              <Image src={matchCardImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>匹配</Text>
            </View>
          </View>

          <View className='card card-center'>
            <View className='card-img-wrap'>
              <Image src={dinnerImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>悦聚</Text>
            </View>
          </View>

          <View className='card card-right'>
            <View className='card-img-wrap'>
              <Image src={continueImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>延续</Text>
            </View>
          </View>
        </View>

        <View className='text-content'>
          <Text className='headline'>让对的相遇不再错过</Text>
          <Text className='subtitle'>通过氛围测试，找到你的氛围原型，遇见志同道合的ta</Text>
          <View className='badges'>
            {['🧠 氛围测试', '🎯 算法匹配', '👥 4-6人局'].map((label) => (
              <View key={label} className='badge'>
                <Text>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>当前功能入口</Text>
          <Text className='payment-page__summary-value'>活动权益 / 登录 / Onboarding</Text>
          <Text className='payment-page__summary-note'>
            {featuredPlan ? `推荐方案：${featuredPlan.displayName} · ¥${featuredPlan.price}` : '正在同步支付与优惠信息'}
          </Text>
          <Text className='payment-page__summary-note'>可用优惠：{coupons.count ?? 0} 张</Text>
        </View>
      </View>

      <View className='bottom-zone'>
        <Button className='primary-btn' onClick={() => Taro.navigateTo({ url: '/pages/onboarding/personality-test/index' })} hoverClass='primary-btn-hover'>
          看看我会遇见谁
        </Button>
        <Button className='secondary-btn' onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}>
          查看会员权益
        </Button>
        <Button className='secondary-btn' onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
          已有账号？登录
        </Button>
        <View className='legal-text'>
          <Text>我已阅读并同意</Text>
          {/* Temporary combined legal page until separate privacy content lands in mini-program. */}
          <Navigator url='/pages/terms/index' className='link'>《用户协议》</Navigator>
          <Text>和</Text>
          <Navigator url='/pages/terms/index' className='link'>《隐私政策》</Navigator>
        </View>
      </View>
    </View>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return isAuthenticated ? <AuthenticatedDiscover /> : <UnauthenticatedLanding />
}
