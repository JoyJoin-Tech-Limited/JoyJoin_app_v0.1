import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function ProfileReviewStubPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>资料预览</Text>
        <Text className='page__subtitle'>P0 占位页：用于承接 profile-review nextStep。</Text>
        <Button className='page__cta' onClick={() => Taro.redirectTo({ url: '/pages/discover/index' })}>
          完成并进入发现页
        </Button>
      </View>
    </View>
  )
}
