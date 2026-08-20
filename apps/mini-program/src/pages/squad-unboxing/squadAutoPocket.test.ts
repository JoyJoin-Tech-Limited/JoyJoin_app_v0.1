// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createSquadAutoPocketSession,
  type SquadAutoPocketArmInput,
} from './squadAutoPocket'
import { AUTO_POCKET_DELAY_MS } from './squadDeckCollapseState'
import {
  SETTLE_BREATH_DELAY_MS,
  SETTLE_BREATH_DURATION_MS,
  SETTLE_BREATH_TOTAL_MS,
  computeBurstTotalMs,
} from './squadDealTiming'

// Auto-pocket handoff (2026-08-19): after ALL cards flip face-up in an
// interactive session, the deck folds itself into the pill via the exact
// manual-collapse path. These tests pin the arm/cancel/fire semantics with
// injected fake timers — no Taro component is rendered.

const here = dirname(fileURLToPath(import.meta.url))

/** Manual timer harness — deterministic wall-clock for the injected timers. */
function createTimerHarness() {
  let now = 0
  let nextId = 1
  const pending: { id: number; cb: () => void; fireAt: number }[] = []
  const setTimer = (cb: () => void, ms: number) => {
    const id = nextId
    nextId += 1
    pending.push({ id, cb, fireAt: now + ms })
    return id
  }
  const clearTimer = (handle: unknown) => {
    const index = pending.findIndex((entry) => entry.id === handle)
    if (index >= 0) pending.splice(index, 1)
  }
  const advance = (ms: number) => {
    const target = now + ms
    for (;;) {
      const due = pending
        .filter((entry) => entry.fireAt <= target)
        .sort((a, b) => a.fireAt - b.fireAt || a.id - b.id)[0]
      if (!due) break
      pending.splice(pending.indexOf(due), 1)
      now = due.fireAt
      due.cb()
    }
    now = target
  }
  return { setTimer, clearTimer, advance, pendingCount: () => pending.length }
}

const baseArmInput: SquadAutoPocketArmInput = {
  interactive: true,
  deckPhase: 'fan',
  focusedIndex: -1,
  visibleCount: 5,
  pocketDeckEnabled: true,
  motionInstant: false,
  storyMode: false,
  lastFlipCount: 1,
}

function createSession(overrides: { canFire?: () => boolean } = {}) {
  const timers = createTimerHarness()
  const fired: string[] = []
  const session = createSquadAutoPocketSession({
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    canFire: overrides.canFire ?? (() => true),
    onFire: () => fired.push('fire'),
  })
  return { session, timers, fired }
}

describe('squadAutoPocket — timing constants stay aligned with the settle breath', () => {
  it('holds the fold until the breath finishes plus the quiet beat', () => {
    expect(SETTLE_BREATH_DELAY_MS).toBe(420)
    expect(SETTLE_BREATH_DURATION_MS).toBe(480)
    expect(SETTLE_BREATH_TOTAL_MS).toBe(900)
    expect(AUTO_POCKET_DELAY_MS).toBe(500)
  })
})

