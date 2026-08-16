import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getShiqiFirstActStorageKey, SHIQI_FIRST_ACT_HIGHLIGHTS, ShiqiFirstActExperience } from './ShiqiFirstActExperience'

const mocks = vi.hoisted(() => ({ storage: new Map<string, unknown>(), navigateTo: vi.fn(), didShow: null as null | (() => void) }))
vi.mock('@tarojs/taro', () => ({ default: { getStorageSync: (key: string) => mocks.storage.get(key), setStorageSync: (key: string, value: unknown) => mocks.storage.set(key, value), removeStorageSync: (key: string) => mocks.storage.delete(key), navigateTo: mocks.navigateTo }, useDidShow: (callback: () => void) => { mocks.didShow = callback } }))
vi.mock('@tarojs/components', () => ({ View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>, Text: ({ children, ...props }: any) => <span {...props}>{children}</span>, Image: ({ mode: _mode, ...props }: any) => <img {...props} /> }))

describe('ShiqiFirstActExperience — Atuan template parity', () => {
  beforeEach(() => { mocks.storage.clear(); mocks.navigateTo.mockClear(); mocks.didShow = null })

  it('shows only three first-layer markers and unlocks the light box after them', () => {
    render(<ShiqiFirstActExperience encounterId='shiqi-1' scene='shiqi.jpg' onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getAllByTestId('shiqi-first-act-hotspot')).toHaveLength(3)
    for (const highlight of SHIQI_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) {
      fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
      expect(screen.getByTestId('shiqi-scene-clue')).toHaveTextContent(highlight.observation)
      expect(screen.queryByText(highlight.replies[0].label)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('三处线索已找到')
    expect(screen.getByRole('button', { name: '观察竖向检视灯箱' })).toBeInTheDocument()
  })

  it('uses the dedicated one-item-at-a-time game and preserves approach 1', () => {
    const onComplete = vi.fn()
    render(<ShiqiFirstActExperience encounterId='shiqi-2' scene='shiqi.jpg' onSpeechChange={vi.fn()} onComplete={onComplete} />)
    for (const highlight of SHIQI_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) { fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` })); fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` })) }
    fireEvent.click(screen.getByRole('button', { name: '观察竖向检视灯箱' })); fireEvent.click(screen.getByRole('button', { name: '收下竖向检视灯箱的线索，回到现场' })); fireEvent.click(screen.getByRole('button', { name: '替拾柒接住滑下灯箱的路线纸' }))
    fireEvent.click(screen.getByRole('button', { name: '把后来写上的箭头放到旁边' }))
    expect(screen.getByText('灯箱里的三层路线纸')).toBeInTheDocument()
    expect(screen.getAllByTestId('shiqi-object-hotspot')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '和拾柒一起核对三层路线纸' })).not.toBeInTheDocument()
    for (const label of ['同一个折返点', '后写的箭头', '错开的页角']) {
      fireEvent.click(screen.getByRole('button', { name: `观察${label}` }))
      fireEvent.click(screen.getByRole('button', { name: `收下${label}的线索，继续查看三层路线纸` }))
    }
    expect(screen.getAllByTestId('shiqi-highlight-reply')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '哪些是三张纸都能证明的？' }))
    expect(screen.getByTestId('shiqi-scene-speech')).toHaveTextContent('共同事实')
    fireEvent.click(screen.getByRole('button', { name: '和拾柒一起核对三层路线纸' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: expect.stringContaining('mode=shiqi') })
    mocks.storage.set(`${getShiqiFirstActStorageKey('shiqi-2')}:game`, [{}, {}, {}]); act(() => mocks.didShow?.())
    fireEvent.click(screen.getByRole('button', { name: '完成拾柒第一幕' })); expect(onComplete).toHaveBeenCalledWith(1)
  })
})
