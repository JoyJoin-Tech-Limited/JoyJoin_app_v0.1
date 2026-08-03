import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IdentityStageScene, {
  IDENTITY_STAGE_BREATH_MS,
  IDENTITY_STAGE_DRIFT_MS,
  IDENTITY_STAGE_ENTRANCE_MS,
  IDENTITY_STAGE_PARTICLE_COUNTS,
  IDENTITY_STAGE_REVEAL_CAP_MS,
} from './IdentityStageScene'
import type { DegradationTier } from '../../lib/utils/frameBudget'

/**
 * Component-level tests for IdentityStageScene (sprint hd2d-identity-stage).
 * Platform layers are mocked so the degradation contract (tier budgets,
 * reduced-motion, art failure chain, page lifecycle) is verifiable in jsdom.
 */

const mocks = vi.hoisted(() => {
  const didShowCallbacks: Array<() => void> = []
  const didHideCallbacks: Array<() => void> = []
  return {
    getDegradationTier: vi.fn<() => Promise<DegradationTier>>(),
    getSystemReducedMotion: vi.fn(() => false),
    track: vi.fn(),
    logError: vi.fn(),
    didShowCallbacks,
    didHideCallbacks,
    useDidShow: vi.fn((callback: () => void) => { didShowCallbacks.push(callback) }),
    useDidHide: vi.fn((callback: () => void) => { didHideCallbacks.push(callback) }),
  }
})

vi.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {},
  useDidShow: mocks.useDidShow,
  useDidHide: mocks.useDidHide,
}))

vi.mock('@tarojs/components', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Image: ({ mode: _mode, lazyLoad: _lazyLoad, ...props }: any) => <img alt='' {...props} />,
}))

vi.mock('../../lib/utils/frameBudget', () => ({
  getDegradationTier: mocks.getDegradationTier,
}))

vi.mock('../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: mocks.getSystemReducedMotion,
}))

vi.mock('../../lib/analytics/profileAnalytics', () => ({
  profileAnalytics: { track: mocks.track },
}))

vi.mock('../../lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: mocks.logError,
}))

function Avatar() {
  return <div data-testid='stage-avatar'>avatar</div>
}

function renderScene() {
  return render(
    <IdentityStageScene>
      <Avatar />
    </IdentityStageScene>,
  )
}

function getViewport(container: HTMLElement): HTMLElement {
  return container.querySelector('.identity-stage__viewport') as HTMLElement
}

function getScene(container: HTMLElement): HTMLElement {
  return container.querySelector('.identity-stage__scene') as HTMLElement
}

