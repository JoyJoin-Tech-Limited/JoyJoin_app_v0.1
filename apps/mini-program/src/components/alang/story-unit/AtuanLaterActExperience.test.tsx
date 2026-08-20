import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  it('keeps later-act Atuan crisp during highlight exploration like the first act', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/components/alang/story-unit/AtuanLaterActExperience.scss'), 'utf8')

    expect(styles).not.toContain('atuan-later-scene__character--quiet')
    expect(styles).not.toMatch(/\.atuan-later-scene__character[^{]*\{[^}]*opacity:\s*0\.[0-8]/s)
    expect(styles).toContain('rgba($color-text-primary, 0.36)')
    expect(styles).toMatch(/\.atuan-later-scene__character\s*\{[^}]*right:\s*0;[^}]*width:\s*45%;[^}]*height:\s*56%;/s)
    expect(styles).toMatch(/\.atuan-later-scene__speech\s*\{[^}]*right:\s*200rpx;[^}]*left:\s*24rpx;/s)
  })

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
    const { container } = render(<AtuanLaterActPrelude unitId='s1-p2-atuan' background='pavilion.webp' character='atuan.webp' disabled={false} onBegin={onBegin} />)

    expect(screen.getByTestId('atuan-later-prelude')).toBeInTheDocument()
    expect(container.querySelector('.atuan-later-experience__chapter')).toBeNull()
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
    const { container } = render(<Harness />)

    expect(screen.getByTestId('atuan-later-background')).toHaveAttribute('src', 'pavilion.webp')
    expect(screen.getByText('你接着说')).toBeInTheDocument()
    expect(container.querySelector('.atuan-later-experience__chapter')).toBeNull()
    expect(screen.queryByRole('button', { name: '查看反复折过的座位图' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '这些折痕，是你一次次改出来的吗？' }))
    expect(container.querySelector('.atuan-later-experience__progress')).toBeNull()
    expect(container.querySelectorAll('.first-act-highlight')).toHaveLength(3)
    expect(container.querySelector('.atuan-later-scene__hotspot-ring')).toBeNull()
    for (const name of ['观察反复折过的座位图', '观察椅脚旁的浅痕', '观察没有名字的席位卡']) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    expect(screen.getByText('你想怎么回应阿团？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把你的邀请说清，把舒服的距离留给他选。' }))
    expect(screen.getByText('阿团把座位图和两把椅子留在你们中间。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '把座位图转正' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起摆好座位图' }))
    expect(screen.getByTestId('atuan-later-experience')).toHaveClass('atuan-later-experience--game')
    fireEvent.click(screen.getByRole('button', { name: '让朝上记号停在右下角' }))
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
      game: expect.objectContaining({ planUpright: true, chairGap: 'breathing', attempts: 0 }),
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
      game: expect.objectContaining({ boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: 'blank', attempts: 0 }),
    }))
  })

  it('turns repeated orientation mistakes into a clue and an optional assist', () => {
    const Harness = () => {
      const [progress, setProgress] = useState<AtuanLaterActProgress>({
        ...createAtuanLaterActProgress('s1-p2-atuan', 'read_plan_first'),
        arrivalReplyId: 'ask_fold_history',
        highlightOrder: ['plan_folds', 'chair_scuffs', 'blank_place'],
        followupId: 'leave_choice',
        gameStarted: true,
      })
      return <AtuanLaterActExperience unitId='s1-p2-atuan' background='pavilion.webp' character='atuan.webp' progress={progress} onProgress={setProgress} onComplete={vi.fn()} />
    }
    render(<Harness />)
    for (let attempt = 0; attempt < 3; attempt += 1) fireEvent.click(screen.getByRole('button', { name: '逆时针转一格' }))
    expect(screen.getByText(/线索：朝上记号/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请阿团压住正确方向' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '请阿团压住正确方向' }))
    expect(screen.getByText('两把椅子停在哪里？')).toBeInTheDocument()
  })

  it('makes the third act inspect the lock and card boundary before name placement', () => {
    const Harness = () => {
      const [progress, setProgress] = useState<AtuanLaterActProgress>({
        ...createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first'),
        arrivalReplyId: 'ask_sixth_card',
        highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
        followupId: 'leave_answer',
        gameStarted: true,
      })
      return <AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} onProgress={setProgress} onComplete={vi.fn()} />
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '用卡角撬开箱盖' }))
    expect(screen.getByLabelText('已完成 0 步，共 4 步')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '对齐齿痕后转动钥匙' }))
    fireEvent.click(screen.getByRole('button', { name: '翻读背面被擦淡的名字' }))
    expect(screen.getByText('第六张卡该怎样回到第二幕？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '只看正面并摆到座位图中央' }))
    expect(screen.getByText('先确认谁在发出邀请。')).toBeInTheDocument()
  })

  it('gives the third-act card and signer steps their own failure ladder and assist', () => {
    const Harness = () => {
      const [progress, setProgress] = useState<AtuanThirdActProgress>({
        ...createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first'),
        arrivalReplyId: 'ask_sixth_card',
        highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
        followupId: 'leave_answer',
        gameStarted: true,
        game: { boxUnlocked: true, invitationPlaced: false, atuanNamePlaced: false, otherSeat: 'unset', attempts: 0 },
      })
      return <AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} variantKey='replay-third-act' onProgress={(next) => { if (next.unitId === 's1-p3-atuan') setProgress(next) }} onComplete={vi.fn()} />
    }
    render(<Harness />)

    for (let attempt = 0; attempt < 3; attempt += 1) fireEvent.click(screen.getByRole('button', { name: '把卡片藏回夹层' }))
    expect(screen.getByRole('alert')).toHaveTextContent('邀请再次消失')
    expect(screen.getByText(/线索：正面保留着完整邀请句/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '请阿团只摆好卡片正面' }))
    expect(screen.getByText('先确认谁在发出邀请。')).toBeInTheDocument()

    for (let attempt = 0; attempt < 3; attempt += 1) fireEvent.click(screen.getByRole('button', { name: '先放上默默的名牌' }))
    expect(screen.getByRole('alert')).toHaveTextContent('颠倒邀请方向')
    expect(screen.getByText(/线索：卡片上的句子来自阿团/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '请阿团放上自己的名牌' }))
    expect(screen.getByText('另一边怎么放？')).toBeInTheDocument()
  })

  it('keeps attempts bounded and lets the user finish after repeated mistakes', () => {
    const onComplete = vi.fn()
    const Harness = () => {
      const [progress, setProgress] = useState<AtuanThirdActProgress>({
        ...createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first'),
        arrivalReplyId: 'ask_sixth_card',
        highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
        followupId: 'leave_answer',
        gameStarted: true,
        game: { boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: 'unset', attempts: 20 },
      })
      return <AtuanLaterActExperience unitId='s1-p3-atuan' background='table.webp' character='atuan.webp' progress={progress} onProgress={(next) => { if (next.unitId === 's1-p3-atuan') setProgress(next) }} onComplete={onComplete} />
    }
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '替默默写上名字' }))
    fireEvent.click(screen.getByRole('button', { name: '把另一边留空' }))
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ game: expect.objectContaining({ attempts: 0, otherSeat: 'blank' }) }))
  })

  it('uses the replay namespace to vary choice order deterministically', () => {
    const progress: AtuanThirdActProgress = {
      ...createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first'),
      arrivalReplyId: 'ask_sixth_card',
      highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
      followupId: 'leave_answer',
      gameStarted: true,
    }
    const props = { unitId: 's1-p3-atuan' as const, background: 'table.webp', character: 'atuan.webp', progress, onProgress: vi.fn(), onComplete: vi.fn() }
    const { container, rerender } = render(<AtuanLaterActExperience {...props} variantKey='a' />)
    const firstOrder = [...container.querySelectorAll('.atuan-later-experience__choice')].map((node) => node.textContent)
    rerender(<AtuanLaterActExperience {...props} variantKey='b' />)
    const secondOrder = [...container.querySelectorAll('.atuan-later-experience__choice')].map((node) => node.textContent)

    expect(secondOrder).not.toEqual(firstOrder)
    rerender(<AtuanLaterActExperience {...props} variantKey='a' />)
    expect([...container.querySelectorAll('.atuan-later-experience__choice')].map((node) => node.textContent)).toEqual(firstOrder)
  })

  it('also varies the second-act seating choices by replay namespace', () => {
    const progress: AtuanLaterActProgress = {
      ...createAtuanLaterActProgress('s1-p2-atuan', 'read_plan_first'),
      arrivalReplyId: 'ask_fold_history',
      highlightOrder: ['plan_folds', 'chair_scuffs', 'blank_place'],
      followupId: 'leave_choice',
      gameStarted: true,
    }
    const props = { unitId: 's1-p2-atuan' as const, background: 'pavilion.webp', character: 'atuan.webp', progress, onProgress: vi.fn(), onComplete: vi.fn() }
    const { container, rerender } = render(<AtuanLaterActExperience {...props} variantKey='a' />)
    const firstOrder = [...container.querySelectorAll('.atuan-later-experience__choice')].map((node) => node.textContent)
    rerender(<AtuanLaterActExperience {...props} variantKey='b' />)
    const secondOrder = [...container.querySelectorAll('.atuan-later-experience__choice')].map((node) => node.textContent)

    expect(secondOrder).not.toEqual(firstOrder)
  })
})
