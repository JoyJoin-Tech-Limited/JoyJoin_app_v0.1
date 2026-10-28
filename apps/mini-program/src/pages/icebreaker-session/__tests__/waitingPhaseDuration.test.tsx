import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaitingPhase from '../components/WaitingPhase'

// Quiet Concierge: waiting 只展示 current / next / final，不再渲染完整
// phase 链或逐项分钟预期。未知/custom 走一条诚实的通用提示。

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

describe('WaitingPhase Quiet Concierge guide window', () => {
  it('shows only current / next / final instead of the full phase chain', () => {
    const { container } = render(<WaitingPhase {...baseProps} />)
    expect(container.querySelectorAll('.icebreaker__waiting-phase')).toHaveLength(3)
    expect(screen.getByText(/现在开始/)).toBeTruthy()
    expect(screen.getByText(/下一环/)).toBeTruthy()
    expect(screen.getByText(/最后/)).toBeTruthy()
    expect(screen.getByText('话题卡', { exact: false })).toBeTruthy()
    expect(screen.getByText('回顾', { exact: false })).toBeTruthy()
    expect(screen.queryByText(/谎言侦探/)).toBeNull()
    expect(screen.queryByText(/约\d+分钟/)).toBeNull()
  })

  it('custom tier falls back to one honest line instead of inventing a sequence', () => {
    render(<WaitingPhase {...baseProps} currentTier={'custom' as never} />)
    expect(screen.getByText(/跟着卡面走就好，不用提前准备/)).toBeTruthy()
    expect(screen.queryByText('下一环')).toBeNull()
    expect(screen.queryByText('最后')).toBeNull()
  })
})
