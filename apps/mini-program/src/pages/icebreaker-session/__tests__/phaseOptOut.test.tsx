import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { PhaseOptOutControl } from '../components/PhaseOptOutControl'
import {
  PHASE_OPT_OUT_COPY,
  classifyPhaseActionError,
  getPhaseCompletionUserIds,
  getPhaseRequiredParticipantIds,
  isFullParticipationPhase,
  isPhaseRosterCompleteForClient,
  resolvePhaseOptOutNotice,
  resolvePhaseOptOutView,
  resolveReadyParticipantIds,
} from '../viewModels/phaseOptOutModel'

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: false }),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

import { haptics } from '../../../lib/utils/haptics'

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_w3',
    icebreakerSessionId: 'ib_w3',
    currentPhase: 'micro_challenge',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: 1_000,
    sessionStartedAt: 500,
    completedPhases: [],
    ...overrides,
  }
}

const baseProps = {
  phase: 'micro_challenge',
  currentUserId: 'me',
  isOptingOut: false,
  onOptOut: vi.fn(),
}

describe('W3 phase opt-out — applicability model', () => {
  it('only offers opt-out for participation:full phases', () => {
    expect(isFullParticipationPhase('micro_challenge')).toBe(true)
    expect(isFullParticipationPhase('lie_detective')).toBe(true)
    expect(isFullParticipationPhase('auction')).toBe(true)
    expect(isFullParticipationPhase('warmup')).toBe(false)
    expect(isFullParticipationPhase('personality_dice')).toBe(false)
    expect(isFullParticipationPhase('recap')).toBe(false)
    expect(isFullParticipationPhase('phase_selection')).toBe(false)
  })

  it('shows the affordance when the viewer has not opted out or completed', () => {
    const view = resolvePhaseOptOutView(makeState(), 'micro_challenge', 'me')
    expect(view).toMatchObject({ applicable: true, hasOptedOut: false, showAffordance: true })
  })

  it('renders opt_out state once the viewer is in phaseOptOutUserIds', () => {
    const view = resolvePhaseOptOutView(
      makeState({ phaseOptOutUserIds: ['me'] }),
      'micro_challenge',
      'me',
    )
    expect(view.hasOptedOut).toBe(true)
    expect(view.showAffordance).toBe(false)
  })

  it('treats silent auto-complete as complete, not opted-out', () => {
    const view = resolvePhaseOptOutView(
      makeState({ phaseSilentCompletedUserIds: ['me'] }),
      'micro_challenge',
      'me',
    )
    expect(view.hasOptedOut).toBe(false)
    expect(view.isSilentCompleted).toBe(true)
    expect(view.showAffordance).toBe(false)
  })

  it('hides the affordance once the viewer is in the phase completion array', () => {
    const view = resolvePhaseOptOutView(
      makeState({ challengeCompletedBy: ['me'] }),
      'micro_challenge',
      'me',
    )
    expect(view.hasCompleted).toBe(true)
    expect(view.showAffordance).toBe(false)
  })

  it('mirrors the server completion-array mapping per phase', () => {
    const state = makeState({
      warmupReadyUserIds: ['w'],
      challengeCompletedBy: ['m'],
      lieDetectiveCompletedUserIds: ['l'],
      quipBattleVotedUserIds: ['q'],
      groupMirrorSubmittedUserIds: ['g'],
      undercoverWordVotedUserIds: ['u'],
    })
    expect(getPhaseCompletionUserIds(state, 'warmup')).toEqual(['w'])
    expect(getPhaseCompletionUserIds(state, 'micro_challenge')).toEqual(['m'])
    expect(getPhaseCompletionUserIds(state, 'lie_detective')).toEqual(['l'])
    expect(getPhaseCompletionUserIds(state, 'quip_battle')).toEqual(['q'])
    expect(getPhaseCompletionUserIds(state, 'group_mirror')).toEqual(['g'])
    expect(getPhaseCompletionUserIds(state, 'undercover_word')).toEqual(['u'])
    // Phases without a persisted completion array stay undefined (server parity).
    expect(getPhaseCompletionUserIds(state, 'auction')).toBeUndefined()
    expect(getPhaseCompletionUserIds(state, 'mini_script')).toBeUndefined()
  })

  it('never applies to a non-full phase even with opt-out markers', () => {
    const view = resolvePhaseOptOutView(
      makeState({ currentPhase: 'warmup', phaseOptOutUserIds: ['me'] }),
      'warmup',
      'me',
    )
    expect(view.applicable).toBe(false)
    expect(view.showAffordance).toBe(false)
  })
})

