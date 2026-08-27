import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { GUIDANCE_TIP_IDS } from '@shared/api'
import { GUIDANCE_TIP_REGISTRY, isTabPageSurface, isTabPageRoute } from '../registry'
import {
  CEREMONY_IDS,
  __resetCeremoniesForTests,
  enterCeremony,
  exitCeremony,
  isCeremonyActive,
} from '../ceremonyState'
import {
  __resetGuidanceQueueForTests,
  evaluateGuidanceQueue,
  getMountedGuidanceTipId,
  getSessionShownTipIds,
  markTipShown,
  unmountTip,
} from '../../../hooks/useGuidanceQueue'
import { __resetArrivalMigrationForTests } from '../arrivalMigration'

/**
 * GuidanceQueue contract test (C4 onboarding guidance iteration, 2026-08-27 —
 * sprint-contract.c4-guidance-queue, Verification table). Pattern follows
 * miniscriptClientPathContract.test.ts: behavioral assertions against the
 * pure arbitration layer plus structural (source) assertions for the wiring
 * that cannot run under jsdom.
 */

const hookSource = readFileSync(
  resolve(process.cwd(), 'src/hooks/useGuidanceQueue.ts'),
  'utf8',
)
const unboxingCeremonySource = readFileSync(
  resolve(process.cwd(), 'src/components/onboarding/UnboxingCeremony.tsx'),
  'utf8',
)
const squadUnboxingSource = readFileSync(
  resolve(process.cwd(), 'src/pages/squad-unboxing/index.tsx'),
  'utf8',
)
const flashHomeSource = readFileSync(
  resolve(process.cwd(), 'src/pages/alang/event/index.tsx'),
  'utf8',
)
const icebreakerSessionSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.tsx'),
  'utf8',
)
const discoverPageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/discover/index.tsx'),
  'utf8',
)
const discoverScssSource = readFileSync(
  resolve(process.cwd(), 'src/pages/discover/index.scss'),
  'utf8',
)
const tipCardTsxSource = readFileSync(
  resolve(process.cwd(), 'src/components/guidance/GuidanceTipCard.tsx'),
  'utf8',
)

const baseCtx = {
  flagEnabled: true,
  surface: 'discover' as const,
  seenGuidance: {} as Record<string, string>,
  arrivalPending: true,
}

beforeEach(() => {
  __resetGuidanceQueueForTests()
  __resetCeremoniesForTests()
  __resetArrivalMigrationForTests()
})

describe('C5 — registry ⊆ shared server enum', () => {
  it('every registered tip id is a member of GUIDANCE_TIP_IDS (never a silent 400 on dismiss)', () => {
    expect(GUIDANCE_TIP_REGISTRY.length).toBeGreaterThan(0)
    for (const tip of GUIDANCE_TIP_REGISTRY) {
      expect(GUIDANCE_TIP_IDS).toContain(tip.id)
    }
  })

  it('W1 registers only discover_arrival', () => {
    expect(GUIDANCE_TIP_REGISTRY.map((tip) => tip.id)).toEqual(['discover_arrival'])
  })
})

describe('C1 — ≤1 tip mounted app-wide per session', () => {
  it('fires the eligible tip once, then refuses every further evaluation this session', () => {
    const tip = evaluateGuidanceQueue(baseCtx)
    expect(tip?.id).toBe('discover_arrival')

    markTipShown(tip!.id)
    expect(getMountedGuidanceTipId()).toBe('discover_arrival')

    // Same surface, same trigger state — refused.
    expect(evaluateGuidanceQueue(baseCtx)).toBeNull()
    // Different surface — still refused (≤1 app-wide).
    expect(evaluateGuidanceQueue({ ...baseCtx, surface: 'events' })).toBeNull()
    expect(getSessionShownTipIds().has('discover_arrival')).toBe(true)
  })

  it('a second tip can never mount while one is mounted', () => {
    const tip = evaluateGuidanceQueue(baseCtx)
    markTipShown(tip!.id)
    unmountTip(tip!.id)
    expect(getMountedGuidanceTipId()).toBeNull()
    // Mount slot released, but the session shown-set still blocks refire.
    expect(evaluateGuidanceQueue(baseCtx)).toBeNull()
  })
})

