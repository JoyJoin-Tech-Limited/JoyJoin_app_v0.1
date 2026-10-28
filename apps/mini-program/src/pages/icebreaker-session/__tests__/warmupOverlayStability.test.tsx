import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WarmupPhaseView } from '../phases/WarmupPhaseView'

vi.mock('@tarojs/taro', () => ({
  default: {
    createSelectorQuery: () => ({
      select: () => ({ boundingClientRect: () => ({ exec: () => {} }) }),
    }),
  },
}))
vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))
vi.mock('../../../hooks/useResetOnShow', () => ({ useResetOnShow: () => {} }))
vi.mock('../../../hooks/useUgcReport', () => ({ useUgcReport: () => ({ presentReport: vi.fn() }) }))
vi.mock('../components/WarmupCardSlot', () => ({ WarmupCardSlot: () => null }))
vi.mock('../components/WarmupWelcomeBand', () => ({ WarmupWelcomeBand: () => null }))
vi.mock('../components/WarmupActionBar', () => ({ WarmupActionBar: () => null }))
vi.mock('../components/IcebreakerTierSelector', () => ({ default: () => null }))
vi.mock('../components/GlancePeek', () => ({ GlancePeek: () => null }))
vi.mock('../components/GyroParallaxSpike', () => ({ GyroParallaxSpike: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../components/WarmupEmberRim', () => ({
  WarmupEmberRim: () => null,
  useEmberSync: () => ({ embers: [], halo: 'off', entering: false }),
}))
vi.mock('../components/WarmupCelebrationOverlay', () => ({ WarmupCelebrationOverlay: () => null }))
vi.mock('../components/HandshakeRitual', () => ({ HandshakeRitual: () => null }))
vi.mock('../../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const baseProps = {
  topics: [],
  currentIndex: 0,
  readyUserIds: [],
  participants: [],
  currentUserId: 'host',
  selectedMood: undefined,
  isHost: true,
  vibe: 'balanced' as const,
  onGenerateTopics: () => {},
  isGeneratingTopics: false,
  onAdvance: () => {},
  onRitualStart: () => {},
  glanceStackEnabled: true,
  readiness: {
    allReady: false,
    canAdvance: false,
    optimisticSelfReady: false,
    displayReadyCount: 0,
    readyCount: 0,
    requiredCount: 0,
    handleToggleReady: () => {},
  } as never,
}

describe('WarmupPhaseView overlay visibility stability (R1 regression)', () => {
  it('reports an active ritual once and does not toggle on rerender with a stable callback', async () => {
    const onOverlayVisibilityChange = vi.fn()
    const { rerender } = render(
      <WarmupPhaseView {...baseProps} onOverlayVisibilityChange={onOverlayVisibilityChange} />,
    )

    await waitFor(() => {
      expect(onOverlayVisibilityChange).toHaveBeenCalledWith(true)
    })
    expect(onOverlayVisibilityChange.mock.calls.filter(([value]) => value === true)).toHaveLength(1)
    const callsAfterMount = onOverlayVisibilityChange.mock.calls.length

    rerender(
      <WarmupPhaseView {...baseProps} onOverlayVisibilityChange={onOverlayVisibilityChange} />,
    )

    await waitFor(() => {
      expect(onOverlayVisibilityChange).toHaveBeenCalledTimes(callsAfterMount)
    })
    expect(onOverlayVisibilityChange.mock.calls.filter(([value]) => value === true)).toHaveLength(1)
  })
})
