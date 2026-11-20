import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProfileArchiveSheet from '../ProfileArchiveSheet'
import type { ProfileArchiveSheetProps } from '../ProfileArchiveSheet'

vi.mock('@tarojs/components', () => ({
  View: ({
    children,
    catchMove: _catchMove,
    hoverClass: _hoverClass,
    ...props
  }: Record<string, unknown> & { children?: unknown }) => <div {...props}>{children as never}</div>,
  Text: ({ children, ...props }: Record<string, unknown> & { children?: unknown }) => (
    <span {...props}>{children as never}</span>
  ),
  ScrollView: ({
    children,
    scrollY: _scrollY,
    enhanced: _enhanced,
    showScrollbar: _showScrollbar,
    ...props
  }: Record<string, unknown> & { children?: unknown }) => <div {...props}>{children as never}</div>,
}))

const PRIVACY_LINE = '仅自己可见 · 不会出现在分享海报里'

function makeProps(overrides: Partial<ProfileArchiveSheetProps> = {}): ProfileArchiveSheetProps {
  return {
    visible: true,
    onClose: vi.fn(),
    fields: [
      { label: '职业', value: '产品经理' },
      { label: '城市', value: '深圳' },
    ],
    intents: [{ value: 'meet_people', label: '认识新朋友' }],
    interestLabels: ['爵士乐', '手冲咖啡'],
    interestLevels: { 爵士乐: 3, 手冲咖啡: 2 },
    interestCategories: ['文艺现场'],
    heatConclusion: '你的热量集中在文艺现场和周末的慢时光。',
    storyLine: '工作之外，你还在找回自己的节奏。',
    interestState: 'ready',
    ...overrides,
  }
}

describe('ProfileArchiveSheet — closed / open shell', () => {
  it('is non-interactive and hidden from the a11y tree when closed', () => {
    const props = makeProps({ visible: false })
    const { container } = render(<ProfileArchiveSheet {...props} />)

    const root = container.querySelector('.profile-archive-sheet') as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.className).not.toContain('profile-archive-sheet--visible')

    const scrim = container.querySelector('.profile-archive-sheet__scrim') as HTMLElement
    expect(scrim).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(scrim)
    expect(props.onClose).not.toHaveBeenCalled()

    // aria-hidden on the root removes the dialog and its controls from the
    // accessibility tree — nothing is reachable, matching pointer-events:none.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: '收起完整小档案' })).toBeNull()
  })

  it('renders the card-back header on open', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: '完整小档案' })).toBeInTheDocument()
    expect(screen.getByText('入场卡背面')).toBeInTheDocument()
    expect(screen.getByText('完整小档案')).toBeInTheDocument()
    // One merged visibility line: the standalone 仅自己可见 row is gone, and the
    // old 27-char use-disclosure sentence is not coming back.
    expect(screen.getByText(PRIVACY_LINE)).toBeInTheDocument()
    expect(screen.queryByText('仅自己可见')).toBeNull()
    expect(
      screen.queryByText('这些资料用于你的入场卡和活动安排，不会出现在分享海报里'),
    ).toBeNull()
    expect(container.querySelectorAll('.profile-archive-sheet__privacy')).toHaveLength(1)
    expect(container.querySelectorAll('.profile-archive-sheet__privacy-dot')).toHaveLength(1)
    expect(screen.getByText('你的小档案')).toBeInTheDocument()
    expect(screen.getByText('来这里想要什么')).toBeInTheDocument()
    expect(screen.getByText('兴趣热量地图')).toBeInTheDocument()
  })

  it('renders no footer CTA — only 收起 and the scrim leave the sheet', () => {
    render(<ProfileArchiveSheet {...makeProps()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('收起完整小档案')
  })
})

