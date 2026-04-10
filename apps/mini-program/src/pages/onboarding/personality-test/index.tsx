import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function PersonalityTestStubPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>氛围测试</Text>
        <Text className='page__subtitle'>P0 占位页：后续迁移 web 版测试体验，此处先保证登录跳转正确。</Text>
        <Button className='profile-page__cta' onClick={() => Taro.redirectTo({ url: '/pages/onboarding/essential-data/index' })}>
          下一步：基本资料
        </Button>
      </View>
    </View>
  )
}
