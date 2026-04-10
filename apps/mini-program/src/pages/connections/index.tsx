import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * ConnectionsPage — canonical post-event connections hub.
 *
 * Route: /pages/connections/index
 * Replaces the legacy `pages/chats` route which used non-canonical naming.
 */
export default function ConnectionsPage() {
  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>连接</Text>
        <Text className='page__subtitle'>即将上线</Text>
      </View>
    </View>
  )
}
