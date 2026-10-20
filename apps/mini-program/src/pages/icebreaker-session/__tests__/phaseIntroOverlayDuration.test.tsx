import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { PhaseIntroOverlay } from '../overlays/PhaseIntroOverlay'
import {
  clearPhaseDurationSource,
  syncPhaseDurationSource,
} from '../viewModels/phaseDurationModel'

// ── P2 #4 环节时长预期 (2026-10-20) — PhaseIntroOverlay label 下一行 ──────
// The overlay fires on ritual-phase entries; the 「约N分钟」 line reads the
// session duration snapshot (compiled runPlan first) and stays absent when
// no source can price the phase (never a fabricated number, never a
// countdown).

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: () => '',
    setStorageSync: () => {},
  },
}))

vi.mock('../phaseViews', () => ({
  PhaseHeaderIcon: () => <div data-testid='phase-icon' />,
  getPhaseLabel: (phase: string) =>
    phase === 'mini_script' ? '迷你剧本杀' : phase === 'recap' ? '回顾' : phase,
}))

afterEach(() => {
  clearPhaseDurationSource()
})

describe('PhaseIntroOverlay P2 #4 约N分钟 line', () => {
  it('renders the expectation under the label from the compiled runPlan snapshot', async () => {
    syncPhaseDurationSource({
      eventTier: 'glow',
      runPlan: { segments: [{ phase: 'mini_script', allocatedMinutes: 27 }] },
    })
    render(<PhaseIntroOverlay phase='mini_script' visible />)
    expect(await screen.findByText('迷你剧本杀')).toBeTruthy()
    expect(screen.getByText('约27分钟')).toBeTruthy()
  })

  it('falls back to static sources (CUSTOM_GAME_OPTIONS 25) without a compiled segment', () => {
    syncPhaseDurationSource({ eventTier: 'glow' })
    render(<PhaseIntroOverlay phase='mini_script' visible />)
    expect(screen.getByText('约25分钟')).toBeTruthy()
  })

  it('renders the tier-plan recap expectation', () => {
    syncPhaseDurationSource({ eventTier: 'glow' })
    render(<PhaseIntroOverlay phase='recap' visible />)
    expect(screen.getByText('约5分钟')).toBeTruthy()
  })

  it('omits the line when no source exists (label still renders, never fabricates)', () => {
    clearPhaseDurationSource()
    render(<PhaseIntroOverlay phase='mini_script' visible />)
    expect(screen.getByText('迷你剧本杀')).toBeTruthy()
    expect(screen.queryByText(/约\d+分钟/)).toBeNull()
  })

  it('keeps the line out of the field-mode pilot (mode=field renders nothing)', () => {
    syncPhaseDurationSource({ eventTier: 'glow' })
    const { container } = render(<PhaseIntroOverlay phase='warmup' visible mode='field' />)
    expect(container.innerHTML).toBe('')
  })
})
