import { View, Text } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import type { CTAState } from '../viewModels/warmupViewModels'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

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
  /** AC-07 — host stall exit, visible only while the stall nudge is live. */
  stallExitVisible?: boolean
  onStallExit?: () => void
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
  stallExitVisible = false,
  onStallExit,
}: WarmupActionBarProps) {
  const isLoading = isUpdatingReady || isAdvancingTopic || isAdvancing

  const handlePrimary = () => {
    if (isLoading) return
    // Confirm haptic is action-owned (performSocialAction) — no raw tap buzz.
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
    onNextTopic()
  }

  const handleCancel = () => {
    if (isLoading) return
    onToggleReady()
  }

  const handleStallExit = () => {
    if (isLoading) return
    onStallExit?.()
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

      {stallExitVisible && isHost && (
        <View
          className='warmup-action__stall-exit'
          onClick={handleStallExit}
          hoverClass='warmup-action__stall-exit--pressed'
          role='button'
          aria-label='不等了，直接继续'
        >
          <Text className='warmup-action__stall-exit-text'>不等了，直接继续 ›</Text>
        </View>
      )}
    </View>
  )
}
