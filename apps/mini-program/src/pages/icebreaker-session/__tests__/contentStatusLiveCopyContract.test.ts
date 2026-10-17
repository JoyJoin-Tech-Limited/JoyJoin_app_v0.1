import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import {
  GENERATING_COPY_STAGE_DELAY_MS,
  getGeneratingLiveCopy,
  isContentGenerating,
  type GenerativeContentPhase,
} from '../viewModels/generatingLiveCopy'

const SESSION_DIR = resolve(process.cwd(), 'src/pages/icebreaker-session')

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSources(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const readSrc = (rel: string) => readFileSync(resolve(SESSION_DIR, rel), 'utf8')

/** Strip comments so the invariant scans code, not the prose that documents
 *  it (warmupDockStructureContract precedent — the ban itself is written
 *  down in comments, which must not trip the assertion). */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u

const FIVE_PHASES: GenerativeContentPhase[] = [
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'auction',
  'personality_dice',
]

/**
 * Wave 3 (icebreaker-uiux-wave3, contract AC-07): live generating copy for
 * the five AI-generative phases.
 *
 * RENDER-GUARD INVARIANT (评审 M9): the live copy gate is POSITIVE equality
 * on `'generating'` only. A negative comparison (`!== 'idle'`) is forbidden
 * because the `*ContentStatus` fields are absent when the
 * `icebreakerContentStatusEnabled` flag is off, and `undefined !== 'idle'`
 * is true — a negative guard would render the live copy for every flag-off
 * client. This suite source-scans the whole subpackage for the forbidden
 * shape (warmupDockStructureContract precedent).
 */
describe('contentStatus live copy — render-guard invariant (wave3 AC-07)', () => {
  it('no `!== \'idle\'` negative comparison anywhere in the subpackage', () => {
    const offenders: string[] = []
    for (const file of collectSources(SESSION_DIR)) {
      const source = stripComments(readFileSync(file, 'utf8'))
      if (/!==\s*'idle'/.test(source) || /!==\s*"idle"/.test(source)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('isContentGenerating is true ONLY for the positive generating state', () => {
    expect(isContentGenerating('generating')).toBe(true)
    // Field absent (flag off / legacy session) must fall through to the
    // static waiting copy — the AC-03 fallback contract.
    expect(isContentGenerating(undefined)).toBe(false)
    expect(isContentGenerating('idle')).toBe(false)
    expect(isContentGenerating('ready')).toBe(false)
    expect(isContentGenerating('failed')).toBe(false)
  })

  it('every generative phase has staged, zero-emoji, mascot-led copy', () => {
    for (const phase of FIVE_PHASES) {
      const stage0 = getGeneratingLiveCopy(phase, 0)
      const stage1 = getGeneratingLiveCopy(phase, 1)
      expect(stage0.length).toBeGreaterThan(0)
      expect(stage1.length).toBeGreaterThan(0)
      expect(stage0).not.toBe(stage1)
      expect(stage0).toContain(DEFAULT_MASCOT_DISPLAY_NAME)
      // Zero emoji on primary copy; no AI/matching vocabulary (WeChat
      // review posture) — the words below must never appear in live copy.
      expect(emojiPattern.test(stage0)).toBe(false)
      expect(emojiPattern.test(stage1)).toBe(false)
      expect(stage0).not.toMatch(/AI|匹配|社交|灵魂/)
      expect(stage1).not.toMatch(/AI|匹配|社交|灵魂/)
    }
    // Warmup precedent: a static line past ~4s reads as a hang, so the
    // staged swap must land well inside the 6s LLM race window.
    expect(GENERATING_COPY_STAGE_DELAY_MS).toBeLessThanOrEqual(5000)
  })

  it('all five HeroViews consume the live copy hook', () => {
    const expectations: Array<[string, string]> = [
      ['phases/QuipBattleHeroView.tsx', "useGeneratingLiveCopy('quip_battle', contentStatus)"],
      ['phases/UndercoverWordHeroView.tsx', "useGeneratingLiveCopy('undercover_word', contentStatus)"],
      ['phases/GroupMirrorHeroView.tsx', "useGeneratingLiveCopy('group_mirror', contentStatus)"],
      ['phases/PersonalityDiceHeroView.tsx', "useGeneratingLiveCopy('personality_dice', contentStatus)"],
      // Auction owns the full session prop and reads the field off it.
      ['phases/AuctionHeroView.tsx', "useGeneratingLiveCopy('auction', session.auctionContentStatus)"],
    ]
    for (const [file, needle] of expectations) {
      expect(readSrc(file)).toContain(needle)
    }
  })

  it('live copy only ever OVERRIDES the static line via nullish fallback', () => {
    // `generatingLiveCopy ?? (...static copy...)` — the static waiting copy
    // stays the default when the field is absent (flag off / legacy).
    for (const file of [
      'phases/QuipBattleHeroView.tsx',
      'phases/UndercoverWordHeroView.tsx',
      'phases/GroupMirrorHeroView.tsx',
      'phases/PersonalityDiceHeroView.tsx',
      'phases/AuctionHeroView.tsx',
    ]) {
      expect(readSrc(file)).toContain('generatingLiveCopy ??')
    }
  })

  it('SessionPhaseViews threads the four flag-gated fields into the views', () => {
    const source = readSrc('SessionPhaseViews.tsx')
    expect(source).toContain('contentStatus={session.quipContentStatus}')
    expect(source).toContain('contentStatus={session.undercoverContentStatus}')
    expect(source).toContain('contentStatus={session.groupMirrorContentStatus}')
    expect(source).toContain('contentStatus={session.diceContentStatus}')
  })
})

/**
 * Wave 3 (contract AC-07 stall 条款): warmup is the ONLY phase with a
 * client stall exit (host 「不等了，直接继续」). It must never render within
 * GENERATING_STALL_SUPPRESS_MS of the generating start — and the window is
 * measured from the poll-observed flip (device clock), never the
 * server-stamped `warmupTopicsGeneratingAt` (clock-skew canon 2026-08-13).
 * Phases without a stall exit gain nothing (the five generative phases have
 * no client stall exit by design).
 */
describe('contentStatus stall suppression (wave3 AC-07 stall clause)', () => {
  const pageSource = readSrc('index.tsx')

  it('client compiles the shared 30s constant (single source in packages/shared)', () => {
    expect(pageSource).toContain("import { GENERATING_STALL_SUPPRESS_MS } from '@shared/socialIcebreaker'")
  })

  it('stall exit is suppressed inside the generating window', () => {
    expect(pageSource).toContain("session?.warmupTopicsStatus === 'generating'")
    expect(pageSource).toContain('Date.now() - topicsGeneratingObservedAt < GENERATING_STALL_SUPPRESS_MS')
    expect(pageSource).toContain('&& !stallExitSuppressed')
  })

  it('never compares the server-stamped generating timestamp (clock-skew canon)', () => {
    expect(pageSource).not.toMatch(/Date\.now\(\)\s*-\s*session\?\.warmupTopicsGeneratingAt/)
    expect(pageSource).not.toMatch(/Date\.now\(\)\s*-\s*\w*warmupTopicsGeneratingAt/)
  })
})
