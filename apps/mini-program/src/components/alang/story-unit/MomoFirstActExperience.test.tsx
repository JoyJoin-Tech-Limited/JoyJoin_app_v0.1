import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MOMO_FIRST_ACT_HIGHLIGHTS,
  MomoFirstActExperience,
} from './MomoFirstActExperience'

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
  encounterId = 'enc-momo-1',
  onComplete = vi.fn(),
  onSpeechChange = vi.fn(),
}: {
  encounterId?: string
  onComplete?: (approachIndex: 0 | 1) => void
  onSpeechChange?: (speech: string) => void
} = {}) {
  const view = render(
    <MomoFirstActExperience
      encounterId={encounterId}
      scene='momo-scene.png'
      disabled={false}
      onSpeechChange={onSpeechChange}
      onComplete={onComplete}
    />,
  )
  return { ...view, onComplete, onSpeechChange }
}

function answerHighlight(highlightIndex: number, replyIndex = 0) {
  const highlight = MOMO_FIRST_ACT_HIGHLIGHTS[highlightIndex]
  fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
  expect(screen.getAllByTestId('momo-highlight-reply')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: highlight.replies[replyIndex].label }))
  expect(screen.getByTestId('momo-scene-speech')).toHaveTextContent(highlight.replies[replyIndex].response)
  fireEvent.click(screen.getByRole('button', { name: highlightIndex === MOMO_FIRST_ACT_HIGHLIGHTS.length - 1 ? '看完四处线索' : '继续观察' }))
}

function enterHighlights(approachIndex: 0 | 1 = 0) {
  fireEvent.click(screen.getByRole('button', { name: '替默默扶住晃动的路线册' }))
  fireEvent.click(screen.getByRole('button', { name: approachIndex === 0
    ? '停下也算路线的一部分'
    : '先核对最后三处，再决定停下' }))
  fireEvent.click(screen.getByRole('button', { name: '先核对四处线索' }))
}

function reachGame(approachIndex: 0 | 1) {
  enterHighlights(approachIndex)
  MOMO_FIRST_ACT_HIGHLIGHTS.forEach((_, index) => answerHighlight(index, index % 2))
  fireEvent.click(screen.getByRole('button', { name: '开始走这段雨路' }))
}

