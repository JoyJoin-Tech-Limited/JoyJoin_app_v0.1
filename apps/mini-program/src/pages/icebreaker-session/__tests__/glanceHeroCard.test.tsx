import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PhaseHeroCard } from '../components/PhaseHeroCard'

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

// Test-local stand-in so the JSX below typechecks without the Taro import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Text = (props: any) => <span {...props} />

describe('PhaseHeroCard — glance stack dual path (S3 pilot)', () => {
  const baseProps = {
    phase: 'micro_challenge' as const,
    title: '摆出你们的一致姿势',
    prompt: '三秒内摆出同一个动作',
    statusChip: '第 1 位玩家',
    statusText: '点按节奏球，和大家一起完成',
    doneCount: 2,
    totalCount: 6,
  }

  it('glance mode renders L1 emblem + label, L2 script, ACT — but hides L3 behind the peek', () => {
    const { container } = render(
      <PhaseHeroCard
        {...baseProps}
        glanceMode
        l2Framing='一起来——'
        actions={<Text>ACT-TARGET</Text>}
      >
        <Text>AIGC-FOOTER</Text>
      </PhaseHeroCard>,
    )

    // L1: emblem zone + hairline canonical label.
    expect(container.querySelector('.phase-hero-card__l1')).toBeTruthy()
    expect(container.querySelector('.phase-hero-card__l1-emblem')).toBeTruthy()
    expect(screen.getByText('挑战')).toBeTruthy()
    // L2: framing + title + prompt at quiet contrast.
    expect(screen.getByText('一起来——')).toBeTruthy()
    expect(screen.getByText('摆出你们的一致姿势')).toBeTruthy()
    expect(screen.getByText('三秒内摆出同一个动作')).toBeTruthy()
    // Pinned (spec §4.2): ACT target and slot/AIGC content render outside the peek.
    expect(screen.getByText('ACT-TARGET')).toBeTruthy()
    expect(screen.getByText('AIGC-FOOTER')).toBeTruthy()
    // L3: status text/chip NOT rendered until the hold-to-peek opens.
    expect(screen.queryByText('点按节奏球，和大家一起完成')).toBeNull()
    expect(screen.queryByText('第 1 位玩家')).toBeNull()
    expect(screen.getByText('2/6 · 按住看')).toBeTruthy()
  })

  it('hold-to-peek reveals L3 and release re-hides it', () => {
    const { container } = render(<PhaseHeroCard {...baseProps} glanceMode />)
    const peek = container.querySelector('.glance-peek') as HTMLElement
    expect(peek).toBeTruthy()

    fireEvent.touchStart(peek)
    expect(screen.getByText('点按节奏球，和大家一起完成')).toBeTruthy()
    expect(screen.getByText('第 1 位玩家')).toBeTruthy()

    fireEvent.touchEnd(peek)
    expect(screen.queryByText('点按节奏球，和大家一起完成')).toBeNull()
  })

  it('legacy mode (flag-off) keeps the 4-zone layout with status visible inline', () => {
    const { container } = render(
      <PhaseHeroCard {...baseProps} actions={<Text>ACT-TARGET</Text>} />,
    )
    expect(container.querySelector('.phase-hero-card__l1')).toBeNull()
    expect(container.querySelector('.glance-peek')).toBeNull()
    // Legacy status zone renders inline as before.
    expect(screen.getByText('点按节奏球，和大家一起完成')).toBeTruthy()
    expect(screen.getByText('第 1 位玩家')).toBeTruthy()
    expect(container.querySelector('.phase-hero-card__header-rail')).toBeTruthy()
  })

  it('glance mode never renders both an art band and the L1 emblem (one anchor rule)', () => {
    const { container } = render(
      <PhaseHeroCard {...baseProps} glanceMode artUrl='https://cdn.example.com/band.webp' />,
    )
    expect(container.querySelector('.phase-hero-card__art')).toBeNull()
    expect(container.querySelector('.phase-hero-card__l1-emblem')).toBeTruthy()
  })

  it('glance mode renders without L3 when there is no context to demote', () => {
    const { container } = render(
      <PhaseHeroCard phase='micro_challenge' title='t' glanceMode />,
    )
    expect(container.querySelector('.glance-peek')).toBeNull()
    expect(container.querySelector('.phase-hero-card__l1')).toBeTruthy()
  })
})
