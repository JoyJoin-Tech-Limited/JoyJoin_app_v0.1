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
  fireEvent.click(screen.getByRole('button', { name: '查看阿团' }))
  fireEvent.click(screen.getByRole('button', { name: '收下阿团的线索，回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '查看长椅' }))
  fireEvent.click(screen.getByRole('button', { name: '收下长椅的线索，回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '查看路灯' }))
  fireEvent.click(screen.getByRole('button', { name: '收下路灯的线索，回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '查看新出现的信封' }))
  fireEvent.click(screen.getByRole('button', { name: '收下信封线索，回到现场' }))
  fireEvent.click(screen.getByRole('button', { name: '接住被风掀起的卡片' }))
}

function reachConversation(action: '接住卡片' | '护住纸袋' = '护住纸袋') {
  reachActionChoice()
  fireEvent.click(screen.getByRole('button', { name: action }))
}

function completeConversation() {
  fireEvent.click(screen.getByRole('button', { name: '如果他不来，我们也别让这趟白跑。' }))
  fireEvent.click(screen.getByRole('button', { name: '走到阿团身边，看看那只纸袋' }))
  fireEvent.click(screen.getByRole('button', { name: '和阿团一起整理卡片' }))
}

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('FlashStoryUnit production flow', () => {
  it('unlocks the letter only after Atuan, the bench, and the lamp are explored', () => {
    const { submit } = renderFirst()
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-arrival-prelude').querySelector('.atuan-arrival__scene')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-scene-character')).toHaveAttribute('src', 'atuan.webp')
    expect(screen.getByRole('button', { name: '查看阿团' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看长椅' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看路灯' })).toBeInTheDocument()
    expect(screen.getByTestId('atuan-arrival-prelude').querySelectorAll('.atuan-arrival__scene-target')).toHaveLength(3)
    expect(screen.getByTestId('atuan-arrival-prelude').querySelectorAll('.atuan-arrival__target-label')).toHaveLength(0)
    expect(screen.queryByText('阿团')).not.toBeInTheDocument()
    expect(screen.queryByText('长椅')).not.toBeInTheDocument()
    expect(screen.queryByText('路灯')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看新出现的信封' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看阿团' }))
    expect(screen.getByTestId('atuan-arrival-prelude').querySelectorAll('.atuan-arrival__scene-target')).toHaveLength(2)
    expect(screen.getByTestId('atuan-scene-character')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收下阿团的线索，回到现场' }))
    fireEvent.click(screen.getByRole('button', { name: '查看长椅' }))
    fireEvent.click(screen.getByRole('button', { name: '收下长椅的线索，回到现场' }))
    expect(screen.queryByRole('button', { name: '查看新出现的信封' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看路灯' }))
    fireEvent.click(screen.getByRole('button', { name: '收下路灯的线索，回到现场' }))
    expect(screen.getByRole('button', { name: '查看新出现的信封' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看新出现的信封' }).querySelector('.atuan-arrival__target-label')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-scene-character')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看新出现的信封' }))
    expect(screen.getByTestId('atuan-scene-character')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收下信封线索，回到现场' }))
    expect(screen.getByTestId('atuan-scene-character')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '接住被风掀起的卡片' }))
    expect(screen.getByTestId('atuan-scene-character')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接住卡片' })).toHaveTextContent('接住卡片')
    expect(screen.getByRole('button', { name: '护住纸袋' })).toHaveTextContent('护住纸袋')
    fireEvent.click(screen.getByRole('button', { name: '护住纸袋' }))
    expect(screen.getByTestId('atuan-conversation-scene')).toBeInTheDocument()
    expect(screen.getByTestId('atuan-conversation-background')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-conversation-character')).toHaveAttribute('src', 'atuan.webp')
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.queryByText('水豚')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-scene-narration')).toHaveTextContent('你俯身护住纸袋')
    expect(screen.getByTestId('atuan-scene-dialogue')).toHaveTextContent('风今天好像比我更着急')
    expect(screen.getByTestId('atuan-scene-dialogue')).not.toHaveTextContent('你俯身护住纸袋')
    expect(submit).not.toHaveBeenCalled()
    completeConversation()

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

    expect(screen.queryByText('探索现场')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看阿团' })).not.toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: '查看长椅' })).not.toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: '查看路灯' })).not.toBeEmptyDOMElement()

    reachActionChoice()
    fireEvent.click(screen.getByRole('button', { name: '护住纸袋' }))
    completeConversation()

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: firstQuestion.id,
      optionId: 'atuan-b',
      storyPath: expect.objectContaining({ version: 'atuan-first-act-v2', approachId: 'notice_again' }),
    }))
  })

  it('restores the selected Atuan action after the page is recreated', () => {
    const first = renderFirst()
    reachConversation('接住卡片')
    first.view.unmount()

    renderFirst()
    expect(screen.getByTestId('atuan-conversation-background')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-scene-narration')).toHaveTextContent('你伸手接住被风掀起的卡片')
    expect(screen.getByRole('button', { name: '如果他不来，我们也别让这趟白跑。' })).toBeInTheDocument()
    expect(screen.queryByText('接住卡片')).not.toBeInTheDocument()
  })

  it('keeps later Atuan chapters on their existing conversational path', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const story = { ...firstStory, id: 'episode-atuan-2', code: 's1-p2-atuan', phase: 2, title: '阿团认领座位图', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p2-atuan-response-v2' }
    render(<FlashStoryUnit encounterId='enc-p2' npc={baseNpc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={6} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)
    expect(screen.getByTestId('npc-speech')).not.toBeEmptyDOMElement()
    expect(screen.queryByTestId('atuan-arrival-prelude')).not.toBeInTheDocument()
  })

  it('keeps the park scene and removes the identity tag after the first story settles', () => {
    const story = { ...firstStory, response: '阿团把卡片收好了。' }
    render(<FlashStoryUnit encounterId='enc-settled' npc={baseNpc as any} story={story as any} question={firstQuestion as any} motion={motion as any} storyPosition={5} submitState='idle' submitError='' atuanArrivalAssets={{ scene: 'park.webp', character: 'atuan.webp', bag: 'bag.webp' }} onSubmit={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByTestId('atuan-conversation-background')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-conversation-character')).toHaveAttribute('src', 'atuan.webp')
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.queryByText('水豚')).not.toBeInTheDocument()
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
