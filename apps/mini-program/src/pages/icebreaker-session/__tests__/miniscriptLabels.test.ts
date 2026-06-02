import { describe, expect, it } from 'vitest'
import {
  MINI_SCRIPT_STYLE_OPTIONS,
  MINI_SCRIPT_GENRE_OPTIONS,
  DEFAULT_MINI_SCRIPT_GENRES,
} from '../miniscriptLabels'

// ── MINI_SCRIPT_STYLE_OPTIONS ──────────────────────────────────────────
describe('MINI_SCRIPT_STYLE_OPTIONS', () => {
  it('has exactly 7 style options', () => {
    expect(MINI_SCRIPT_STYLE_OPTIONS).toHaveLength(7)
  })

  it('has unique value keys', () => {
    const values = MINI_SCRIPT_STYLE_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('has unique labels', () => {
    const labels = MINI_SCRIPT_STYLE_OPTIONS.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('every option has a non-empty label and value', () => {
    for (const opt of MINI_SCRIPT_STYLE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0)
      expect(opt.value.length).toBeGreaterThan(0)
    }
  })

  it('includes expected style values', () => {
    const values = MINI_SCRIPT_STYLE_OPTIONS.map((o) => o.value)
    expect(values).toContain('western_court')
    expect(values).toContain('medieval')
    expect(values).toContain('ancient_chinese')
    expect(values).toContain('xianxia')
    expect(values).toContain('future_tech')
    expect(values).toContain('modern_urban')
    expect(values).toContain('republican_era')
  })
})

// ── MINI_SCRIPT_GENRE_OPTIONS ──────────────────────────────────────────
describe('MINI_SCRIPT_GENRE_OPTIONS', () => {
  it('has exactly 4 genre options', () => {
    expect(MINI_SCRIPT_GENRE_OPTIONS).toHaveLength(4)
  })

  it('has unique value keys', () => {
    const values = MINI_SCRIPT_GENRE_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('has unique labels', () => {
    const labels = MINI_SCRIPT_GENRE_OPTIONS.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('every option has a non-empty label and value', () => {
    for (const opt of MINI_SCRIPT_GENRE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0)
      expect(opt.value.length).toBeGreaterThan(0)
    }
  })

  it('includes expected genre values', () => {
    const values = MINI_SCRIPT_GENRE_OPTIONS.map((o) => o.value)
    expect(values).toContain('light_reasoning')
    expect(values).toContain('thriller_mystery')
    expect(values).toContain('romance')
    expect(values).toContain('absurd_comedy')
  })
})

// ── DEFAULT_MINI_SCRIPT_GENRES ─────────────────────────────────────────
describe('DEFAULT_MINI_SCRIPT_GENRES', () => {
  it('includes all genre values by default', () => {
    expect(DEFAULT_MINI_SCRIPT_GENRES).toHaveLength(4)
    expect(DEFAULT_MINI_SCRIPT_GENRES).toContain('light_reasoning')
    expect(DEFAULT_MINI_SCRIPT_GENRES).toContain('thriller_mystery')
    expect(DEFAULT_MINI_SCRIPT_GENRES).toContain('romance')
    expect(DEFAULT_MINI_SCRIPT_GENRES).toContain('absurd_comedy')
  })

  it('only contains values from MINI_SCRIPT_GENRE_OPTIONS', () => {
    const validValues = new Set(MINI_SCRIPT_GENRE_OPTIONS.map((g) => g.value))
    for (const g of DEFAULT_MINI_SCRIPT_GENRES) {
      expect(validValues.has(g)).toBe(true)
    }
  })

  it('has no duplicate genres', () => {
    expect(new Set(DEFAULT_MINI_SCRIPT_GENRES).size).toBe(
      DEFAULT_MINI_SCRIPT_GENRES.length,
    )
  })
})
