import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { PhaseHeaderIcon, getPhaseLabel } from '../phaseViews'
import type { SessionPhase } from '../phaseViews'
import {
  ICE_HOST_PHASE_PROMPT_PREFIX,
  ICE_PHASE_ONE_LINE_RULE_PREFIX,
  getIceHostPhasePrompt,
  getIcePhaseOneLineRule,
} from '@shared/copy/icebreakerSession'
import { getApproxPhaseDurationLabel } from '../viewModels/phaseDurationModel'

const OVERLAY_DURATION_MS = 1600
const FADE_OUT_START_MS = 1200

/**
 * P0 补4 (2026-10-20): per-phase one-time rule flag — device-level coachmark
 * precedent (`jj_ib_host_menu_coachmark_seen_v1` in userScopedStorage).
 */
const PHASE_RULE_SEEN_STORAGE_PREFIX = 'jj_ib_phase_rule_seen_v1_'

function readPhaseRuleSeen(phase: SessionPhase): boolean {
  try {
    return Taro.getStorageSync<string>(`${PHASE_RULE_SEEN_STORAGE_PREFIX}${phase}`) === '1'
  } catch {
    return false
  }
}

function persistPhaseRuleSeen(phase: SessionPhase): void {
  try {
    Taro.setStorageSync(`${PHASE_RULE_SEEN_STORAGE_PREFIX}${phase}`, '1')
  } catch {
    // Storage full / unavailable — the rule may re-show once; acceptable.
  }
}

/** Full-screen phase intro overlay — flashes when entering a new phase
 *
 * Shows the phase icon at 160rpx with a dramatic fade-in/scale-up animation,
 * holds for ~1.2s, then fades out. Total duration ~1.6s.
 *
 * S4 (2026-08-11): `mode='field'` suppresses the screen-swap overlay on the
 * glance-stack pilot surfaces — the mood field cross-fades underneath the
 * conversation instead (zone 5: no "screens"). Overlay mode stays the default
 * and serves every non-pilot phase unchanged.
 *
 * P0 补1 (2026-10-20): hosts additionally see a curated 「你可以这样说：…」
 * opener line (zero LLM; copy lives in @shared/copy/icebreakerSession).
 * P0 补4: first-time attendees additionally see a one-line rule, once per
 * phase (device-level seen flag). A first-time host may see both.
 */
export function PhaseIntroOverlay({
  phase,
  visible,
  mode = 'overlay',
  isHost = false,
  onAutoHide,
}: {
  phase: SessionPhase
  visible: boolean
  mode?: 'overlay' | 'field'
  isHost?: boolean
  /** Fired once the overlay has fully hidden itself — the parent uses it to
   *  reset the trigger so the NEXT ritual phase can show again. */
  onAutoHide?: () => void
}) {
  const [show, setShow] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  // P0 补4: whether this device still owes the one-line rule for this phase.
  const [ruleDue, setRuleDue] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      setFadingOut(false)
      return
    }

    // Force remount on rapid transitions — prevents stale timer overlap
    setAnimKey((k) => k + 1)
    setShow(true)
    setFadingOut(false)

    // P0 补4: first attendance at this phase appends the one-line rule —
    // once. Marked seen as it renders so a mid-show kill cannot repeat it.
    const rule = getIcePhaseOneLineRule(phase)
    const due = rule !== null && !readPhaseRuleSeen(phase)
    setRuleDue(due)
    if (due) persistPhaseRuleSeen(phase)

    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true)
    }, FADE_OUT_START_MS)

    const hideTimer = setTimeout(() => {
      setShow(false)
      setFadingOut(false)
      onAutoHide?.()
    }, OVERLAY_DURATION_MS)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(hideTimer)
    }
    // phase is captured intentionally: the parent pulses `visible` per ritual
    // entry; adding phase here would re-fire on every poll re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!show || mode === 'field') return null

  // P0 补1: host-only opener prompt (curated, never LLM).
  const hostPrompt = isHost ? getIceHostPhasePrompt(phase) : null
  // P0 补4: one-line rule for first-time attendees of this phase.
  const oneLineRule = ruleDue ? getIcePhaseOneLineRule(phase) : null
  // P2 #4 (2026-10-20): 「约 N 分钟」 expectation under the label (ritual
  // phases only — the overlay is gated to them). Reads the session duration
  // snapshot (compiled runPlan first); null → no line, never a fabricated
  // number. Always approximate — this is an expectation, not a countdown.
  const durationLabel = getApproxPhaseDurationLabel(phase)

  return (
    <View
      key={animKey}
      className={`phase-intro-overlay ${fadingOut ? 'phase-intro-overlay--out' : ''}`}
      catchMove
    >
      <View className='phase-intro-overlay__content'>
        <PhaseHeaderIcon phase={phase} size={160} />
        <Text className='phase-intro-overlay__label'>{getPhaseLabel(phase)}</Text>
        {durationLabel ? (
          <Text className='phase-intro-overlay__duration'>{durationLabel}</Text>
        ) : null}
        {hostPrompt ? (
          <Text className='phase-intro-overlay__host-prompt'>
            {ICE_HOST_PHASE_PROMPT_PREFIX}{hostPrompt}
          </Text>
        ) : null}
        {oneLineRule ? (
          <Text className='phase-intro-overlay__rule'>
            {ICE_PHASE_ONE_LINE_RULE_PREFIX}{oneLineRule}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