describe('W3 phase opt-out — ready set includes opted-out / silent players', () => {
  it('unions generated players with server-completed players, deduped', () => {
    const { readyIds, readyCount } = resolveReadyParticipantIds(['a', 'b', 'b'], ['b', 'c'])
    expect(readyCount).toBe(3)
    expect([...readyIds].sort()).toEqual(['a', 'b', 'c'])
  })

  it('counts a pure opt-out player with no generated content', () => {
    const { readyCount } = resolveReadyParticipantIds([], ['opt-out-player'])
    expect(readyCount).toBe(1)
  })

  it('the lie-detective card reads the ready union and ships no skipped badge', () => {
    const source = readFileSync(
      resolve(__dirname, '../phases/LieDetectiveHeroView.tsx'),
      'utf8',
    )
    expect(source).toContain('resolveReadyParticipantIds(')
    expect(source).toContain('doneCount={readyCount}')
    expect(source).not.toContain('skipped')
  })
})

describe('W3 phase opt-out — snapshot-scoped completion (late-joiner safe)', () => {
  it('required set is the snapshot minus opted-out and silent members', () => {
    const state = makeState({
      phaseRosterSnapshot: ['a', 'b', 'c'],
      phaseOptOutUserIds: ['b'],
      phaseSilentCompletedUserIds: ['c'],
    })
    expect(getPhaseRequiredParticipantIds(state)).toEqual(['a'])
  })

  it('dedupes the snapshot and returns [] when it is absent', () => {
    expect(getPhaseRequiredParticipantIds(makeState())).toEqual([])
    expect(
      getPhaseRequiredParticipantIds(makeState({ phaseRosterSnapshot: ['a', 'a', 'b'] })),
    ).toEqual(['a', 'b'])
  })

  it('a mid-phase late joiner cannot disable the host advance (snapshot wins)', () => {
    // Snapshot has 2 members, both complete; playerCount grew to 3 when a late
    // joiner arrived after phase entry. The old `>= playerCount` check would
    // wrongly stay false and disable 进入下一阶段.
    const state = makeState({
      currentPhase: 'micro_challenge',
      playerCount: 3,
      phaseRosterSnapshot: ['a', 'b'],
      challengeCompletedBy: ['a', 'b'],
    })
    expect(isPhaseRosterCompleteForClient(state, 'micro_challenge', state.playerCount)).toBe(true)
  })

  it('stays incomplete while a required snapshot member is outstanding', () => {
    const state = makeState({
      phaseRosterSnapshot: ['a', 'b'],
      challengeCompletedBy: ['a'],
    })
    expect(isPhaseRosterCompleteForClient(state, 'micro_challenge', state.playerCount)).toBe(false)
  })

  it('passes once every required member completes, even with an opt-out', () => {
    const state = makeState({
      phaseRosterSnapshot: ['a', 'b'],
      phaseOptOutUserIds: ['b'],
      challengeCompletedBy: ['a'],
    })
    expect(isPhaseRosterCompleteForClient(state, 'micro_challenge', state.playerCount)).toBe(true)
  })

  it('completes when every snapshot member has departed (server parity)', () => {
    const state = makeState({
      phaseRosterSnapshot: ['a'],
      phaseOptOutUserIds: ['a'],
    })
    expect(isPhaseRosterCompleteForClient(state, 'micro_challenge', 5)).toBe(true)
  })

  it('keeps legacy count semantics when the session predates the snapshot', () => {
    expect(
      isPhaseRosterCompleteForClient(
        makeState({ playerCount: 4, challengeCompletedBy: ['a', 'b', 'c'] }),
        'micro_challenge',
        4,
      ),
    ).toBe(false)
    expect(
      isPhaseRosterCompleteForClient(
        makeState({ playerCount: 3, challengeCompletedBy: ['a', 'b', 'c'] }),
        'micro_challenge',
        3,
      ),
    ).toBe(true)
  })
})

