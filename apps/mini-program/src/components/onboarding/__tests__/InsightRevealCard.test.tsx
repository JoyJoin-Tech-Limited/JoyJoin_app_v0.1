import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import InsightRevealCard, {
  INSIGHT_ROW_STAGGER_MS,
  type InsightLineFeedbackMeta,
  type InsightRevealCompleteMeta,
  type ProfileTaglineV2Response,
} from '../InsightRevealCard'
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '@shared/ai/onboarding'
import { haptics } from '../../../lib/utils/haptics'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

vi.mock('../../ai-content/AIGCLabel', () => ({
  default: ({ meta, enabled, className }: { meta?: { aiGenerated?: boolean }; enabled?: boolean; className?: string }) => (
    <span
      data-testid='aigc-label'
      data-ai-generated={meta?.aiGenerated ? 'true' : 'false'}
      data-enabled={enabled === undefined ? 'inherit' : String(enabled)}
      className={className}
    />
  ),
}))

vi.mock('../../ai-content/AIContentReportButton', () => ({
  default: ({ variant, className }: { variant?: string; className?: string }) => (
    <span data-testid='aigc-report-button' data-variant={variant ?? 'default'} className={className} />
  ),
}))

vi.mock('../../ui/JoyJoinIcon', () => ({
  default: () => <span data-testid='joyjoin-icon' />,
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const V2_TAGLINE: ProfileTaglineV2Response = {
  lines: [
    { role: 'observation', text: '你把最多的热量给了探店和私厨', aigc: false },
    { role: 'inference', text: '你身上有种让人放松下来的节奏', aigc: true },
    { role: 'reveal', text: '慢热的人，其实是把认真留给了对的局', aigc: true },
  ],
  evidence: [
    { text: '你选了「探店」', sourceRef: 'interest:tan-dian' },
    { text: '重点兴趣给了「私厨」', sourceRef: 'priority:si-chu' },
  ],
  meta: {
    generatedAt: '2026-10-14T00:00:00Z',
    fromCache: false,
    provider: 'deepseek',
    fallbackUsed: false,
    promptVersion: 'profile-tagline-v2',
    aigc: { aiGenerated: true, labelType: 'ai-generated' },
  },
  insightLine: '你身上有种让人放松下来的节奏',
}

const BASE_PROPS = {
  isLoading: false,
  isError: false,
  active: true,
  shouldReduceMotion: false,
  aigcLabelsEnabled: true,
  onRetry: () => {},
}

function renderCard(overrides: Partial<Parameters<typeof InsightRevealCard>[0]> = {}) {
  return render(<InsightRevealCard {...BASE_PROPS} tagline={V2_TAGLINE} {...overrides} />)
}

describe('InsightRevealCard — AC-08 staged reveal (v2 shape)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a row stagger inside the contracted 350–500ms band', () => {
    expect(INSIGHT_ROW_STAGGER_MS).toBeGreaterThanOrEqual(350)
    expect(INSIGHT_ROW_STAGGER_MS).toBeLessThanOrEqual(500)
  })

  it('lands the observation row and evidence group first, with LLM rows as dual-bar skeletons (AC-15)', () => {
    const { container } = renderCard()

    // Deterministic content is visible immediately.
    expect(screen.getByText('你把最多的热量给了探店和私厨')).toBeTruthy()
    // AC-15: 20rpx microcopy caption above the pill row.
    expect(screen.getByText('来自你的选择')).toBeTruthy()
    expect(screen.getByText('你选了「探店」')).toBeTruthy()
    expect(screen.getByText('重点兴趣给了「私厨」')).toBeTruthy()

    // LLM rows are pending dual-bar skeletons, not text.
    expect(screen.queryByText('你身上有种让人放松下来的节奏')).toBeNull()
    expect(screen.queryByText('慢热的人，其实是把认真留给了对的局')).toBeNull()
    const skeletons = container.querySelectorAll('.insight-reveal__row-skeleton')
    expect(skeletons).toHaveLength(2)
    expect(container.querySelectorAll('.insight-reveal__row-skeleton-bar--long')).toHaveLength(2)
    expect(container.querySelectorAll('.insight-reveal__row-skeleton-bar--short')).toHaveLength(2)

    expect(haptics).not.toHaveBeenCalled()
  })

  it('keeps intermediate rows silent and fires haptics(success) only on the final landed row (AC-14)', () => {
    const onAllRowsLanded = vi.fn()
    const { container } = renderCard({ onAllRowsLanded })

    // Intermediate row lands silently.
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(screen.getByText('你身上有种让人放松下来的节奏')).toBeTruthy()
    expect(screen.queryByText('慢热的人，其实是把认真留给了对的局')).toBeNull()
    expect(haptics).not.toHaveBeenCalled()
    expect(onAllRowsLanded).not.toHaveBeenCalled()

    // Final row lands with the success haptic.
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(screen.getByText('慢热的人，其实是把认真留给了对的局')).toBeTruthy()
    expect(haptics).toHaveBeenCalledTimes(1)
    expect(haptics).toHaveBeenCalledWith('success')
    expect(container.querySelectorAll('.insight-reveal__row-skeleton')).toHaveLength(0)
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })

  it('aggregates the AIGC disclosure into ONE footer label once a LLM row has landed (AC-16)', () => {
    const { container } = renderCard()

    // Fail-closed: no landed aigc row → no footer, no label, no report button.
    expect(screen.queryAllByTestId('aigc-label')).toHaveLength(0)
    expect(container.querySelector('.insight-reveal__footer')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })

    // First landed LLM row → exactly one aggregated footer label (not per-line).
    let labels = screen.getAllByTestId('aigc-label')
    expect(labels).toHaveLength(1)
    expect(labels[0].className).toContain('insight-reveal__footer-aigc')
    expect(labels[0].getAttribute('data-ai-generated')).toBe('true')

    // The report button shares the footer row, de-chromed via variant='text'.
    const reportButton = screen.getByTestId('aigc-report-button')
    expect(reportButton.getAttribute('data-variant')).toBe('text')
    expect(reportButton.className).toContain('insight-reveal__footer-report')

    // Second LLM row lands → still exactly one aggregated label.
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    labels = screen.getAllByTestId('aigc-label')
    expect(labels).toHaveLength(1)
  })

  it('renders no AIGC footer when every row is deterministic (fail-closed)', () => {
    const deterministicOnly: ProfileTaglineV2Response = {
      lines: [{ role: 'observation', text: '你把最多的热量给了探店', aigc: false }],
      evidence: [{ text: '你选了「探店」', sourceRef: 'interest:tan-dian' }],
      meta: { ...V2_TAGLINE.meta!, fallbackUsed: true },
      insightLine: '',
    }
    const { container } = renderCard({ tagline: deterministicOnly })

    expect(screen.getByText('你把最多的热量给了探店')).toBeTruthy()
    expect(screen.queryAllByTestId('aigc-label')).toHaveLength(0)
    expect(screen.queryByTestId('aigc-report-button')).toBeNull()
    expect(container.querySelector('.insight-reveal__footer')).toBeNull()
  })

  it('hides the footer while the aigc label feature flag is off', () => {
    const { container } = renderCard({ aigcLabelsEnabled: false })

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })

    expect(container.querySelector('.insight-reveal__footer')).toBeNull()
    expect(screen.queryAllByTestId('aigc-label')).toHaveLength(0)
  })

  it('does not start the LLM sequence until the page reveal is active', () => {
    const onAllRowsLanded = vi.fn()
    const { container, rerender } = render(
      <InsightRevealCard {...BASE_PROPS} active={false} tagline={V2_TAGLINE} onAllRowsLanded={onAllRowsLanded} />,
    )

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS * 3)
    })
    expect(container.querySelectorAll('.insight-reveal__row-skeleton')).toHaveLength(2)
    expect(haptics).not.toHaveBeenCalled()
    expect(onAllRowsLanded).not.toHaveBeenCalled()

    rerender(
      <InsightRevealCard {...BASE_PROPS} active tagline={V2_TAGLINE} onAllRowsLanded={onAllRowsLanded} />,
    )
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })

  it('settles immediately with no skeleton and no haptics when only deterministic rows exist', () => {
    const onAllRowsLanded = vi.fn()
    const deterministicOnly: ProfileTaglineV2Response = {
      lines: [{ role: 'observation', text: '你把最多的热量给了探店', aigc: false }],
      evidence: [{ text: '你选了「探店」', sourceRef: 'interest:tan-dian' }],
      meta: V2_TAGLINE.meta,
      insightLine: '',
    }
    const { container } = renderCard({ tagline: deterministicOnly, onAllRowsLanded })

    expect(screen.getByText('你把最多的热量给了探店')).toBeTruthy()
    expect(container.querySelectorAll('.insight-reveal__row-skeleton')).toHaveLength(0)
    expect(haptics).not.toHaveBeenCalled()
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })
})

