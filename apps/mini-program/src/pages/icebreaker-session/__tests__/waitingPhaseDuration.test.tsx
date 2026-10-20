import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaitingPhase from '../components/WaitingPhase'
import {
  clearPhaseDurationSource,
  syncPhaseDurationSource,
} from '../viewModels/phaseDurationModel'

// ── P2 #4 环节时长预期 (2026-10-20) — waiting 环节链条「约N分钟」render ──
// Mirrors waitingPhaseContract.test.tsx's harness; duration source priority:
// compiled runPlan snapshot → static tier plan (the currentTier prop) →
// CUSTOM_GAME_OPTIONS. Always 「约」 — never a countdown.

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../../lib/utils/cdnAssets', () => ({
  localAsset: (p: string) => p,
  cdnAsset: (p: string) => p,
}))

vi.mock('../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/mock/xiaoyue.webp',
}))

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => true,
}))

vi.mock('../../../components/ui/Card', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='card'>{children}</div>,
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('../components/WaitingBeat', () => ({
  default: () => <div data-testid='waiting-beat' />,
}))

vi.mock('../components/IcebreakerTierSelector', () => ({
  default: () => <div data-testid='tier-selector' />,
}))

vi.mock('../../../components/mascot/ArchetypeHead', () => ({
  default: () => <div data-testid='archetype-head' />,
}))

vi.mock('../../../components/mascot/MissingArchetypePlaceholder', () => ({
  default: () => <div data-testid='missing-archetype' />,
}))

const GLOW_PHASE_MAP = [
  { key: 'warmup', label: '话题卡', current: false },
  { key: 'lie_detective', label: '谎言侦探', current: false },
  { key: 'recap', label: '回顾', current: false },
]

const baseProps = {
  playerCount: 3,
  hostName: '悦仔测试',
  isHost: false,
  currentTier: 'glow' as const,
  canChangeTier: false,
  onChangeTier: () => {},
  onAdvance: () => {},
  participants: [],
  phaseMapItems: GLOW_PHASE_MAP,
}

afterEach(() => {
  clearPhaseDurationSource()
})

describe('WaitingPhase P2 #4 约N分钟 chain', () => {
  it('suffixes each phase name with the static tier-plan expectation while no snapshot exists', () => {
    render(<WaitingPhase {...baseProps} />)
    // glow plan: warmup 8 / lie_detective 15 / recap 5
    expect(screen.getByText('约8分钟', { exact: false })).toBeTruthy()
    expect(screen.getByText('约15分钟', { exact: false })).toBeTruthy()
    expect(screen.getByText('约5分钟', { exact: false })).toBeTruthy()
  })

  it('prefers the compiled runPlan snapshot over the static tier plan', () => {
    syncPhaseDurationSource({
      eventTier: 'glow',
      runPlan: {
        segments: [
          { phase: 'warmup', allocatedMinutes: 9 },
          { phase: 'lie_detective', allocatedMinutes: 18 },
          { phase: 'recap', allocatedMinutes: 5 },
        ],
      },
    })
    render(<WaitingPhase {...baseProps} />)
    expect(screen.getByText('约9分钟', { exact: false })).toBeTruthy()
    expect(screen.getByText('约18分钟', { exact: false })).toBeTruthy()
    expect(screen.queryByText('约8分钟', { exact: false })).toBeNull()
  })

  it('falls back to CUSTOM_GAME_OPTIONS minutes for phases outside the tier plan', () => {
    render(
      <WaitingPhase
        {...baseProps}
        phaseMapItems={[{ key: 'speed_friending', label: '轮桌畅聊', current: false }]}
      />,
    )
    expect(screen.getByText('约20分钟', { exact: false })).toBeTruthy()
  })

  it('omits the suffix when no source can price the phase (never fabricates)', () => {
    // Custom-tier sessions have no static tier plan, and warmup/recap are
    // absent from CUSTOM_GAME_OPTIONS → label only, no minutes.
    render(
      <WaitingPhase
        {...baseProps}
        currentTier={'custom' as never}
        phaseMapItems={[
          { key: 'warmup', label: '话题卡', current: false },
          { key: 'auction', label: '拍卖', current: false },
        ]}
      />,
    )
    expect(screen.getByText('话题卡', { exact: false })).toBeTruthy()
    expect(screen.queryByText('约8分钟', { exact: false })).toBeNull()
    // auction prices from CUSTOM_GAME_OPTIONS (20) even on the custom tier.
    expect(screen.getByText('约20分钟', { exact: false })).toBeTruthy()
  })
})
