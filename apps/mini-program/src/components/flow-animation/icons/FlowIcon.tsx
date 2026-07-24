import { View } from '@tarojs/components'
import type { FlowAccent, FlowIconName } from '../flowAnimation.types'

interface FlowIconProps {
  name: FlowIconName
  active?: boolean
  accent?: FlowAccent
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function FlowIcon({
  name,
  active = false,
  accent = 'brand',
  size = 'md',
  className = '',
}: FlowIconProps) {
  return (
    <View
      className={[
        'jj-flow-icon',
        `jj-flow-icon--${name}`,
        `jj-flow-icon--${accent}`,
        `jj-flow-icon--${size}`,
        active ? 'jj-flow-icon--active' : '',
        className,
      ].filter(Boolean).join(' ')}
      ariaLabel=''
    >
      <View className='jj-flow-icon__shape jj-flow-icon__shape--a' />
      <View className='jj-flow-icon__shape jj-flow-icon__shape--b' />
      <View className='jj-flow-icon__shape jj-flow-icon__shape--c' />
      <View className='jj-flow-icon__spark jj-flow-icon__spark--one' />
      <View className='jj-flow-icon__spark jj-flow-icon__spark--two' />
    </View>
  )
}
