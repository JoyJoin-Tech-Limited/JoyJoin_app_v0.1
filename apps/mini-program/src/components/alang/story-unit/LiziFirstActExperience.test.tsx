import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LIZI_FIRST_ACT_HIGHLIGHTS,
  LiziFirstActExperience,
  liziFirstActStorageKey,
  type LiziFirstActApproachIndex,
} from './LiziFirstActExperience'

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
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

const REPLY_LABELS: Record<(typeof LIZI_FIRST_ACT_HIGHLIGHTS)[number]['id'], readonly [string, string]> = {
  lizi: ['名字没了，纸上的试写痕迹还在。', '都干了，你还留着它们？'],
  palette: ['不叫名字，也能看出每道痕迹不一样。', '先看边缘，干掉以后差别更明显。'],
  swatches: ['“静”不一定最淡，可能只是落笔更稳。', '风把每块色片的节奏吹出来了。'],
  cart: ['这次不猜颜色，认笔帽上的切口。', '先把笔帽排开，再和试写痕迹一一对照。'],
}

function renderExperience({
  encounterId = 'enc-lizi',
  disabled = false,
  onSpeechChange = vi.fn<(speech: string) => void>(),
  onComplete = vi.fn<(approachIndex: LiziFirstActApproachIndex) => void>(),
}: {
  encounterId?: string
  disabled?: boolean
  onSpeechChange?: (speech: string) => void
  onComplete?: (approachIndex: LiziFirstActApproachIndex) => void
} = {}) {
  const view = render(
    <LiziFirstActExperience
      encounterId={encounterId}
      scene='lizi-first-act.webp'
      disabled={disabled}
      onSpeechChange={onSpeechChange}
      onComplete={onComplete}
    />,
  )
  return { view, onSpeechChange, onComplete }
}

function replyToHighlight(label: string, replyLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: `观察${label}` }))
  fireEvent.click(screen.getByRole('button', { name: replyLabel }))
  const closeLabel = screen.queryByRole('button', { name: '把四处线索放在一起' })
    ? '把四处线索放在一起'
    : '记下这一笔，继续看'
  fireEvent.click(screen.getByRole('button', { name: closeLabel }))
}

function completeHighlights() {
  replyToHighlight('栗子', REPLY_LABELS.lizi[0])
  replyToHighlight('左侧色板', REPLY_LABELS.palette[0])
  replyToHighlight('悬挂色片', REPLY_LABELS.swatches[0])
  replyToHighlight('右侧工具车', REPLY_LABELS.cart[0])
}

function inspectAllMarks() {
  fireEvent.click(screen.getByRole('button', { name: '查看第一道试写痕迹：软弧边' }))
  expect(screen.getByText(/它记住的是“暖”/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '查看第二道试写痕迹：双细线' }))
  expect(screen.getByText(/它记住的是“静”/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '查看第三道试写痕迹：短断点' }))
  expect(screen.getByText(/它记住的是“醒”/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '按“暖、静、醒”配回笔帽' }))
}

function enterPairing(approachIndex: LiziFirstActApproachIndex) {
  completeHighlights()
  fireEvent.click(screen.getByRole('button', {
    name: approachIndex === 0 ? '先相信纸上留下的痕迹。' : '先把三种手感排成顺序。',
  }))
  fireEvent.click(screen.getByRole('button', { name: '看看三条试写痕迹' }))
  inspectAllMarks()
}

