import { View, Text } from '@tarojs/components'
import './index.scss'

export default function ProfilePage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>我的</Text>
        <Text className='page__subtitle'>即将上线</Text>
      </View>
    </View>
  )
}
