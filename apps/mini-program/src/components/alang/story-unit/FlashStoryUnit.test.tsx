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
  it('turns Atuan phase one into a responsive conversation with no keep-or-cover quiz', () => {
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
        { id: 'atuan-c', label: '旧系统选项三' },
      ],
    }

    render(<FlashStoryUnit encounterId='enc-atuan' npc={atuanNpc as any} story={atuanStory as any} question={atuanQuestion as any} motion={story.motion as any} storyPosition={5} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.getByTestId('npc-speech')).toHaveTextContent('……还是少了一张')
    expect(screen.queryByText('哪些能留下，哪些要遮住？')).not.toBeInTheDocument()
    expect(screen.getByTestId('flash-story-choice-panel')).not.toHaveTextContent('五张没有送出去的观察卡')
    fireEvent.click(screen.getByRole('button', { name: '需要我帮你回忆一下吗？' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('你居然没有先问我写了什么')
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('如果是你捡到了，会怎么做')
    expect(screen.getByTestId('flash-story-choice-panel')).not.toHaveTextContent('如果是你捡到了，会怎么做')
    expect(screen.queryByText('需要我帮你回忆一下吗？')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '我会先确认，那个人会不会因此受伤。' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('你会先看谁可能受伤')
    expect(screen.queryByText('我会先确认，那个人会不会因此受伤。')).not.toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '所以，第六张卡写了谁？' }))
    expect(screen.getByTestId('npc-speech')).toHaveTextContent('这个问题，今天先不回答')
    fireEvent.click(screen.getByRole('button', { name: '好，下次见。' }))

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 's1-p1-atuan-response-v2',
      optionId: 'atuan-b',
      label: '需要我帮你回忆一下吗？',
    }))
  })

  it.each([
    {
      phase: 2,
      code: 's1-p2-atuan',
      objectCode: 'seat-plan',
      title: '阿团认领座位图',
      questionId: 's1-p2-atuan-response-v2',
      openingChoice: '你其实早就知道要留给谁了，对吗？',
      openingReply: '知道该照顾谁，和承认自己为什么这么在意，是两回事',
      followUpChoice: '如果他还是想坐远一点呢？',
      followUpReply: '距离应该由坐在那里的人决定',
      hookChoice: '所以你怕的不是位置不对，是他知道你想靠近？',
      hookReply: '承认自己想靠近他，难一点',
      closingChoice: '那这次，别再把图收回去了。',
    },
    {
      phase: 3,
      code: 's1-p3-atuan',
      objectCode: 'seat-plan',
      title: '座位图写上了名字',
      questionId: 's1-p3-atuan-response-v2',
      openingChoice: '如果他的答案不是你想要的呢？',
      openingReply: '不想让这张图变成一道必须答对的题',
      followUpChoice: '也告诉他，不接受不会失去你这个朋友。',
      followUpReply: '靠近不该拿关系做交换',
      hookChoice: '那你现在准备好把图交给他了吗？',
      hookReply: '不替他回答，也不催他回答',
      closingChoice: '去吧，我在这里等你的后续。',
    },
  ])('gives Atuan phase $phase the same complete conversational rhythm as phase one', ({
    phase,
    code,
    objectCode,
    title,
    questionId,
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