describe('ProfileArchiveSheet — fields and intents', () => {
  it('renders every field as label-above-value with no extra annotation', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps()} />)

    expect(screen.getByText('职业')).toBeInTheDocument()
    expect(screen.getByText('产品经理')).toBeInTheDocument()
    expect(screen.getByText('城市')).toBeInTheDocument()
    expect(screen.getByText('深圳')).toBeInTheDocument()

    const fields = container.querySelectorAll('.profile-archive-sheet__field')
    expect(fields).toHaveLength(2)
    fields.forEach((field) => {
      // Exactly two children: the label and the value. No per-field notes,
      // badges, icons, or trend annotations.
      expect(field.children).toHaveLength(2)
      expect(field.children[0].className).toBe('profile-archive-sheet__field-label')
      expect(field.children[1].className).toBe('profile-archive-sheet__field-value')
    })
  })

  it('shows one quiet placeholder when 小档案 is empty', () => {
    render(<ProfileArchiveSheet {...makeProps({ fields: [] })} />)

    expect(screen.getByText('资料待补充')).toBeInTheDocument()
  })

  it('renders intent pills and hides the section entirely when empty', () => {
    const { container, rerender } = render(<ProfileArchiveSheet {...makeProps()} />)
    expect(screen.getByText('认识新朋友')).toBeInTheDocument()
    expect(container.querySelectorAll('.profile-archive-sheet__intent')).toHaveLength(1)
    // One accent rule per rendered section; no 01/02/03 numerals anywhere.
    expect(container.querySelectorAll('.profile-archive-sheet__section-rule')).toHaveLength(3)
    expect(screen.queryByText('01')).toBeNull()
    expect(screen.queryByText('02')).toBeNull()
    expect(screen.queryByText('03')).toBeNull()

    rerender(<ProfileArchiveSheet {...makeProps({ intents: [] })} />)
    expect(screen.queryByText('来这里想要什么')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.profile-archive-sheet__intent')).toHaveLength(0)
    // Dropping 想找 drops its rule too — the archive never shows a marker whose
    // section is gone.
    expect(container.querySelectorAll('.profile-archive-sheet__section-rule')).toHaveLength(2)
  })

  it('spans an odd trailing field across both columns', () => {
    const fiveFields = [
      { label: '家乡', value: '深圳' },
      { label: '关系状态', value: '单身' },
      { label: '学历', value: '本科' },
      { label: '职业', value: '产品经理' },
      { label: '行业', value: '互联网' },
    ]
    const { container, rerender } = render(
      <ProfileArchiveSheet {...makeProps({ fields: fiveFields })} />,
    )

    const fields = container.querySelectorAll('.profile-archive-sheet__field')
    expect(fields).toHaveLength(5)
    expect(container.querySelectorAll('.profile-archive-sheet__field--wide')).toHaveLength(1)
    expect(fields[4].className).toContain('profile-archive-sheet__field--wide')
    // The wide tail keeps the same label-above-value structure.
    expect(fields[4].children).toHaveLength(2)
    expect(fields[0].className).not.toContain('profile-archive-sheet__field--wide')

    // An even count has no orphan to fix.
    rerender(
      <ProfileArchiveSheet {...makeProps({ fields: fiveFields.slice(0, 4) })} />,
    )
    expect(container.querySelectorAll('.profile-archive-sheet__field--wide')).toHaveLength(0)
  })
})

describe('ProfileArchiveSheet — interest heat map', () => {
  it('renders conclusion, interest cloud, category cloud and story line when ready', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps()} />)

    expect(
      screen.getByText('你的热量集中在文艺现场和周末的慢时光。'),
    ).toBeInTheDocument()
    expect(screen.getByText('爵士乐')).toBeInTheDocument()
    expect(screen.getByText('手冲咖啡')).toBeInTheDocument()
    expect(screen.getByText('文艺现场')).toBeInTheDocument()
    expect(screen.getByText('工作之外，你还在找回自己的节奏。')).toBeInTheDocument()

    // Levels + accent are passed through to the shared cloud.
    expect(container.querySelectorAll('.interest-chip-cloud__chip--accent')).toHaveLength(2)
    expect(container.querySelectorAll('.interest-chip-cloud__chip--level-3')).toHaveLength(1)
    expect(container.querySelectorAll('.interest-chip-cloud__chip--level-2')).toHaveLength(1)
    // One cloud with levels (interest labels), one plain cloud (categories).
    expect(container.querySelectorAll('.interest-chip-cloud__chip')).toHaveLength(3)
    expect(container.querySelectorAll('.profile-archive-sheet__story')).toHaveLength(1)
  })

  it('falls back to the empty line when ready has nothing to show', () => {
    render(
      <ProfileArchiveSheet
        {...makeProps({
          interestLabels: [],
          interestCategories: [],
          heatConclusion: '',
          storyLine: '',
        })}
      />,
    )

    expect(screen.getByText('还没有兴趣标签，之后可以在「我的」补充')).toBeInTheDocument()
  })

  it('renders a calm skeleton while loading', () => {
    const { container } = render(
      <ProfileArchiveSheet {...makeProps({ interestState: 'loading' })} />,
    )

    expect(screen.getByRole('status', { name: '兴趣数据加载中' })).toBeInTheDocument()
    expect(container.querySelectorAll('.profile-archive-sheet__skeleton-line')).toHaveLength(2)
    expect(container.querySelectorAll('.profile-archive-sheet__skeleton-chip')).toHaveLength(3)
    expect(screen.queryByText('你的热量集中在文艺现场和周末的慢时光。')).not.toBeInTheDocument()
  })

  it('renders the error line and calls onRetryInterests', () => {
    const onRetryInterests = vi.fn()
    render(
      <ProfileArchiveSheet {...makeProps({ interestState: 'error', onRetryInterests })} />,
    )

    expect(screen.getByText('兴趣数据暂时不可用')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载兴趣数据' }))
    expect(onRetryInterests).toHaveBeenCalledTimes(1)
  })

  it('omits the retry affordance when no retry handler is wired', () => {
    render(<ProfileArchiveSheet {...makeProps({ interestState: 'error' })} />)

    expect(screen.queryByRole('button', { name: '重新加载兴趣数据' })).toBeNull()
  })

  it('renders the empty copy in the empty state', () => {
    render(<ProfileArchiveSheet {...makeProps({ interestState: 'empty' })} />)

    expect(screen.getByText('还没有兴趣标签，之后可以在「我的」补充')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新加载兴趣数据' })).toBeNull()
  })
})

