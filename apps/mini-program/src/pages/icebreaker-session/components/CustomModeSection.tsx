import { View, Text, Button } from '@tarojs/components'
import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'

interface CustomModeSectionProps {
  isHost?: boolean
  socialSessionId?: string | null
  session?: SocialSessionState
  playerCount?: number
  pendingAction?: string | null
  onSelectPhase?: (phase: SocialIcebreakerPhase) => void
  onEndSession?: () => void
}

export function CustomModeSection({
  isHost,
  session,
  pendingAction,
  onSelectPhase,
  onEndSession,
}: CustomModeSectionProps) {
  const phases = session?.selectablePhases ?? []

  if (!isHost) {
    return (
      <View className='custom-mode-section'>
        <Text>等待主持人选择下一个环节</Text>
      </View>
    )
  }

  return (
    <View className='custom-mode-section'>
      <Text className='custom-mode-section__title'>选择下一个环节</Text>
      {phases.map((phase) => (
        <Button
          key={phase.phase}
          disabled={!!pendingAction || phase.disabled}
          onClick={() => onSelectPhase?.(phase.phase)}
        >
          {phase.emoji} {phase.name}
        </Button>
      ))}
      <Button disabled={!!pendingAction} onClick={onEndSession}>
        结束派对
      </Button>
    </View>
  )
}

export default CustomModeSection
