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
  it('plays Atuan phase one as anomaly, investigation, reversal, decision, and named ending', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const atuanNpc = { ...npc, id: 'npc-atuan', slug: 'atuan', name: '阿团', species: '水豚' }
    const atuanStory = {
      ...story,
      id: 'episode-atuan-1',
      code: 's1-p1-atuan',
      title: '五张没有送出去的观察卡',
      objectCode: 'observation-cards',
    }
    const atuanQuestion = {
      ...question,
      id: 's1-p1-atuan-response-v2',
      options: [
        { id: 'atuan-a', label: '旧系统选项一' },
        { id: 'atuan-b', label: '旧系统选项二' },
      ],
    }

    render(<FlashStoryUnit encounterId='enc-atuan' npc={atuanNpc as any} story={atuanStory as any} question={atuanQuestion as any} motion={story.motion as any} storyPosition={5} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.getByTestId('npc-speech')).toHaveTextContent('多了一张')
    expect(screen.getByTestId('flash-story-choice-panel')).not.toHaveTextContent('五张没有送出去的观察卡')
    fireEvent.click(screen.getByRole('button', { name: '先按纸张和笔迹，排出这些卡出现的顺序。' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('先看痕迹')
    expect(screen.getByText(/第七张纸更新/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '有人捡到以后，把它悄悄放回来了。' }))
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '看看卡片背面留下了什么' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('丢掉的旧稿')
    fireEvent.click(screen.getByRole('button', { name: '把卡还给你，不替你翻开。' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('没有人偷走任何东西')
    fireEvent.click(screen.getByRole('button', { name: '收好这个结局' }))

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 's1-p1-atuan-response-v2',
      optionId: 'atuan-a',
      label: '先按纸张和笔迹，排出这些卡出现的顺序。',
      storyPath: expect.objectContaining({
        version: 'atuan-first-act-v1',
        anomalyId: 'extra_card',
        investigationId: 'trace_order',
        hypothesisId: 'returned',
        decisionId: 'return_unread',
        endingId: 'no_one_stole',
      }),
    }))
  })

  it.each([
    {
      phase: 2,
      code: 's1-p2-atuan',
      objectCode: 'seat-plan',
      title: '阿团认领座位图',
      questionId: 's1-p2-atuan-response-v2',
      openingContext: '又见面了。上次谢谢你，那张卡后来找回来了',
      openingChoice: '你这次为什么愿意给我看？',
      openingReply: '因为上次你帮我时没有乱翻卡片',
      followUpChoice: '如果他只愿意坐远一点，也没关系吧？',
      followUpReply: '图是我的邀请，不是他的座位规定',
      hookChoice: '你是想邀请默默坐在你旁边，对吗？',
      hookReply: '我想和他并肩坐一会儿',
      closingChoice: '那就把你的意思也写在图上。',
    },
    {
      phase: 3,
      code: 's1-p3-atuan',
      objectCode: 'seat-plan',
      title: '座位图写上了名字',
      questionId: 's1-p3-atuan-response-v2',
      openingContext: '上次分别后，我把那句话写上去了',
      openingChoice: '如果默默不接受呢？',
      openingReply: '朋友不应该因为拒绝一次邀请',
      followUpChoice: '也告诉他，不接受不会影响你们做朋友。',
      followUpReply: '我想让他先安心',
      hookChoice: '那你准备怎么开口？',
      hookReply: '这张图是我为我们画的',
      closingChoice: '很好，就这样告诉他。',
    },
  ])('gives Atuan phase $phase the same complete conversational rhythm as phase one', ({
    phase,
    code,
    objectCode,
    title,
    questionId,
    openingContext,
    openingChoice,
    openingReply,
    followUpChoice,
    followUpReply,
    hookChoice,
    hookReply,
    closingChoice,
  }) => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const atuanNpc = { ...npc, id: 'npc-atuan', slug: 'atuan', name: '阿团', species: '水豚' }
    const atuanStory = {
      ...story,
      id: `episode-atuan-${phase}`,
      code,
      phase,
      title,
      objectCode,
    }
    const atuanQuestion = {
      ...question,
      id: questionId,
      options: [
        { id: `${code}-a`, label: '服务端旧选项一' },
        { id: `${code}-b`, label: '服务端旧选项二' },
      ],
    }

    render(<FlashStoryUnit encounterId={`enc-atuan-${phase}`} npc={atuanNpc as any} story={atuanStory as any} question={atuanQuestion as any} motion={story.motion as any} storyPosition={phase * 5} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.queryByTestId('atuan-story-dialogue')).not.toBeInTheDocument()
    expect(screen.getByTestId('flash-story-choice-panel')).not.toHaveTextContent(title)
    expect(screen.getByTestId('npc-speech')).toHaveTextContent(openingContext)
    fireEvent.click(screen.getByRole('button', { name: openingChoice }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent(openingReply)
    expect(submit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: followUpChoice }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent(followUpReply)
    expect(screen.queryByText(followUpChoice)).not.toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: hookChoice }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent(hookReply)
    expect(submit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: closingChoice }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId,
      optionId: `${code}-b`,
      label: openingChoice,
    }))
  })

  it('restores Atuan first-act progress after the page is recreated', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const atuanNpc = { ...npc, id: 'npc-atuan', slug: 'atuan', name: '阿团', species: '水豚' }
    const atuanStory = { ...story, id: 'episode-atuan-1', code: 's1-p1-atuan', objectCode: 'observation-cards' }
    const atuanQuestion = { ...question, id: 's1-p1-atuan-response-v2', options: [
      { id: 'atuan-a', label: '旧系统选项一' },
      { id: 'atuan-b', label: '旧系统选项二' },
    ] }
    const first = render(<FlashStoryUnit encounterId='enc-atuan' npc={atuanNpc as any} story={atuanStory as any} question={atuanQuestion as any} motion={story.motion as any} storyPosition={5} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '先按纸张和笔迹，排出这些卡出现的顺序。' }))
    fireEvent.click(screen.getByRole('button', { name: '有人捡到以后，把它悄悄放回来了。' }))
    first.unmount()

    render(<FlashStoryUnit encounterId='enc-atuan' npc={atuanNpc as any} story={atuanStory as any} question={atuanQuestion as any} motion={story.motion as any} storyPosition={5} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.getByRole('button', { name: '看看卡片背面留下了什么' })).toBeInTheDocument()
    expect(screen.getByText(/第七张纸更新/)).toBeInTheDocument()
  })

  it('submits a non-first reviewed option and restores that exact payload after process death', async () => {
    const firstSubmit = vi.fn().mockResolvedValue(undefined)
    const first = render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={firstSubmit} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: question.options[1].label }))
    expect(firstSubmit).toHaveBeenCalledWith(expect.objectContaining({ optionId: question.options[1].id, questionId: question.id }))
    first.unmount()

    const retrySubmit = vi.fn().mockResolvedValue(undefined)
    render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={retrySubmit} onContinue={vi.fn()} />)
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

  it('submits a story choice directly without inserting a minigame or divergent timeline', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<FlashStoryUnit encounterId='enc-1' npc={npc as any} story={story as any} question={question as any} motion={story.motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: question.options[0].label }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ optionId: question.options[0].id, questionId: question.id }))
    expect(screen.queryByTestId('flash-story-microgame')).not.toBeInTheDocument()
    expect(screen.queryByText('另一条时间线')).not.toBeInTheDocument()
  })
})
