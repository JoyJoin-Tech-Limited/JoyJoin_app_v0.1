import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageSync, setStorageSync } from '@tarojs/taro'
import {
  ALANG_FIRST_ACT_HIGHLIGHTS,
  ALANG_SPACING_TARGET,
  AlangFirstActExperience,
  alangFirstActStorageKey,
  type AlangApproachIndex,
} from './AlangFirstActExperience'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

const ENCOUNTER_ID = 'enc-alang-first-act'

function renderExperience(overrides: Partial<ComponentProps<typeof AlangFirstActExperience>> = {}) {
  const onSpeechChange = vi.fn()
  const onComplete = vi.fn()
  const view = render(
    <AlangFirstActExperience
      encounterId={ENCOUNTER_ID}
      scene='alang-riverside.webp'
      onSpeechChange={onSpeechChange}
      onComplete={onComplete}
      {...overrides}
    />,
  )
  return { view, onSpeechChange, onComplete }
}

function finishHighlights(replyIndex: AlangApproachIndex = 0) {
  ALANG_FIRST_ACT_HIGHLIGHTS.forEach((highlight, index) => {
    fireEvent.click(screen.getByRole('button', { name: `观察${highlight.label}` }))
    expect(screen.getByTestId('alang-scene-speech')).toHaveTextContent(highlight.speech)
    expect(screen.getByRole('button', { name: highlight.replies[0].label })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: highlight.replies[1].label })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: highlight.replies[replyIndex].label }))
    expect(screen.getByTestId('alang-scene-speech')).toHaveTextContent(highlight.replies[replyIndex].response)
    fireEvent.click(screen.getByRole('button', {
      name: index === ALANG_FIRST_ACT_HIGHLIGHTS.length - 1 ? '看完四处线索' : '继续观察',
    }))
  })
}

function reachSpacingGame(approachIndex: AlangApproachIndex) {
  finishHighlights()
  fireEvent.click(screen.getByRole('button', { name: approachIndex === 0
    ? '先并肩看河。话慢一点再说。'
    : '留一点角度。既同向，也看得见彼此。' }))
  fireEvent.click(screen.getByRole('button', { name: '调一调两把椅子' }))
}

function solveSpacingGame() {
  fireEvent.click(screen.getByRole('button', { name: '把椅子留开一点' }))
  fireEvent.click(screen.getByRole('button', { name: '把椅子留开一点' }))
  fireEvent.click(screen.getByRole('button', { name: '让椅子朝向同一侧' }))
  expect(screen.getByTestId('alang-chair-board')).toHaveAttribute('data-seat-distance', String(ALANG_SPACING_TARGET.distance))
  expect(screen.getByTestId('alang-chair-board')).toHaveAttribute('data-seat-angle', String(ALANG_SPACING_TARGET.angle))
  fireEvent.click(screen.getByRole('button', { name: '确认座位距离与夹角' }))
}

