import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Slider: ({ onChange, onChanging, value, ...props }: any) => (
    // Faithful WeChat semantics: onChanging fires per drag frame (native
    // 'input'), onChange only on release (native 'change'). React would
    // co-fire a JSX onChange prop on every 'input' event, so the commit
    // path is wired via a raw listener instead.
    <input
      type='range'
      data-testid='slider'
      value={value}
      onInput={(e) => onChanging?.({ detail: { value: Number((e.target as HTMLInputElement).value) } })}
      ref={(el: HTMLInputElement | null) => {
        if (el && !(el as any).__jjCommitWired) {
          ;(el as any).__jjCommitWired = true
          el.addEventListener('change', () => onChange?.({ detail: { value: Number(el.value) } }))
        }
      }}
      {...props}
    />
  ),
  Image: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getSystemInfoSync: () => ({ reduceMotion: false }),
  },
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: ({ emoji, className }: { emoji: string; className?: string }) => (
    <span className={className} data-emoji={emoji}>{emoji}</span>
  ),
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

import { haptics } from '../../../lib/utils/haptics'

vi.mock('../../../hooks/useDeviceTier', () => ({ useDeviceTier: () => ({ isDegradation: false }) }))

const sliderOptions = [
  { value: '-50', text: '非常内向' },
  { value: '0', text: '中立' },
  { value: '50', text: '非常外向' },
]

describe('PersonalityTestAnswerArea slider hint', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function renderSliderModule(sliderValue = 50) {
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    return render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={sliderValue}
        isSubmitting={false}
        onAnswer={vi.fn()}
        onSliderChange={vi.fn()}
        onSliderSubmit={vi.fn()}
      />,
    )
  }

  it('shows the first-time hint initially and dismisses it on drag (onChanging)', async () => {
    const { getByText, queryByText } = await renderSliderModule()
    expect(getByText('拖动滑块，选择最符合你的程度')).toBeTruthy()

    const slider = document.querySelector('[data-testid="slider"]') as HTMLInputElement
    fireEvent.input(slider, { target: { value: 60 } })

    await waitFor(() => {
      expect(queryByText('拖动滑块，选择最符合你的程度')).toBeNull()
    })
  })

  it('dismisses the hint on a tap that only fires onChange (no onChanging)', async () => {
    const { getByText, queryByText } = await renderSliderModule()
    expect(getByText('拖动滑块，选择最符合你的程度')).toBeTruthy()

    const slider = document.querySelector('[data-testid="slider"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: 70 } })

    await waitFor(() => {
      expect(queryByText('拖动滑块，选择最符合你的程度')).toBeNull()
    })
  })
})

describe('PersonalityTestAnswerArea slider endpoint icons (WS-3)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function renderSliderModule(sliderValue = 50) {
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    return render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '想一个人待着', rightLabel: '快叫上朋友！' }}
        sliderValue={sliderValue}
        isSubmitting={false}
        onAnswer={vi.fn()}
        onSliderChange={vi.fn()}
        onSliderSubmit={vi.fn()}
      />,
    )
  }

  it('renders both endpoint icons via the semantic CDN keys', async () => {
    const { container } = await renderSliderModule()
    const icons = Array.from(container.querySelectorAll('.answer-area__slider-anchor-icon')) as HTMLImageElement[]
    expect(icons).toHaveLength(2)
    expect(icons[0].src).toContain('lovart-icon-personality-solo-rest-20260507-v1.png')
    expect(icons[1].src).toContain('lovart-icon-personality-party-ready-20260507-v1.png')
  })

  it('leans left at the 35 boundary (left leaning + scaled, right dimmed)', async () => {
    const { container } = await renderSliderModule(35)
    const left = container.querySelector('.answer-area__slider-anchor--left')!
    const right = container.querySelector('.answer-area__slider-anchor--right')!
    expect(left.className).toContain('answer-area__slider-anchor--leaning')
    expect(left.className).not.toContain('answer-area__slider-anchor--dimmed')
    expect(right.className).toContain('answer-area__slider-anchor--dimmed')
    expect(left.querySelector('.answer-area__slider-anchor-icon')!.className)
      .toContain('answer-area__slider-anchor-icon--leaning-scale')
    expect(right.querySelector('.answer-area__slider-anchor-icon')!.className)
      .not.toContain('answer-area__slider-anchor-icon--leaning-scale')
  })

  it('leans right at the 65 boundary (right leaning + scaled, left dimmed)', async () => {
    const { container } = await renderSliderModule(65)
    const left = container.querySelector('.answer-area__slider-anchor--left')!
    const right = container.querySelector('.answer-area__slider-anchor--right')!
    expect(right.className).toContain('answer-area__slider-anchor--leaning')
    expect(left.className).toContain('answer-area__slider-anchor--dimmed')
    expect(right.querySelector('.answer-area__slider-anchor-icon')!.className)
      .toContain('answer-area__slider-anchor-icon--leaning-scale')
  })

  it('stays neutral at center (no leaning, no dimmed)', async () => {
    const { container } = await renderSliderModule(50)
    const anchors = container.querySelectorAll('.answer-area__slider-anchor')
    anchors.forEach((anchor) => {
      expect(anchor.className).not.toContain('answer-area__slider-anchor--leaning')
      expect(anchor.className).not.toContain('answer-area__slider-anchor--dimmed')
    })
  })

  it('hides a failed icon but reserves its layout shell', async () => {
    const { container } = await renderSliderModule()
    const icon = container.querySelector('.answer-area__slider-anchor-icon') as HTMLImageElement
    fireEvent.error(icon)

    await waitFor(() => {
      expect(container.querySelectorAll('.answer-area__slider-anchor-icon')).toHaveLength(1)
    })
    // Both shells keep their reserved 48rpx slots — no layout shift.
    expect(container.querySelectorAll('.answer-area__slider-anchor-icon-shell')).toHaveLength(2)
  })
})

