import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { MOMO_FIRST_ACT_HIGHLIGHTS, MomoFirstActExperience, momoFirstActStorageKey } from './MomoFirstActExperience'

const mocks = vi.hoisted(() => ({ storage: new Map<string, unknown>(), navigateTo: vi.fn(), didShow: null as null | (() => void) }))
vi.mock('@tarojs/taro', () => ({ default: { getStorageSync: (key: string) => mocks.storage.get(key), setStorageSync: (key: string, value: unknown) => mocks.storage.set(key, value), removeStorageSync: (key: string) => mocks.storage.delete(key), navigateTo: mocks.navigateTo }, useDidShow: (callback: () => void) => { mocks.didShow = callback } }))
vi.mock('@tarojs/components', () => ({ View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>, Text: ({ children, ...props }: any) => <span {...props}>{children}</span>, Image: ({ mode: _mode, ...props }: any) => <img {...props} /> }))

describe('MomoFirstActExperience — Atuan template parity', () => {
  beforeEach(() => { mocks.storage.clear(); mocks.navigateTo.mockClear(); mocks.didShow = null })

  it('keeps clue inspection single-card and reveals the route book fourth', () => {
    render(<MomoFirstActExperience encounterId='momo-1' scene='momo.jpg' disabled={false} onSpeechChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getAllByTestId('momo-first-act-hotspot')).toHaveLength(3)
    for (const highlight of MOMO_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) {
      fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
      expect(screen.getByTestId('momo-scene-clue')).toHaveTextContent(highlight.speech)
      expect(screen.queryByText(highlight.replies[0].label)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('三处线索已找到')
    expect(screen.getByRole('button', { name: '观察路线书台' })).toBeInTheDocument()
  })

  it('returns from the shared dedicated game before completing approach 0', () => {
    const onComplete = vi.fn()
    render(<MomoFirstActExperience encounterId='momo-2' scene='momo.jpg' disabled={false} onSpeechChange={vi.fn()} onComplete={onComplete} />)
    for (const highlight of MOMO_FIRST_ACT_HIGHLIGHTS.slice(0, 3)) { fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` })); fireEvent.click(screen.getByRole('button', { name: `收下${highlight.label}的线索，回到现场` })) }
    fireEvent.click(screen.getByRole('button', { name: '观察路线书台' })); fireEvent.click(screen.getByRole('button', { name: '收下路线书台的线索，回到现场' })); fireEvent.click(screen.getByRole('button', { name: '替默默扶住晃动的路线册' }))
    fireEvent.click(screen.getByRole('button', { name: FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-momo'].approaches[0].label }))
    fireEvent.click(screen.getByRole('button', { name: '和默默一起整理三段路线' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: expect.stringContaining('mode=momo') })
    mocks.storage.set(`${momoFirstActStorageKey('momo-2')}:game`, [{}, {}, {}]); act(() => mocks.didShow?.())
    fireEvent.click(screen.getByRole('button', { name: '完成默默第一幕' })); expect(onComplete).toHaveBeenCalledWith(0)
  })
})
