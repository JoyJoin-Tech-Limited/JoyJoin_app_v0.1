import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  INSIGHT_POSTER_AIGC_LABEL,
  INSIGHT_POSTER_HEIGHT,
  INSIGHT_POSTER_QR_COPY,
  INSIGHT_POSTER_TEXT_METRICS,
  INSIGHT_POSTER_WIDTH,
  drawInsightPosterContent,
  resolveInsightShareVisibility,
  type InsightPosterInput,
} from '../insightPoster'
import { splitText } from '../../utils/canvasHelpers'
import type { ProfileTaglineEvidence, ProfileTaglineLine } from '@shared/ai/onboarding'

// Record canvas primitive args while keeping the real helpers running.
const recorded = vi.hoisted(() => ({
  drawTextBlocks: [] as Array<Record<string, unknown>>,
  fillTexts: [] as string[],
  drawImages: [] as string[],
}))

vi.mock('../../utils/canvasHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/canvasHelpers')>()
  return {
    ...actual,
    drawTextBlock: (ctx: unknown, options: Record<string, unknown>) => {
      recorded.drawTextBlocks.push(options)
      return (actual as typeof import('../../utils/canvasHelpers')).drawTextBlock(
        ctx as Parameters<typeof actual.drawTextBlock>[0],
        options as unknown as Parameters<typeof actual.drawTextBlock>[1],
      )
    },
  }
})

function createMockCtx() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    setFillStyle: vi.fn(),
    setStrokeStyle: vi.fn(),
    setLineWidth: vi.fn(),
    setFontSize: vi.fn(),
    setTextAlign: vi.fn(),
    setTextBaseline: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn((text: string) => {
      recorded.fillTexts.push(text)
    }),
    drawImage: vi.fn((src: string) => {
      recorded.drawImages.push(src)
    }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    draw: vi.fn(),
  }
  return ctx as unknown as Parameters<typeof drawInsightPosterContent>[0]
}

const LINES: ProfileTaglineLine[] = [
  { role: 'observation', text: '你把最多的热量给了探店和私厨', aigc: false },
  { role: 'inference', text: '你身上有种让人放松下来的节奏', aigc: true },
  { role: 'reveal', text: '慢热的人，其实是把认真留给了对的局', aigc: true },
]

const EVIDENCE: ProfileTaglineEvidence[] = [
  { text: '你选了「探店」', sourceRef: 'interest:tan-dian' },
]

function buildInput(overrides: Partial<InsightPosterInput> = {}): InsightPosterInput {
  return {
    displayName: '小悦',
    archetypeName: '社牛柯基',
    accentText: '#8B5CF6',
    lines: LINES,
    evidence: EVIDENCE,
    hasAigcLabel: true,
    ...overrides,
  }
}

const allDrawnStrings = () => [
  ...recorded.fillTexts,
  ...recorded.drawTextBlocks.map((block) => String(block.text)),
]

// AC-06: forbidden vocab + emoji — the AIGC label and QR copy are the ONLY
// sanctioned carve-outs.
const FORBIDDEN_VOCAB = /匹配|社交|灵魂|AI|撮合/
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
// No incentive/reward wording anywhere on the poster.
const INCENTIVE_PATTERN = /奖励|权益|优惠|红包|礼券|返现|免费|福利|券/

describe('insightPoster — geometry + text metrics (AC-02 / AC-02c)', () => {
  it('pins the 1080×1560 portrait convention', () => {
    expect(INSIGHT_POSTER_WIDTH).toBe(1080)
    expect(INSIGHT_POSTER_HEIGHT).toBe(1560)
  })

  it('grades reveal > base typography within the ±4px optical band', () => {
    expect(INSIGHT_POSTER_TEXT_METRICS.reveal.fontSize).toBe(48)
    expect(INSIGHT_POSTER_TEXT_METRICS.base.fontSize).toBe(40)
    expect(INSIGHT_POSTER_TEXT_METRICS.reveal.fontSize).toBeGreaterThan(INSIGHT_POSTER_TEXT_METRICS.base.fontSize)
    expect(INSIGHT_POSTER_TEXT_METRICS.reveal.maxLines).toBe(3)
    expect(INSIGHT_POSTER_TEXT_METRICS.base.maxLines).toBe(3)
  })
})

