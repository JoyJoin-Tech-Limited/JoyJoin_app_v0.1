import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Slider: ({ onChange, onChanging, value, ...props }: any) => (
    <input
      type='range'
      data-testid='slider'
      value={value}
      onInput={(e) => onChanging?.({ detail: { value: Number((e.target as HTMLInputElement).value) } })}
      onChange={(e) => onChange?.({ detail: { value: Number((e.target as HTMLInputElement).value) } })}
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
