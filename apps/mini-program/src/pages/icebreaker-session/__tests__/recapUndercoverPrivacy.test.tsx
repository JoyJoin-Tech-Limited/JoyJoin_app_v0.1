import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { RecapPhaseView } from '../phases/RecapPhaseView'

// ── G0 privacy contract (2026-11-10) ──────────────────────────────────────
// The recap must never name the undercover player. The server strips
// `undercoverDisplayName` from every viewer's payload (viewer-scoped strip),
// and the client holds a second line of defence: even if an old/unsanitized
// payload still carries the name, no recap surface (share back-face lines or
// the 「谁是卧底」 data card) may render it.
//
// Cards are the whole story: 卧底已被揪出 / 卧底成功隐藏.

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
// Both faces render: the share lines (卧底 outcome) live on the BACK face.
vi.mock('../../../components/reveal/CardFlip', () => ({
  default: ({ front, back }: { front: React.ReactNode; back: React.ReactNode }) => (
    <div>
      {front}
      {back}
    </div>
  ),
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

const LEAKED_NAME = '阿团'

const baseProps = {
  summary: null,
  medals: [],
  playerCount: 4,
  onLeave: () => {},
  socialSessionId: 'social-1',
}

/** Simulates a stale/unsanitized payload that still carries the stripped name. */
function buildRecapData(caught: boolean) {
  return {
    topicsDiscussed: [],
    challengesCompleted: 0,
    funMoments: [],
    undercoverWord: { caught, undercoverDisplayName: LEAKED_NAME },
  }
}

describe('RecapPhaseView · G0 undercover identity privacy', () => {
  it('reports a caught undercover by outcome only, never by name', () => {
    const { container } = render(
      <RecapPhaseView {...baseProps} recapData={buildRecapData(true) as never} />,
    )

    expect(container.textContent).toContain('卧底已被揪出')
    expect(container.textContent).not.toContain(LEAKED_NAME)
  })

  it('reports a hidden undercover by outcome only, never by name', () => {
    const { container } = render(
      <RecapPhaseView {...baseProps} recapData={buildRecapData(false) as never} />,
    )

    expect(container.textContent).toContain('卧底成功隐藏')
    expect(container.textContent).not.toContain(LEAKED_NAME)
  })

  it('keeps the expanded 谁是卧底 data card name-free too', () => {
    const { container } = render(
      <RecapPhaseView {...baseProps} recapData={buildRecapData(true) as never} />,
    )

    fireEvent.click(container.querySelector('.icebreaker__recap-data-toggle') as HTMLElement)
    expect(container.textContent).toContain('谁是卧底')
    expect(container.textContent).toContain('卧底已被揪出')
    expect(container.textContent).not.toContain(LEAKED_NAME)
  })
})
