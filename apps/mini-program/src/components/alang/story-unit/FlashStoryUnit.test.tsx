import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFlashFirstActExperienceContract } from '@shared/alang/flashFirstActExperience'
import { FlashStoryUnit } from './FlashStoryUnit'

const storage = new Map<string, unknown>()
let didShowCallback: (() => void) | null = null
vi.mock('@tarojs/taro', () => ({ useDidShow: (callback: () => void) => { didShowCallback = callback }, default: {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
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
vi.mock('./AlangFirstActExperience', () => ({ AlangFirstActExperience: ({ scene, onComplete }: any) => <div data-testid='alang-first-act-mock' data-scene={scene}><button onClick={() => onComplete(1)}>完成阿浪第一幕</button></div> }))
vi.mock('./LiziFirstActExperience', () => ({ LiziFirstActExperience: ({ scene, onComplete }: any) => <div data-testid='lizi-first-act-mock' data-scene={scene}><button onClick={() => onComplete(1)}>完成栗子第一幕</button></div> }))
vi.mock('./MomoFirstActExperience', () => ({ MomoFirstActExperience: ({ scene, onComplete }: any) => <div data-testid='momo-first-act-mock' data-scene={scene}><button onClick={() => onComplete(1)}>完成默默第一幕</button></div> }))
vi.mock('./ShiqiFirstActExperience', () => ({ ShiqiFirstActExperience: ({ scene, onComplete }: any) => <div data-testid='shiqi-first-act-mock' data-scene={scene}><button onClick={() => onComplete(1)}>完成拾柒第一幕</button></div> }))

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
  fireEvent.click(screen.getByRole('button', { name: '它们原来有顺序？' }))
  fireEvent.click(screen.getByRole('button', { name: '查看新折痕' }))
  fireEvent.click(screen.getByRole('button', { name: '查看褪色的紫绳' }))
  fireEvent.click(screen.getByRole('button', { name: '查看被擦掉的名字' }))
  expect(screen.getByTestId('atuan-scene-dialogue')).toHaveTextContent('先别替它找主人')
  fireEvent.click(screen.getByRole('button', { name: '如果他不来，我们也别让这趟白跑。' }))
  storage.set('joyjoin_flash_story_unit_v2_s1-p1-atuan_enc-atuan_episode-atuan-1:atuan-cards', [
    { cardId: 'city', destinationId: 'keep' },
    { cardId: 'habit', destinationId: 'return' },
    { cardId: 'private_time', destinationId: 'cover' },
  ])
  fireEvent.click(screen.getByRole('button', { name: '和阿团一起整理卡片' }))
  act(() => { didShowCallback?.() })
  fireEvent.click(screen.getByRole('button', { name: '把整理好的卡片交给阿团' }))
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
    expect(screen.getByTestId('atuan-scene-narration')).toHaveTextContent('你先按住纸袋')
    expect(screen.getByTestId('atuan-scene-dialogue')).toHaveTextContent('一张一张和风讲道理')
    expect(screen.getByTestId('atuan-scene-dialogue')).not.toHaveTextContent('你先按住纸袋')
    expect(screen.getByTestId('atuan-scene-dialogue').closest('[data-testid="flash-story-choice-panel"]')).toBeNull()
    expect(submit).not.toHaveBeenCalled()
    completeConversation()

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: firstQuestion.id,
      optionId: 'atuan-b',
      storyPath: expect.objectContaining({ version: 'atuan-first-act-v4', approachId: 'notice_again' }),
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
      storyPath: expect.objectContaining({ version: 'atuan-first-act-v4', approachId: 'notice_again' }),
    }))
  })

  it('restores the selected Atuan action after the page is recreated', () => {
    const first = renderFirst()
    reachConversation('接住卡片')
    first.view.unmount()

    renderFirst()
    expect(screen.getByTestId('atuan-conversation-background')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-scene-narration')).toHaveTextContent('你伸手按住飞到半空的卡片')
    expect(screen.getByRole('button', { name: '这张有什么不一样？' })).toBeInTheDocument()
    expect(screen.queryByText('接住卡片')).not.toBeInTheDocument()
  })

  it('opens Atuan second act on its new background and dedicated interaction path', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const story = { ...firstStory, id: 'episode-atuan-2', code: 's1-p2-atuan', phase: 2, title: '阿团认领座位图', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p2-atuan-response-v2' }
    render(<FlashStoryUnit encounterId='enc-p2' npc={baseNpc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={6} submitState='idle' submitError='' atuanArrivalAssets={{ scene: 'park.webp', secondScene: 'pavilion.webp', thirdScene: 'table.webp', character: 'atuan.webp', bag: 'bag.webp' }} onSubmit={submit} onContinue={vi.fn()} />)
    expect(screen.getByTestId('atuan-later-background')).toHaveAttribute('src', 'pavilion.webp')
    expect(screen.getByTestId('atuan-later-prelude')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '先看看他改过的地方' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '先看看他改过的地方' }))
    expect(screen.getByTestId('atuan-later-experience')).toHaveAttribute('data-unit-id', 's1-p2-atuan')
    expect(screen.getByText('你接着说')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '这些折痕，是你一次次改出来的吗？' }))
    expect(screen.getByRole('button', { name: '查看反复折过的座位图' })).toBeInTheDocument()
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.queryByTestId('atuan-arrival-prelude')).not.toBeInTheDocument()
  })

  it('retries a completed later Atuan act through the same completion button after failure or recreation', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const story = { ...firstStory, id: 'episode-atuan-2-retry', code: 's1-p2-atuan', phase: 2, title: '阿团认领座位图', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p2-atuan-response-v2' }
    const baseProps = {
      encounterId: 'enc-p2-retry', npc: baseNpc as any, story: story as any, question: question as any,
      motion: motion as any, storyPosition: 6, submitError: '', atuanArrivalAssets: { scene: 'park.webp', secondScene: 'pavilion.webp', thirdScene: 'table.webp', character: 'atuan.webp', bag: 'bag.webp' },
      onSubmit: submit, onContinue: vi.fn(),
    }
    const view = render(<FlashStoryUnit {...baseProps} submitState='idle' />)

    fireEvent.click(screen.getByRole('button', { name: '先看看他改过的地方' }))
    fireEvent.click(screen.getByRole('button', { name: '这些折痕，是你一次次改出来的吗？' }))
    for (const name of ['查看反复折过的座位图', '查看椅脚旁的浅痕', '查看没有名字的席位卡']) fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name: '把你的邀请说清，把舒服的距离留给他选。' }))
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起摆好座位图' }))
    fireEvent.click(screen.getByRole('button', { name: '把座位图转正' }))
    fireEvent.click(screen.getByRole('button', { name: '留出能自在说话的距离' }))
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))
    expect(submit).toHaveBeenCalledTimes(1)

    view.rerender(<FlashStoryUnit {...baseProps} submitState='retry' submitError='网络开了小差，这段故事还没有丢。' />)
    expect(screen.getByRole('alert')).toHaveTextContent('这段故事还没有丢')
    expect(screen.queryByRole('button', { name: '重新送出' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))
    expect(submit).toHaveBeenCalledTimes(2)
    expect(submit.mock.calls[1]?.[0]).toEqual(submit.mock.calls[0]?.[0])

    view.unmount()
    render(<FlashStoryUnit {...baseProps} submitState='idle' />)
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))
    expect(submit).toHaveBeenCalledTimes(3)
    expect(submit.mock.calls[2]?.[0]).toEqual(expect.objectContaining({
      questionId: submit.mock.calls[0]?.[0].questionId,
      optionId: submit.mock.calls[0]?.[0].optionId,
      storyPath: submit.mock.calls[0]?.[0].storyPath,
    }))
  })

  it('reuses the original completion action for a locally restored solved first act', () => {
    const story = { ...firstStory, id: 'episode-alang-restored', code: 's1-p1-alang', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p1-alang-response-v2' }
    storage.set('joyjoin_flash_story_unit_v2_s1-p1-alang_enc-alang-restored_episode-alang-restored', {
      unitId: 's1-p1-alang',
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice: { questionId: question.id, optionId: question.options[0].id, label: question.options[0].label },
      companionEvent: 'SUCCESS',
      divergenceCopy: null,
      atuanFirstAct: null,
      atuanLaterAct: null,
      analyticsSent: [],
    })

    const submit = vi.fn().mockResolvedValue(undefined)
    render(<FlashStoryUnit encounterId='enc-alang-restored' npc={{ ...baseNpc, slug: 'alang' } as any} story={story as any} question={question as any} motion={motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.queryByRole('button', { name: '重新送出' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '完成阿浪第一幕' }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: question.id,
      optionId: question.options[0].id,
    }))
  })

  it('runs Atuan third act from its opening choice through the returned-card table game', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const story = { ...firstStory, id: 'episode-atuan-3', code: 's1-p3-atuan', phase: 3, title: '座位图写上了名字', objectCode: 'seat-plan' }
    const question = { ...firstQuestion, id: 's1-p3-atuan-response-v2' }
    render(<FlashStoryUnit encounterId='enc-p3' npc={baseNpc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={15} submitState='idle' submitError='' atuanArrivalAssets={{ scene: 'park.webp', secondScene: 'pavilion.webp', thirdScene: 'table.webp', character: 'atuan.webp', bag: 'bag.webp' }} onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.getByTestId('atuan-later-background')).toHaveAttribute('src', 'table.webp')
    fireEvent.click(screen.getByRole('button', { name: '先看看箱底那把钥匙' }))
    fireEvent.click(screen.getByRole('button', { name: '第六张卡，原来一直在这里？' }))
    for (const name of ['查看木箱旁的钥匙', '查看回来的第六张卡', '查看座位图上空着的另一边']) fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name: '告诉他不用现在回答，这个位置不会催他。' }))
    fireEvent.click(screen.getByRole('button', { name: '和阿团一起打开这份迟到的邀请' }))
    fireEvent.click(screen.getByRole('button', { name: '用钥匙打开夹层' }))
    fireEvent.click(screen.getByRole('button', { name: '把第六张卡摆到座位图中央' }))
    fireEvent.click(screen.getByRole('button', { name: '放上阿团的名牌' }))
    fireEvent.click(screen.getByRole('button', { name: '替默默写上名字' }))
    expect(screen.getByRole('alert')).toHaveTextContent('不能替默默写下答案')
    fireEvent.click(screen.getByRole('button', { name: '把另一边留空' }))
    fireEvent.click(screen.getByRole('button', { name: '收好阿团的这段故事' }))

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: question.id,
      optionId: 'atuan-a',
      storyPath: expect.objectContaining({
        unitId: 's1-p3-atuan',
        arrivalReplyId: 'ask_sixth_card',
        actionId: 'open_returned_card',
        endingId: 'answer_left_open',
        game: expect.objectContaining({ invitationPlaced: true, otherSeat: 'blank', attempts: 1 }),
      }),
    }))
  })

  it('keeps the park scene and removes the identity tag after the first story settles', () => {
    const story = { ...firstStory, response: '阿团把卡片收好了。' }
    render(<FlashStoryUnit encounterId='enc-settled' npc={baseNpc as any} story={story as any} question={firstQuestion as any} motion={motion as any} storyPosition={5} submitState='idle' submitError='' atuanArrivalAssets={{ scene: 'park.webp', character: 'atuan.webp', bag: 'bag.webp' }} onSubmit={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByTestId('atuan-conversation-background')).toHaveAttribute('src', 'park.webp')
    expect(screen.getByTestId('atuan-conversation-character')).toHaveAttribute('src', 'atuan.webp')
    expect(screen.queryByTestId('npc-speech')).not.toBeInTheDocument()
    expect(screen.queryByText('水豚')).not.toBeInTheDocument()
    expect(screen.getByTestId('atuan-scene-dialogue')).toHaveTextContent('阿团把卡片收好了')
  })

  it('keeps the settled-story exit outside the native result scroller', () => {
    const onContinue = vi.fn()
    const story = {
      ...firstStory,
      id: 'episode-momo-3-settled',
      code: 's1-p3-momo',
      phase: 3,
      title: '默默把邀请说完整',
      objectCode: 'dry-markers',
      response: '迟到的邀请终于成为一句完整的话。',
      closing: '他直接向栗子发出邀请，给出时间和两个可选方向。',
      fragment: {
        category: 'relationship',
        title: '一句完整的邀请',
        fact: '默默说清了时间和方向，答案仍留给栗子。',
      },
      progress: { completedInPhase: 3, totalInPhase: 5, completedTotal: 7, total: 15 },
    }
    const npc = { ...baseNpc, id: 'npc-momo', slug: 'momo', name: '默默', species: '兔狲' }
    const { container } = render(<FlashStoryUnit encounterId='enc-momo-p3-settled' npc={npc as any} story={story as any} question={firstQuestion as any} motion={motion as any} storyPosition={7} submitState='idle' submitError='' onSubmit={vi.fn()} onContinue={onContinue} />)

    const resultPanel = container.querySelector('.flash-dialogue__story-panel--result')
    const resultScroller = resultPanel?.querySelector<HTMLElement>('.flash-dialogue__story-panel-scroll') ?? null
    const resultFooter = resultPanel?.querySelector<HTMLElement>('.flash-dialogue__story-panel-footer') ?? null
    const continueButton = screen.getByRole('button', { name: '收好碎片，继续寻找' })

    expect(resultPanel).not.toBeNull()
    expect(resultFooter).not.toBeNull()
    expect(resultScroller).not.toContainElement(resultFooter)
    expect(resultFooter).toContainElement(continueButton)
    fireEvent.click(continueButton)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['alang', '阿浪', '灰狼', 'seat-plan', '完成阿浪第一幕', 'alang-first-act-mock'],
    ['lizi', '栗子', '水獭', 'dry-markers', '完成栗子第一幕', 'lizi-first-act-mock'],
    ['momo', '默默', '兔狲', 'route-book', '完成默默第一幕', 'momo-first-act-mock'],
    ['shiqi', '拾柒', '乌鸦', 'outing-book', '完成拾柒第一幕', 'shiqi-first-act-mock'],
  ])('runs %s first act and maps its final stance to the real server option', (slug, name, species, objectCode, completionLabel, testId) => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const npc = { ...baseNpc, id: `npc-${slug}`, slug, name, species }
    const story = { ...firstStory, id: `episode-${slug}-1`, code: `s1-p1-${slug}`, title: `${name}第一幕`, objectCode }
    const contract = getFlashFirstActExperienceContract(story.code)!
    const question = {
      id: `${story.code}-first-act-response-v1`,
      text: contract.prompt,
      options: contract.approaches.map(({ id, label }) => ({ id, label })),
    }
    render(<FlashStoryUnit encounterId={`enc-${slug}`} npc={npc as any} story={story as any} question={question as any} motion={motion as any} storyPosition={1} submitState='idle' submitError='' onSubmit={submit} onContinue={vi.fn()} />)

    expect(screen.getByTestId(testId)).toHaveAttribute('data-scene', expect.stringContaining(`flash-${slug}-first-act`))
    expect(screen.queryByTestId('flash-story-choice-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: completionLabel }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      questionId: question.id,
      optionId: contract.approaches[1].id,
      label: contract.approaches[1].label,
    }))
  })
})
