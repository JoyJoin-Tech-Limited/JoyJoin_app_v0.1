import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TRUTH_CEREMONY_CONTINUE_HINT,
  TRUTH_CEREMONY_HOST_NEXT_CTA,
  TRUTH_CEREMONY_STAGE_GATE_BEAT,
  TRUTH_CEREMONY_STAGE_HAPTIC,
  TRUTH_CEREMONY_STAGE_MS,
  TRUTH_CEREMONY_STAGE_TITLE,
  TRUTH_CEREMONY_WAITING_HOST_HINT,
  isCeremonyStageRevealedByBeat,
  planTruthCeremony,
  type TruthCeremonyStage,
} from '../phases/miniScriptTruthCeremonyModel'

const heroSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx'),
  'utf8',
)
const heroStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.scss'),
  'utf8',
)
const hookSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/useTruthCeremonyStage.ts'),
  'utf8',
)

const ALL_STAGES: TruthCeremonyStage[] = ['tally', 'culprit', 'motive', 'honor']

/** Full-ceremony input: flag snapshot on, round 2 played, motion allowed. */
const STAGED_INPUT = {
  solutionRevealed: true,
  v2Enabled: true,
  showTwoStepResults: true,
  hasMotiveText: true,
  hasTallyRows: true,
  reduceMotion: false,
}

/**
 * MiniScript V2 P3 · staged truth-reveal ceremony (locked grill Q13:
 * ceremony strengthening only — no culprit first-person narrative).
 */
describe('planTruthCeremony · mode resolution', () => {
  it('is hidden until the solution is revealed', () => {
    expect(planTruthCeremony({ ...STAGED_INPUT, solutionRevealed: false })).toEqual({
      mode: 'hidden',
      stages: [],
    })
  })

  it('stages the full four-beat ceremony on the flag-on round-2 path', () => {
    // Q14 order: free beats first (tally, motive), then the host-paced
    // climax (culprit) and honor.
    expect(planTruthCeremony(STAGED_INPUT)).toEqual({
      mode: 'staged',
      stages: ['tally', 'motive', 'culprit', 'honor'],
    })
  })

  it('keeps the existing static truth view when the flag snapshot is off', () => {
    expect(planTruthCeremony({ ...STAGED_INPUT, v2Enabled: false }).mode).toBe('static')
  })

  it('keeps the static view when round 2 was never played (single-step / legacy script)', () => {
    expect(planTruthCeremony({ ...STAGED_INPUT, showTwoStepResults: false }).mode).toBe('static')
  })

  it('renders instantly static under reduced motion', () => {
    expect(planTruthCeremony({ ...STAGED_INPUT, reduceMotion: true }).mode).toBe('static')
  })
})

describe('planTruthCeremony · stage composition', () => {
  it('drops the tally stage when round 1 has no tally rows (0-vote force reveal)', () => {
    const plan = planTruthCeremony({ ...STAGED_INPUT, hasTallyRows: false })
    expect(plan.stages).toEqual(['motive', 'culprit', 'honor'])
  })

  it('drops the motive stage when the reveal carries no motive text', () => {
    const plan = planTruthCeremony({ ...STAGED_INPUT, hasMotiveText: false })
    expect(plan.stages).toEqual(['tally', 'culprit', 'honor'])
  })

  it('always lands on the honor stage last', () => {
    for (const hasTallyRows of [true, false]) {
      for (const hasMotiveText of [true, false]) {
        const plan = planTruthCeremony({ ...STAGED_INPUT, hasTallyRows, hasMotiveText })
        expect(plan.stages[plan.stages.length - 1]).toBe('honor')
      }
    }
  })
})

describe('ceremony stage metadata', () => {
  it('defines a positive dwell, a title, and a haptic entry for every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(TRUTH_CEREMONY_STAGE_MS[stage]).toBeGreaterThan(0)
      expect(TRUTH_CEREMONY_STAGE_TITLE[stage].length).toBeGreaterThan(0)
      expect(stage in TRUTH_CEREMONY_STAGE_HAPTIC).toBe(true)
    }
  })

  it('fires the heavy haptic only on the culprit land', () => {
    expect(TRUTH_CEREMONY_STAGE_HAPTIC.culprit).toBe('heavy')
    expect(TRUTH_CEREMONY_STAGE_HAPTIC.honor).toBe('success')
    expect(TRUTH_CEREMONY_STAGE_HAPTIC.tally).toBeNull()
    expect(TRUTH_CEREMONY_STAGE_HAPTIC.motive).toBeNull()
  })

  it('keeps stage copy free of emoji and review-blocked vocabulary', () => {
    for (const stage of ALL_STAGES) {
      const title = TRUTH_CEREMONY_STAGE_TITLE[stage]
      expect(title).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      expect(title).not.toMatch(/匹配|社交|灵魂|撮合|AI/)
    }
    expect(TRUTH_CEREMONY_CONTINUE_HINT).toBe('轻触继续')
  })
})

