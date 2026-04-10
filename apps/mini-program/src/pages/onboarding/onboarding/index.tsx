import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function OnboardingEntryPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>Onboarding</Text>
        <Text className='page__subtitle'>P0 占位页：用于承接 server-driven nextStep，避免登录后落到错误页面。</Text>
        <Button className='page__cta' onClick={() => Taro.redirectTo({ url: '/pages/onboarding/personality-test/index' })}>
          进入氛围测试
        </Button>
      </View>
    </View>
  )
}