describe('AlangFirstActExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStorageSync).mockReturnValue(null)
  })

  it('presents four Alang-specific highlights and all eight distinct player replies', () => {
    const { onSpeechChange } = renderExperience()

    expect(screen.getByTestId('alang-first-act-scene')).toHaveAttribute('src', 'alang-riverside.webp')
    expect(ALANG_FIRST_ACT_HIGHLIGHTS).toHaveLength(4)
    expect(ALANG_FIRST_ACT_HIGHLIGHTS.flatMap((highlight) => highlight.replies)).toHaveLength(8)
    expect(new Set(ALANG_FIRST_ACT_HIGHLIGHTS.flatMap((highlight) => highlight.replies.map((reply) => reply.label))).size).toBe(8)

    for (const highlight of ALANG_FIRST_ACT_HIGHLIGHTS) {
      expect(highlight.replies[0].response).not.toBe(highlight.replies[1].response)
    }

    finishHighlights()

    expect(screen.getByText(/原来这里没有失踪的人/)).toBeInTheDocument()
    expect(screen.getByText(/总被说成争论的道歉/)).toBeInTheDocument()
    expect(onSpeechChange).toHaveBeenCalledWith(expect.stringContaining('同一阵风'))
  })

  it('shows the first-error cue, supports retry, succeeds, and completes with approachIndex 0', () => {
    const { onComplete } = renderExperience()
    reachSpacingGame(0)

    expect(screen.getByTestId('alang-spacing-game')).toHaveAttribute('data-testid', 'alang-spacing-game')
    expect(screen.getByTestId('alang-first-act-experience')).toHaveAttribute('data-object-code', 'seat-plan')
    expect(screen.getByTestId('alang-first-act-experience')).toHaveAttribute('data-game-type', 'spacing')

    fireEvent.click(screen.getByRole('button', { name: '确认座位距离与夹角' }))
    expect(screen.getByRole('alert')).toHaveTextContent('第一次没调对')
    expect(screen.getByRole('alert')).toHaveTextContent('必须立刻说清的对质')
    expect(screen.getByRole('button', { name: '再调一次' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '再调一次' }))
    solveSpacingGame()

    expect(screen.getByText('并肩，但不挤')).toBeInTheDocument()
    expect(screen.getByTestId('alang-scene-speech')).toHaveTextContent('不必先赢')
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '记下这段并肩留白' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(0)
  })

  it('restores the spacing progress and completes with approachIndex 1', async () => {
    const first = renderExperience()
    reachSpacingGame(1)
    fireEvent.click(screen.getByRole('button', { name: '把椅子留开一点' }))

    const storageKey = alangFirstActStorageKey(ENCOUNTER_ID)
    await waitFor(() => {
      expect(setStorageSync).toHaveBeenCalledWith(storageKey, expect.objectContaining({
        stage: 'game',
        approachIndex: 1,
        distance: 1,
      }))
    })
    const matchingStorageCalls = vi.mocked(setStorageSync).mock.calls.filter(([key]) => key === storageKey)
    const savedProgress = matchingStorageCalls[matchingStorageCalls.length - 1]?.[1]
    expect(savedProgress).toBeTruthy()
    first.view.unmount()

    vi.mocked(getStorageSync).mockReturnValue(savedProgress)
    const restored = renderExperience()
    expect(screen.getByTestId('alang-first-act-experience')).toHaveAttribute('data-stage', 'game')
    expect(screen.getByTestId('alang-chair-board')).toHaveAttribute('data-seat-distance', '1')

    fireEvent.click(screen.getByRole('button', { name: '把椅子留开一点' }))
    fireEvent.click(screen.getByRole('button', { name: '让椅子朝向同一侧' }))
    fireEvent.click(screen.getByRole('button', { name: '确认座位距离与夹角' }))
    fireEvent.click(screen.getByRole('button', { name: '记下这段并肩留白' }))

    expect(restored.onComplete).toHaveBeenCalledTimes(1)
    expect(restored.onComplete).toHaveBeenCalledWith(1)
  })

  it('keeps the accepted first-act scene versioned, valid, and package-sized', () => {
    const assetPath = resolve(process.cwd(), 'src/pages/alang/assets/ui/flash-alang-first-act-riverside-v2.webp')
    const bytes = statSync(assetPath).size
    const header = readFileSync(assetPath).subarray(0, 12)

    expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(header.subarray(8, 12).toString('ascii')).toBe('WEBP')
    expect(bytes).toBeGreaterThan(12)
    expect(bytes).toBeLessThanOrEqual(80 * 1024)
  })

  it('asserts the exclusive distance-and-city story language', () => {
    const allCopy = JSON.stringify(ALANG_FIRST_ACT_HIGHLIGHTS)
    for (const keyword of ['救生圈绳结', '路线地图台', '窗边双椅', '转角', '余量', '并肩']) {
      expect(allCopy).toContain(keyword)
    }
    expect(allCopy).not.toContain('第六张卡')
    expect(allCopy).not.toContain('公园长椅')
    expect(ALANG_SPACING_TARGET).toEqual(expect.objectContaining({ objectCode: 'seat-plan', gameType: 'spacing' }))
  })
})