describe('host-paced ceremony beats (locked Q14)', () => {
  it('gates only culprit (beat 1) and honor (beat 2); tally and motive stay free', () => {
    expect(TRUTH_CEREMONY_STAGE_GATE_BEAT.tally).toBeNull()
    expect(TRUTH_CEREMONY_STAGE_GATE_BEAT.motive).toBeNull()
    expect(TRUTH_CEREMONY_STAGE_GATE_BEAT.culprit).toBe(1)
    expect(TRUTH_CEREMONY_STAGE_GATE_BEAT.honor).toBe(2)
  })

  it('resolves stage visibility from the server beat, never a device clock', () => {
    // Beat 0: free stages visible, both host beats held.
    expect(isCeremonyStageRevealedByBeat('tally', 0)).toBe(true)
    expect(isCeremonyStageRevealedByBeat('motive', 0)).toBe(true)
    expect(isCeremonyStageRevealedByBeat('culprit', 0)).toBe(false)
    expect(isCeremonyStageRevealedByBeat('honor', 0)).toBe(false)
    // Beat 1: culprit lands, honor still held.
    expect(isCeremonyStageRevealedByBeat('culprit', 1)).toBe(true)
    expect(isCeremonyStageRevealedByBeat('honor', 1)).toBe(false)
    // Beat 2: everything visible (rejoin → straight to final).
    expect(isCeremonyStageRevealedByBeat('honor', 2)).toBe(true)
  })

  it('ships emoji-free hold copy for the host CTA and the player wait', () => {
    expect(TRUTH_CEREMONY_HOST_NEXT_CTA).toBe('下一段 ›')
    expect(TRUTH_CEREMONY_WAITING_HOST_HINT).toBe('等主持人揭晓下一段…')
    for (const copy of [TRUTH_CEREMONY_HOST_NEXT_CTA, TRUTH_CEREMONY_WAITING_HOST_HINT]) {
      expect(copy).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  it('passes the server beat into the stage hook', () => {
    expect(heroSource).toContain('session.miniScriptCeremonyBeat ?? 0')
    expect(heroSource).toContain('useTruthCeremonyStage(ceremonyPlan, solutionRevealed, ceremonyBeat)')
    expect(hookSource).toContain('isCeremonyStageRevealedByBeat')
  })

  it('parks the auto-advance timer while a beat is held (sole timer owner)', () => {
    expect(hookSource).toContain('!stageRevealed')
    expect(hookSource).toContain('setTimeout(advance, TRUTH_CEREMONY_STAGE_MS[stage])')
    expect(hookSource).toContain('clearTimeout(timer)')
    // Rejoin lands on the first still-held stage, never a replay.
    expect(hookSource).toContain('rejoinStageIndex')
  })

  it('renders the host 下一段 CTA and the player waiting hint on held beats', () => {
    expect(heroSource).toContain('TRUTH_CEREMONY_HOST_NEXT_CTA')
    expect(heroSource).toContain('TRUTH_CEREMONY_WAITING_HOST_HINT')
    expect(heroSource).toContain('onAdvanceCeremony')
    expect(heroSource).toContain('miniscript-hero__ceremony-hold')
    expect(heroSource).toContain('miniscript-hero__ceremony-next')
    expect(heroSource).toContain('miniscript-hero__ceremony-waiting')
    // N8 (a11y): held beats carry no button role on the container — tap is a
    // no-op there, so role/tap advance only exist once the beat is revealed.
    expect(heroSource).toContain("role={revealed ? 'button' : undefined}")
    // The hold block (host CTA) is a SIBLING of the tap-to-continue stage,
    // never nested inside the button region (button-in-button fix).
    const stageIndex = heroSource.indexOf("className='miniscript-hero__ceremony-stage'")
    const holdIndex = heroSource.indexOf("className='miniscript-hero__ceremony-hold'")
    expect(stageIndex).toBeGreaterThan(-1)
    expect(holdIndex).toBeGreaterThan(stageIndex)
    // Stage haptics wait for the server beat to land.
    expect(heroSource).toContain('if (!ceremonyStage || !ceremonyStageRevealed) return')
  })

  it('ships the hold-view BEM classes with matching CSS', () => {
    expect(heroStyles).toContain('&__ceremony-hold')
    expect(heroStyles).toContain('&__ceremony-next')
    expect(heroStyles).toContain('&__ceremony-next-text')
    expect(heroStyles).toContain('&__ceremony-waiting')
  })
})

describe('ceremony view wiring (structural)', () => {
  it('derives the plan from scalar inputs so a re-polled plan keeps its identity', () => {
    expect(heroSource).toContain('planTruthCeremony({')
    expect(heroSource).toContain('hasMotiveText')
    expect(heroSource).toContain('hasTallyRows')
    expect(heroSource).toContain('reduceMotion: shouldReduceMotion')
    expect(heroSource).toContain('useMiniRevealMotion()')
  })

  it('lets the hook own ALL ceremony timing (sole-owner-of-timing precedent)', () => {
    expect(heroSource).toContain('useTruthCeremonyStage(ceremonyPlan, solutionRevealed, ceremonyBeat)')
    // No sibling timer may drive stage state in the view.
    expect(heroSource).not.toContain('setTimeout(')
    expect(hookSource).toContain('setTimeout(advance, TRUTH_CEREMONY_STAGE_MS[stage])')
    expect(hookSource).toContain('clearTimeout(timer)')
  })

  it('jumps forward on swipe-back / rejoin instead of replaying', () => {
    expect(hookSource).toContain('useDidShow(')
    expect(hookSource).toContain('Number.MAX_SAFE_INTEGER')
    // Rejoin lands on the first still-held stage (beat ≥ 2 → complete).
    expect(hookSource).toContain('rejoinStageIndex(stagesRef.current, serverBeatRef.current)')
  })

  it('renders the staged ceremony only for the flag-on round-2 path', () => {
    expect(heroSource).toContain("ceremonyPlan.mode === 'staged' && !ceremony.isComplete")
    expect(heroSource).toContain('showCeremony ? ceremonyContent : truthContent')
  })

  it('ships every ceremony BEM class with matching CSS', () => {
    const classes = [
      'miniscript-hero__ceremony',
      'miniscript-hero__ceremony-dots',
      'miniscript-hero__ceremony-dot',
      'miniscript-hero__ceremony-dot--active',
      'miniscript-hero__ceremony-dot--past',
      'miniscript-hero__ceremony-stage',
      'miniscript-hero__ceremony-title',
      'miniscript-hero__ceremony-panel',
      'miniscript-hero__ceremony-hint',
      'miniscript-hero__culprit-card',
      'miniscript-hero__culprit-label',
      'miniscript-hero__culprit-name',
      'miniscript-hero__culprit-what',
      'miniscript-hero__motive-card',
      'miniscript-hero__motive-label',
      'miniscript-hero__motive-text',
      'miniscript-hero__honor-cards',
      'miniscript-hero__honor-card',
    ]
    for (const cls of classes) {
      const bemBase = cls.split('--')[0]
      expect(heroStyles).toContain(`&__${bemBase.replace('miniscript-hero__', '')}`)
    }
    // Modifiers exist as nested &-- rules.
    expect(heroStyles).toContain('&--active')
    expect(heroStyles).toContain('&--past')
  })

  it('flattens the ceremony motion in the reduced-motion media query', () => {
    expect(heroStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*miniscript-hero__ceremony-stage[\s\S]*miniscript-hero__honor-card/,
    )
  })
})

describe('honor card polish (structural)', () => {
  it('renders honor names as JoyJoinIcon cards, never raw emoji', () => {
    expect(heroSource).toContain("<JoyJoinIcon emoji='🔍' size={32} />")
    expect(heroSource).toContain('miniscript-hero__honor-card')
  })

  it('staggers the honor-card pop-in with brand entrance easing', () => {
    expect(heroStyles).toMatch(/&__honor-card\s*{[\s\S]*animation: ms-honor-pop 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\) both/)
    expect(heroStyles).toContain('animation-delay: 450ms')
  })

  it('keeps the private wrong-answer feedback gentle and device-private', () => {
    expect(heroSource).toContain('差一点点——当事人其实是')
    expect(heroSource).toContain('honorPrivateLine')
    expect(heroSource).toContain('playerResults.find((r) => r.userId === currentUserId)')
  })
})