describe('C1 amendment — session = JS runtime lifetime; shown-set authoritative', () => {
  it('useDidShow re-fires and backgrounding do NOT reset the shown-set', () => {
    const tip = evaluateGuidanceQueue(baseCtx)
    markTipShown(tip!.id)
    // Repeated evaluations (what useDidShow re-entry does) never refire and
    // never clear module state — only the test-only reset can.
    for (let i = 0; i < 3; i += 1) {
      expect(evaluateGuidanceQueue(baseCtx)).toBeNull()
    }
    expect(getSessionShownTipIds().size).toBe(1)
  })

  it('the in-memory shown-set wins over a stale cached seenGuidance payload', () => {
    const tip = evaluateGuidanceQueue(baseCtx)
    markTipShown(tip!.id)
    // Cached auth payload WITHOUT the tip (stale until refetch) must not
    // re-derive eligibility — the shown-set is consulted first.
    expect(evaluateGuidanceQueue({ ...baseCtx, seenGuidance: {} })).toBeNull()
  })

  it('server-persisted seenGuidance blocks a never-shown-this-session tip', () => {
    expect(
      evaluateGuidanceQueue({ ...baseCtx, seenGuidance: { discover_arrival: '2026-08-27T00:00:00.000Z' } }),
    ).toBeNull()
  })

  it('the hook never resets session state outside the test-only export', () => {
    expect(hookSource).toContain('const sessionShownTipIds = new Set<GuidanceTipId>()')
    // The test-only reset may be DEFINED but never CALLED in product code.
    const nameOccurrences = hookSource.match(/__resetGuidanceQueueForTests/g) ?? []
    expect(nameOccurrences.length).toBe(1)
    expect(hookSource).toContain('export function __resetGuidanceQueueForTests(): void {')
  })
})

describe('C2 — evaluation order and gates', () => {
  it('flag off refuses before anything else', () => {
    expect(evaluateGuidanceQueue({ ...baseCtx, flagEnabled: false })).toBeNull()
  })

  it('refuses while any ceremony is active and recovers after exit', () => {
    enterCeremony(CEREMONY_IDS.unboxing)
    expect(isCeremonyActive()).toBe(true)
    expect(evaluateGuidanceQueue(baseCtx)).toBeNull()
    exitCeremony(CEREMONY_IDS.unboxing)
    expect(isCeremonyActive()).toBe(false)
    expect(evaluateGuidanceQueue(baseCtx)?.id).toBe('discover_arrival')
  })

  it('fires only on tab-page surfaces', () => {
    expect(isTabPageSurface('discover')).toBe(true)
    expect(isTabPageSurface('centerHub')).toBe(true)
    expect(isTabPageSurface('alang')).toBe(false)
    expect(isTabPageRoute('pages/discover/index')).toBe(true)
    expect(isTabPageRoute('/pages/center-hub/index')).toBe(true)
    expect(isTabPageRoute('pages/alang/event/index')).toBe(false)
    expect(evaluateGuidanceQueue({ ...baseCtx, surface: 'alang' as never })).toBeNull()
  })

  it('the hook also checks the live route against the tab-page list', () => {
    expect(hookSource).toContain('isTabPageRoute(routePath)')
    expect(hookSource).toContain('useDidShow(() => {')
  })

  it('the discover_arrival trigger requires the arrival-pending signal', () => {
    expect(evaluateGuidanceQueue({ ...baseCtx, arrivalPending: false })).toBeNull()
  })
})