function loadAllArt() {
  fireEvent.load(screen.getByTestId('identity-stage-far-bg'))
  fireEvent.load(screen.getByTestId('identity-stage-mid-bg'))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.didShowCallbacks.length = 0
  mocks.didHideCallbacks.length = 0
  mocks.getSystemReducedMotion.mockReturnValue(false)
  mocks.getDegradationTier.mockResolvedValue('full')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('IdentityStageScene named constants (AC-06)', () => {
  it('locks the contract durations', () => {
    expect(IDENTITY_STAGE_DRIFT_MS).toBe(12000)
    expect(IDENTITY_STAGE_ENTRANCE_MS).toBe(500)
    expect(IDENTITY_STAGE_REVEAL_CAP_MS).toBe(1500)
    expect(IDENTITY_STAGE_BREATH_MS).toBe(5600)
  })

  it('consumes both constants in the animation code', async () => {
    const { container } = renderScene()
    loadAllArt()

    await waitFor(() => {
      expect(getScene(container).style.animation).toContain(`${IDENTITY_STAGE_DRIFT_MS}ms`)
    })
    expect(getViewport(container).style.transition).toContain(`${IDENTITY_STAGE_ENTRANCE_MS}ms`)
  })
})

describe('IdentityStageScene particle budget (AC-05)', () => {
  it.each<[DegradationTier, number]>([
    ['full', 10],
    ['reduced', 4],
    ['minimal', 0],
    ['emergency', 0],
  ])('renders at most the budgeted particles at tier %s', async (tier, expected) => {
    expect(IDENTITY_STAGE_PARTICLE_COUNTS[tier]).toBe(expected)
    mocks.getDegradationTier.mockResolvedValue(tier)
    const { container } = renderScene()

    await waitFor(() => {
      expect(screen.getByTestId('identity-stage-scene')).toHaveAttribute('data-tier', tier)
    })
    expect(container.querySelectorAll('.identity-stage__particle')).toHaveLength(expected)
  })

  it('stays static with zero particles and no drift while the tier promise is unresolved', () => {
    mocks.getDegradationTier.mockReturnValue(new Promise<DegradationTier>(() => {}))
    const { container } = renderScene()

    const scene = screen.getByTestId('identity-stage-scene')
    expect(scene).toHaveAttribute('data-tier', 'pending')
    expect(scene).toHaveAttribute('data-motion', 'off')
    expect(container.querySelectorAll('.identity-stage__particle')).toHaveLength(0)
    expect(getScene(container).style.animation).toBe('')
    expect((container.querySelector('.identity-stage__rim-light') as HTMLElement).style.animation).toBe('')
    expect((container.querySelector('.identity-stage__halo') as HTMLElement).style.animation).toBe('')
    expect((container.querySelector('.identity-stage__avatar') as HTMLElement).style.animation).toBe('')
    expect((container.querySelector('.identity-stage__grade') as HTMLElement).style.animation).toBe('')
  })

  it('enables the camera drift and layered breathing once a motion-capable tier resolves', async () => {
    const { container } = renderScene()

    await waitFor(() => {
      expect(getScene(container).style.animation).toContain(`identity-stage-drift ${IDENTITY_STAGE_DRIFT_MS}ms`)
    })
    expect(getScene(container).style.animationPlayState).toBe('running')
    const rimLight = container.querySelector('.identity-stage__rim-light') as HTMLElement
    expect(rimLight.style.animation).toContain(`identity-stage-breathe ${IDENTITY_STAGE_BREATH_MS}ms`)
    const halo = container.querySelector('.identity-stage__halo') as HTMLElement
    expect(halo.style.animation).toContain('identity-stage-halo-breathe')
    const avatar = container.querySelector('.identity-stage__avatar') as HTMLElement
    expect(avatar.style.animation).toContain('identity-stage-avatar-breath')
    const grade = container.querySelector('.identity-stage__grade') as HTMLElement
    expect(grade.style.animation).toContain('identity-stage-grade-drift')
    expect(screen.getByTestId('identity-stage-scene')).toHaveAttribute('data-motion', 'on')
  })

  it('never bobs the normal-flow content slot (absoluteAvatar=false)', async () => {
    const { container } = render(
      <IdentityStageScene absoluteAvatar={false}>
        <Avatar />
      </IdentityStageScene>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('identity-stage-scene')).toHaveAttribute('data-motion', 'on')
    })
    // Hero-card content (text, buttons) must not ride the breath bob.
    expect(container.querySelector('.identity-stage__avatar')).toBeNull()
    const content = container.querySelector('.identity-stage__content') as HTMLElement
    expect(content).toBeTruthy()
    expect(content.style.animation).toBe('')
  })

  it('keeps minimal and emergency tiers fully static', async () => {
    mocks.getDegradationTier.mockResolvedValue('emergency')
    const { container } = renderScene()

    await waitFor(() => {
      expect(screen.getByTestId('identity-stage-scene')).toHaveAttribute('data-tier', 'emergency')
    })
    expect(getScene(container).style.animation).toBe('')
    expect(container.querySelectorAll('.identity-stage__particle')).toHaveLength(0)
  })
})

describe('IdentityStageScene reduced-motion (AC-07)', () => {
  it('is fully static and revealed on first render without resolving the tier', () => {
    mocks.getSystemReducedMotion.mockReturnValue(true)
    const { container } = renderScene()

    const scene = screen.getByTestId('identity-stage-scene')
    expect(scene).toHaveAttribute('data-reduced-motion', 'true')
    expect(scene).toHaveAttribute('data-motion', 'off')
    expect(getViewport(container).className).toContain('identity-stage__viewport--revealed')
    expect(getViewport(container).style.transition).toBe('')
    expect(getScene(container).style.animation).toBe('')
    expect(container.querySelectorAll('.identity-stage__particle')).toHaveLength(0)
    expect(mocks.getDegradationTier).not.toHaveBeenCalled()
  })
})

