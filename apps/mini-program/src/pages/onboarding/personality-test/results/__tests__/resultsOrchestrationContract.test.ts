import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The orchestration layer moved into sibling hooks (2026-08-18 split, mirrors
// the icebreaker-session SessionPhaseViews/useSocialActions pattern); the page
// keeps data derivation, feature-flag profile selection, and the stage
// dispatch JSX. These contracts keep that boundary from eroding in either
// direction.
const pageSource = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')
const revealSource = readFileSync(resolve(__dirname, '../hooks/useResultsRevealSequence.ts'), 'utf8')
const loginSource = readFileSync(resolve(__dirname, '../hooks/useResultsLoginHandoff.ts'), 'utf8')

describe('personality results orchestration split', () => {
  it('keeps the page as a thin composition root wired to the sibling hooks', () => {
    expect(pageSource).toContain('useResultsRevealSequence({')
    expect(pageSource).toContain('useResultsXiaoyueAnalysis({')
    expect(pageSource).toContain('useResultsLoginHandoff({')
    expect(pageSource).not.toContain('runResultFlow = useCallback')
    expect(pageSource).not.toContain('fetchXiaoyueAnalysis = useCallback')
    expect(pageSource).not.toContain('handleContinue = useCallback')
  })

  it('keeps the slot → reveal → bridge → result state machine in the reveal hook', () => {
    expect(revealSource).toContain("analytics.interaction('slot_animation_start'")
    expect(revealSource).toContain("analytics.interaction('slot_near_miss'")
    expect(revealSource).toContain("analytics.errorOccurred('results_loading_stuck'")
    // Flow markers must not drift back into the page.
    expect(pageSource).not.toContain('slot_animation_start')
    expect(pageSource).not.toContain('slot_near_miss')
    expect(pageSource).not.toContain('slot_rare_variant')
  })

  it('keeps the login handoff dwell discipline in the login hook', () => {
    expect(loginSource).toContain('LOGIN_HANDOFF_MIN_VISIBLE_MS = 1200')
    expect(loginSource).toContain("analytics.errorOccurred('login_handoff_failed'")
    expect(pageSource).not.toContain('LOGIN_HANDOFF_MIN_VISIBLE_MS')
    expect(pageSource).not.toContain('authenticateMiniProgramUserWithTest')
  })

  it('keeps the stage dispatch JSX and hidden canvases on the page', () => {
    expect(pageSource).toContain("case 'slot':")
    expect(pageSource).toContain("case 'reveal':")
    expect(pageSource).toContain("case 'bridge':")
    expect(pageSource).toContain("case 'result':")
    expect(pageSource).toContain('PERSONALITY_SHARE_POSTER_CANVAS_ID')
    expect(pageSource).toContain('personality-results__skip-button')
  })

  it('stays under the harness gate warn threshold (1200 lines)', () => {
    expect(pageSource.split('\n').length).toBeLessThan(1200)
  })
})
