import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileReviewInviteCard from '../ProfileReviewInviteCard'

vi.mock('../../../lib/utils/cdnAssets', () => ({
  useCdnFirstSrc: vi.fn(() => ({
    src: '/assets/lovart/profile-review/invite-teaser.webp',
    onError: vi.fn(),
    isLocal: false,
  })),
  cdnAsset: vi.fn((path: string) => path),
  localAsset: vi.fn((path: string) => path),
}))

vi.mock('../../../lib/utils/archetypeAssets', () => ({
  ASSET_BASE_WEBP_LOCAL: '/pages/onboarding/assets/archetypes',
  ARCHETYPE_ASSET_MAP: {
    corgi: { webp: 'corgi.webp', png: 'corgi.png' },
    fox: { webp: 'fox.webp', png: 'fox.png' },
    owl: { webp: 'owl.webp', png: 'owl.png' },
    cat: { webp: 'cat.webp', png: 'cat.png' },
    turtle: { webp: 'turtle.webp', png: 'turtle.png' },
    koala: { webp: 'koala.webp', png: 'koala.png' },
  },
}))

vi.mock('../../../pages/onboarding/personality-test/visuals', () => ({
  getArchetypeVisual: vi.fn(() => ({
    name: '社牛柯基',
    accentText: '#7C3AED',
    accentSoft: 'rgba(139,92,246,0.12)',
    accentBorder: 'rgba(139,92,246,0.22)',
    tagline: '暖场小太阳',
  })),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} alt='' />,
}))

describe('ProfileReviewInviteCard (radar summary)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the radar summary copy with live profile data', () => {
    render(
      <ProfileReviewInviteCard
        visible
        archetypeId='corgi'
        displayName='小悦'
        topInterestLabel='火锅'
        intentLabel='交新朋友'
      />,
    )

    expect(screen.getByText('入场卡摘要')).toBeInTheDocument()
    expect(screen.getByText('你的同频雷达已就位')).toBeInTheDocument()
    expect(screen.getByText('社牛柯基 · 热衷火锅 · 想交新朋友')).toBeInTheDocument()
    expect(screen.getByText('同频的人，悦仔帮你留意着。')).toBeInTheDocument()
  })

  it('never claims events were pre-picked', () => {
    render(<ProfileReviewInviteCard visible archetypeId='corgi' />)

    expect(screen.queryByText(/挑了几个局/)).not.toBeInTheDocument()
    expect(screen.queryByText(/帮你挑最对味的局/)).not.toBeInTheDocument()
  })

  it('omits missing data clauses gracefully', () => {
    render(<ProfileReviewInviteCard visible archetypeId='corgi' />)

    // Archetype name shows in the summary line and the radar center pill.
    expect(screen.getAllByText('社牛柯基').length).toBeGreaterThan(0)
    expect(screen.queryByText(/热衷/)).not.toBeInTheDocument()
    expect(screen.queryByText(/想交/)).not.toBeInTheDocument()
  })

  it('falls back to the archetype tagline when no summary data exists', () => {
    render(<ProfileReviewInviteCard visible archetypeId='' />)

    expect(screen.getByText('暖场小太阳')).toBeInTheDocument()
  })

  it('is display-only: no button role and a descriptive aria label', () => {
    render(
      <ProfileReviewInviteCard
        visible
        archetypeId='corgi'
        displayName='小悦'
        topInterestLabel='火锅'
        intentLabel='交新朋友'
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '小悦的入场卡摘要，原型社牛柯基，热衷火锅，想交新朋友' }),
    ).toBeInTheDocument()
  })

  it('renders the user archetype at the radar center plus 4 satellites', () => {
    const { container } = render(<ProfileReviewInviteCard visible archetypeId='corgi' />)

    const images = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    // banner bg + center + 4 satellites
    expect(images).toHaveLength(6)
    expect(images).toContain('/pages/onboarding/assets/archetypes/archetype-corgi.webp')
    // the 4 archetypes after corgi in registry order
    for (const id of ['fox', 'owl', 'cat', 'turtle']) {
      expect(images).toContain(`/pages/onboarding/assets/archetypes/archetype-${id}.webp`)
    }
  })

  it('applies the reduce-motion modifier class', () => {
    const { container } = render(<ProfileReviewInviteCard visible reduceMotion archetypeId='corgi' />)

    expect(
      container.querySelector('.profile-review-invite-card--reduce-motion'),
    ).not.toBeNull()
  })
})
