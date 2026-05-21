import { View, Text } from '@tarojs/components'

interface RichListCardProps {
  title: string
  subtitle?: string
  meta?: string
  ecosystem?: React.ReactNode
  gradient?: 'warm' | 'cool' | 'fire' | 'premium'
  children?: React.ReactNode
  onClick?: () => void
  index?: number
}

export default function RichListCard({
  title, subtitle, meta, ecosystem, gradient = 'premium', children, onClick, index = 0
}: RichListCardProps) {
  return (
    <View
      className={`rich-list-card rich-list-card--${gradient}`}
      onClick={onClick}
      style={index > 0 ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      {ecosystem && <View className='rich-list-card__ecosystem'>{ecosystem}</View>}
      <Text className='rich-list-card__title'>{title}</Text>
      {subtitle && <Text className='rich-list-card__subtitle'>{subtitle}</Text>}
      {meta && <Text className='rich-list-card__meta'>{meta}</Text>}
      {children}
    </View>
  )
}
