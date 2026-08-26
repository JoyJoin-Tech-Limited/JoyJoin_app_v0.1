import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlashStoryV2Interaction } from '@shared/schema/flash'
import { FlashStoryInteractionStage } from './FlashStoryInteractionStage'

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  haptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../../lib/analytics/flashStoryAnalytics', () => ({
  flashStoryAnalytics: { track: mocks.track },
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: mocks.haptics }))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ motionMode: 'full', shouldReduceMotion: false, source: 'default' }),
}))

vi.mock('../FlashUi', () => ({
  FlashButton: ({ children, onClick, disabled, ariaLabel }: any) => (
    <button type='button' onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
  ),
  FlashNpcPortrait: () => <div data-testid='flash-npc-portrait' />,
}))

const npc = { id: 'n1', slug: 'alang', name: '阿浪', animal: '灰狼', themeKey: 'alang' }

function makeInteraction(overrides: Partial<FlashStoryV2Interaction> = {}): FlashStoryV2Interaction {
  return {
    template: 'spacing',
    goal: '移动两把椅子，留出图上刚好的并肩距离。',
    hints: ['不用挤在一起。', '给它们留一点能呼吸的距离。'],
    results: [
      { id: 'aligned', next: 'n3_a' },
      { id: 'crowded', next: 'n3_b' },
    ],
    defaultResultId: 'aligned',
    fallbackNext: 'n4',
    ...overrides,
  }
}

function renderStage(interaction: FlashStoryV2Interaction, extra: { busy?: boolean; error?: string; onSubmit?: (resultId: string) => void } = {}) {
  const onSubmit = extra.onSubmit ?? vi.fn()
  const utils = render(
    <FlashStoryInteractionStage
      npc={npc}
      unitId='s1-p1-alang'
      nodeId='n2_action'
      interaction={interaction}
      segments={[{ text: '阿浪把一张折得很薄的图摊在膝盖上。' }]}
      seasonTitle='没有名字的旧物'
      phase={1}
      busy={extra.busy ?? false}
      error={extra.error}
      onSubmit={onSubmit}
    />,
  )
  return { ...utils, onSubmit }
}

