import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecapPhaseView } from '../phases/RecapPhaseView'
import type { SessionParticipant } from '../phaseUtils'

// ── AC-05 render contract (sprint icebreaker-polish-p1, 补2 主持认可位) ────
// The fixed 「本场主持」 card must render in both medal-grid and glow modes,
// sourcing the host from state.hostUserId → roster displayName, and must
// never fabricate a name when the host is unknown.

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
  RootPortal: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: { showToast: vi.fn() },
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../icebreakerSessionModel', () => ({
  buildSocialPath: (id: string, suffix?: string) => `/api/social-icebreaker/${id}${suffix ?? ''}`,
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: () => <span data-testid='joyjoin-icon' />,
}))

vi.mock('../../../components/ui/Card', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='card'>{children}</div>,
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: () => false,
}))

// Recap share poster (2026-10-20, spec 规格一): flag OFF in these tests —
// the share hook is still invoked unconditionally by the view, so it needs a
// stub; the flag hook returning false keeps every share surface unmounted.
vi.mock('../../../hooks/useRecapSharePosterEnabled', () => ({
  useRecapSharePosterEnabled: () => false,
}))

vi.mock('../hooks/useRecapSharePoster', () => ({
  useRecapSharePoster: () => ({ isGenerating: false, handleShare: vi.fn() }),
}))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: true }),
}))

vi.mock('../phaseUtils', () => ({
  PhaseHeaderIcon: () => <span data-testid='phase-header-icon' />,
}))

vi.mock('../../../components/reveal/ParticleBurst', () => ({
  default: () => <span data-testid='particle-burst' />,
}))
vi.mock('../../../components/reveal/IdentityReveal', () => ({
  default: () => <span data-testid='identity-reveal' />,
}))
vi.mock('../../../components/reveal/CardFlip', () => ({
  default: () => <span data-testid='card-flip' />,
}))

vi.mock('../../../components/mascot/XiaoyueChatBubble', () => ({
  default: () => <span data-testid='xiaoyue-bubble' />,
}))

vi.mock('../../../lib/ceremonyHeroes', () => ({
  CEREMONY_HEROES: { seeYouNextTime: '/mock/ceremony.webp' },
}))
vi.mock('../../../lib/milestoneBadges', () => ({
  MILESTONE_BADGES: { recapStamp: '/mock/stamp.webp' },
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))

vi.mock('@shared/copy/icebreakerSession', () => ({
  formatIceLieFooledLine: (n: number) => `${n} 次骗过全场`,
}))

vi.mock('../momentCardTelemetry', () => ({
  emitMomentCardGenerateOnce: vi.fn(),
}))

vi.mock('../components/PhaseAigcRow', () => ({
  PhaseAigcRow: () => null,
}))

vi.mock('../phases/RecapGlowBlock', () => ({
  MedalIcon: () => <span data-testid='medal-icon' />,
  RecapGlowBlock: () => <div data-testid='glow-block' />,
}))

const ROSTER: SessionParticipant[] = [
  { userId: 'u-host', displayName: '老周', archetype: '靠谱大象', isActive: true },
  { userId: 'u2', displayName: '小鹿', archetype: '寻宝狐', isActive: true },
]

const baseProps = {
  recapData: null,
  summary: null,
  medals: [],
  playerCount: 2,
  onLeave: () => {},
  socialSessionId: 'social-1',
  participants: ROSTER,
  currentUserId: 'u2',
}

describe('RecapPhaseView · AC-05 本场主持 card', () => {
  it('renders the fixed host card with the roster displayName (medal mode)', () => {
    render(<RecapPhaseView {...baseProps} hostUserId='u-host' />)
    expect(screen.getByText('本场主持')).toBeTruthy()
    expect(screen.getByText('老周')).toBeTruthy()
    expect(screen.getByText('把今晚的每个环节串了起来')).toBeTruthy()
  })

  it('still renders the host card in glow mode (fixed, not medal-dependent)', () => {
    const glow = {
      tiers: { 'u-host': 'warm' as const, u2: 'ember' as const },
      medals: [],
      tableLine: '这桌今晚很暖',
    }
    render(<RecapPhaseView {...baseProps} hostUserId='u-host' glow={glow} />)
    expect(screen.getByTestId('glow-block')).toBeTruthy()
    expect(screen.getByText('本场主持')).toBeTruthy()
    expect(screen.getByText('老周')).toBeTruthy()
  })

  it('stays hidden when the host is absent or off-roster (no fabrication)', () => {
    const { unmount } = render(<RecapPhaseView {...baseProps} />)
    expect(screen.queryByText('本场主持')).toBeNull()
    unmount()
    render(<RecapPhaseView {...baseProps} hostUserId='u-unknown' />)
    expect(screen.queryByText('本场主持')).toBeNull()
  })
})
