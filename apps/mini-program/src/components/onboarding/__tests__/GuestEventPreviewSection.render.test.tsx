import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GuestEventPreviewItem } from '@shared/api'
import GuestEventPreviewSection from '../GuestEventPreviewSection'
import {
  consumeGuestPreviewLoginPending,
  __resetGuestPreviewLoginPendingForTests,
} from '../../../lib/analytics/guestPreviewLoginPending'

/**
 * GuestEventPreviewSection render contract (转化 P1c, contract AC-09).
 * Pattern: guidanceQueueContract.test.ts + WelcomeGiftCard.render.test.tsx.
 * Covers: guest+supply → render (min(3, supply)); authenticated → null;
 * auth-loading → null; empty supply → null; fetch error → null (fail-closed);
 * observer unavailable/missing page → static direct render + impression;
 * reduced-motion → static direct render; observer trigger → choreography +
 * impression + hook settle haptic; card tap → guest tap events + login path.
 */

const { mockGetSystemReducedMotion } = vi.hoisted(() => ({
  mockGetSystemReducedMotion: vi.fn(() => false),
}))
const { mockGetGuestEventPreview } = vi.hoisted(() => ({
  mockGetGuestEventPreview: vi.fn(),
}))
const { mockHaptics } = vi.hoisted(() => ({ mockHaptics: vi.fn() }))
const { mockDiscoverAnalytics } = vi.hoisted(() => ({
  mockDiscoverAnalytics: {
    trackGuestPreviewCardImpression: vi.fn(),
    trackGuestPreviewCardTap: vi.fn(),
    trackGuestPreviewLoginTap: vi.fn(),
    trackGuestPreviewLoginSuccess: vi.fn(),
  },
}))
const { mockCreateIntersectionObserver } = vi.hoisted(() => ({
  mockCreateIntersectionObserver: vi.fn(),
}))
const { mockGetCurrentInstance } = vi.hoisted(() => ({ mockGetCurrentInstance: vi.fn() }))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => {
    const { hoverClass: _hoverClass, ...rest } = props as Record<string, unknown>
    return <div {...rest} />
  },
  Text: (props: Record<string, unknown>) => {
    const { numberOfLines: _numberOfLines, ...rest } = props as Record<string, unknown>
    return <span {...rest} />
  },
  Image: (props: Record<string, unknown>) => {
    const { mode: _mode, ...rest } = props as Record<string, unknown>
    return <img {...rest} />
  },
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    createIntersectionObserver: mockCreateIntersectionObserver,
    getCurrentInstance: mockGetCurrentInstance,
  },
  createIntersectionObserver: mockCreateIntersectionObserver,
  getCurrentInstance: mockGetCurrentInstance,
}))

vi.mock('@shared/api', () => ({
  getGuestEventPreview: mockGetGuestEventPreview,
}))

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: mockGetSystemReducedMotion,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mockHaptics,
}))

vi.mock('../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: mockDiscoverAnalytics,
}))

function makeItem(overrides: Partial<GuestEventPreviewItem> = {}): GuestEventPreviewItem {
  return {
    id: 'pool-1',
    title: '周五微醺小聚',
    dateTime: '2026-10-30T11:00:00.000Z',
    district: '南山区',
    eventType: '酒局',
    spotsLeft: 5,
    ...overrides,
  }
}

interface ObserverStub {
  relativeToViewport: () => ObserverStub
  observe: (selector: string, cb: (res: { intersectionRatio: number }) => void) => void
  disconnect: () => void
}

function stubObserverRatio(ratio: number): ObserverStub {
  const stub: ObserverStub = {
    relativeToViewport: () => stub,
    observe: (_selector, cb) => {
      cb({ intersectionRatio: ratio })
    },
    disconnect: () => {},
  }
  mockCreateIntersectionObserver.mockReturnValue(stub)
  mockGetCurrentInstance.mockReturnValue({ page: {} })
  return stub
}

function renderSection(
  overrides: { isAuthenticated?: boolean; authIsLoading?: boolean; onLoginRequest?: () => void } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <GuestEventPreviewSection
        isAuthenticated={false}
        authIsLoading={false}
        onLoginRequest={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetGuestPreviewLoginPendingForTests()
})