describe('PersonalityTestAnswerArea slider custom track (2026-09 polish)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(haptics).mockClear()
  })

  async function renderSliderModule(sliderValue = 50, sliderTouched = false) {
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    return render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={sliderValue}
        sliderTouched={sliderTouched}
        isSubmitting={false}
        onAnswer={vi.fn()}
        onSliderChange={vi.fn()}
        onSliderSubmit={vi.fn()}
      />,
    )
  }

  it('renders the custom rail/fill/thumb layers under the native gesture slider', async () => {
    const { container } = await renderSliderModule()
    expect(container.querySelector('.answer-area__slider-rail')).toBeTruthy()
    expect(container.querySelector('.answer-area__slider-fill')).toBeTruthy()
    expect(container.querySelector('.answer-area__slider-thumb')).toBeTruthy()
    expect(container.querySelector('.answer-area__slider-thumb-ring')).toBeTruthy()
    expect(container.querySelector('.answer-area__slider-thumb-core')).toBeTruthy()
    expect(container.querySelector('.answer-area__slider-thumb-dot')).toBeTruthy()
    expect(container.querySelector('[data-testid="slider"]')).toBeTruthy()
  })

  it('renders neutral (grey) thumb ring + fill until the first touch, temperature after', async () => {
    const { container, rerender } = await renderSliderModule(50, false)
    const ring = container.querySelector('.answer-area__slider-thumb-ring') as HTMLElement
    const fill = container.querySelector('.answer-area__slider-fill') as HTMLElement
    const dot = container.querySelector('.answer-area__slider-thumb-dot') as HTMLElement
    expect(ring.style.background).toContain('rgb(216, 221, 230)') // #D8DDE6
    expect(fill.style.background).toContain('rgb(216, 221, 230)')
    expect(dot.style.backgroundColor).toContain('rgb(183, 190, 201)') // #B7BEC9

    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    rerender(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={50}
        sliderTouched={true}
        isSubmitting={false}
        onAnswer={vi.fn()}
        onSliderChange={vi.fn()}
        onSliderSubmit={vi.fn()}
      />,
    )
    // Touched at 50 → dot takes the centre temperature stop (#A78BFA).
    expect(dot.style.backgroundColor).toContain('rgb(167, 139, 250)')
    expect(fill.style.width).toBe('171.5px') // 22 + (343−44)×0.5 fallback geometry
  })

  it('toggles --dragging classes on badge + thumb during drag and removes them on commit', async () => {
    const { container } = await renderSliderModule(50, true)
    const slider = container.querySelector('[data-testid="slider"]') as HTMLInputElement

    expect(container.querySelector('.answer-area__slider-thumb--dragging')).toBeNull()
    expect(container.querySelector('.answer-area__slider-live-badge-inner--dragging')).toBeNull()

    fireEvent.input(slider, { target: { value: 60 } })
    await waitFor(() => {
      expect(container.querySelector('.answer-area__slider-thumb--dragging')).toBeTruthy()
      expect(container.querySelector('.answer-area__slider-live-badge-inner--dragging')).toBeTruthy()
    })

    fireEvent.change(slider, { target: { value: 60 } })
    await waitFor(() => {
      expect(container.querySelector('.answer-area__slider-thumb--dragging')).toBeNull()
      expect(container.querySelector('.answer-area__slider-live-badge-inner--dragging')).toBeNull()
    })
  })

  it('fires medium haptic on semantic option-boundary crossing, light otherwise', async () => {
    const { container } = await renderSliderModule(50, true)
    const slider = container.querySelector('[data-testid="slider"]') as HTMLInputElement

    // First event seeds the option ref (50 → '非常外向'); no medium yet.
    fireEvent.input(slider, { target: { value: 55 } })
    // 55 stays in the same option ('50') → no medium.
    fireEvent.input(slider, { target: { value: 60 } })
    expect(vi.mocked(haptics).mock.calls.some(([tier]) => tier === 'medium')).toBe(false)

    // 20 maps to '中立' (|0-20|=20 < |50-20|=30) → boundary crossed → medium.
    fireEvent.input(slider, { target: { value: 20 } })
    expect(vi.mocked(haptics).mock.calls.some(([tier]) => tier === 'medium')).toBe(true)
  })

  it('forwards a track-tap commit even when the value did not change (interaction gate)', async () => {
    const onSliderChange = vi.fn()
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    const { container } = render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={50}
        isSubmitting={false}
        onAnswer={vi.fn()}
        onSliderChange={onSliderChange}
        onSliderSubmit={vi.fn()}
      />,
    )
    const slider = container.querySelector('[data-testid="slider"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: 50 } })
    expect(onSliderChange).toHaveBeenCalledWith(50)
  })

  it('gates the inline submit button on sliderTouched', async () => {
    const { getByText } = await renderSliderModule(50, false)
    const submit = getByText('确认这个感觉').closest('button') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('dims the custom layers while submitting', async () => {
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    const { container } = render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={50}
        sliderTouched={true}
        isSubmitting={true}
        onAnswer={vi.fn()}
        onSliderChange={vi.fn()}
        onSliderSubmit={vi.fn()}
      />,
    )
    expect(container.querySelector('.answer-area__slider-stage--disabled')).toBeTruthy()
  })
})
