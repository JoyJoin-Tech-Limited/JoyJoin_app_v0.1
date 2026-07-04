import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
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
        <Text className='custom-mode-section__waiting'>等待主持人选择下一个环节</Text>
      </View>
    )
  }

  const handlePhaseTap = (phase: SocialIcebreakerPhase, disabled: boolean, disabledReason?: string) => {
    if (pendingAction) return
    if (disabled) {
      Taro.showToast({ title: disabledReason || '该玩法暂未开放', icon: 'none', duration: 2000 })
      return
    }
    onSelectPhase?.(phase)
  }

  return (
    <View className='custom-mode-section'>
      <Text className='custom-mode-section__title'>选择下一个环节</Text>
      {phases.map((phase) => (
        <View
          key={phase.phase}
          className={`custom-mode-section__btn${phase.disabled ? ' custom-mode-section__btn--disabled' : ''}`}
          hoverClass={phase.disabled ? 'none' : 'custom-mode-section__btn--pressed'}
          onClick={() => handlePhaseTap(phase.phase, phase.disabled, phase.disabledReason)}
        >
          <Text className='custom-mode-section__btn-emoji'>{phase.emoji}</Text>
          <Text className='custom-mode-section__btn-label'>{phase.name}</Text>
          {phase.disabledReason && (
            <Text className='custom-mode-section__btn-hint'>{phase.disabledReason}</Text>
          )}
        </View>
      ))}
      <View
        className='custom-mode-section__btn custom-mode-section__btn--end'
        hoverClass='custom-mode-section__btn--pressed'
        onClick={() => !pendingAction && onEndSession?.()}
      >
        <Text className='custom-mode-section__btn-label'>结束派对</Text>
      </View>
    </View>
  )
}

export default CustomModeSection
