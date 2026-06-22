import React from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface RichListCardProps {
  title: string
  subtitle?: string
  meta?: string
  ecosystem?: React.ReactNode
  gradient?: 'warm' | 'cool' | 'fire' | 'premium' | 'surface'
  children?: React.ReactNode
  onClick?: () => void
  index?: number
}

export default React.memo(function RichListCard({
  title, subtitle, meta, ecosystem, gradient = 'premium', children, onClick, index = 0
}: RichListCardProps) {
  return (
    <View
      className={`rich-list-card rich-list-card--${gradient}`}
      onClick={onClick}
      hoverClass='rich-list-card--pressed'
      hoverStartTime={0}
      hoverStayTime={100}
      style={{ animationDelay: `${Math.min(index * 60, 500)}ms` }}
    >
      {ecosystem && <View className='rich-list-card__ecosystem'>{ecosystem}</View>}
      <Text className='rich-list-card__title'>{title}</Text>
      {subtitle && <Text className='rich-list-card__subtitle'>{subtitle}</Text>}
      {meta && <Text className='rich-list-card__meta'>{meta}</Text>}
      {children}
    </View>
  )
})
