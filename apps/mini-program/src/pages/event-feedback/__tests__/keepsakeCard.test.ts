import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  KEEPSAKE_CARD_HEIGHT,
  KEEPSAKE_CARD_WIDTH,
  KEEPSAKE_QR_COPY,
  drawKeepsakeCardContent,
  type KeepsakeCardInput,
} from '../keepsakeCard'

/**
 * Runtime spy-locks for the 互选纪念卡 canvas (item 19, 2026-10-16).
 * Mirrors insightPoster.test.ts: a mock ctx records fillText/drawImage args
 * while the real draw function runs — layout, vocab, and the PII structural
 * exclusion are asserted against what actually reaches the canvas primitives.
 */

const recorded = vi.hoisted(() => ({
  fillTexts: [] as string[],
  drawImages: [] as string[],
}))

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
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    draw: vi.fn(),
  }
  return ctx as unknown as Parameters<typeof drawKeepsakeCardContent>[0]
}

function buildInput(overrides: Partial<KeepsakeCardInput> = {}): KeepsakeCardInput {
  return {
    viewer: { displayName: '晨曦', archetype: 'corgi' },
    matches: [{ displayName: '阿岚', archetype: 'koala' }],
    eventDayLabel: '10.15',
    ...overrides,
  }
}

describe('keepsake card canvas (2026-10-16, item 19)', () => {
  beforeEach(() => {
    recorded.fillTexts.length = 0
    recorded.drawImages.length = 0
  })

  it('is a 1080×1560 portrait card (results-page convention)', () => {
    expect(KEEPSAKE_CARD_WIDTH).toBe(1080)
    expect(KEEPSAKE_CARD_HEIGHT).toBe(1560)
  })

  it('draws both names, the mutual line, and the event date', () => {
    drawKeepsakeCardContent(createMockCtx(), buildInput(), ['tmp://corgi.webp', 'tmp://koala.webp'])
    expect(recorded.fillTexts).toContain('晨曦')
    expect(recorded.fillTexts).toContain('阿岚')
    expect(recorded.fillTexts).toContain('我们互相选择了对方')
    expect(recorded.fillTexts).toContain('10.15 那局')
    expect(recorded.fillTexts).toContain('互选纪念')
    // Both resolved heads reach drawImage.
    expect(recorded.drawImages).toContain('tmp://corgi.webp')
    expect(recorded.drawImages).toContain('tmp://koala.webp')
  })

  it('omits the date line when the label is unresolved', () => {
    drawKeepsakeCardContent(createMockCtx(), buildInput({ eventDayLabel: undefined }), ['', ''])
    expect(recorded.fillTexts.some((text) => text.includes('那局'))).toBe(false)
  })

  it('PII spy-lock: poisoned contact fields never reach a canvas primitive', () => {
    const input = buildInput()
    // Runtime pollution beyond the type boundary — the draw function must
    // never read these, so nothing carrying them can be baked into the card.
    ;(input.viewer as unknown as Record<string, unknown>).wechatContactId = 'viewer_probe_001'
    ;(input.matches[0] as unknown as Record<string, unknown>).wechatContactId = 'wxid_probe_001'
    drawKeepsakeCardContent(createMockCtx(), input, ['', ''])
    const allText = recorded.fillTexts.join('\n')
    expect(allText).not.toContain('viewer_probe_001')
    expect(allText).not.toContain('wxid_probe_001')
    expect(allText).not.toContain('微信号')
    // drawImage only ever receives resolved head/QR paths — never a field value.
    for (const src of recorded.drawImages) {
      expect(typeof src).toBe('string')
      expect(src).not.toContain('probe')
    }
  })

  it('visible canvas copy stays inside the review-posture vocab (no banned words, no share bait)', () => {
    drawKeepsakeCardContent(
      createMockCtx(),
      buildInput({ matches: [{ displayName: '阿岚', archetype: null }], qrCodeImagePath: 'tmp://qr.png' }),
      ['', ''],
    )
    const allText = recorded.fillTexts.join('\n')
    for (const banned of ['匹配', '社交', '撮合', '灵魂', 'AI', '分享', '奖励', '福利']) {
      expect(allText).not.toContain(banned)
    }
    // The QR band copy is the vocab-whitelisted zero-inducement line.
    expect(recorded.fillTexts).toContain(KEEPSAKE_QR_COPY)
    expect(KEEPSAKE_QR_COPY).toBe('扫码，遇见对味的局')
    expect(recorded.drawImages).toContain('tmp://qr.png')
  })

  it('falls back to the copy-only band when the QR path is absent', () => {
    drawKeepsakeCardContent(createMockCtx(), buildInput({ qrCodeImagePath: undefined }), ['', ''])
    expect(recorded.fillTexts).toContain(KEEPSAKE_QR_COPY)
    expect(recorded.drawImages).toHaveLength(0)
  })

  it('caps match heads at 3 and folds the overflow into a caption', () => {
    const input = buildInput({
      matches: [
        { displayName: '阿岚', archetype: 'koala' },
        { displayName: '拾柒', archetype: 'owl' },
        { displayName: '默默', archetype: 'cat' },
        { displayName: '阿团', archetype: 'fox' },
      ],
    })
    drawKeepsakeCardContent(createMockCtx(), input, ['', '', '', ''])
    expect(recorded.fillTexts).toContain('还有 1 位伙伴互选成功')
    // Folded person's name is not drawn.
    expect(recorded.fillTexts).not.toContain('阿团')
  })

  it('truncates long names to 4 glyphs (squad-poster grammar)', () => {
    drawKeepsakeCardContent(
      createMockCtx(),
      buildInput({ matches: [{ displayName: '一只很长很长的名字', archetype: 'cat' }] }),
      ['', ''],
    )
    expect(recorded.fillTexts).toContain('一只很长')
    expect(recorded.fillTexts).not.toContain('一只很长很长的名字')
  })
})
