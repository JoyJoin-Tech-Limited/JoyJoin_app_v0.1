import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FirstActHighlightOverlay } from './FirstActHighlightOverlay'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

const targets = [
  { id: 'npc', label: 'NPC本人', placementClassName: 'scene__target--npc' },
  { id: 'one', label: '物件一', placementClassName: 'scene__target--one' },
  { id: 'two', label: '物件二', placementClassName: 'scene__target--two' },
  { id: 'three', label: '物件三', placementClassName: 'scene__target--three' },
] as const

describe('FirstActHighlightOverlay', () => {
  it('matches Atuan by showing only the remaining targets with one shared marker grammar', () => {
    const onSelect = vi.fn()
    render(
      <FirstActHighlightOverlay
        npcSlug='demo'
        targets={targets}
        completedIds={['one']}
        activeId='two'
        onSelect={onSelect}
      />,
    )

    expect(screen.getAllByTestId('demo-first-act-hotspot')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '观察物件一' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察物件二' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '观察物件三' }))
    expect(onSelect).toHaveBeenCalledWith('three')
  })

  it('locks unopened targets while a reply panel is active', () => {
    const onSelect = vi.fn()
    render(
      <FirstActHighlightOverlay
        npcSlug='demo'
        targets={targets}
        completedIds={[]}
        activeId='npc'
        locked
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: '观察物件一' })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByRole('button', { name: '观察物件一' }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
