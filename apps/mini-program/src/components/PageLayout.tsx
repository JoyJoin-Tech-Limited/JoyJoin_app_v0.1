import { View, type ViewProps } from '@tarojs/components'
import './PageLayout.scss'

/**
 * Standard page wrapper with JoyJoin mini-program spacing and background.
 */
export default function PageLayout({ className = '', ...props }: ViewProps) {
  return <View className={`page-layout${className ? ` ${className}` : ''}`} {...props} />
}
