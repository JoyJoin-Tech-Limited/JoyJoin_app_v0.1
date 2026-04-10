import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function ExtendedDataStubPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>兴趣偏好</Text>
        <Text className='page__subtitle'>P0 占位页：用于承接 extended-data nextStep。</Text>
        <Button className='page__cta' onClick={() => Taro.redirectTo({ url: '/pages/onboarding/profile-review/index' })}>
          下一步：资料预览
        </Button>
      </View>
    </View>
  )
}
