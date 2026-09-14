import { View, Text } from '@tarojs/components'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { haptics } from '../../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import {
  PHASE_OPT_OUT_COPY,
  resolvePhaseOptOutView,
  type PhaseActionNotice,
} from '../viewModels/phaseOptOutModel'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

export interface PhaseOptOutControlProps {
  phase: string
  state: SocialSessionState
  currentUserId: string
  isOptingOut: boolean
  /**
   * G2: the viewer is a late-join observer refused by the lie-detective roster
   * snapshot (`PHASE_ROSTER_LOCKED`). The observer card already explains the
   * situation, so the opt-out affordance is suppressed — otherwise it renders
   * 只想听 and immediately errors again.
   */
  rosterLocked?: boolean
  /** Inline, code-specific failure copy (never a bare generic toast). */
  notice?: PhaseActionNotice | null
  onOptOut: () => void
}

/**
 * PhaseOptOutControl — W3 honest opt-out for `participation: 'full'` phases.
 *
 * Renders a quiet 「只想听」 affordance next to the phase card and, once the
 * viewer is in `phaseOptOutUserIds`, the `opt_out` state. Opted-out players are
 * counted as complete by the phase card's own counter (server appends them to
 * the completion array), so there is deliberately no separate "skipped" badge.
 * Silent auto-complete (`phaseSilentCompletedUserIds`) renders its own honest
 * state, and a roster-locked late joiner gets no affordance at all.
 */
export function PhaseOptOutControl({
  phase,
  state,
  currentUserId,
  isOptingOut,
  rosterLocked = false,
  notice,
  onOptOut,
}: PhaseOptOutControlProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const view = resolvePhaseOptOutView(state, phase, currentUserId)

  if (!view.applicable) {
    return null
  }

  const motionClass = shouldReduceMotion ? ' phase-opt-out--reduced-motion' : ''

  if (view.hasOptedOut) {
    return (
      <View
        className={`phase-opt-out phase-opt-out--opted-out${motionClass}`}
        role='status'
        aria-live='polite'
      >
        <Text className='phase-opt-out__state-title'>{PHASE_OPT_OUT_COPY.optedOutTitle}</Text>
        <Text className='phase-opt-out__state-body'>{PHASE_OPT_OUT_COPY.optedOutBody}</Text>
      </View>
    )
  }

  // G3: silent auto-complete has a server-written outcome, so it must render a
  // small honest state rather than returning null (which read as a dead surface).
  if (view.isSilentCompleted) {
    return (
      <View
        className={`phase-opt-out phase-opt-out--silent${motionClass}`}
        role='status'
        aria-live='polite'
      >
        <Text className='phase-opt-out__state-title'>{PHASE_OPT_OUT_COPY.silentTitle}</Text>
        <Text className='phase-opt-out__state-body'>{PHASE_OPT_OUT_COPY.silentBody}</Text>
      </View>
    )
  }

  // G2: a roster-locked late joiner must not see the affordance — the server
  // would reject with PHASE_ROSTER_LOCKED. The observer card owns the message.
  if (rosterLocked) {
    return null
  }

  if (!view.showAffordance) {
    return null
  }

  const handleTap = () => {
    if (isOptingOut) return
    haptics('light')
    onOptOut()
  }

  return (
    <View className='phase-opt-out'>
      <View
        className={`phase-opt-out__action${isOptingOut ? ' phase-opt-out__action--busy' : ''}`}
        role='button'
        aria-label={PHASE_OPT_OUT_COPY.affordanceLabel}
        aria-disabled={isOptingOut}
        hoverClass='phase-opt-out__action--pressed'
        onClick={handleTap}
      >
        <Text className='phase-opt-out__action-label'>
          {isOptingOut ? PHASE_OPT_OUT_COPY.busyLabel : PHASE_OPT_OUT_COPY.affordanceLabel}
        </Text>
      </View>
      <Text className='phase-opt-out__hint'>{PHASE_OPT_OUT_COPY.affordanceHint}</Text>
      {notice ? (
        <View className='phase-opt-out__notice' role='alert'>
          <Text className='phase-opt-out__notice-title'>{notice.title}</Text>
          <Text className='phase-opt-out__notice-body'>{notice.body}</Text>
        </View>
      ) : null}
    </View>
  )
}
