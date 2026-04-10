import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function EssentialDataStubPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>基本资料</Text>
        <Text className='page__subtitle'>P0 占位页：用于承接 essential-data nextStep。</Text>
        <Button className='page__cta' onClick={() => Taro.redirectTo({ url: '/pages/onboarding/extended-data/index' })}>
          下一步：兴趣偏好
        </Button>
      </View>
    </View>
  )
}