function walkThreeClues() {
  fireEvent.click(screen.getByRole('button', { name: '节点一：檐水变疏' }))
  fireEvent.click(screen.getByRole('button', { name: '节点二：竖牌向内折' }))
  fireEvent.click(screen.getByRole('button', { name: '节点三：实线在页边收住' }))
}

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('MomoFirstActExperience', () => {
  it('keeps the opening playable when the scene image fails', () => {
    renderExperience()
    fireEvent.error(screen.getByTestId('momo-first-act-scene'))
    expect(screen.queryByTestId('momo-first-act-scene')).not.toBeInTheDocument()
    expect(screen.getByTestId('momo-first-act-scene-fallback')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '替默默扶住晃动的路线册' })).toBeInTheDocument()
  })

  it('migrates the legacy empty observe state back to the new arrival beat', () => {
    storage.set('joyjoin:flash:momo-first-act:v1:enc-momo-legacy', {
      stage: 'observe',
      completedHighlightIds: [],
      activeHighlightId: null,
      approachIndex: null,
    })

    renderExperience({ encounterId: 'enc-momo-legacy' })

    expect(screen.queryAllByTestId('momo-first-act-hotspot')).toHaveLength(0)
    expect(screen.getByRole('button', { name: '替默默扶住晃动的路线册' })).toBeInTheDocument()
  })

  it('exposes four highlights and exactly eight Momo-specific replies', () => {
    const { onSpeechChange } = renderExperience()

    expect(screen.getByTestId('momo-first-act-scene')).toHaveAttribute('src', 'momo-scene.png')
    expect(screen.queryByTestId('momo-first-act-hotspot')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '替默默扶住晃动的路线册' })).toBeInTheDocument()
    enterHighlights(0)
    expect(screen.getAllByTestId('momo-first-act-hotspot')).toHaveLength(4)
    expect(screen.queryByTestId('momo-first-act-dialogue-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察默默本人' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察听音窗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察竖向路线牌' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '观察路线书台' })).toBeInTheDocument()

    const replies = MOMO_FIRST_ACT_HIGHLIGHTS.flatMap((highlight) => highlight.replies)
    expect(replies).toHaveLength(8)
    expect(new Set(replies.map((reply) => reply.label)).size).toBe(8)
    const exclusiveCopy = JSON.stringify(MOMO_FIRST_ACT_HIGHLIGHTS)
    expect(exclusiveCopy).toContain('空白页前停住')
    expect(exclusiveCopy).toContain('檐水')
    expect(exclusiveCopy).toContain('折点')
    expect(exclusiveCopy).not.toMatch(/颜色|椅子距离|档案叠页|阿团|等待/)

    answerHighlight(0, 1)
    expect(onSpeechChange).toHaveBeenCalledWith(MOMO_FIRST_ACT_HIGHLIGHTS[0].replies[1].response)
  })

  it('reports an early stop, supports retry, and completes with approach 0', () => {
    const onComplete = vi.fn<(approachIndex: 0 | 1) => void>()
    renderExperience({ onComplete })
    reachGame(0)

    fireEvent.click(screen.getByRole('button', { name: '停在这里' }))
    expect(screen.getByRole('status')).toHaveTextContent('停早了')
    fireEvent.click(screen.getByRole('button', { name: '重新走这段雨路' }))
    expect(screen.getByTestId('momo-route-progress')).toHaveTextContent('0 / 3')

    walkThreeClues()
    fireEvent.click(screen.getByRole('button', { name: '停在这里' }))
    expect(screen.getByTestId('momo-first-act-dialogue-panel')).toHaveTextContent('空白页前停住了')
    fireEvent.click(screen.getByRole('button', { name: '完成《雨停在空白以前》' }))
    expect(onComplete).toHaveBeenCalledWith(0)
  })

  it('reports walking past the blank page, retries, and completes with approach 1', () => {
    const onComplete = vi.fn<(approachIndex: 0 | 1) => void>()
    renderExperience({ onComplete })
    reachGame(1)

    walkThreeClues()
    fireEvent.click(screen.getByRole('button', { name: '空白页' }))
    expect(screen.getByRole('status')).toHaveTextContent('走过头了')
    fireEvent.click(screen.getByRole('button', { name: '重新走这段雨路' }))
    walkThreeClues()
    fireEvent.click(screen.getByRole('button', { name: '停在这里' }))
    fireEvent.click(screen.getByRole('button', { name: '完成《雨停在空白以前》' }))
    expect(onComplete).toHaveBeenCalledWith(1)
  })

  it('restores answered highlights, chosen approach, and route progress per encounter', () => {
    const first = renderExperience({ encounterId: 'enc-momo-resume' })
    reachGame(1)
    fireEvent.click(screen.getByRole('button', { name: '节点一：檐水变疏' }))
    fireEvent.click(screen.getByRole('button', { name: '节点二：竖牌向内折' }))
    expect(screen.getByTestId('momo-route-progress')).toHaveTextContent('2 / 3')
    first.unmount()

    renderExperience({ encounterId: 'enc-momo-resume' })
    expect(screen.getByTestId('momo-route-game')).toBeInTheDocument()
    expect(screen.getByTestId('momo-route-progress')).toHaveTextContent('2 / 3')
    expect(screen.queryByRole('button', { name: '观察默默本人' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '节点三：实线在页边收住' }))
    fireEvent.click(screen.getByRole('button', { name: '停在这里' }))
    fireEvent.click(screen.getByRole('button', { name: '完成《雨停在空白以前》' }))
    expect(screen.getByTestId('momo-first-act-dialogue-panel')).toBeInTheDocument()
  })
})
