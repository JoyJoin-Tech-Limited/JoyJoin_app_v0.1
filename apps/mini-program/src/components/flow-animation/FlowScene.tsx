import type { PropsWithChildren } from 'react'
import { Text, View } from '@tarojs/components'

interface FlowSceneProps extends PropsWithChildren {
  kicker: string
  title: string
  copy: string
  active: boolean
}

export default function FlowScene({
  kicker,
  title,
  copy,
  active,
  children,
}: FlowSceneProps) {
  return (
    <View
      className={`flow-scene ${active ? 'flow-scene--active' : ''}`}
    >
      <View className='flow-scene__visual'>{children}</View>
      <View className='flow-scene__copy'>
        <Text className='flow-scene__kicker'>{kicker}</Text>
        <Text className='flow-scene__title'>{title}</Text>
        <Text className='flow-scene__body'>{copy}</Text>
      </View>
    </View>
  )
}
