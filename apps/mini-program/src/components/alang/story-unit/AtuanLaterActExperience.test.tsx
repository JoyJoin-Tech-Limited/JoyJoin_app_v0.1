import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createAtuanLaterActProgress, type AtuanLaterActProgress, type AtuanThirdActProgress } from '@shared/alang/atuanLaterActs'
import { AtuanLaterActExperience, AtuanLaterActPrelude, AtuanLaterActScene } from './AtuanLaterActExperience'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

describe('AtuanLaterActExperience', () => {
  it('keeps the scene usable when WeChat cannot decode the bundled background', () => {
    render(
      <AtuanLaterActScene
        unitId='s1-p2-atuan'
        background='pavilion.webp'
        character='atuan.webp'
        speech='test speech'
      />,
    )

    fireEvent.error(screen.getByTestId('atuan-later-background'))

    expect(screen.queryByTestId('atuan-later-background')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-later-scene')).toHaveClass('atuan-later-scene--fallback')
    expect(screen.getByText('test speech')).toBeInTheDocument()
  })

  it('opens a later act with the same two-choice scene beat as the first act', () => {
    const onBegin = vi.fn()
    render(<AtuanLaterActPrelude unitId='s1-p2-atuan' background='pavilion.webp' character='atuan.webp' disabled={false} onBegin={onBegin} />)

    expect(screen.getByTestId('atuan-later-prelude')).toBeInTheDocument()
    expect(screen.getByText('阿团把一张反复折过的座位图铺在桌上。两把椅子被他挪过很多次，每一次都像差一点才敢停下。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '先看看他改过的地方' }))
    expect(onBegin).toHaveBeenCalledWith(0, '先看看他改过的地方')
  })

  it('turns the second-act background highlights into a recoverable seating game', () => {
    const onComplete = vi.fn()
    const Harness = () => {
      const [progress, setProgress] = useState(() => createAtuanLaterActProgress('s1-p2-atuan', 'read_plan_first'))
      return <AtuanLaterActExperience unitId='s1-p2-atuan' background='pavilion.webp' character='atuan.webp' progress={progress} disabled={false} onProgress={(next: AtuanLaterActProgress) => { if (next.unitId === 's1-p2-atuan') setProgress(next) }} onComplete={onComplete} />
    }
    render(<Harness />)

    expect(screen.getByTestId('atuan-later-background')).toHaveAttribute('src', 'pavilion.webp')
    expect(screen.getByText('你接着说')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看反复折过的座位图' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '这些折痕，是你一次次改出来的吗？' }))
    for (const name of ['查看反复折过的座位图', '查看椅脚旁的浅痕', '查看没有名字的席位卡']) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    expect(screen.getByText('你想怎么回应阿团？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把你的邀请说清，把舒服的距离留给他选。' }))
    expect(screen.getByText('阿团把座位图和两把椅子留在你们中间。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '把座位图转正' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起摆好座位图' }))
    expect(screen.getByTestId('atuan-later-experience')).toHaveClass('atuan-later-experience--game')
    fireEvent.click(screen.getByRole('button', { name: '把座位图转正' }))
    fireEvent.click(screen.getByRole('button', { name: '把椅子挪得更近' }))
    expect(screen.getByRole('alert')).toHaveTextContent('再留一点呼吸感')
    fireEvent.click(screen.getByRole('button', { name: '留出能自在说话的距离' }))
    const completeButton = screen.getByRole('button', { name: '收好阿团的这段故事' })
    expect(completeButton.closest('.atuan-later-experience__scroll')).toBeNull()
    expect(completeButton.closest('.atuan-later-experience__panel')).not.toBeNull()
    fireEvent.click(completeButton)
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      version: 'atuan-later-acts-v2',
      unitId: 's1-p2-atuan',
      arrivalReplyId: 'ask_fold_history',
      actionId: 'arrange_seating_plan',
      endingId: 'room_preserved',
      game: expect.objectContaining({ planUpright: true, chairGap: 'breathing', attempts: 1 }),
    }))
  })

  it('keeps the third-act other seat blank instead of writing an answer for Momo', () => {
    const onComplete = vi.fn()
    let progress: AtuanThirdActProgress = {
      ...createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first'),
      arrivalReplyId: 'ask_sixth_card' as const,
      highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
      followupId: 'leave_answer' as const,
      gameStarted: true,
      game: { boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: 'unset' as const, attempts: 0 },
    }
    const onProgress = vi.fn((next) => { progress = next })
    const { rerender } = render(<AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} disabled={false} onProgress={onProgress} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: '替默默写上名字' }))
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ game: expect.objectContaining({ otherSeat: 'unset', attempts: 1 }) }))

    progress = onProgress.mock.calls[onProgress.mock.calls.length - 1]![0]
    rerender(<AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} disabled={false} onProgress={onProgress} onComplete={onComplete} />)
    expect(screen.getByRole('alert')).toHaveTextContent('不能替默默写下答案')
    fireEvent.click(screen.getByRole('button', { name: '把另一边留空' }))
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ game: expect.objectContaining({ otherSeat: 'blank' }) }))
    progress = onProgress.mock.calls[onProgress.mock.calls.length - 1]![0]
    rerender(<AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} disabled={false} onProgress={onProgress} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      version: 'atuan-later-acts-v2',
      unitId: 's1-p3-atuan',
      arrivalReplyId: 'ask_sixth_card',
      actionId: 'open_returned_card',
      endingId: 'answer_left_open',
      game: expect.objectContaining({ boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: 'blank', attempts: 1 }),
    }))
  })
})