describe('InsightRevealCard — AC-11 reduced-motion static equivalent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders every row statically with no animation class, no skeleton, no haptics', () => {
    const onAllRowsLanded = vi.fn()
    const { container } = renderCard({ shouldReduceMotion: true, onAllRowsLanded })

    expect(screen.getByText('你把最多的热量给了探店和私厨')).toBeTruthy()
    expect(screen.getByText('你身上有种让人放松下来的节奏')).toBeTruthy()
    expect(screen.getByText('慢热的人，其实是把认真留给了对的局')).toBeTruthy()
    expect(screen.getByText('你选了「探店」')).toBeTruthy()

    expect(container.querySelectorAll('.insight-reveal__row-skeleton')).toHaveLength(0)
    expect(container.querySelectorAll('.insight-reveal__row--landed')).toHaveLength(0)
    expect(container.querySelectorAll('.insight-reveal__row--static').length).toBeGreaterThan(0)

    // AC-16: the footer renders statically (present, no animation classes).
    expect(container.querySelector('.insight-reveal__footer')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS * 5)
    })
    expect(haptics).not.toHaveBeenCalled()
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })
})

describe('InsightRevealCard — legacy v1 backward compat (REL-02) + AC-18 flag gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the single-line insightLine UI with the section-level AIGC label', () => {
    const onAllRowsLanded = vi.fn()
    const legacy: ProfileTaglineV2Response = {
      insightLine: '你身上有种让人放松的节奏',
      meta: V2_TAGLINE.meta,
    }
    render(<InsightRevealCard {...BASE_PROPS} tagline={legacy} onAllRowsLanded={onAllRowsLanded} />)

    expect(screen.getByText('你身上有种让人放松的节奏')).toBeTruthy()

    // Exactly one label: the legacy section-level one (no footer aggregation).
    const labels = screen.getAllByTestId('aigc-label')
    expect(labels).toHaveLength(1)
    expect(labels[0].className).not.toContain('insight-reveal__footer-aigc')

    // Legacy shape settles immediately so the gift keeps its original timing.
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })

  it('AC-18: v2Enabled=false forces the legacy path even when v2 data arrives', () => {
    const { container } = render(
      <InsightRevealCard {...BASE_PROPS} tagline={V2_TAGLINE} v2Enabled={false} />,
    )

    // Legacy single-line UI from insightLine, not the staged rows.
    expect(screen.getByText('你身上有种让人放松下来的节奏')).toBeTruthy()
    expect(container.querySelector('.insight-reveal__card')).toBeNull()
    expect(container.querySelectorAll('.insight-reveal__row-skeleton')).toHaveLength(0)

    // Section-level label present (legacy behaviour), footer absent.
    const labels = screen.getAllByTestId('aigc-label')
    expect(labels).toHaveLength(1)
    expect(labels[0].className).not.toContain('insight-reveal__footer-aigc')
    expect(container.querySelector('.insight-reveal__footer')).toBeNull()
  })

  it('treats an empty lines array as the legacy shape', () => {
    render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={{ lines: [], evidence: [], insightLine: '老版本的一行观察', meta: V2_TAGLINE.meta }}
      />,
    )
    expect(screen.getByText('老版本的一行观察')).toBeTruthy()
  })

  it('renders the generic fallback with retry affordance on error', () => {
    const onRetry = vi.fn()
    const onAllRowsLanded = vi.fn()
    render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={undefined}
        isError
        onRetry={onRetry}
        onAllRowsLanded={onAllRowsLanded}
      />,
    )

    expect(screen.getByText(GENERIC_PROFILE_TAGLINE_FALLBACK)).toBeTruthy()

    fireEvent.click(screen.getByText('重试'))
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Error settles the insight gate so the gift enters on the original path.
    expect(onAllRowsLanded).toHaveBeenCalledTimes(1)
  })

  it('shows the loading shimmer while the tagline query is in flight, without settling', () => {
    const onAllRowsLanded = vi.fn()
    const onRevealComplete = vi.fn()
    const { container } = render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={undefined}
        isLoading
        onAllRowsLanded={onAllRowsLanded}
        onRevealComplete={onRevealComplete}
      />,
    )
    expect(container.querySelector('.profile-review__ai-tag--loading')).not.toBeNull()
    expect(screen.queryByText(GENERIC_PROFILE_TAGLINE_FALLBACK)).toBeNull()
    // AC-19: no emission while the query is in flight.
    expect(onAllRowsLanded).not.toHaveBeenCalled()
    expect(onRevealComplete).not.toHaveBeenCalled()
  })
})

