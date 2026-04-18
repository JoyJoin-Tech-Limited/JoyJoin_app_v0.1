import { Text } from '@tarojs/components'
import { FancyLineLoadingScreen } from './FancyLineLoadingScreen'
import './LoadingScreen.scss'

/**
 * Standard full-page loading state (user-client FancyLine + optional status line).
 */
export default function LoadingScreen({ message = '加载中…' }: { message?: string }) {
  return (
    <FancyLineLoadingScreen
      loop
      bottomContent={<Text className='loading-screen__message'>{message}</Text>}
    />
  )
}
