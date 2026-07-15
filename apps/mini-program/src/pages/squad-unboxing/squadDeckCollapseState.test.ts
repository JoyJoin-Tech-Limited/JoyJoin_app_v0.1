// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FOLD_CARD_EXIT_MS,
  FOLD_SETTLE_INSTANT_MS,
  FOLD_STAGGER_MS,
  FOLD_TOTAL_BUDGET_MS,
  HEARTBEAT_STAGGER_MS,
  UNFOLD_RELEASE_MS,
  UNFOLD_STAGGER_MS,
  UNFOLD_TOTAL_BUDGET_MS,
  computeFoldDelayById,
  computeFoldOrder,
  computeFoldStaggerMs,
  computeFoldTotalMs,
  computeUnfoldDelayById,
  computeUnfoldStaggerMs,
  computeUnfoldTotalMs,
  getDeckCollapseHintKey,
  getDeckCollapseKey,
} from './squadDeckCollapseState'

const here = dirname(fileURLToPath(import.meta.url))

// "Pocket the deck" two-phase collapse (locked contract:
// sprint-contract.squad-unboxing-pocket-deck-20260715.md). The fold cascade
// must fit its ≤600ms budget, the 最佳拍档 card folds last, the heartbeat
// haptic keeps a ≥80ms stagger, and the phase machine never persists the
// transient folding/unfolding windows.

describe('squadDeckCollapseState — fold order (AC-02)', () => {
  it('keeps roster order and moves the 最佳拍档 card to the END', () => {
    expect(computeFoldOrder(['a', 'b', 'c', 'd'], 'c')).toEqual(['a', 'b', 'd', 'c'])
  })

  it('is a pure reorder when there is no best partner (or it is not visible)', () => {
    expect(computeFoldOrder(['a', 'b', 'c'], null)).toEqual(['a', 'b', 'c'])
    expect(computeFoldOrder(['a', 'b', 'c'], 'zzz')).toEqual(['a', 'b', 'c'])
  })

  it('handles a lone card', () => {
    expect(computeFoldOrder(['me'], 'me')).toEqual(['me'])
  })
})

describe('squadDeckCollapseState — fold timing budget (AC-02)', () => {
  it('compresses the stagger so the cascade never exceeds 600ms', () => {
    for (let count = 1; count <= 12; count += 1) {
      expect(computeFoldTotalMs(count)).toBeLessThanOrEqual(FOLD_TOTAL_BUDGET_MS)
    }
  })

  it('targets ~50ms stagger and never exceeds it', () => {
    for (let count = 2; count <= 12; count += 1) {
      expect(computeFoldStaggerMs(count)).toBeLessThanOrEqual(FOLD_STAGGER_MS)
    }
    // Within the product domain (≤8-member tables) the stagger stays ≥40ms,
    // comfortably above the tactile floor (same discipline as the deal).
    for (let count = 2; count <= 8; count += 1) {
      expect(computeFoldStaggerMs(count)).toBeGreaterThanOrEqual(40)
    }
  })

  it('gives a single card no stagger and a lone fold of one exit transition', () => {
    expect(computeFoldStaggerMs(1)).toBe(0)
    expect(computeFoldTotalMs(1)).toBe(FOLD_CARD_EXIT_MS)
  })

  it('keeps the reduced-motion crossfade at 150ms (AC-06)', () => {
    expect(FOLD_SETTLE_INSTANT_MS).toBeLessThanOrEqual(200)
    expect(FOLD_SETTLE_INSTANT_MS).toBeGreaterThanOrEqual(150)
  })
})

describe('squadDeckCollapseState — fold delays (最佳拍档 folds last)', () => {
  it('assigns ascending delays in fold order with the best partner last', () => {
    const delays = computeFoldDelayById(['a', 'b', 'c', 'd'], 'c')
    expect(delays.get('c')).toBeGreaterThan(delays.get('d') ?? -1)
    expect(delays.get('a')).toBe(0)
    expect(delays.get('b')).toBeGreaterThan(delays.get('a') ?? 1)
  })

  it('keeps the heartbeat haptic stagger ≥80ms (two distinct pulses)', () => {
    expect(HEARTBEAT_STAGGER_MS).toBeGreaterThanOrEqual(80)
  })
})

describe('squadDeckCollapseState — unfold timing', () => {
  it('compresses the re-fan so it never exceeds the unfold budget', () => {
    for (let count = 1; count <= 12; count += 1) {
      expect(computeUnfoldTotalMs(count)).toBeLessThanOrEqual(UNFOLD_TOTAL_BUDGET_MS)
    }
  })

  it('unfolds in roster order (no best-partner slot on the way out)', () => {
    const delays = computeUnfoldDelayById(['a', 'b', 'c'])
    expect(delays.get('a')).toBe(0)
    expect(delays.get('b')).toBe(computeUnfoldStaggerMs(3))
    expect(delays.get('c')).toBe(2 * computeUnfoldStaggerMs(3))
  })

  it('caps the re-fan stagger and leaves a visibility-commit frame gap', () => {
    expect(UNFOLD_STAGGER_MS).toBeLessThanOrEqual(FOLD_STAGGER_MS)
    expect(UNFOLD_RELEASE_MS).toBeGreaterThanOrEqual(50)
  })
})

describe('squadDeckCollapseState — storage keys (mirror jj_revealed pattern)', () => {
  it('builds the collapsed-phase key per group', () => {
    expect(getDeckCollapseKey('group-1')).toBe('jj_deck_collapsed_group-1')
  })

  it('builds the one-time first-collapse hint key per group', () => {
    expect(getDeckCollapseHintKey('group-1')).toBe('jj_deck_collapse_hint_group-1')
  })
})

describe('squadDeckCollapseState — module purity (MNT-03)', () => {
  it('stays pure: no Taro, no storage, no timers', () => {
    const source = readFileSync(resolve(here, 'squadDeckCollapseState.ts'), 'utf8')
    expect(source).not.toContain("from '@tarojs/taro'")
    expect(source).not.toContain('StorageSync')
    expect(source).not.toContain('setTimeout')
  })
})
