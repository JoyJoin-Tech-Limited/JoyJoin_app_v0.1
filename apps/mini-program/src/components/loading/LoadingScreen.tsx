import JoyJoinLoadingScreen from './JoyJoinLoadingScreen'

interface LoadingScreenProps {
  /** Primary status message, forwarded as JoyJoinLoadingScreen title */
  message?: string
}

/**
 * Standard full-page loading state (premium JoyJoin mascot + orbit dots + skeleton).
 */
export default function LoadingScreen({ message }: LoadingScreenProps) {
  return <JoyJoinLoadingScreen title={message} />
}