describe('IdentityStageScene art loading chain (AC-03, REL-01)', () => {
  it('keeps every image layer hidden until its own onLoad fires', () => {
    renderScene()
    const farBg = screen.getByTestId('identity-stage-far-bg')
    const midBg = screen.getByTestId('identity-stage-mid-bg')

    expect(farBg.style.opacity).toBe('0')
    expect(midBg.style.opacity).toBe('0')

    fireEvent.load(farBg)
    expect(farBg.style.opacity).toBe('1')
    expect(midBg.style.opacity).toBe('0')

    fireEvent.load(midBg)
    expect(midBg.style.opacity).toBe('1')
  })

  it('serves every art layer through the CDN helper', () => {
    renderScene()

    expect(screen.getByTestId('identity-stage-far-bg').getAttribute('src'))
      .toContain('/assets/profile-pixel/v2/stage/far-bg-v1.webp')
    expect(screen.getByTestId('identity-stage-mid-bg').getAttribute('src'))
      .toContain('/assets/profile-pixel/v2/stage/mid-bg-v1.webp')
  })

  it('starts the entrance reveal only after far-bg and mid-bg have loaded or failed', async () => {
    const { container } = renderScene()
    expect(getViewport(container).className).not.toContain('--revealed')

    fireEvent.load(screen.getByTestId('identity-stage-far-bg'))
    expect(getViewport(container).className).not.toContain('--revealed')

    fireEvent.error(screen.getByTestId('identity-stage-mid-bg'))
    await waitFor(() => {
      expect(getViewport(container).className).toContain('identity-stage__viewport--revealed')
    })
  })

  it('never lets a hung layer block the reveal past the 1500ms hard cap', () => {
    vi.useFakeTimers()
    const { container } = renderScene()
    expect(getViewport(container).className).not.toContain('--revealed')

    act(() => {
      vi.advanceTimersByTime(IDENTITY_STAGE_REVEAL_CAP_MS)
    })
    expect(getViewport(container).className).toContain('identity-stage__viewport--revealed')
  })

  it('hides a single failed layer, reports it, and keeps the rest of the scene', async () => {
    renderScene()

    fireEvent.error(screen.getByTestId('identity-stage-far-bg'))

    await waitFor(() => {
      expect(screen.queryByTestId('identity-stage-far-bg')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('identity-stage-mid-bg')).toBeInTheDocument()
    expect(screen.getByTestId('stage-avatar')).toBeInTheDocument()
    expect(screen.getByTestId('identity-stage-scene')).toBeInTheDocument()
    expect(mocks.track).toHaveBeenCalledWith('identity_stage_asset_error', { layer: 'farBg' })
    expect(mocks.logError).toHaveBeenCalledWith('identity-stage:asset-error', { layer: 'farBg' })
  })

  it('degrades to the existing static identity card when every background layer fails', async () => {
    renderScene()

    fireEvent.error(screen.getByTestId('identity-stage-far-bg'))
    fireEvent.error(screen.getByTestId('identity-stage-mid-bg'))

    await waitFor(() => {
      expect(screen.getByTestId('identity-stage-static-fallback')).toBeInTheDocument()
    })
    expect(screen.getByTestId('stage-avatar')).toBeInTheDocument()
    expect(screen.queryByTestId('identity-stage-scene')).not.toBeInTheDocument()
    expect(mocks.track).toHaveBeenCalledWith('identity_stage_asset_error', { layer: 'farBg' })
    expect(mocks.track).toHaveBeenCalledWith('identity_stage_asset_error', { layer: 'midBg' })
    expect(mocks.track).toHaveBeenCalledWith('identity_stage_fallback_static', {
      reason: 'background_layers_unavailable',
    })
    expect(mocks.track).not.toHaveBeenCalledWith('identity_stage_shown', expect.anything())
  })
})

describe('IdentityStageScene analytics (AC-11, OBS-01)', () => {
  it('fires identity_stage_shown exactly once when the scene is revealed', async () => {
    renderScene()
    loadAllArt()

    await waitFor(() => {
      expect(mocks.track).toHaveBeenCalledWith('identity_stage_shown', {
        tier: 'pending',
        reducedMotion: false,
        particleCount: 0,
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('identity-stage-scene')).toHaveAttribute('data-tier', 'full')
    })
    expect(mocks.track.mock.calls.filter(([event]) => event === 'identity_stage_shown')).toHaveLength(1)
  })
})

describe('IdentityStageScene page lifecycle (REL-02)', () => {
  it('pauses every loop on useDidHide and resumes on useDidShow', async () => {
    const { container } = renderScene()

    await waitFor(() => {
      expect(getScene(container).style.animationPlayState).toBe('running')
    })
    const rimLight = container.querySelector('.identity-stage__rim-light') as HTMLElement
    const halo = container.querySelector('.identity-stage__halo') as HTMLElement
    const avatar = container.querySelector('.identity-stage__avatar') as HTMLElement
    const particle = container.querySelector('.identity-stage__particle') as HTMLElement
    expect(rimLight.style.animationPlayState).toBe('running')
    expect(halo.style.animationPlayState).toBe('running')
    expect(avatar.style.animationPlayState).toBe('running')
    expect(particle.style.animationPlayState).toBe('running')

    act(() => {
      mocks.didHideCallbacks.forEach((callback) => callback())
    })
    expect(getScene(container).style.animationPlayState).toBe('paused')
    expect(rimLight.style.animationPlayState).toBe('paused')
    expect(halo.style.animationPlayState).toBe('paused')
    expect(avatar.style.animationPlayState).toBe('paused')
    expect(particle.style.animationPlayState).toBe('paused')

    act(() => {
      mocks.didShowCallbacks.forEach((callback) => callback())
    })
    expect(getScene(container).style.animationPlayState).toBe('running')
    expect(rimLight.style.animationPlayState).toBe('running')
    expect(halo.style.animationPlayState).toBe('running')
    expect(avatar.style.animationPlayState).toBe('running')
    expect(particle.style.animationPlayState).toBe('running')
  })

  it('clears the reveal-cap timer on unmount', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = renderScene()

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(IDENTITY_STAGE_REVEAL_CAP_MS + 500)
    })
    expect(mocks.track).not.toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