describe('InsightRevealCard — AC-19 insight_reveal_complete emission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires exactly once with the v2 metadata shape after all rows land', () => {
    const onRevealComplete = vi.fn<(meta: InsightRevealCompleteMeta) => void>()
    const queryStartedAt = Date.now() - 1_000
    renderCard({ onRevealComplete, queryStartedAt })

    // Not before all rows land.
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(onRevealComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(onRevealComplete).toHaveBeenCalledTimes(1)

    const meta = onRevealComplete.mock.calls[0][0]
    expect(meta.shape).toBe('v2')
    expect(meta.lineCount).toBe(3)
    expect(meta.hasReveal).toBe(true)
    expect(meta.fallbackUsed).toBe(false)
    expect(meta.latencyMs).toBeGreaterThanOrEqual(1_000)

    // Stays single-emission even as time passes.
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(onRevealComplete).toHaveBeenCalledTimes(1)
  })

  it('emits shape v1 immediately for the legacy shape', () => {
    const onRevealComplete = vi.fn<(meta: InsightRevealCompleteMeta) => void>()
    render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={{ insightLine: '你身上有种让人放松的节奏', meta: V2_TAGLINE.meta }}
        onRevealComplete={onRevealComplete}
      />,
    )
    expect(onRevealComplete).toHaveBeenCalledTimes(1)
    const meta = onRevealComplete.mock.calls[0][0]
    expect(meta.shape).toBe('v1')
    expect(meta.lineCount).toBe(1)
    expect(meta.hasReveal).toBe(false)
    expect(meta.fallbackUsed).toBe(false)
  })

  it('emits shape generic with fallbackUsed on error', () => {
    const onRevealComplete = vi.fn<(meta: InsightRevealCompleteMeta) => void>()
    render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={undefined}
        isError
        onRevealComplete={onRevealComplete}
      />,
    )
    expect(onRevealComplete).toHaveBeenCalledTimes(1)
    const meta = onRevealComplete.mock.calls[0][0]
    expect(meta.shape).toBe('generic')
    expect(meta.lineCount).toBe(0)
    expect(meta.fallbackUsed).toBe(true)
  })

  it('re-fires once per visit when the replay nonce bumps (useDidShow reset)', () => {
    const onRevealComplete = vi.fn<(meta: InsightRevealCompleteMeta) => void>()
    const { rerender } = render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={{ insightLine: '老版本的一行观察', meta: V2_TAGLINE.meta }}
        replayNonce={0}
        onRevealComplete={onRevealComplete}
      />,
    )
    expect(onRevealComplete).toHaveBeenCalledTimes(1)

    rerender(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={{ insightLine: '老版本的一行观察', meta: V2_TAGLINE.meta }}
        replayNonce={1}
        onRevealComplete={onRevealComplete}
      />,
    )
    expect(onRevealComplete).toHaveBeenCalledTimes(2)
  })
})