describe('squadAutoPocket — arm + fire', () => {
  it('fires exactly once after the settle breath + hold on motion tiers', () => {
    const { session, timers, fired } = createSession()
    session.arm(baseArmInput)
    expect(session.getState()).toBe('armed')
    timers.advance(SETTLE_BREATH_TOTAL_MS + AUTO_POCKET_DELAY_MS - 1)
    expect(fired).toHaveLength(0)
    timers.advance(1)
    expect(fired).toHaveLength(1)
    expect(session.getState()).toBe('fired')
    // At most once per session: further time and re-arm attempts are no-ops.
    timers.advance(10_000)
    session.arm(baseArmInput)
    timers.advance(10_000)
    expect(fired).toHaveLength(1)
  })

  it('shortens the pre-fold wait to burst + hold on reduce-motion / degradation tiers', () => {
    const { session, timers, fired } = createSession()
    session.arm({ ...baseArmInput, motionInstant: true })
    const waitMs = computeBurstTotalMs(baseArmInput.lastFlipCount) + AUTO_POCKET_DELAY_MS
    timers.advance(waitMs - 1)
    expect(fired).toHaveLength(0)
    timers.advance(1)
    expect(fired).toHaveLength(1)
  })

  it('waits out a reveal-all burst on instant tiers so the fire-time guard can pass', () => {
    const { session, timers, fired } = createSession()
    session.arm({ ...baseArmInput, motionInstant: true, lastFlipCount: 6 })
    const waitMs = computeBurstTotalMs(6) + AUTO_POCKET_DELAY_MS
    // Halfway through the burst the fold must not fire (guard would fail).
    timers.advance(Math.floor(waitMs / 2))
    expect(fired).toHaveLength(0)
    timers.advance(waitMs - Math.floor(waitMs / 2))
    expect(fired).toHaveLength(1)
  })

  it('consumes the handoff without firing when a fire-time guard fails (user beat the fold)', () => {
    const { session, timers, fired } = createSession({ canFire: () => false })
    session.arm(baseArmInput)
    timers.advance(SETTLE_BREATH_TOTAL_MS + AUTO_POCKET_DELAY_MS + 100)
    expect(fired).toHaveLength(0)
    expect(session.getState()).toBe('cancelled')
    // Never re-arms afterwards.
    session.arm(baseArmInput)
    expect(timers.pendingCount()).toBe(0)
  })

  it('destroy clears the pending timer (unmount / groupId swap)', () => {
    const { session, timers, fired } = createSession()
    session.arm(baseArmInput)
    session.destroy()
    expect(timers.pendingCount()).toBe(0)
    timers.advance(10_000)
    expect(fired).toHaveLength(0)
  })
})

describe('squadAutoPocket — cancel-permanent (掌控感)', () => {
  it('never fires when the user focuses a card during the hold — even after unfocus + more time', () => {
    const { session, timers, fired } = createSession()
    session.arm(baseArmInput)
    timers.advance(300)
    // User taps a card mid-hold → the page calls cancelPermanently.
    session.cancelPermanently()
    expect(session.getState()).toBe('cancelled')
    timers.advance(10_000)
    expect(fired).toHaveLength(0)
    // Cancel is permanent for the session: re-arm attempts are no-ops.
    session.arm(baseArmInput)
    expect(timers.pendingCount()).toBe(0)
    timers.advance(10_000)
    expect(fired).toHaveLength(0)
  })

  it('cancel before arming is a harmless no-op', () => {
    const { session } = createSession()
    session.cancelPermanently()
    expect(session.getState()).toBe('idle')
  })
})

describe('squadAutoPocket — arm gates', () => {
  it('never arms for non-interactive (revisit / allRevealed) sessions', () => {
    const { session, timers } = createSession()
    session.arm({ ...baseArmInput, interactive: false })
    expect(session.getState()).toBe('idle')
    expect(timers.pendingCount()).toBe(0)
  })

  it('never arms when the deck already starts pocketed from persisted state', () => {
    const { session, timers } = createSession()
    session.arm({ ...baseArmInput, deckPhase: 'pocketed' })
    expect(session.getState()).toBe('idle')
    expect(timers.pendingCount()).toBe(0)
  })

  it('never arms over a focused card (the last-flip one-step beat focuses)', () => {
    const { session, timers } = createSession()
    session.arm({ ...baseArmInput, focusedIndex: 2 })
    expect(session.getState()).toBe('idle')
    expect(timers.pendingCount()).toBe(0)
  })

  it('never arms with zero visible cards, a disabled kill switch, or story mode', () => {
    const zeroCards = createSession()
    zeroCards.session.arm({ ...baseArmInput, visibleCount: 0 })
    expect(zeroCards.session.getState()).toBe('idle')

    const killSwitch = createSession()
    killSwitch.session.arm({ ...baseArmInput, pocketDeckEnabled: false })
    expect(killSwitch.session.getState()).toBe('idle')

    // Screenshot story states stay timer-independent (deterministic captures).
    const story = createSession()
    story.session.arm({ ...baseArmInput, storyMode: true })
    expect(story.session.getState()).toBe('idle')
  })
})

describe('squadAutoPocket — module purity (same split as squadFlipState)', () => {
  it('stays pure: no Taro, no storage, no direct timer globals', () => {
    const source = readFileSync(resolve(here, 'squadAutoPocket.ts'), 'utf8')
    expect(source).not.toContain("from '@tarojs/taro'")
    expect(source).not.toContain('StorageSync')
    expect(source).not.toContain('setTimeout')
  })
})
