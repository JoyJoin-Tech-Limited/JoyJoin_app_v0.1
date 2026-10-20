import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecapPhaseView } from '../phases/RecapPhaseView'
import type { SessionParticipant } from '../phaseUtils'

// ── Recap share poster entry (2026-10-20, spec 规格一 AC-1/AC-2) ────────────
// flag ON  → moment panel gains 存下这张高光卡 (primary) + 转发给微信朋友
//            (openType='share') + CardFlip back gains 直接存卡; hidden canvas
//            mounted; page-level forward registered.
// flag OFF → byte-identical legacy: single 看完了, no new CTA, no canvas, no
//            useShareAppMessage registration.

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useShareAppMessage: vi.fn(),
  showToast: vi.fn(),
  flagEnabled: { value: false },
  handleShare: vi.fn(),
  authUser: { value: { referralCode: 'CODE99' } as Record<string, unknown> | undefined },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
  RootPortal: (props: Record<string, unknown>) => <div {...props} />,
  Canvas: (props: Record<string, unknown>) => <div data-testid='poster-canvas' {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: { showToast: mocks.showToast },
  useShareAppMessage: mocks.useShareAppMessage,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: () => ({ data: undefined }),
  }
})

vi.mock('../../../lib/api/api', () => ({
  apiRequest: mocks.apiRequest,
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
  default: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: () => false,
}))

vi.mock('../../../hooks/useRecapSharePosterEnabled', () => ({
  useRecapSharePosterEnabled: () => mocks.flagEnabled.value,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.authUser.value, isLoading: false }),
}))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: true }),
}))

vi.mock('../hooks/useRecapSharePoster', () => ({
  useRecapSharePoster: () => ({ isGenerating: false, handleShare: mocks.handleShare }),
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
  // Render BOTH faces so the back-face CTAs are assertable.
  default: ({ front, back }: { front: React.ReactNode; back: React.ReactNode }) => (
    <div data-testid='card-flip'>
      <div data-testid='card-flip-front'>{front}</div>
      <div data-testid='card-flip-back'>{back}</div>
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
  emitMomentCardAction: vi.fn(),
}))

vi.mock('../components/PhaseAigcRow', () => ({
  PhaseAigcRow: () => null,
}))

vi.mock('../phases/RecapGlowBlock', () => ({
  MedalIcon: () => <span data-testid='medal-icon' />,
  RecapGlowBlock: () => <div data-testid='glow-block' />,
}))

const ROSTER: SessionParticipant[] = [
  { userId: 'u1', displayName: '老周', archetype: '靠谱大象', isActive: true },
  { userId: 'u2', displayName: '小鹿', archetype: '寻宝狐', isActive: true },
]

const PANEL = {
  headline: '今晚的高光',
  overview: '这桌把话题聊开了',
  highlights: [
    { aspect: 'memorable' as const, title: '气氛担当', personDisplayName: '老周', evidence: '三次把全场逗笑', narrative: '有人把全场逗笑了三次' },
  ],
  closingLine: '晚安',
}

const baseProps = {
  recapData: null,
  summary: null,
  medals: [],
  playerCount: 2,
  onLeave: () => {},
  socialSessionId: 'social-1',
  participants: ROSTER,
  currentUserId: 'u2',
  eventTier: 'glow',
  sessionStartedAt: new Date(2026, 9, 20, 19, 0).getTime(),
}

async function openMomentPanel() {
  mocks.apiRequest.mockResolvedValueOnce({ panel: PANEL, meta: null })
  fireEvent.click(screen.getByText('生成高光'))
  await waitFor(() => expect(screen.getByText('今晚的高光')).toBeTruthy())
}

describe('RecapPhaseView · recap share poster entries (spec 规格一)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.flagEnabled.value = false
    mocks.authUser.value = { referralCode: 'CODE99' }
  })

  it('flag ON: moment panel gains 存下这张高光卡 + 转发给微信朋友 (openType=share)', async () => {
    mocks.flagEnabled.value = true
    render(<RecapPhaseView {...baseProps} />)
    await openMomentPanel()

    expect(screen.getByText('存下这张高光卡')).toBeTruthy()
    const forward = screen.getByText('转发给微信朋友')
    expect(forward.closest('button')?.getAttribute('opentype')).toBe('share')
    expect(screen.getByText('看完了')).toBeTruthy()

    // The save CTA drives the poster action layer.
    fireEvent.click(screen.getByText('存下这张高光卡'))
    expect(mocks.handleShare).toHaveBeenCalledTimes(1)
  })

  it('flag ON: CardFlip back face gains 直接存卡', () => {
    mocks.flagEnabled.value = true
    render(<RecapPhaseView {...baseProps} />)
    expect(screen.getByText('直接存卡')).toBeTruthy()
  })

  it('flag ON: hidden canvas mounts and the page-level forward is registered', () => {
    mocks.flagEnabled.value = true
    const { container } = render(<RecapPhaseView {...baseProps} />)

    expect(container.querySelector('.icebreaker__recap-share-poster-canvas')).toBeTruthy()
    expect(mocks.useShareAppMessage).toHaveBeenCalledTimes(1)

    // AC-7: the registered share callback lands non-participants on the
    // LANDING page with referral attribution — never the session page.
    const callback = mocks.useShareAppMessage.mock.calls[0][0] as () => {
      title: string
      path: string
      imageUrl?: string
    }
    const message = callback()
    expect(message.title).toBe('我们 2 个人把今晚聊热了')
    expect(message.path).toBe('/pages/index/index?invitationCode=CODE99')
    expect(message.path).not.toContain('icebreaker-session')
    expect(message.imageUrl).toBeTruthy()
  })

  it('flag OFF: panel keeps the single 看完了 — zero share CTAs (AC-1)', async () => {
    mocks.flagEnabled.value = false
    render(<RecapPhaseView {...baseProps} />)
    await openMomentPanel()

    expect(screen.getByText('看完了')).toBeTruthy()
    expect(screen.queryByText('存下这张高光卡')).toBeNull()
    expect(screen.queryByText('转发给微信朋友')).toBeNull()
  })

  it('flag OFF: no 直接存卡, no canvas, no forward registration (AC-1)', () => {
    mocks.flagEnabled.value = false
    const { container } = render(<RecapPhaseView {...baseProps} />)

    expect(screen.queryByText('直接存卡')).toBeNull()
    expect(container.querySelector('.icebreaker__recap-share-poster-canvas')).toBeNull()
    expect(mocks.useShareAppMessage).not.toHaveBeenCalled()
    // The legacy 生成高光 CTA is untouched.
    expect(screen.getByText('生成高光')).toBeTruthy()
  })
})
