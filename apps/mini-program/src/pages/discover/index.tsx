import { View, Text, Image, Button, Navigator } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getPricing, getUserCoupons } from '@shared/api'
import { apiRequest } from '../../lib/api'
import './index.scss'
import logoImage from '../../assets/box_logo_archetypes.png'
import matchCardImg from '../../assets/match.png'
import dinnerImg from '../../assets/dinner.png'
import continueImg from '../../assets/continue.png'

export default function DiscoverPage() {
  // TODO: Taro adaptation needed for web-only drawers, coach marks, and browser-only interactions from the web discover page.
  const { data: pricing = [] } = useQuery({
    queryKey: ['mini-program', 'pricing'],
    queryFn: () => getPricing(apiRequest),
  })
  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
  })

  const featuredPlan = pricing.find((plan) => plan.planType === 'vip_quarterly') ?? pricing[0]

  const handlePrimaryCTA = () => {
    Taro.navigateTo({ url: '/pages/onboarding/personality-test/index' })
  }

  const handleSecondaryCTA = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

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
            {featuredPlan
              ? `推荐方案：${featuredPlan.displayName} · ¥${featuredPlan.price}`
              : '正在同步支付与优惠信息'}
          </Text>
          <Text className='payment-page__summary-note'>可用优惠：{coupons.count ?? 0} 张</Text>
        </View>
      </View>

      <View className='bottom-zone'>
        <Button className='primary-btn' onClick={handlePrimaryCTA} hoverClass='primary-btn-hover'>
          看看我会遇见谁
        </Button>
        <Button className='secondary-btn' onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}>
          查看会员权益
        </Button>
        <Button className='secondary-btn' onClick={handleSecondaryCTA}>
          已有账号？登录
        </Button>
        <View className='legal-text'>
          <Text>我已阅读并同意</Text>
          <Navigator url='/pages/terms/index' className='link'>《用户协议》</Navigator>
          <Text>和</Text>
          <Navigator url='/pages/terms/index' className='link'>《隐私政策》</Navigator>
        </View>
      </View>
    </View>
  )
}
