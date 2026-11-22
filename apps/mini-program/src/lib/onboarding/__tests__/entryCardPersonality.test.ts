import { describe, expect, it } from 'vitest'
import { buildEntryCardPersonalityLine } from '../entryCardPersonality'

describe('buildEntryCardPersonalityLine', () => {
  it('keeps the two most distinctive traits and uses the matching end label', () => {
    expect(
      buildEntryCardPersonalityLine({
        A: 90,
        O: 20,
        C: 50,
        E: 50,
        X: 50,
        P: 50,
      }),
    ).toBe('相处方式：热情亲近 · 传统务实')
  })

  it('uses the low-end label for a trait below the midpoint', () => {
    expect(
      buildEntryCardPersonalityLine({
        A: 50,
        O: 50,
        C: 50,
        E: 18,
        X: 50,
        P: 50,
      }),
    ).toBe('相处方式：情绪敏感')
  })

  it('returns null for a flat profile instead of inventing a claim', () => {
    expect(
      buildEntryCardPersonalityLine({
        A: 50,
        O: 50,
        C: 50,
        E: 50,
        X: 50,
        P: 50,
      }),
    ).toBeNull()
  })

  it('returns null when no scores are available', () => {
    expect(buildEntryCardPersonalityLine(null)).toBeNull()
    expect(buildEntryCardPersonalityLine(undefined)).toBeNull()
    expect(buildEntryCardPersonalityLine({})).toBeNull()
  })

  it('breaks equal-deviation ties by the fixed A/O/C/E/X/P order', () => {
    expect(
      buildEntryCardPersonalityLine({
        A: 80,
        O: 20,
        C: 50,
        E: 50,
        X: 50,
        P: 50,
      }),
    ).toBe('相处方式：热情亲近 · 传统务实')
  })

  it('clamps out-of-range values before ranking them', () => {
    expect(
      buildEntryCardPersonalityLine({
        A: 200,
        O: -20,
        C: 50,
        E: 50,
        X: 50,
        P: 50,
      }),
    ).toBe('相处方式：热情亲近 · 传统务实')
  })
})
