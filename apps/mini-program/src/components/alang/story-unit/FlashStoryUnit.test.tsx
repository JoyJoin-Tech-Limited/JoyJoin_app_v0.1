import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlashStoryUnit } from './FlashStoryUnit'

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
} }))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))
vi.mock('../FlashUi', () => ({
  FlashButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  FlashNpcDialogueScene: ({ speech }: any) => <div data-testid='npc-speech'>{speech}</div>,
}))
vi.mock('../../../lib/analytics/flashStoryAnalytics', () => ({ flashStoryAnalytics: { track: vi.fn() } }))

const motion = { ambient: 'breathe' }
const progress = { completedInPhase: 0, totalInPhase: 5, completedTotal: 0, total: 15 }
const baseNpc = { id: 'npc-atuan', slug: 'atuan', name: '阿团', species: '水豚', personalitySummary: '', themeColor: '#000', avatarUrl: null }
const firstStory = {
  id: 'episode-atuan-1', code: 's1-p1-atuan', seasonTitle: '没有名字的旧物', phase: 1,
  title: '五张没有送出去的观察卡', objectCode: 'observation-cards', opening: '', action: '', discovery: '',
  closing: null, response: null, motion, fragment: null, progress,
}
const firstQuestion = { id: 's1-p1-atuan-response-v2', text: '你准备怎么做？', options: [
  { id: 'atuan-a', label: '旧选项一' },
  { id: 'atuan-b', label: '旧选项二' },
] }

function renderFirst(submit = vi.fn().mockResolvedValue(undefined)) {
  return {
    submit,
    view: render(<FlashStoryUnit encounterId='enc-atuan' npc={baseNpc as any} story={firstStory as any} question={firstQuestion as any} motion={motion as any} storyPosition={5} submitState='idle' submitError='' atuanArrivalAssets={{ scene: 'park.webp', character: 'atuan.webp', bag: 'bag.webp' }} onSubmit={submit} onContinue={vi.fn()} />),
  }
}

function reachActionChoice() {
  fireEvent.click(screen.getByRole('button', { name: '查看站在长椅旁的阿团' }))
  fireEvent.click(screen.getByRole('button', { name: '阿团一直看着公园入口，点击回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '查看长椅上的纸袋' }))
  fireEvent.click(screen.getByRole('button', { name: '纸袋里装着五张没有送出去的卡，点击回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '接住被风掀起的卡片' }))
}

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('FlashStoryUnit production flow', () => {
  it('runs the first Atuan encounter through simultaneous highlights and a real story submission', () => {
    const { submit } = renderFirst()
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-arrival-prelude').querySelector('.atuan-arrival__scene')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByRole('button', { name: '查看站在长椅旁的阿团' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看长椅上的纸袋' })).toBeInTheDocument()

    reachActionChoice()
    fireEvent.click(screen.getByRole('button', { name: '先压住纸袋' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('一起看看它们该去哪里')
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起整理卡片' }))

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: firstQuestion.id,
      optionId: 'atuan-b',
      storyPath: expect.objectContaining({ version: 'atuan-first-act-v2', approachId: 'notice_again' }),
    }))
  })

  it('keeps the full first encounter actionable when every scene image fails', () => {
    const { submit } = renderFirst()

    for (const image of screen.getAllByRole('img', { hidden: true })) {
      fireEvent.error(image)
    }

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看站在长椅旁的阿团' })).toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: '查看长椅上的纸袋' })).toBeEmptyDOMElement()

    reachActionChoice()
    fireEvent.click(screen.getByRole('button', { name: '先压住纸袋' }))
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起整理卡片' }))

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: firstQuestion.id,
      optionId: 'atuan-b',
      storyPath: expect.objectContaining({ version: 'atuan-first-act-v2', approachId: 'notice_again' }),
    }))
  })

  it('restores the selected Atuan action after the page is recreated', () => {
    const first = renderFirst()
    reachActionChoice()
    fireEvent.click(screen.getByRole('button', { name: '先接住飞出的卡' }))
    first.view.unmount()

    renderFirst()
    expect(screen.getByRole('button', { name: '和阿团一起整理卡片' })).toBeInTheDocument()
    expect(screen.queryByText('先接住飞出的卡')).not.toBeInTheDocument()
  })

  it('keeps later Atuan chapters on their existing conversational path', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const story = { ...firstStory, id: 'episode-atuan-2', code: 's1-p2-atuan', phase: 2, title: '阿团认领座位图', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p2-atuan-response-v2' }
    render(<FlashStoryUnit encounterId='enc-p2' npc={baseNpc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={6} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)
    expect(screen.getByTestId('npc-speech')).not.toBeEmptyDOMElement()
    expect(screen.queryByTestId('atuan-arrival-prelude')).not.toBeInTheDocument()
  })

  it('submits non-Atuan choices without entering the Atuan scene', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const npc = { ...baseNpc, id: 'npc-lizi', slug: 'lizi', name: '栗子', species: '松鼠' }
    const story = { ...firstStory, id: 'episode-lizi-1', code: 's1-p1-lizi', title: '干掉的彩笔', objectCode: 'dry-markers' }
    const question = { id: 's1-p1-lizi-response-v2', text: '怎么开始？', options: [{ id: 'lizi-a', label: '先看笔迹' }] }
    render(<FlashStoryUnit encounterId='enc-lizi' npc={npc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '先看笔迹' }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ optionId: 'lizi-a' }))
  })
})