describe('insightPoster — content layout (AC-02 / AC-02c)', () => {
  beforeEach(() => {
    recorded.drawTextBlocks.length = 0
    recorded.fillTexts.length = 0
    recorded.drawImages.length = 0
  })

  it('draws every insight line in display order with role-specific metrics', () => {
    drawInsightPosterContent(createMockCtx(), buildInput())

    const lineBlocks = recorded.drawTextBlocks.filter((block) =>
      LINES.some((line) => line.text === block.text),
    )
    expect(lineBlocks.map((block) => block.text)).toEqual(LINES.map((line) => line.text))
    expect(lineBlocks.map((block) => block.fontSize)).toEqual([40, 40, 48])
    expect(lineBlocks.map((block) => block.maxLines)).toEqual([3, 3, 3])
    expect(lineBlocks.map((block) => block.maxCharsPerLine)).toEqual([22, 22, 18])
  })

  it('truncates an 80-char line to ≤3 lines with an ellipsis (known trade-off)', () => {
    const longLine = '长'.repeat(80)
    drawInsightPosterContent(createMockCtx(), buildInput({ lines: [{ role: 'reveal', text: longLine, aigc: true }] }))

    // Delegated to drawTextBlock with maxLines 3 — the util's own contract:
    const wrapped = splitText(longLine, INSIGHT_POSTER_TEXT_METRICS.reveal.maxCharsPerLine, 3)
    expect(wrapped.length).toBeLessThanOrEqual(3)
    expect(wrapped[wrapped.length - 1].endsWith('…')).toBe(true)

    // The builder passes the full text (truncation is the util's job)…
    const block = recorded.drawTextBlocks.find((b) => b.text === longLine)
    expect(block).toBeDefined()
    expect(block?.maxLines).toBe(3)

    // …and no rendered canvas string exceeds one wrapped line's width.
    const longest = Math.max(...recorded.fillTexts.map((t) => Array.from(t).length))
    expect(longest).toBeLessThanOrEqual(INSIGHT_POSTER_TEXT_METRICS.reveal.maxCharsPerLine + 1)
  })

  it('keeps the layout stable and monotonic for a 1-line input', () => {
    const ctx = createMockCtx()
    drawInsightPosterContent(ctx, buildInput({ lines: [LINES[0]], evidence: [] }))

    expect(recorded.fillTexts).toContain(LINES[0].text)
    // QR band copy + brand wordmark still render.
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_QR_COPY)
    expect(recorded.fillTexts).toContain('JoyJoin 悦聚')

    const blockYs = recorded.drawTextBlocks.map((block) => Number(block.y))
    for (let i = 1; i < blockYs.length; i += 1) {
      expect(blockYs[i]).toBeGreaterThanOrEqual(blockYs[i - 1])
    }
  })

  it('bakes the AIGC label iff hasAigcLabel (fail-closed)', () => {
    drawInsightPosterContent(createMockCtx(), buildInput({ hasAigcLabel: true }))
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_AIGC_LABEL)

    recorded.fillTexts.length = 0
    drawInsightPosterContent(createMockCtx(), buildInput({ hasAigcLabel: false }))
    expect(recorded.fillTexts).not.toContain(INSIGHT_POSTER_AIGC_LABEL)
  })

  it('draws the QR image fail-open — copy-only band without it', () => {
    drawInsightPosterContent(createMockCtx(), buildInput({ qrCodeImagePath: 'tmp://qr.png' }))
    expect(recorded.drawImages).toContain('tmp://qr.png')
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_QR_COPY)

    recorded.drawImages.length = 0
    recorded.fillTexts.length = 0
    drawInsightPosterContent(createMockCtx(), buildInput({ qrCodeImagePath: undefined }))
    expect(recorded.drawImages).toEqual([])
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_QR_COPY)
  })

  it('REL-02: sensitive 小档案 values never reach any canvas primitive', () => {
    const SENSITIVE = ['香港', '单身', '硕士', '产品经理', '互联网']
    drawInsightPosterContent(createMockCtx(), buildInput())

    const drawn = allDrawnStrings().join('\n')
    for (const value of SENSITIVE) {
      expect(drawn).not.toContain(value)
    }
  })

  it('AC-06: zero forbidden vocab / emoji / incentive wording except sanctioned strings', () => {
    drawInsightPosterContent(createMockCtx(), buildInput())

    for (const text of allDrawnStrings()) {
      expect(INCENTIVE_PATTERN.test(text)).toBe(false)
      expect(EMOJI_PATTERN.test(text)).toBe(false)
      if (text === INSIGHT_POSTER_AIGC_LABEL) continue
      if (text === INSIGHT_POSTER_QR_COPY) continue
      expect(FORBIDDEN_VOCAB.test(text)).toBe(false)
    }
    // The two carve-outs are asserted explicitly (not silently skipped).
    expect(INSIGHT_POSTER_AIGC_LABEL).toBe('内容由 AI 生成')
    expect(INSIGHT_POSTER_QR_COPY).toBe('扫码，遇见对味的局')
    // Both appear in this fully-populated poster.
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_AIGC_LABEL)
    expect(recorded.fillTexts).toContain(INSIGHT_POSTER_QR_COPY)
  })
})

describe('resolveInsightShareVisibility — AC-01 fail-closed matrix', () => {
  const base = {
    isV2Insight: true,
    insightRowsLanded: true,
    hasVisual: true,
    flagEnabled: true,
  }

  it('1. v2 + landed + visual + flag → visible', () => {
    expect(resolveInsightShareVisibility(base)).toBe(true)
  })

  it('2. rows not landed (incl. loading) → hidden', () => {
    expect(resolveInsightShareVisibility({ ...base, insightRowsLanded: false })).toBe(false)
  })

  it('3. flag explicitly off → hidden', () => {
    expect(resolveInsightShareVisibility({ ...base, flagEnabled: false })).toBe(false)
  })

  it('4. visual null → hidden', () => {
    expect(resolveInsightShareVisibility({ ...base, hasVisual: false })).toBe(false)
  })

  it('5. legacy shape → hidden', () => {
    expect(resolveInsightShareVisibility({ ...base, isV2Insight: false })).toBe(false)
  })

  it('6. generic/error shape (not v2, not landed) → hidden', () => {
    expect(
      resolveInsightShareVisibility({
        isV2Insight: false,
        insightRowsLanded: false,
        hasVisual: true,
        flagEnabled: true,
      }),
    ).toBe(false)
  })

  it('7. first paint (loading, nothing resolved) → hidden', () => {
    expect(
      resolveInsightShareVisibility({
        isV2Insight: false,
        insightRowsLanded: false,
        hasVisual: false,
        flagEnabled: true,
      }),
    ).toBe(false)
  })

  it('8. all signals off → hidden', () => {
    expect(
      resolveInsightShareVisibility({
        isV2Insight: false,
        insightRowsLanded: false,
        hasVisual: false,
        flagEnabled: false,
      }),
    ).toBe(false)
  })
})
