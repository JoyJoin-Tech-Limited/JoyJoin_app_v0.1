import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SHIQI_FIRST_ACT_HIGHLIGHTS,
  ShiqiFirstActExperience,
} from './ShiqiFirstActExperience'

const storage = new Map<string, unknown>()

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

function renderExperience({
  encounterId = 'enc-shiqi-1',
  onComplete = vi.fn<(approachIndex: 0 | 1) => void>(),
  onSpeechChange = vi.fn<(speech: string) => void>(),
}: {
  encounterId?: string
  onComplete?: (approachIndex: 0 | 1) => void
  onSpeechChange?: (speech: string) => void
} = {}) {
  const view = render(
    <ShiqiFirstActExperience
      encounterId={encounterId}
      scene='shiqi-scene.webp'
      disabled={false}
      onSpeechChange={onSpeechChange}
      onComplete={onComplete}
    />,
  )
  return { ...view, onComplete, onSpeechChange }
}

function answerHighlight(highlightIndex: number, replyIndex = 0) {
  const highlight = SHIQI_FIRST_ACT_HIGHLIGHTS[highlightIndex]
  fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
  expect(screen.getAllByTestId('shiqi-highlight-reply')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: highlight.replies[replyIndex].label }))
  expect(screen.getByTestId('shiqi-scene-speech')).toHaveTextContent(highlight.replies[replyIndex].response)
  fireEvent.click(screen.getByRole('button', { name: highlightIndex === SHIQI_FIRST_ACT_HIGHLIGHTS.length - 1 ? '看完四处线索' : '继续观察' }))
}

function reachGame(approachIndex: 0 | 1) {
  SHIQI_FIRST_ACT_HIGHLIGHTS.forEach((_, index) => answerHighlight(index, index % 2))
  const label = approachIndex === 0
    ? '先保留事实浅痕，再注明解释层'
    : '先标出解释偏移，再回看原始浅痕'
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: '开始对齐浅痕' }))
}

function alignAllLayers() {
  fireEvent.click(screen.getByRole('button', { name: '第一层向右' }))
  fireEvent.click(screen.getByRole('button', { name: '第一层向上' }))
  fireEvent.click(screen.getByRole('button', { name: '核对第一层' }))

  fireEvent.click(screen.getByRole('button', { name: '第二层向左' }))
  fireEvent.click(screen.getByRole('button', { name: '第二层向左' }))
  fireEvent.click(screen.getByRole('button', { name: '第二层向下' }))
  fireEvent.click(screen.getByRole('button', { name: '核对第二层' }))

  fireEvent.click(screen.getByRole('button', { name: '第三层向右' }))
  fireEvent.click(screen.getByRole('button', { name: '第三层向右' }))
  fireEvent.click(screen.getByRole('button', { name: '第三层向下' }))
  fireEvent.click(screen.getByRole('button', { name: '第三层向下' }))
  fireEvent.click(screen.getByRole('button', { name: '核对第三层' }))
}

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('ShiqiFirstActExperience', () => {
  it('exposes four scene highlights and exactly eight Shiqi-specific replies', () => {
    const { onSpeechChange } = renderExperience()

    expect(screen.getByTestId('shiqi-first-act-scene')).toHaveAttribute('src', 'shiqi-scene.webp')
    expect(screen.getAllByTestId('shiqi-first-act-hotspot')).toHaveLength(4)
    expect(screen.queryByTestId('shiqi-first-act-dialogue-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察拾柒本人' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察外出记录册' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察交换箱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察竖向检视灯箱' })).toBeInTheDocument()

    const replies = SHIQI_FIRST_ACT_HIGHLIGHTS.flatMap((highlight) => highlight.replies)
    expect(replies).toHaveLength(8)
    expect(new Set(replies.map((reply) => reply.label)).size).toBe(8)
    const exclusiveCopy = JSON.stringify(SHIQI_FIRST_ACT_HIGHLIGHTS)
    expect(exclusiveCopy).toContain('方向相同，不代表走法相同')
    expect(exclusiveCopy).toContain('压痕先后，比猜测动机可靠')
    expect(exclusiveCopy).not.toMatch(/颜色配对|椅子间距|雨路停页|观察卡|隐私/)

    answerHighlight(0, 1)
    expect(onSpeechChange).toHaveBeenCalledWith(SHIQI_FIRST_ACT_HIGHLIGHTS[0].replies[1].response)
  })

  it('gives offset feedback, a first-error hint, reset, and completes all three overlay layers with approach 0', () => {
    const onComplete = vi.fn()
    reachGameAfterRender(0, onComplete)

    expect(screen.getByTestId('shiqi-offset-feedback')).toHaveTextContent('横向 -1 · 纵向 +1')
    expect(document.querySelectorAll('.shiqi-first-act__paper')[0]).toHaveStyle({ opacity: '0.92', zIndex: '4' })
    fireEvent.click(screen.getByRole('button', { name: '核对第一层' }))
    expect(screen.getByTestId('shiqi-scene-speech')).toHaveTextContent('还差一点')
    expect(screen.getByText(/还没重合/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '第一层向右' }))
    expect(screen.getByTestId('shiqi-offset-feedback')).toHaveTextContent('横向 0 · 纵向 +1')
    fireEvent.click(screen.getByRole('button', { name: '重置三层路线纸' }))
    expect(screen.getByTestId('shiqi-offset-feedback')).toHaveTextContent('横向 -1 · 纵向 +1')

    alignAllLayers()
    expect(screen.getByTestId('shiqi-first-act-dialogue-panel')).toHaveTextContent('三层浅痕对齐了')
    fireEvent.click(screen.getByRole('button', { name: '完成《记录没有说完》' }))
    expect(onComplete).toHaveBeenCalledWith(0)
  })

  it('submits approach 1 instead of fixing completion to the first option', () => {
    const onComplete = vi.fn()
    reachGameAfterRender(1, onComplete)
    alignAllLayers()
    fireEvent.click(screen.getByRole('button', { name: '完成《记录没有说完》' }))
    expect(onComplete).toHaveBeenCalledWith(1)
  })

  it('restores hotspot answers, approach, active layer, and offsets for the encounter', () => {
    const first = renderExperience({ encounterId: 'enc-resume' })
    reachGame(1)
    fireEvent.click(screen.getByRole('button', { name: '第一层向右' }))
    fireEvent.click(screen.getByRole('button', { name: '第一层向上' }))
    fireEvent.click(screen.getByRole('button', { name: '核对第一层' }))
    fireEvent.click(screen.getByRole('button', { name: '第二层向左' }))
    expect(screen.getByTestId('shiqi-offset-feedback')).toHaveTextContent('横向 +1 · 纵向 -1')
    first.unmount()

    renderExperience({ encounterId: 'enc-resume' })
    expect(screen.getByTestId('shiqi-overlay-game')).toBeInTheDocument()
    expect(screen.getByText('第二层 · 路线复写')).toBeInTheDocument()
    expect(screen.getByTestId('shiqi-offset-feedback')).toHaveTextContent('横向 +1 · 纵向 -1')
    expect(screen.queryByRole('button', { name: '观察拾柒本人' })).not.toBeInTheDocument()
  })
})

function reachGameAfterRender(approachIndex: 0 | 1, onComplete: (approachIndex: 0 | 1) => void) {
  renderExperience({ onComplete })
  reachGame(approachIndex)
}
