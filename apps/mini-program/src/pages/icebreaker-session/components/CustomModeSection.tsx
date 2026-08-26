import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'

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
  const hostName = session?.hostDisplayName || '主持人'
  const [selectedPhase, setSelectedPhase] = useState<SocialIcebreakerPhase | null>(null)
  const isSelecting = pendingAction === 'select-phase'

  useEffect(() => {
    if (!isSelecting) {
      setSelectedPhase(null)
    }
  }, [isSelecting])

  if (!isHost) {
    return (
      <View className='custom-mode-section'>
        <View className='custom-mode-section__role-card'>
          <Text className='custom-mode-section__role-kicker'>当前由主持人推进</Text>
          <Text className='custom-mode-section__role-name'>{hostName}</Text>
          <Text className='custom-mode-section__role-copy'>请稍等，主持人选择后会自动进入下一个玩法。</Text>
        </View>
      </View>
    )
  }

  const handlePhaseTap = (phase: SocialIcebreakerPhase, disabled: boolean, disabledReason?: string) => {
    if (pendingAction) return
    if (disabled) {
      Taro.showToast({ title: disabledReason || '该玩法暂未开放', icon: 'none', duration: 2000 })
      return
    }
    setSelectedPhase(phase)
    onSelectPhase?.(phase)
  }

  return (
    <View className='custom-mode-section'>
      <View className='custom-mode-section__header'>
        <View>
          <Text className='custom-mode-section__title'>选择下一个环节</Text>
          <Text className='custom-mode-section__subtitle'>你是主持人，选择后全员同步进入玩法</Text>
        </View>
        <Text className='custom-mode-section__host-badge'>主持人</Text>
      </View>
      {phases.map((phase) => (
        <View
          key={phase.phase}
          className={`custom-mode-section__btn${phase.disabled || isSelecting ? ' custom-mode-section__btn--disabled' : ''}${selectedPhase === phase.phase ? ' custom-mode-section__btn--selected' : ''}`}
          hoverClass={phase.disabled || isSelecting ? 'none' : 'custom-mode-section__btn--pressed'}
          onClick={() => handlePhaseTap(phase.phase, phase.disabled, phase.disabledReason)}
        >
          <JoyJoinIcon emoji={phase.emoji} tier='phase' size={20} className='custom-mode-section__btn-emoji' />
          <Text className='custom-mode-section__btn-label'>{phase.name}</Text>
          {(phase.disabledReason || selectedPhase === phase.phase) && (
            <Text className='custom-mode-section__btn-hint'>
              {selectedPhase === phase.phase ? '同步中…' : phase.disabledReason}
            </Text>
          )}
        </View>
      ))}
      <View
        className={`custom-mode-section__btn custom-mode-section__btn--end${pendingAction ? ' custom-mode-section__btn--disabled' : ''}`}
        hoverClass={pendingAction ? 'none' : 'custom-mode-section__btn--pressed'}
        onClick={() => !pendingAction && onEndSession?.()}
      >
        <JoyJoinIcon className='custom-mode-section__btn-emoji' emoji='✓' tier='status' size={24} />
        <Text className='custom-mode-section__btn-label'>结束派对</Text>
      </View>
    </View>
  )
}

export default CustomModeSection