describe('P1c render contract — guest + supply', () => {
  it('renders min(3, supply) cards + the canonical hook line, fires impression at the observer trigger', async () => {
    stubObserverRatio(0.9)
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a', title: '场次一' }),
      makeItem({ id: 'b', title: '场次二' }),
      makeItem({ id: 'c', title: '场次三' }),
      makeItem({ id: 'd', title: '场次四' }),
    ])
    const { container } = renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    expect(container.querySelectorAll('.guest-event-card').length).toBe(3)
    expect(screen.getAllByText('还剩 5 座').length).toBe(3)
    // Impression fires at the first-in-viewport instant (observer trigger).
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledWith({
      variant: 'vignette',
      supplyCount: 3,
    })
    // Choreography flips to the entered phase after the ≥400ms settle gate.
    await waitFor(
      () => {
        expect(container.querySelector('.guest-event-card')).toHaveClass('guest-event-card--entered')
      },
      { timeout: 2000 },
    )
    // Hook-line settle haptic (single, at +530+350ms).
    await waitFor(
      () => {
        expect(mockHaptics).toHaveBeenCalledWith('light')
      },
      { timeout: 3000 },
    )
    expect(mockHaptics).toHaveBeenCalledTimes(1)
  })

  it('reports the cream fallback variant when the first pool has no event-type vignette', async () => {
    stubObserverRatio(0.9)
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a', eventType: '其他', title: '午后桌游' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ])
    renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledWith({
      variant: 'fallback',
      supplyCount: 3,
    })
  })

  it('card tap fires both guest tap events, marks the login pending, haptics and routes to the existing login path', async () => {
    stubObserverRatio(0.9)
    mockGetGuestEventPreview.mockResolvedValueOnce([makeItem({ id: 'a' })])
    const onLoginRequest = vi.fn()
    const { container } = renderSection({ onLoginRequest })

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    const card = container.querySelector('.guest-event-card')
    expect(card).not.toBeNull()
    fireEvent.click(card!)

    expect(mockHaptics).toHaveBeenCalledWith('light')
    expect(mockDiscoverAnalytics.trackGuestPreviewCardTap).toHaveBeenCalledWith({
      destination: 'login',
    })
    expect(mockDiscoverAnalytics.trackGuestPreviewLoginTap).toHaveBeenCalledWith({
      surface: 'guest_preview_card',
    })
    expect(onLoginRequest).toHaveBeenCalled()
    // The real pending module flips true on tap (login-success guard source).
    expect(consumeGuestPreviewLoginPending()).toBe(true)
  })

  it('keeps the pre-entrance state (hidden choreography) while below the observer threshold', async () => {
    stubObserverRatio(0.1)
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ])
    const { container } = renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    const card = container.querySelector('.guest-event-card')
    expect(card).toHaveClass('guest-event-card--pre')
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).not.toHaveBeenCalled()
  })
})

describe('P1c render contract — fail-closed byte-level null', () => {
  it('renders nothing for an authenticated user and never fetches', () => {
    const { container } = renderSection({ isAuthenticated: true })
    expect(container.querySelector('.guest-event-preview')).toBeNull()
    expect(mockGetGuestEventPreview).not.toHaveBeenCalled()
  })

  it('renders nothing while auth is still loading and never fetches', () => {
    const { container } = renderSection({ authIsLoading: true })
    expect(container.querySelector('.guest-event-preview')).toBeNull()
    expect(mockGetGuestEventPreview).not.toHaveBeenCalled()
  })

  it('renders nothing on empty supply (server flag-off / supply<3)', async () => {
    stubObserverRatio(0.9)
    mockGetGuestEventPreview.mockResolvedValueOnce([])
    const { container } = renderSection()

    await waitFor(() => expect(mockGetGuestEventPreview).toHaveBeenCalled())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('.guest-event-preview')).toBeNull()
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).not.toHaveBeenCalled()
  })

  it('renders nothing on fetch error (fail-closed, silent)', async () => {
    stubObserverRatio(0.9)
    mockGetGuestEventPreview.mockRejectedValueOnce(new Error('guest-preview failed'))
    const { container } = renderSection()

    await waitFor(() => expect(mockGetGuestEventPreview).toHaveBeenCalled())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('.guest-event-preview')).toBeNull()
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).not.toHaveBeenCalled()
  })
})