describe('FlashStoryInteractionStage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the visible goal and fires action_shown once per node', () => {
    renderStage(makeInteraction())
    expect(document.querySelector('[data-testid="flash-interaction-stage"]')).toBeTruthy()
    expect(document.querySelector('[data-testid="flash-interaction-goal"]')?.textContent).toContain('移动两把椅子')
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'action_shown', { template: 'spacing' })
    expect(mocks.track).toHaveBeenCalledTimes(1)
  })

  it('spacing: tapping a zone enables confirm and submits the mapped default result at the last position', () => {
    const { onSubmit } = renderStage(makeInteraction())
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'object_interaction_start', { template: 'spacing' })

    const confirm = document.querySelector('[aria-label="就这样收好"]') as HTMLButtonElement
    expect(confirm).toBeTruthy()
    fireEvent.click(confirm)

    expect(onSubmit).toHaveBeenCalledWith('aligned')
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'result_chosen', { template: 'spacing', resultId: 'aligned' })
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'object_complete', { template: 'spacing' })
  })

  it('spacing: a no-op gesture shows the first hint as guidance and fires first_mistake only once', () => {
    renderStage(makeInteraction())
    const zone0 = document.querySelector('[data-testid="flash-interaction-zone-0"]')!
    fireEvent.click(zone0)
    expect(document.querySelector('[data-testid="flash-interaction-guidance"]')?.textContent).toBe('不用挤在一起。')
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'first_mistake', { template: 'spacing' })

    fireEvent.click(zone0)
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'first_mistake')).toHaveLength(1)
  })

  it('path: out-of-order taps guide instead of failing; in-order taps advance and submit', () => {
    const { onSubmit } = renderStage(makeInteraction({ template: 'path' }))
    expect(document.querySelector('[data-testid="flash-interaction-gesture-path"]')).toBeTruthy()

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-waypoint-1"]')!)
    expect(document.querySelector('[data-testid="flash-interaction-guidance"]')?.textContent).toBe('不用挤在一起。')

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-waypoint-0"]')!)
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-waypoint-1"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('aligned')
  })

  it('overlay: tapping an alignment mark moves the top layer and confirms', () => {
    const { onSubmit } = renderStage(makeInteraction({ template: 'overlay' }))
    expect(document.querySelector('[data-testid="flash-interaction-gesture-overlay"]')).toBeTruthy()

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-mark-0"]')!)
    expect(document.querySelector('[data-testid="flash-interaction-guidance"]')?.textContent).toBe('不用挤在一起。')

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-mark-1"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('aligned')
  })

  it('privacy: tapping regions toggles masks; tapping the bare board shows guidance', () => {
    const { onSubmit } = renderStage(makeInteraction({
      template: 'privacy',
      results: [{ id: 'masked', next: 'n3_a' }],
      defaultResultId: 'masked',
    }))
    expect(document.querySelector('[data-testid="flash-interaction-gesture-privacy"]')).toBeTruthy()

    fireEvent.click(document.querySelector('.flash-interaction__privacy-board')!)
    expect(document.querySelector('[data-testid="flash-interaction-guidance"]')).toBeTruthy()
    expect(document.querySelector('[aria-label="就这样收好"]')).toBeNull()

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-region-0"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('masked')
  })

  it('pairing (post-pilot template) renders data-driven and completes via pair slots', () => {
    const { onSubmit } = renderStage(makeInteraction({
      template: 'pairing',
      results: [{ id: 'paired', next: 'n3_a' }],
      defaultResultId: 'paired',
    }))
    expect(document.querySelector('[data-testid="flash-interaction-gesture-pairing"]')).toBeTruthy()

    // 未拿起纸片就点右侧位置 → 引导而非失败。
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-pair-right-0"]')!)
    expect(document.querySelector('[data-testid="flash-interaction-guidance"]')).toBeTruthy()

    fireEvent.click(document.querySelector('[data-testid="flash-interaction-pair-left-0"]')!)
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-pair-right-0"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('paired')
  })

  it('reveals up to two hints, firing hint_shown per reveal', () => {
    renderStage(makeInteraction())
    const toggle = document.querySelector('[aria-label="给我一点提示"]')!
    fireEvent.click(toggle)
    expect(document.querySelectorAll('[data-testid="flash-interaction-hint"]')).toHaveLength(1)
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'hint_shown', { template: 'spacing' })

    fireEvent.click(document.querySelector('[aria-label="给我一点提示"]')!)
    expect(document.querySelectorAll('[data-testid="flash-interaction-hint"]')).toHaveLength(2)
    expect(document.querySelector('[aria-label="给我一点提示"]')).toBeNull()
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'hint_shown')).toHaveLength(2)
  })

  it('treats completion as the result for single-result configs', () => {
    const { onSubmit } = renderStage(makeInteraction({
      results: [{ id: 'aligned', next: 'n3_a' }],
    }))
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-0"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('aligned')
  })

  it('disables gestures and confirm while busy', () => {
    const { onSubmit } = renderStage(makeInteraction(), { busy: true })
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    expect(document.querySelector('[aria-label="就这样收好"]')).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders the submit error surface with role=alert', () => {
    renderStage(makeInteraction(), { error: '刚才没有收好，再点一次下方按钮就能继续。' })
    const alert = document.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('刚才没有收好')
  })

  it('resets local gesture progress via 重新整理 without uploading anything', () => {
    renderStage(makeInteraction())
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    fireEvent.click(document.querySelector('[aria-label="重新整理"]')!)
    expect(document.querySelector('[aria-label="就这样收好"]')).toBeNull()
  })

  it('fires exit_before_complete on unmount only when a gesture started but was never submitted', () => {
    const started = renderStage(makeInteraction())
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    started.unmount()
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'exit_before_complete', { template: 'spacing' })

    mocks.track.mockClear()
    const submitted = renderStage(makeInteraction())
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    submitted.unmount()
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'exit_before_complete')).toHaveLength(0)

    const untouched = renderStage(makeInteraction())
    untouched.unmount()
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'exit_before_complete')).toHaveLength(0)
  })

  it('skips analytics silently for unknown unit ids', () => {
    const onSubmit = vi.fn()
    render(
      <FlashStoryInteractionStage
        npc={npc}
        unitId='s9-p9-ghost'
        nodeId='n2_action'
        interaction={makeInteraction()}
        segments={[]}
        seasonTitle='没有名字的旧物'
        phase={1}
        busy={false}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.click(document.querySelector('[data-testid="flash-interaction-zone-1"]')!)
    fireEvent.click(document.querySelector('[aria-label="就这样收好"]')!)
    expect(onSubmit).toHaveBeenCalledWith('aligned')
    expect(mocks.track).not.toHaveBeenCalled()
  })
})