describe('W3 phase opt-out — no client deadlock in full phases', () => {
  const readPhase = (file: string) =>
    readFileSync(resolve(__dirname, `../phases/${file}`), 'utf8')

  it('quip battle submit gate reads submitted ∪ completed', () => {
    const source = readPhase('QuipBattleHeroView.tsx')
    expect(source).toContain('const submittedOrCompleted = new Set([...submittedUserIds, ...votedUserIds])')
    expect(source).toContain('const allSubmitted = submittedOrCompleted.size >= playerCount')
  })

  it('undercover word describe gate counts explicit opt-out/silent markers (never round votes)', () => {
    const source = readPhase('UndercoverWordHeroView.tsx')
    expect(source).toContain('...completedUserIds,')
    expect(source).toContain('describedUserIds.size >= playerCount')
  })

  it('mini-script advance stays host-driven (not gated on per-player readiness)', () => {
    const source = readPhase('MiniScriptHeroView.tsx')
    expect(source).toMatch(/onClick=\{onAdvance\}\s+disabled=\{isAdvancing\}/)
  })
})

describe('W3 phase opt-out — failure classification (no generic toast)', () => {
  it('classifies the three locked error codes from the response body', () => {
    expect(classifyPhaseActionError({ data: { code: 'PHASE_MISMATCH' } })).toBe('PHASE_MISMATCH')
    expect(classifyPhaseActionError({ data: { code: 'OPT_OUT_NOT_APPLICABLE' } })).toBe('OPT_OUT_NOT_APPLICABLE')
    expect(classifyPhaseActionError({ data: { code: 'PHASE_ROSTER_LOCKED' } })).toBe('PHASE_ROSTER_LOCKED')
  })

  it('classifies 410 / SESSION_EXPIRED as expired', () => {
    expect(classifyPhaseActionError({ statusCode: 410 })).toBe('SESSION_EXPIRED')
    expect(classifyPhaseActionError(new Error('SESSION_EXPIRED'))).toBe('SESSION_EXPIRED')
  })

  it('falls back to UNKNOWN for anything unmapped', () => {
    expect(classifyPhaseActionError(new Error('boom'))).toBe('UNKNOWN')
    expect(classifyPhaseActionError(undefined)).toBe('UNKNOWN')
  })

  it('resolves code-specific copy and never the generic fallback for the three codes', () => {
    const mismatch = resolvePhaseOptOutNotice({ data: { code: 'PHASE_MISMATCH' } })
    const notApplicable = resolvePhaseOptOutNotice({ data: { code: 'OPT_OUT_NOT_APPLICABLE' } })
    const rosterLocked = resolvePhaseOptOutNotice({ data: { code: 'PHASE_ROSTER_LOCKED' } })

    expect(mismatch.title).toBe('环节已经切换')
    expect(notApplicable.title).toBe('这一轮不能跳过')
    expect(rosterLocked.title).toBe('这一轮已经开始')
    for (const notice of [mismatch, notApplicable, rosterLocked]) {
      expect(notice.title).not.toBe('操作没成功')
    }
  })
})

