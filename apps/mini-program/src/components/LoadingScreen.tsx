import { Text } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { FancyLineLoadingScreen } from './FancyLineLoadingScreen'
import './LoadingScreen.scss'

/**
 * Standard full-page loading state (user-client FancyLine + optional status line).
 */
export default function LoadingScreen({ message = `${DEFAULT_MASCOT_DISPLAY_NAME}正在赶来…` }: { message?: string }) {
  return (
    <FancyLineLoadingScreen
      loop
      bottomContent={<Text className='loading-screen__message'>{message}</Text>}
    />
  )
}