describe('InsightRevealCard — AC-21 visual polish contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const landAllLlmRows = () => {
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
  }

  it('AC-21③: reveal row text inherits the accentColor prop when provided', () => {
    renderCard({ accentColor: '#0F766E' })
    landAllLlmRows()

    const revealText = screen.getByText('慢热的人，其实是把认真留给了对的局')
    expect(revealText.style.color).toBe('rgb(15, 118, 110)')

    // Other rows never take the accent.
    expect(screen.getByText('你身上有种让人放松下来的节奏').style.color).toBe('')
    expect(screen.getByText('你把最多的热量给了探店和私厨').style.color).toBe('')
  })

  it('AC-21③: falls back to the SCSS token when accentColor is absent', () => {
    renderCard()
    landAllLlmRows()

    const revealText = screen.getByText('慢热的人，其实是把认真留给了对的局')
    expect(revealText.style.color).toBe('')
  })

  it('AC-21⑤: SCSS hangs the quote glyph on the reveal row only, exactly once', () => {
    const scss = readFileSync(
      resolve(process.cwd(), 'src/components/onboarding/InsightRevealCard.scss'),
      'utf8',
    )

    // The glyph lives on the reveal-row modifier's ::before.
    expect(scss).toMatch(/&--reveal[\s\S]*?&::before[\s\S]*?content: '「'/)
    // Exactly one ceremonial quote in the whole stylesheet — no other rows.
    expect(scss.match(/content: '「'/g) ?? []).toHaveLength(1)
    // Brand display font at 30% ink, hung at -$spacing-sm.
    expect(scss).toContain('font-family: $font-cn-display')
    expect(scss).toContain('rgba($color-primary, 0.3)')
    expect(scss).toContain('left: -$spacing-sm')
  })
})

