import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProfileReviewInviteCard from '../ProfileReviewInviteCard'

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../lib/utils/cdnAssets', () => ({
  useCdnFirstSrc: vi.fn(() => ({ src: '/assets/lovart/profile-review/invite-teaser.webp', onError: vi.fn(), isLocal: false })),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} alt='' />,
}))

describe('ProfileReviewInviteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders invite copy and hint when visible', () => {
    render(<ProfileReviewInviteCard visible onTap={() => {}} />)

    expect(screen.getByText('悦仔给你挑了几个局')).toBeInTheDocument()
    expect(screen.getByText('确认后，悦仔会按你的热量地图，帮你挑最对味的局。')).toBeInTheDocument()
    expect(screen.getByText('确认并进入发现')).toBeInTheDocument()
  })

  it('fires onTap when user taps the enabled card', () => {
    const onTap = vi.fn()
    render(<ProfileReviewInviteCard visible onTap={onTap} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('does not fire onTap when disabled', () => {
    const onTap = vi.fn()
    render(<ProfileReviewInviteCard visible disabled onTap={onTap} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('does not fire onTap when busy', () => {
    const onTap = vi.fn()
    render(<ProfileReviewInviteCard visible busy onTap={onTap} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('shows busy hint when busy', () => {
    render(<ProfileReviewInviteCard visible busy onTap={() => {}} />)

    expect(screen.getByText('正在进入发现…')).toBeInTheDocument()
  })

  it('marks aria-disabled when disabled', () => {
    render(<ProfileReviewInviteCard visible disabled onTap={() => {}} />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })
})
