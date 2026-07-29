import { View, Text } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import type { CTAState } from '../viewModels/warmupViewModels'
import { haptics } from '../../../lib/utils/haptics'
import './WarmupActionBar.scss'

interface WarmupActionBarProps {
  ctaState: CTAState
  isReady: boolean
  isHost: boolean
  everyoneReady: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
  isAdvancing: boolean
  onToggleReady: () => void
  onNextTopic: () => void
  onAdvance: () => void
}

export function WarmupActionBar({
  ctaState,
  isReady,
  isHost,
  everyoneReady,
  isUpdatingReady,
  isAdvancingTopic,
  isAdvancing,
  onToggleReady,
  onNextTopic,
  onAdvance,
}: WarmupActionBarProps) {
  const isLoading = isUpdatingReady || isAdvancingTopic || isAdvancing

  const handlePrimary = () => {
    if (isLoading) return
    haptics('medium')
    if (ctaState.primaryAction === 'advance_phase') {
      onAdvance()
      return
    }
    if (ctaState.primaryAction === 'next_topic') {
      onNextTopic()
      return
    }
    onToggleReady()
  }

  const handleSecondary = () => {
    if (isLoading) return
    haptics('light')
    onNextTopic()
  }

  const handleCancel = () => {
    if (isLoading) return
    haptics('light')
    onToggleReady()
  }

  const primaryButton = (
    <Button
      key={ctaState.primary}
      variant={ctaState.primaryAction === 'toggle_ready' && isReady ? 'secondary' : 'primary'}
      className={`warmup-action__primary ${
        ctaState.primaryAction === 'toggle_ready' && isReady ? 'warmup-action__primary--ready' : ''
      }`}
      onClick={handlePrimary}
      disabled={isLoading}
      loading={isLoading}
    >
      <View className='warmup-action__primary-inner'>
        {ctaState.primaryAction === 'toggle_ready' && isReady && (
          <JoyJoinIcon emoji='✓' tier='status' size={24} />
        )}
        <Text className='warmup-action__primary-text'>{ctaState.primary}</Text>
      </View>
    </Button>
  )
  const showSecondaryRegion =
    ctaState.showCancel || ctaState.secondaryVisible || !isHost

  return (
    <View className='warmup-action'>
      <View className='warmup-action__primary-wrap'>
        {primaryButton}
      </View>

      {showSecondaryRegion ? <View className='warmup-action__secondary'>
        {ctaState.showCancel && (
          <View
            className='warmup-action__cancel'
            onClick={handleCancel}
            hoverClass='warmup-action__cancel--pressed'
            role='button'
            aria-label='取消准备'
          >
            <Text className='warmup-action__cancel-text'>取消</Text>
          </View>
        )}

        {ctaState.secondaryVisible && (
          <View
            className='warmup-action__text-btn'
            onClick={handleSecondary}
            hoverClass='warmup-action__text-btn--pressed'
            role='button'
            aria-label='进入下一题'
          >
            <Text className='warmup-action__text-btn-label'>进入下一题 ›</Text>
          </View>
        )}

        {!isHost && !everyoneReady && (
          <Text className='warmup-action__helper'>
            大家都准备好后，主持人才可以推进下一步
          </Text>
        )}

        {!isHost && everyoneReady && (
          <Text className='warmup-action__helper'>等主持人开始～</Text>
        )}
      </View> : null}
    </View>
  )
}
