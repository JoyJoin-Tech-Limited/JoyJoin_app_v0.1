import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HeroPromoBanner from './HeroPromoBanner'

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  haptics: vi.fn(),
  routerParams: { params: {} as Record<string, string> },
}))

vi.mock('../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: mocks.track },
}))
vi.mock('../lib/utils/haptics', () => ({ haptics: mocks.haptics }))
vi.mock('../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: true }),
}))
vi.mock('../hooks/useStaggerMount', () => ({ useStaggerMount: () => false }))
vi.mock('../hooks/useDeviceTier', () => ({ useDeviceTier: () => ({ isDegradation: true }) }))
vi.mock('../hooks/usePageVisibility', () => ({ usePageVisibility: () => ({ isPageVisible: true }) }))
vi.mock('@tarojs/taro', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tarojs/taro')>()
  return {
    ...original,
    useRouter: () => mocks.routerParams,
  }
})
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

describe('HeroPromoBanner variant D (flash teaser takeover)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routerParams = { params: {} }
  })

  it('renders the 内测中 pill instead of a CTA button and keeps copy teaser-voiced', () => {
    render(<HeroPromoBanner variant='D' hasArchetype onCtaTap={vi.fn()} onTeaserTap={vi.fn()} />)

    expect(screen.getByText('街头盲盒')).toBeInTheDocument()
    expect(screen.getByText('这座城市，还藏着一个没拆的盒子')).toBeInTheDocument()
    expect(screen.getByText('内测中')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '内测中' })).not.toBeInTheDocument()
  })

  it('makes the whole banner the tap target and fires both analytics channels', () => {
    const onTeaserTap = vi.fn()
    render(<HeroPromoBanner variant='D' hasArchetype onTeaserTap={onTeaserTap} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: '街头盲盒内测预告，这座城市还藏着一个没拆的盒子，点击查看预告',
      }),
    )

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.track).toHaveBeenCalledWith(
      'promo_banner_cta_tap',
      undefined,
      { variant: 'D', hasArchetype: true },
    )
    expect(mocks.track).toHaveBeenCalledWith('flash_teaser_tap', undefined, { surface: 'banner' })
    expect(onTeaserTap).toHaveBeenCalledTimes(1)
  })

  it('keeps the standard CTA flow for non-teaser variants', () => {
    const onCtaTap = vi.fn()
    render(<HeroPromoBanner variant='A' hasArchetype onCtaTap={onCtaTap} />)

    fireEvent.click(screen.getByRole('button', { name: '查看活动详情' }))

    expect(mocks.haptics).toHaveBeenCalledWith('medium')
    expect(onCtaTap).toHaveBeenCalledTimes(1)
    expect(
      mocks.track.mock.calls.filter(([event]) => event === 'flash_teaser_tap'),
    ).toHaveLength(0)
  })

  it('accepts ?promo=D as a staff debug override', () => {
    mocks.routerParams = { params: { promo: 'D' } }
    render(<HeroPromoBanner hasArchetype onTeaserTap={vi.fn()} />)

    expect(screen.getByText('内测中')).toBeInTheDocument()
  })

  it('ignores unknown promo URL params', () => {
    mocks.routerParams = { params: { promo: 'Z' } }
    render(<HeroPromoBanner hasArchetype onCtaTap={vi.fn()} />)

    // Default for archetype users is variant A copy.
    expect(screen.getByText('这周末，会遇见谁？')).toBeInTheDocument()
  })
})
