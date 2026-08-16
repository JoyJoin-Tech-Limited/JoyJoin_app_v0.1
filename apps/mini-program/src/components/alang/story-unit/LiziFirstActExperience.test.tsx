import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import {
  LIZI_FIRST_ACT_HIGHLIGHTS,
  LiziFirstActExperience,
  liziFirstActStorageKey,
} from './LiziFirstActExperience'

const mocks = vi.hoisted(() => ({ storage: new Map<string, unknown>(), navigateTo: vi.fn(), didShow: null as null | (() => void) }))
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => mocks.storage.get(key),
    setStorageSync: (key: string, value: unknown) => mocks.storage.set(key, value),
    removeStorageSync: (key: string) => mocks.storage.delete(key),
    navigateTo: mocks.navigateTo,
  },
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

function renderExperience(encounterId = 'lizi-1', onComplete = vi.fn()) {
  return render(<LiziFirstActExperience encounterId={encounterId} scene='lizi.jpg' onSpeechChange={vi.fn()} onComplete={onComplete} />)
}

function finishSceneHighlights() {
  for (const highlight of LIZI_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) {
    fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
    fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` }))
  }
  fireEvent.click(screen.getByRole('button', { name: '观察右侧工具车' }))
  fireEvent.click(screen.getByRole('button', { name: '收下右侧工具车的线索，回到现场' }))
}

describe('LiziFirstActExperience — Atuan template parity', () => {
  beforeEach(() => { mocks.storage.clear(); mocks.navigateTo.mockClear(); mocks.didShow = null })

  it('uses three disappearing scene clues, then unlocks the fourth clue', () => {
    renderExperience()
    expect(screen.getAllByTestId('lizi-first-act-hotspot')).toHaveLength(3)
    for (const highlight of LIZI_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) {
      fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
      expect(screen.getByTestId('lizi-scene-clue')).toHaveTextContent(highlight.speech)
      fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('三处线索已找到')
    expect(screen.getByRole('button', { name: '观察右侧工具车' })).toBeInTheDocument()
  })

  it('adds a three-detail object, follow-up response, and dedicated three-round game', () => {
    const onComplete = vi.fn()
    renderExperience('lizi-flow', onComplete)
    finishSceneHighlights()
    fireEvent.click(screen.getByRole('button', { name: '接住滚向桌沿的三支彩笔' }))
    const approach = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-lizi'].approaches[1]
    fireEvent.click(screen.getByRole('button', { name: approach.label }))

    expect(screen.getByText('摊开的三道试写痕迹')).toBeInTheDocument()
    expect(screen.getAllByTestId('lizi-object-hotspot')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '和栗子一起配回三顶笔帽' })).not.toBeInTheDocument()
    for (const label of ['暖开的软弧边', '安静的双细线', '醒目的短断点']) {
      fireEvent.click(screen.getByRole('button', { name: `观察${label}` }))
      fireEvent.click(screen.getByRole('button', { name: `收下${label}的线索，继续查看试写纸` }))
    }
    expect(screen.getAllByTestId('lizi-highlight-reply')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '如果颜色看起来很像呢？' }))
    expect(screen.getByTestId('lizi-scene-speech')).toHaveTextContent('先别让颜色抢答')
    fireEvent.click(screen.getByRole('button', { name: '和栗子一起配回三顶笔帽' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: expect.stringContaining('mode=lizi') })
    expect(onComplete).not.toHaveBeenCalled()

    mocks.storage.set(`${liziFirstActStorageKey('lizi-flow')}:game`, [
      { cardId: 'warm', destinationId: 'soft-arc' },
      { cardId: 'quiet', destinationId: 'fine-pair' },
      { cardId: 'awake', destinationId: 'quick-notch' },
    ])
    act(() => mocks.didShow?.())
    fireEvent.click(screen.getByRole('button', { name: '完成栗子第一幕' }))
    expect(onComplete).toHaveBeenCalledWith(1)
  })

  it('keeps an old in-game v2 player at the new game handoff', () => {
    mocks.storage.set(liziFirstActStorageKey('lizi-v2'), {
      version: 'lizi-first-act-v2', encounterId: 'lizi-v2', phase: 'pair',
      replies: Object.fromEntries(LIZI_FIRST_ACT_HIGHLIGHTS.map(({ id }) => [id, 'legacy-reply'])),
      approachIndex: 0, inspectedMarks: ['warm', 'quiet', 'awake'], pairings: {}, attempts: 1,
    })
    renderExperience('lizi-v2')
    expect(screen.getByRole('button', { name: '和栗子一起配回三顶笔帽' })).toBeInTheDocument()
  })

  it('keeps the full scene and blocks interaction when disabled', () => {
    render(<LiziFirstActExperience encounterId='lizi-disabled' scene='lizi-full.jpg' disabled onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByTestId('lizi-first-act-scene')).toHaveAttribute('src', 'lizi-full.jpg')
    const hotspot = screen.getAllByTestId('lizi-first-act-hotspot')[0]
    fireEvent.click(hotspot)
    expect(screen.queryByTestId('lizi-scene-clue')).not.toBeInTheDocument()
  })
})
