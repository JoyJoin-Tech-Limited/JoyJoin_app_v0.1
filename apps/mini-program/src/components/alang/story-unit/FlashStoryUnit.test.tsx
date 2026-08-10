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
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))
vi.mock('../FlashUi', () => ({
  FlashButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  FlashNpcDialogueScene: ({ speech }: any) => <div data-testid='npc-speech'>{speech}</div>,
}))
vi.mock('../FlashStoryMicroGame', () => ({
  FlashStoryMicroGame: ({ onInteractionStart, onSolved }: any) => <button onClick={() => { onInteractionStart?.(); onSolved() }}>完成旧物</button>,
}))
vi.mock('./ShiqiOutbookInteraction', () => ({ ShiqiOutbookInteraction: () => null }))
vi.mock('../../../lib/analytics/flashStoryAnalytics', () => ({ flashStoryAnalytics: { track: vi.fn() } }))

const npc = { id: 'npc-lizi', slug: 'lizi', name: '栗子', species: '松鼠', personalitySummary: '', themeColor: '#000', avatarUrl: null }
const story = {
  id: 'episode-lizi-1', code: 's1-p1-lizi', seasonTitle: '没有名字的旧物', phase: 1, title: '干掉的彩笔', objectCode: 'dry-markers',
  opening: '第一次见，我叫栗子。', action: '栗子把彩笔推过来。', discovery: '', closing: null, response: null,
  motion: { ambient: 'breathe' }, fragment: null, progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 0, total: 15 },
}
const question = { id: 's1-p1-lizi-response-v2', text: '你愿意怎么和我开始？', options: [
  { id: 's1-p1-lizi-cooperate-a', label: '我想先按试写痕迹配回笔帽。' },
  { id: 's1-p1-lizi-cooperate-b', label: '我想先知道：哪支笔最久没被用过？' },
] }

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('FlashStoryUnit choice persistence', () => {
  it('submits a non-first reviewed option and restores that exact payload after process death', async () => {
    const firstSubmit = vi.fn().mockResolvedValue(undefined)
    const first = render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={firstSubmit} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: question.options[1].label }))
    fireEvent.click(screen.getByRole('button', { name: '完成旧物' }))
    expect(firstSubmit).toHaveBeenCalledWith(expect.objectContaining({ optionId: question.options[1].id, questionId: question.id }))
    first.unmount()

    const retrySubmit = vi.fn().mockResolvedValue(undefined)
    render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={retrySubmit} onContinue={vi.fn()} />)
    expect(screen.getByText(question.options[1].label)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新送出' }))
    expect(retrySubmit).toHaveBeenCalledWith(expect.objectContaining({ optionId: question.options[1].id, questionId: question.id }))
  })

  it('discards a solved payload when the reviewed option set changed', () => {
    storage.set('joyjoin_flash_story_unit_v2_s1-p1-lizi_enc-1_episode-lizi-1', {
      unitId: 's1-p1-lizi',
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice: { questionId: question.id, optionId: 'retired-option', label: '旧选项' },
      companionEvent: 'SUCCESS',
      analyticsSent: ['story_start', 'object_complete'],
    })
    const submit = vi.fn().mockResolvedValue(undefined)

    render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.queryByText('旧选项')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新送出' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: question.options[0].label })).toBeInTheDocument()
    expect(storage.get('joyjoin_flash_story_unit_v2_s1-p1-lizi_enc-1_episode-lizi-1')).toEqual(expect.objectContaining({
      stage: 'NPC_INTRO',
      choice: null,
    }))
  })
})
