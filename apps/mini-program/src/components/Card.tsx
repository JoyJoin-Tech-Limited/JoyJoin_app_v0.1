import { View, type ViewProps } from '@tarojs/components'
import './Card.scss'

/**
 * Reusable content card container.
 */
export default function Card({ className = '', ...props }: ViewProps) {
  return <View className={`joy-card${className ? ` ${className}` : ''}`} {...props} />
}
