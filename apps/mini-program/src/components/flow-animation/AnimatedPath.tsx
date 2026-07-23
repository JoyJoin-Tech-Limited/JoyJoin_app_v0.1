import { View } from '@tarojs/components'

// prefers-reduced-motion is enforced for every path animation in the shared index.scss fallback.
interface AnimatedPathProps {
  direction?: 'horizontal' | 'vertical' | 'branch-left' | 'branch-right'
  active?: boolean
}

export default function AnimatedPath({
  direction = 'horizontal',
  active = true,
}: AnimatedPathProps) {
  return (
    <View
      className={[
        'animated-path',
        `animated-path--${direction}`,
        active ? 'animated-path--active' : '',
      ].filter(Boolean).join(' ')}
    >
      <View className='animated-path__beam' />
      <View className='animated-path__traveler' />
    </View>
  )
}
