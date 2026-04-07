import { View, Text } from '@tarojs/components'
import './index.scss'

export default function EventsPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>活动</Text>
        <Text className='page__subtitle'>即将上线</Text>
      </View>
    </View>
  )
}
