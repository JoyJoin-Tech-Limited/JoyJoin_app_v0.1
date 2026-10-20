import { afterEach, describe, expect, it } from 'vitest'
import {
  clearPhaseDurationSource,
  formatApproxPhaseDuration,
  getApproxPhaseDurationLabel,
  resolveApproxPhaseDurationLabel,
  resolvePhaseDurationMinutes,
  syncPhaseDurationSource,
} from '../viewModels/phaseDurationModel'

// 2026-10-20 P2 #4 环节时长预期 — 「约 N 分钟」数据源优先级与展示纪律。
// Compiled runPlan（session state 权威）→ 静态 tier plan → CUSTOM_GAME_OPTIONS。

afterEach(() => {
  clearPhaseDurationSource()
})

describe('resolvePhaseDurationMinutes', () => {
  it('prefers the compiled run plan over every static source', () => {
    // lie_detective static = 15 (glow); compiler raises it for larger rosters.
    const source = {
      eventTier: 'glow',
      runPlan: {
        segments: [
          { phase: 'warmup', allocatedMinutes: 9 },
          { phase: 'lie_detective', allocatedMinutes: 18 },
        ],
      },
    }
    expect(resolvePhaseDurationMinutes(source, 'lie_detective')).toBe(18)
    expect(resolvePhaseDurationMinutes(source, 'warmup')).toBe(9)
  })

  it('falls back to the static tier plan when the compiled plan is absent', () => {
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'warmup')).toBe(8)
    expect(resolvePhaseDurationMinutes({ eventTier: 'breeze' }, 'warmup')).toBe(10)
    expect(resolvePhaseDurationMinutes({ eventTier: 'blaze' }, 'quip_battle')).toBe(17)
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'recap')).toBe(5)
  })

  it('falls back through the tier plan to CUSTOM_GAME_OPTIONS minutes', () => {
    // speed_friending / undercover_word exist in no preset tier plan.
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'speed_friending')).toBe(20)
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'undercover_word')).toBe(12)
    // mini_script is compiler-appended (not in static tier plans) → 25.
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'mini_script')).toBe(25)
    // custom tier sessions have no static tier plan at all.
    expect(resolvePhaseDurationMinutes({ eventTier: 'custom' }, 'auction')).toBe(20)
    expect(resolvePhaseDurationMinutes({ eventTier: 'custom' }, 'quip_battle')).toBe(12)
  })

  it('ignores non-positive compiled minutes and drops to the next source', () => {
    const source = {
      eventTier: 'glow',
      runPlan: { segments: [{ phase: 'warmup', allocatedMinutes: 0 }] },
    }
    expect(resolvePhaseDurationMinutes(source, 'warmup')).toBe(8)
  })

  it('returns null for meta phases and unknown phases — never fabricates', () => {
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'waiting')).toBeNull()
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'ended')).toBeNull()
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'phase_selection')).toBeNull()
    expect(resolvePhaseDurationMinutes({ eventTier: 'glow' }, 'not_a_phase')).toBeNull()
    // warmup/recap are absent from CUSTOM_GAME_OPTIONS → null on custom tier.
    expect(resolvePhaseDurationMinutes({ eventTier: 'custom' }, 'warmup')).toBeNull()
    expect(resolvePhaseDurationMinutes(null, 'warmup')).toBeNull()
  })
})

describe('formatApproxPhaseDuration / resolveApproxPhaseDurationLabel', () => {
  it('always renders with the 约 prefix (expectation, never a countdown)', () => {
    expect(formatApproxPhaseDuration(8)).toBe('约8分钟')
    expect(resolveApproxPhaseDurationLabel({ eventTier: 'glow' }, 'warmup')).toBe('约8分钟')
    expect(resolveApproxPhaseDurationLabel({ eventTier: 'glow' }, 'waiting')).toBeNull()
  })
})

describe('module snapshot channel', () => {
  it('serves the synced compiled source until cleared', () => {
    expect(getApproxPhaseDurationLabel('warmup')).toBeNull()
    syncPhaseDurationSource({
      eventTier: 'glow',
      runPlan: { segments: [{ phase: 'warmup', allocatedMinutes: 9 }] },
    })
    expect(getApproxPhaseDurationLabel('warmup')).toBe('约9分钟')
    clearPhaseDurationSource()
    expect(getApproxPhaseDurationLabel('warmup')).toBeNull()
  })

  it('fails closed with zero session context — never prices from custom options alone', () => {
    // mini_script prices at 25 via CUSTOM_GAME_OPTIONS when a tier context
    // exists; with NO snapshot and NO fallback the label must stay absent
    // (regression lock: a null snapshot used to leak the custom-only price).
    expect(getApproxPhaseDurationLabel('mini_script')).toBeNull()
    expect(getApproxPhaseDurationLabel('auction')).toBeNull()
  })

  it('uses the caller-provided fallback only while the snapshot is absent', () => {
    const fallback = { eventTier: 'glow' }
    expect(getApproxPhaseDurationLabel('warmup', fallback)).toBe('约8分钟')
    syncPhaseDurationSource({
      eventTier: 'blaze',
      runPlan: { segments: [{ phase: 'warmup', allocatedMinutes: 7 }] },
    })
    // Snapshot wins over the fallback once present.
    expect(getApproxPhaseDurationLabel('warmup', fallback)).toBe('约7分钟')
  })

  it('keeps working when the session carries no plan (custom sessions)', () => {
    syncPhaseDurationSource({ eventTier: 'custom' })
    expect(getApproxPhaseDurationLabel('auction')).toBe('约20分钟')
    expect(getApproxPhaseDurationLabel('warmup')).toBeNull()
  })
})
