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

  async function renderSliderModule() {
    const { default: PersonalityTestAnswerArea } = await import('./PersonalityTestAnswerArea')
    return render(
      <PersonalityTestAnswerArea
        questionType='slider'
        options={sliderOptions}
        sliderConfig={{ leftLabel: '内向', rightLabel: '外向' }}
        sliderValue={50}
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