function pair(capName: string, markerName: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`选择${capName}`) }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${markerName}干笔`) }))
}

function makeCorrectPairings() {
  pair('圆弧缺口帽', '软弧边')
  pair('双细纹帽', '双细线')
  pair('三短刻帽', '短断点')
}

afterEach(cleanup)
beforeEach(() => storage.clear())

describe('LiziFirstActExperience', () => {
  it('shows the NPC plus three scene highlights and all eight Lizi-specific replies', () => {
    const first = renderExperience()
    expect(screen.getByTestId('lizi-first-act-scene')).toHaveAttribute('src', 'lizi-first-act.webp')
    expect(screen.getByText('第一幕 · 颜色没有走丢')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^观察/ })).toHaveLength(4)
    expect(LIZI_FIRST_ACT_HIGHLIGHTS).toHaveLength(4)
    first.view.unmount()

    for (const highlight of LIZI_FIRST_ACT_HIGHLIGHTS) {
      const current = renderExperience({ encounterId: `enc-options-${highlight.id}` })
      fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
      expect(screen.getByRole('button', { name: REPLY_LABELS[highlight.id][0] })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: REPLY_LABELS[highlight.id][1] })).toBeInTheDocument()
      current.view.unmount()
    }
  })

  it('keeps NPC speech beside the scene and bottom narration free of NPC dialogue', () => {
    const onSpeechChange = vi.fn()
    renderExperience({ onSpeechChange })
    fireEvent.click(screen.getByRole('button', { name: '观察栗子' }))

    expect(screen.getByTestId('lizi-speech')).toHaveTextContent('一卷干掉的彩笔')
    expect(screen.getByText('栗子把布卷压在肘边，三支没盖笔帽的彩笔排得很开。')).not.toHaveTextContent('来得正好')
    expect(onSpeechChange).toHaveBeenLastCalledWith(expect.stringContaining('一卷干掉的彩笔'))
  })

  it('requires three texture clues, exposes three caps and three marker bodies', () => {
    renderExperience()
    enterPairing(0)

    expect(screen.getAllByRole('button', { name: /^选择.+帽/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /干笔，还没配笔帽$/ })).toHaveLength(3)
    expect(screen.getByText('暖 · 软弧边')).toBeInTheDocument()
    expect(screen.getByText('静 · 双细线')).toBeInTheDocument()
    expect(screen.getByText('醒 · 短断点')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /选择圆弧缺口帽/ }))
    expect(screen.getByRole('button', { name: /选择圆弧缺口帽/ })).toHaveClass('lizi-first-act__cap--selected')
    fireEvent.click(screen.getByRole('button', { name: /软弧边干笔/ }))
    expect(screen.getByRole('button', { name: /软弧边干笔，已配圆弧缺口帽/ })).toBeInTheDocument()
  })

  it('shows an error, clears the wrong attempt, retries, succeeds, and completes with approach 0', () => {
    const onComplete = vi.fn()
    renderExperience({ onComplete })
    enterPairing(0)

    pair('圆弧缺口帽', '双细线')
    pair('双细纹帽', '软弧边')
    pair('三短刻帽', '短断点')
    fireEvent.click(screen.getByRole('button', { name: '检查三顶笔帽' }))

    expect(screen.getByRole('alert')).toHaveTextContent('没有完全接上三条试写痕迹')
    expect(screen.getByTestId('lizi-first-act')).toHaveAttribute('data-phase', 'error')
    fireEvent.click(screen.getByRole('button', { name: '重新配一次' }))
    expect(screen.getAllByRole('button', { name: /干笔，还没配笔帽$/ })).toHaveLength(3)

    makeCorrectPairings()
    fireEvent.click(screen.getByRole('button', { name: '检查三顶笔帽' }))
    expect(screen.getByText('三顶笔帽都回去了')).toBeInTheDocument()
    expect(screen.getByText('颜色没有走丢')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把三支笔放回布卷' }))
    expect(onComplete).toHaveBeenCalledWith(0)
  })

  it('resumes an in-progress pairing and completes with approach 1', () => {
    const onComplete = vi.fn()
    const first = renderExperience({ encounterId: 'enc-resume', onComplete })
    enterPairing(1)
    pair('圆弧缺口帽', '软弧边')
    pair('双细纹帽', '双细线')
    first.view.unmount()

    renderExperience({ encounterId: 'enc-resume', onComplete })
    expect(screen.getByTestId('lizi-first-act')).toHaveAttribute('data-phase', 'pair')
    expect(screen.getByRole('button', { name: /软弧边干笔，已配圆弧缺口帽/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /双细线干笔，已配双细纹帽/ })).toBeInTheDocument()
    pair('三短刻帽', '短断点')
    fireEvent.click(screen.getByRole('button', { name: '检查三顶笔帽' }))
    fireEvent.click(screen.getByRole('button', { name: '把三支笔放回布卷' }))

    expect(onComplete).toHaveBeenCalledWith(1)
    expect(storage.get(liziFirstActStorageKey('enc-resume'))).toEqual(expect.objectContaining({ phase: 'complete', approachIndex: 1 }))
  })

  it('recovers from a broken scene image without losing any hotspot', () => {
    renderExperience()
    fireEvent.error(screen.getByTestId('lizi-first-act-scene'))
    expect(screen.getByTestId('lizi-first-act-scene-fallback')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^观察/ })).toHaveLength(4)
  })

  it('blocks hotspot interaction when disabled and keeps copy unique to Lizi', () => {
    renderExperience({ disabled: true })
    fireEvent.click(screen.getByRole('button', { name: '观察栗子' }))
    expect(screen.queryByRole('button', { name: REPLY_LABELS.lizi[0] })).not.toBeInTheDocument()

    const allCopy = JSON.stringify(LIZI_FIRST_ACT_HIGHLIGHTS)
    expect(allCopy).toContain('试写痕迹')
    expect(allCopy).toContain('暖、静、醒')
    expect(allCopy).not.toMatch(/阿团|长椅|路灯|纸袋|观察卡|路线|座位|等待|档案/)
  })
})
