import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaitingPhase from '../components/WaitingPhase'
import type { SessionParticipant } from '../phaseUtils'

// ── AC-13 render contract (icebreaker-uiux-wave2) ───────────────────────────
// The 2026-10-19 design audit found the wave-2 verdict had PASSed AC-13 on a
// commit message while `participants`/`phaseMapItems` were dead props — the
// roster strip and the 「等主持人开场」 line never reached the JSX. These tests
// assert the RENDERED output so props-to-JSX drift cannot recur.

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
  default: ({ archetype }: { archetype?: string }) => (
    <div data-testid='archetype-head' data-archetype={archetype} />
  ),
}))

vi.mock('../../../components/mascot/MissingArchetypePlaceholder', () => ({
  default: () => <div data-testid='missing-archetype' />,
}))

const ROSTER: SessionParticipant[] = [
  { userId: 'u1', displayName: '悦仔测试', archetype: 'happy_corgi', isActive: true },
  { userId: 'u2', displayName: '小鹿', archetype: 'treasure_fox', isActive: true },
  { userId: 'u3', displayName: '阿澈', isActive: true }, // no archetype → placeholder
]

const PHASE_MAP = [
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
  participants: ROSTER,
  currentUserId: 'u2',
  phaseMapItems: PHASE_MAP,
}

describe('WaitingPhase AC-13 render contract', () => {
  it('renders the table roster strip from participants (dead-prop guard)', () => {
    render(<WaitingPhase {...baseProps} />)
    // Names render (self anonymised to 你)
    expect(screen.getByText('悦仔测试')).toBeTruthy()
    expect(screen.getByText('你')).toBeTruthy()
    expect(screen.getByText('阿澈')).toBeTruthy()
    // Archetype heads for known archetypes, placeholder for missing
    expect(screen.getAllByTestId('archetype-head')).toHaveLength(2)
    expect(screen.getAllByTestId('missing-archetype')).toHaveLength(1)
  })

  it('renders the phase sequence preview from phaseMapItems (dead-prop guard)', () => {
    render(<WaitingPhase {...baseProps} />)
    expect(screen.getByText('今晚的环节')).toBeTruthy()
    expect(screen.getByText('话题卡', { exact: false })).toBeTruthy()
    expect(screen.getByText(/谎言侦探/)).toBeTruthy()
    expect(screen.getByText(/回顾/)).toBeTruthy()
  })

  it('shows the explicit 等主持人开场 hint for players only', () => {
    render(<WaitingPhase {...baseProps} />)
    expect(screen.getByText('等主持人开场，先和同桌打个招呼')).toBeTruthy()
  })

  it('hides the host hint and shows the start CTA for the host', () => {
    render(<WaitingPhase {...baseProps} isHost />)
    expect(screen.queryByText('等主持人开场，先和同桌打个招呼')).toBeNull()
    expect(screen.getByText('开始破冰')).toBeTruthy()
  })

  it('keeps the legacy headline while the table is not full', () => {
    render(<WaitingPhase {...baseProps} playerCount={5} />)
    expect(screen.getByText('等待更多玩家加入…')).toBeTruthy()
  })

  it('switches to the 人齐了 headline at a full table (player view)', () => {
    render(<WaitingPhase {...baseProps} playerCount={6} />)
    expect(screen.queryByText('等待更多玩家加入…')).toBeNull()
    expect(screen.getByText('人齐了，等主持人开场')).toBeTruthy()
  })

  it('switches to the host-variant headline at a full table (host view)', () => {
    render(<WaitingPhase {...baseProps} isHost playerCount={6} />)
    expect(screen.getByText('人齐了，可以开场啦')).toBeTruthy()
  })

  it('respects an explicit playerCapacity override', () => {
    render(<WaitingPhase {...baseProps} playerCount={4} playerCapacity={4} />)
    expect(screen.getByText('人齐了，等主持人开场')).toBeTruthy()
  })

  it('renders safely with empty roster and no phase map (fallback states)', () => {
    render(<WaitingPhase {...baseProps} participants={[]} phaseMapItems={null} />)
    expect(screen.getByText('等待更多玩家加入…')).toBeTruthy()
    expect(screen.queryByText('今晚的环节')).toBeNull()
  })
})