describe('C3 — dismiss persists before the exit animation starts', () => {
  it('markGuidanceSeen is committed ahead of setExiting in the dismiss handler', () => {
    const dismissStart = hookSource.indexOf('const dismiss = useCallback(')
    const dismissEnd = hookSource.indexOf('const dismissRef = useRef(dismiss)')
    expect(dismissStart).toBeGreaterThan(-1)
    expect(dismissEnd).toBeGreaterThan(dismissStart)
    const dismissSource = hookSource.slice(dismissStart, dismissEnd)
    const commitIndex = dismissSource.indexOf('markGuidanceSeen(tip.id)')
    const exitIndex = dismissSource.indexOf('setExiting(true)')
    expect(commitIndex).toBeGreaterThan(-1)
    expect(exitIndex).toBeGreaterThan(-1)
    expect(commitIndex).toBeLessThan(exitIndex)
  })

  it('auto-dismiss also persists (the dwell timer routes through the same dismiss)', () => {
    expect(hookSource).toContain("dismissRef.current('auto')")
    expect(hookSource).toContain('GUIDANCE_TIP_DWELL_MS')
  })

  it('a failed write keeps the tip eligible next session (fail-safe, logged)', () => {
    expect(hookSource).toContain('tip remains eligible next session')
    expect(hookSource).toContain('persistError: true')
  })

  it('emits guidance_shown and guidance_dismissed through the discover analytics pipe', () => {
    expect(hookSource).toContain("discoverAnalytics.track('guidance_shown'")
    expect(hookSource).toContain("discoverAnalytics.track('guidance_dismissed'")
  })
})

describe('D1/D2 — ceremony suppression surfaces', () => {
  const surfaces = [
    { name: 'UnboxingCeremony', source: unboxingCeremonySource, id: 'CEREMONY_IDS.unboxing' },
    { name: 'squad-unboxing', source: squadUnboxingSource, id: 'CEREMONY_IDS.squadUnboxing' },
    { name: 'Flash home', source: flashHomeSource, id: 'CEREMONY_IDS.flash' },
    { name: 'icebreaker session', source: icebreakerSessionSource, id: 'CEREMONY_IDS.icebreakerSession' },
  ]

  for (const { name, source, id } of surfaces) {
    it(`${name} registers balanced enter/exit with exitCeremony bound to page onUnload`, () => {
      expect(source).toContain(`enterCeremony(${id})`)
      // exitCeremony appears at least twice: effect cleanup AND the onUnload
      // binding — an abnormal teardown must not leak ceremony state.
      const exitCalls = source.match(new RegExp(`exitCeremony\\(${id}\\)`, 'g')) ?? []
      expect(exitCalls.length).toBeGreaterThanOrEqual(2)
      // onUnload binding uses Taro's native page lifecycle hook.
      expect(source).toMatch(/useUnload\(\(\) => exitCeremony\(/)
      expect(source).toMatch(/import[^;]*useUnload[^;]*from '@tarojs\/taro'/)
    })
  }
})

describe('B2/E1 — flag-mutually-exclusive coachmark paths', () => {
  it('the legacy discover coachmark render is flag-gated (off → byte-for-byte legacy)', () => {
    expect(discoverPageSource).toContain('{!guidanceQueueEnabled && showArrivalCoachmark ? (')
  })

  it('the queue tip renders only with the flag on and reuses the arrival copy', () => {
    expect(discoverPageSource).toContain('arrivalTipShowing')
    expect(discoverPageSource).toContain('useGuidanceQueue({ surface: \'discover\', user })')
    expect(discoverPageSource).toContain("getGuidanceTipCopy('discover_arrival')")
  })

  it('the arrivalHookDay tagline yield is preserved under the flag-on path (E1)', () => {
    expect(discoverPageSource).toContain('arrivalHookDayEffective')
    expect(discoverPageSource).toContain('arrivalSeenToday')
    expect(discoverPageSource).toContain('joyjoin_discover_arrival_seen_date')
  })

  it('the consuming page SCSS @use\'s the component SCSS (subpackage rule)', () => {
    expect(discoverScssSource).toContain("@use '../../components/guidance/GuidanceTipCard.scss'")
    // The component must NOT side-effect import its own SCSS in TSX.
    expect(tipCardTsxSource).not.toMatch(/import\s+['"][^'"]*GuidanceTipCard\.scss['"]/)
    expect(tipCardTsxSource).not.toMatch(/require\(['"][^'"]*GuidanceTipCard\.scss['"]\)/)
  })
})
