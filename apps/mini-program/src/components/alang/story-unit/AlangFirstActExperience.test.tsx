import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { ALANG_FIRST_ACT_HIGHLIGHTS, AlangFirstActExperience, alangFirstActStorageKey } from './AlangFirstActExperience'

const mocks = vi.hoisted(() => ({ storage: new Map<string, unknown>(), navigateTo: vi.fn(), didShow: null as null | (() => void) }))
vi.mock('@tarojs/taro', () => ({
  default: { getStorageSync: (key: string) => mocks.storage.get(key), setStorageSync: (key: string, value: unknown) => mocks.storage.set(key, value), removeStorageSync: (key: string) => mocks.storage.delete(key), navigateTo: mocks.navigateTo },
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
}))
vi.mock('@tarojs/components', () => ({ View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>, Text: ({ children, ...props }: any) => <span {...props}>{children}</span>, Image: ({ mode: _mode, ...props }: any) => <img {...props} /> }))

describe('AlangFirstActExperience — Atuan template parity', () => {
  beforeEach(() => { mocks.storage.clear(); mocks.navigateTo.mockClear(); mocks.didShow = null })

  it('uses three disappearing scene clues, then unlocks the fourth clue', () => {
    render(<AlangFirstActExperience encounterId='alang-1' scene='alang.jpg' onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getAllByTestId('alang-first-act-hotspot')).toHaveLength(3)
    for (const highlight of ALANG_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) {
      fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
      expect(screen.getByTestId('alang-scene-clue')).toHaveTextContent(highlight.speech)
      expect(screen.queryByText(highlight.replies[0].label)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('三处线索已找到')
    expect(screen.getByRole('button', { name: '观察窗边双椅' })).toBeInTheDocument()
  })

  it('opens the dedicated Atuan-style game and completes only after returning', () => {
    const onComplete = vi.fn()
    render(<AlangFirstActExperience encounterId='alang-2' scene='alang.jpg' onSpeechChange={vi.fn()} onComplete={onComplete} />)
    for (const highlight of ALANG_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) { fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` })); fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` })) }
    fireEvent.click(screen.getByRole('button', { name: '观察窗边双椅' })); fireEvent.click(screen.getByRole('button', { name: '收下窗边双椅的线索，回到现场' }))
    fireEvent.click(screen.getByRole('button', { name: '按住被风掀起的河岸草图' }))
    const approach = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-alang'].approaches[1]
    fireEvent.click(screen.getByRole('button', { name: approach.label }))
    expect(screen.getByText('反复折过的座位图')).toBeInTheDocument()
    expect(screen.getAllByTestId('alang-object-hotspot')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '和阿浪一起摆好两把椅子' })).not.toBeInTheDocument()
    for (const label of ['椅脚铅点', '转身弧线', '空着的名字栏']) {
      fireEvent.click(screen.getByRole('button', { name: `观察${label}` }))
      fireEvent.click(screen.getByRole('button', { name: `收下${label}的线索，继续查看座位图` }))
    }
    expect(screen.getAllByTestId('alang-highlight-reply')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '如果对方把椅子再挪远一点呢？' }))
    expect(screen.getByTestId('alang-scene-speech')).toHaveTextContent('那就远一点')
    fireEvent.click(screen.getByRole('button', { name: '和阿浪一起摆好两把椅子' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: expect.stringMatching(/mode=alang.*unitId=s1-p1-alang.*phase=1/),
    })
    expect(onComplete).not.toHaveBeenCalled()
    mocks.storage.set(`${alangFirstActStorageKey('alang-2')}:game`, [
      { cardId: 'distance', destinationId: 'half-step' },
      { cardId: 'angle', destinationId: 'same' },
      { cardId: 'exit', destinationId: 'open' },
    ])
    act(() => mocks.didShow?.())
    fireEvent.click(screen.getByRole('button', { name: '完成阿浪第一幕' }))
    expect(onComplete).toHaveBeenCalledWith(1)
  })

  it('keeps an in-progress v1 player at the game handoff after the template upgrade', () => {
    mocks.storage.set(alangFirstActStorageKey('alang-v1'), {
      version: 'atuan-template-v1', stage: 'conversation', seenIds: ALANG_FIRST_ACT_HIGHLIGHTS.map(({ id }) => id), activeId: null, approachIndex: 0,
    })
    render(<AlangFirstActExperience encounterId='alang-v1' scene='alang.jpg' onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: '和阿浪一起摆好两把椅子' })).toBeInTheDocument()
  })

  it('repairs a v2 conversation cache that lost its approach instead of rendering blank', () => {
    mocks.storage.set(alangFirstActStorageKey('alang-invalid'), {
      version: 'atuan-template-v2', stage: 'conversation', seenIds: ALANG_FIRST_ACT_HIGHLIGHTS.map(({ id }) => id), activeId: null, approachIndex: null,
      objectSeenIds: ['chair-pencil-marks', 'turning-arc', 'blank-name-line'], activeObjectId: null, followUpIndex: 0,
    })
    render(<AlangFirstActExperience encounterId='alang-invalid' scene='alang.jpg' onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-alang'].approaches[0].label })).toBeInTheDocument()
  })
})