describe('P1c render contract — observer fail-closed static render', () => {
  it('renders static (visible, no choreography) when createIntersectionObserver throws', async () => {
    mockCreateIntersectionObserver.mockImplementationOnce(() => {
      throw new Error('observer unavailable')
    })
    mockGetCurrentInstance.mockReturnValue({ page: {} })
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ])
    const { container } = renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    const card = container.querySelector('.guest-event-card')
    expect(card).not.toHaveClass('guest-event-card--pre')
    expect(card).not.toHaveClass('guest-event-card--entered')
    // Impression still fires — the cards are visible, the funnel denominator
    // holds. waitFor: the static-phase cascade (observer effect setState →
    // re-render → static effect) is not guaranteed to flush before
    // findByText resolves (React Query notification timing is scheduler-
    // dependent; direct assertion here flaked 1↔2 in full-suite runs).
    await waitFor(() =>
      expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledWith({
        variant: 'vignette',
        supplyCount: 3,
      }),
    )
  })

  it('renders static when no page instance is available', async () => {
    mockGetCurrentInstance.mockReturnValue({ page: undefined })
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ])
    const { container } = renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    expect(mockCreateIntersectionObserver).not.toHaveBeenCalled()
    expect(container.querySelector('.guest-event-card')).not.toHaveClass('guest-event-card--pre')
    // waitFor for the same async-flush reason documented in the sibling test above.
    await waitFor(() =>
      expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledTimes(1),
    )
  })
})

describe('P1c render contract — observer watchdog (audit CONCERN C3)', () => {
  it('fails closed to the static end state when the observer callback never fires', async () => {
    vi.useFakeTimers()
    try {
      // Observer created successfully but its callback never arrives.
      const stub: ObserverStub = {
        relativeToViewport: () => stub,
        observe: () => {},
        disconnect: vi.fn(),
      }
      mockCreateIntersectionObserver.mockReturnValue(stub)
      mockGetCurrentInstance.mockReturnValue({ page: {} })
      mockGetGuestEventPreview.mockResolvedValueOnce([
        makeItem({ id: 'a' }),
        makeItem({ id: 'b' }),
        makeItem({ id: 'c' }),
      ])
      const { container } = renderSection()

      // Let the mocked fetch resolve and flush microtasks.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      const preWatchdogCard = container.querySelector('.guest-event-card')
      expect(preWatchdogCard).not.toBeNull()
      expect(preWatchdogCard).toHaveClass('guest-event-card--pre')

      // Advance past the 2.5s watchdog window with no observer callback.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_600)
      })

      // Static direct render: visible, no choreography classes, and the
      // render-time static path fires the impression exactly once.
      const card = container.querySelector('.guest-event-card')
      expect(card).not.toBeNull()
      expect(card).not.toHaveClass('guest-event-card--pre')
      expect(card).not.toHaveClass('guest-event-card--entered')
      expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledTimes(1)
      // No choreography settle haptic in the static fallback.
      expect(mockHaptics).not.toHaveBeenCalled()
      // The observer is disconnected by the phase-flip cleanup.
      expect(stub.disconnect).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not interfere with the normal choreography when the observer fires', async () => {
    vi.useFakeTimers()
    try {
      stubObserverRatio(0.9)
      mockGetGuestEventPreview.mockResolvedValueOnce([
        makeItem({ id: 'a' }),
        makeItem({ id: 'b' }),
        makeItem({ id: 'c' }),
      ])
      const { container } = renderSection()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      // Past the ≥400ms settle gate → choreography entered.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(container.querySelector('.guest-event-card')).toHaveClass('guest-event-card--entered')

      // Advance well past the watchdog window — no forced static flip.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_600)
      })
      expect(container.querySelector('.guest-event-card')).toHaveClass('guest-event-card--entered')

      // Hook-line settle haptic still fires exactly once at +530+350ms.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(mockHaptics).toHaveBeenCalledTimes(1)
      expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('P1c render contract — reduced motion static equivalent', () => {
  it('renders the end state directly, never creates an observer, never fires the settle haptic', async () => {
    mockGetSystemReducedMotion.mockReturnValueOnce(true)
    mockGetGuestEventPreview.mockResolvedValueOnce([
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ])
    const { container } = renderSection()

    await screen.findByText(/这周有 \d+ 场正在排桌/)
    expect(mockCreateIntersectionObserver).not.toHaveBeenCalled()
    const card = container.querySelector('.guest-event-card')
    expect(card).not.toHaveClass('guest-event-card--pre')
    expect(card).not.toHaveClass('guest-event-card--entered')
    const hook = container.querySelector('.guest-event-preview__hook')
    expect(hook).not.toHaveClass('guest-event-preview__hook--entered')
    expect(mockDiscoverAnalytics.trackGuestPreviewCardImpression).toHaveBeenCalledTimes(1)
    expect(mockHaptics).not.toHaveBeenCalled()
  })
})
