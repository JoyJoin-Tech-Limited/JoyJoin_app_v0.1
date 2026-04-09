import { View, Text, Image, Button, Navigator } from '@tarojs/components'
import './index.scss'

const logoImage = '/assets/box_logo_archetypes.png'
const matchCardImg = '/assets/match.png'
const dinnerImg = '/assets/dinner.png'
const continueImg = '/assets/continue.png'

export default function DiscoverPage() {
  const handlePrimaryCTA = () => {
    console.log('[Analytics] Landing: Primary CTA clicked')
    // Taro.navigateTo({ url: '/pages/personality-test/index' })
  }

  const handleSecondaryCTA = () => {
    console.log('[Analytics] Landing: Secondary CTA clicked')
    // Handle WeChat Login
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
      </View>

      <View className='bottom-zone'>
        <Button className='primary-btn' onClick={handlePrimaryCTA} hoverClass='primary-btn-hover'>
          看看我会遇见谁
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