describe('ProfileArchiveSheet — dismissal', () => {
  it('closes from the 收起 button and the scrim, but not from the panel', () => {
    const props = makeProps()
    render(<ProfileArchiveSheet {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '收起完整小档案' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('dialog'))
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(document.querySelector('.profile-archive-sheet__scrim') as HTMLElement)
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})

describe('ProfileArchiveSheet — accent inheritance', () => {
  it('paints the accent surface as a background-image over the opaque base', () => {
    // Regression lock (render-caught): the entry-card accent surface is a
    // ~96%-opaque gradient. Using the `background` shorthand would clear the
    // panel's opaque base and let the dark scrim bleed through the lower half.
    const { container } = render(
      <ProfileArchiveSheet
        {...makeProps({
          accentSurface:
            'linear-gradient(145deg, rgba(255, 155, 133, 0.24) 0%, rgba(255, 255, 255, 0.96) 82%)',
          accentBorder: '#FF9B85',
          accentText: '#8B5CF6',
        })}
      />,
    )

    const panel = container.querySelector('.profile-archive-sheet__panel') as HTMLElement
    expect(panel.getAttribute('style')).toContain('background-image: linear-gradient')
    expect(panel.style.backgroundColor).toBe('') // opaque base stays on the CSS rule
    expect(panel.style.borderTopColor).toBeTruthy()

    const eyebrow = container.querySelector('.profile-archive-sheet__eyebrow') as HTMLElement
    expect(eyebrow.style.color).toBeTruthy()

    // Section rules inherit the same accent ink — the markers are part of the
    // themed card, not generic chrome.
    const rules = container.querySelectorAll('.profile-archive-sheet__section-rule')
    expect(rules).toHaveLength(3)
    rules.forEach((rule) => {
      expect((rule as HTMLElement).style.backgroundColor).toBeTruthy()
    })
  })

  it('keeps the neutral paper fallback when no accent is supplied', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps()} />)
    const panel = container.querySelector('.profile-archive-sheet__panel') as HTMLElement

    expect(panel.getAttribute('style')).toBeNull()
    // No accent ink → rules fall back to the CSS $color-primary rule, so no
    // inline colour is emitted at all.
    const rules = container.querySelectorAll('.profile-archive-sheet__section-rule')
    expect(rules).toHaveLength(3)
    rules.forEach((rule) => {
      expect((rule as HTMLElement).getAttribute('style')).toBeNull()
    })
  })
})

describe('ProfileArchiveSheet — motion and copy hygiene', () => {
  it('applies the reduced-motion class when requested', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps({ reduceMotion: true })} />)

    const root = container.querySelector('.profile-archive-sheet') as HTMLElement
    expect(root.className).toContain('profile-archive-sheet--reduce-motion')
    expect(root.className).toContain('profile-archive-sheet--visible')
  })

  it('ships no emoji in the card-back copy', () => {
    const { container } = render(<ProfileArchiveSheet {...makeProps()} />)
    const text = container.textContent ?? ''

    expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u)
  })
})