describe('W3 phase opt-out — control rendering', () => {
  beforeEach(() => {
    vi.mocked(haptics).mockClear()
    baseProps.onOptOut.mockClear()
  })

  it('renders the 只想听 affordance and fires opt-out with a light haptic', () => {
    render(<PhaseOptOutControl {...baseProps} state={makeState()} />)
    expect(screen.getByText(PHASE_OPT_OUT_COPY.affordanceLabel)).toBeTruthy()
    expect(screen.getByText(PHASE_OPT_OUT_COPY.affordanceHint)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: PHASE_OPT_OUT_COPY.affordanceLabel }))
    expect(haptics).toHaveBeenCalledWith('light')
    expect(baseProps.onOptOut).toHaveBeenCalledTimes(1)
  })

  it('renders the opt_out state once the viewer opted out, with no affordance', () => {
    render(
      <PhaseOptOutControl
        {...baseProps}
        state={makeState({ phaseOptOutUserIds: ['me'] })}
      />,
    )
    expect(screen.getByText(PHASE_OPT_OUT_COPY.optedOutTitle)).toBeTruthy()
    expect(screen.getByText(PHASE_OPT_OUT_COPY.optedOutBody)).toBeTruthy()
    expect(screen.queryByText(PHASE_OPT_OUT_COPY.affordanceLabel)).toBeNull()
  })

  it('renders nothing for a non-full phase', () => {
    const { container } = render(
      <PhaseOptOutControl {...baseProps} phase='warmup' state={makeState({ currentPhase: 'warmup' })} />,
    )
    expect(container.textContent).toBe('')
  })

  it('shows the busy label and ignores taps while opting out', () => {
    render(<PhaseOptOutControl {...baseProps} isOptingOut state={makeState()} />)
    expect(screen.getByText(PHASE_OPT_OUT_COPY.busyLabel)).toBeTruthy()
    fireEvent.click(screen.getByText(PHASE_OPT_OUT_COPY.busyLabel))
    expect(baseProps.onOptOut).not.toHaveBeenCalled()
  })

  it('renders the inline, code-specific notice', () => {
    render(
      <PhaseOptOutControl
        {...baseProps}
        state={makeState()}
        notice={resolvePhaseOptOutNotice({ data: { code: 'PHASE_ROSTER_LOCKED' } })}
      />,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('这一轮已经开始')).toBeTruthy()
  })
})

describe('W3 phase opt-out — G2 roster-locked observer', () => {
  beforeEach(() => {
    vi.mocked(haptics).mockClear()
    baseProps.onOptOut.mockClear()
  })

  it('hides the affordance for a roster-locked late-join observer', () => {
    const { container } = render(
      <PhaseOptOutControl {...baseProps} rosterLocked state={makeState()} />,
    )
    expect(screen.queryByText(PHASE_OPT_OUT_COPY.affordanceLabel)).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('still renders the opted-out state when rosterLocked (opted-out wins)', () => {
    render(
      <PhaseOptOutControl
        {...baseProps}
        rosterLocked
        state={makeState({ phaseOptOutUserIds: ['me'] })}
      />,
    )
    expect(screen.getByText(PHASE_OPT_OUT_COPY.optedOutTitle)).toBeTruthy()
  })

  it('passes lieRosterLocked into the control from SessionPhaseViews', () => {
    const source = readFileSync(
      resolve(__dirname, '../SessionPhaseViews.tsx'),
      'utf8',
    )
    expect(source).toContain('rosterLocked={lieRosterLocked}')
  })
})

describe('W3 phase opt-out — G3 silent auto-complete surfaced', () => {
  it('renders the honest silent-complete state instead of nothing', () => {
    render(
      <PhaseOptOutControl
        {...baseProps}
        state={makeState({ phaseSilentCompletedUserIds: ['me'] })}
      />,
    )
    expect(screen.getByText(PHASE_OPT_OUT_COPY.silentTitle)).toBeTruthy()
    expect(screen.getByText(PHASE_OPT_OUT_COPY.silentBody)).toBeTruthy()
    expect(screen.queryByText(PHASE_OPT_OUT_COPY.affordanceLabel)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