describe('InsightRevealCard — AC-23 E-1 per-line light feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const landAllLlmRows = () => {
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
  }

  it('renders 准/不太准 links only on landed aigc rows', () => {
    renderCard()

    // Skeleton phase: no links yet.
    expect(screen.queryAllByText('准')).toHaveLength(0)
    expect(screen.queryAllByText('不太准')).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(screen.getAllByText('准')).toHaveLength(1)
    expect(screen.getAllByText('不太准')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(INSIGHT_ROW_STAGGER_MS)
    })
    expect(screen.getAllByText('准')).toHaveLength(2)
    expect(screen.getAllByText('不太准')).toHaveLength(2)

    // The deterministic observation row carries no feedback affordance.
    const observationRow = screen
      .getByText('你把最多的热量给了探店和私厨')
      .closest('.insight-reveal__row')
    expect(observationRow?.querySelectorAll('.insight-reveal__row-feedback-link').length).toBe(0)
  })

  it('tap fires exactly once with the anonymous payload and swaps to 收到', () => {
    const onLineFeedback = vi.fn<(meta: InsightLineFeedbackMeta) => void>()
    renderCard({ onLineFeedback })
    landAllLlmRows()

    const accurateLink = screen.getAllByText('准')[0]
    fireEvent.click(accurateLink)
    // A double-tap inside one tick is ref-deduped.
    fireEvent.click(accurateLink)

    expect(onLineFeedback).toHaveBeenCalledTimes(1)
    expect(onLineFeedback).toHaveBeenCalledWith({
      role: 'inference',
      vote: 'accurate',
      lineIndex: 1,
      shape: 'v2',
    })
    expect(haptics).toHaveBeenCalledWith('light')

    // The link pair is replaced locally by a quiet 收到.
    expect(screen.getByText('收到')).toBeTruthy()
    expect(screen.getAllByText('准')).toHaveLength(1)
  })

  it('uses the line index from the full lines array for the reveal row', () => {
    const onLineFeedback = vi.fn<(meta: InsightLineFeedbackMeta) => void>()
    renderCard({ onLineFeedback })
    landAllLlmRows()

    fireEvent.click(screen.getAllByText('不太准')[1])
    expect(onLineFeedback).toHaveBeenCalledWith({
      role: 'reveal',
      vote: 'inaccurate',
      lineIndex: 2,
      shape: 'v2',
    })
  })

  it('votes on each row independently — once per row', () => {
    const onLineFeedback = vi.fn<(meta: InsightLineFeedbackMeta) => void>()
    renderCard({ onLineFeedback })
    landAllLlmRows()

    fireEvent.click(screen.getAllByText('准')[0])
    fireEvent.click(screen.getAllByText('准')[0])

    expect(onLineFeedback).toHaveBeenCalledTimes(2)
    expect(onLineFeedback.mock.calls.map((call) => call[0].lineIndex).sort()).toEqual([1, 2])
  })

  it('resets the 收到 state when the replay nonce bumps (useDidShow reset)', () => {
    const { rerender } = render(
      <InsightRevealCard {...BASE_PROPS} tagline={V2_TAGLINE} replayNonce={0} />,
    )
    landAllLlmRows()
    fireEvent.click(screen.getAllByText('准')[0])
    expect(screen.getByText('收到')).toBeTruthy()

    rerender(<InsightRevealCard {...BASE_PROPS} tagline={V2_TAGLINE} replayNonce={1} />)
    expect(screen.queryByText('收到')).toBeNull()
    // Rows reset to skeletons on the fresh visit.
    expect(screen.queryAllByText('准')).toHaveLength(0)
  })

  it('renders no feedback links on the legacy single-line path', () => {
    render(
      <InsightRevealCard
        {...BASE_PROPS}
        tagline={{ insightLine: '老版本的一行观察', meta: V2_TAGLINE.meta }}
      />,
    )
    expect(screen.queryAllByText('准')).toHaveLength(0)
    expect(screen.queryAllByText('不太准')).toHaveLength(0)
  })

  it('renders the links statically under reduced motion', () => {
    renderCard({ shouldReduceMotion: true })
    expect(screen.getAllByText('准')).toHaveLength(2)
    expect(screen.getAllByText('不太准')).toHaveLength(2)
  })
})
