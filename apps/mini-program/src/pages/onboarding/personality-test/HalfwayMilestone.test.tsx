import { describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { HalfwayMilestone } from './HalfwayMilestone'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: ({ emoji, className }: { emoji: string; className?: string }) => (
    <span className={className} data-emoji={emoji}>{emoji}</span>
  ),
}))

vi.mock('../../../lib/milestoneBadges', () => ({
  MILESTONE_BADGES: { quizHalfway: '/assets/milestone-quiz-halfway.webp' },
}))

describe('HalfwayMilestone', () => {
  it('does not render before 50% progress', () => {
    const { container } = render(
      <HalfwayMilestone progressPercent={40} phase='testing' answered={3} estimatedTotal={8} />,
    )
    expect(container.querySelector('.halfway-milestone__card')).toBeNull()
  })

  it('renders at 50% progress in the testing phase', () => {
    const { container, getByText } = render(
      <HalfwayMilestone progressPercent={50} phase='testing' answered={4} estimatedTotal={8} />,
    )
    expect(container.querySelector('.halfway-milestone__card')).toBeTruthy()
    expect(getByText('半程已过')).toBeTruthy()
    expect(getByText('越来越了解你的性格了')).toBeTruthy()
  })

  it('does not render outside the testing phase', () => {
    const { container } = render(
      <HalfwayMilestone progressPercent={60} phase='intro' answered={4} estimatedTotal={8} />,
    )
    expect(container.querySelector('.halfway-milestone__card')).toBeNull()
  })

  it('auto-dismisses after the display duration', async () => {
    vi.useFakeTimers()
    const onReached = vi.fn()
    const { container } = render(
      <HalfwayMilestone
        progressPercent={60}
        phase='testing'
        answered={5}
        estimatedTotal={8}
        onMilestoneReached={onReached}
      />,
    )
    expect(container.querySelector('.halfway-milestone__card')).toBeTruthy()
    expect(onReached).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(4300) })
    expect(container.querySelector('.halfway-milestone__card')).toBeNull()

    vi.useRealTimers()
  })

  it('keeps the icon outside of a Text node (Image-in-Text guard)', () => {
    const { container } = render(
      <HalfwayMilestone progressPercent={50} phase='testing' answered={4} estimatedTotal={8} />,
    )
    const sub = container.querySelector('.halfway-milestone__text-sub')
    expect(sub).toBeTruthy()
    // The icon should be a sibling of the text label, not nested inside it.
    expect(sub?.querySelector('[data-emoji="✨"]')).toBeTruthy()
    expect(sub?.querySelector('span.halfway-milestone__text-sub-label')).toBeTruthy()
  })
})
