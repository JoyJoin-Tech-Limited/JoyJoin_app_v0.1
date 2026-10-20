import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RECAP_SHARE_POSTER_AIGC_LABEL,
  RECAP_SHARE_POSTER_FALLBACK_QUOTE,
  RECAP_SHARE_POSTER_HEIGHT,
  RECAP_SHARE_POSTER_QR_COPY,
  RECAP_SHARE_POSTER_WIDTH,
  buildRecapSharePath,
  buildRecapShareTitle,
  buildTablemateCountLabel,
  drawRecapSharePosterContent,
  formatRecapShareDateLabel,
  resolveRecapShareQuote,
  type RecapSharePosterInput,
} from '../recapSharePoster'

// Record canvas primitive args while keeping the real helpers running
// (insightPoster.test.ts paradigm).
const recorded = vi.hoisted(() => ({
  drawTextBlocks: [] as Array<Record<string, unknown>>,
  fillTexts: [] as string[],
  drawImages: [] as string[],
}))

vi.mock('../../../lib/utils/canvasHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/utils/canvasHelpers')>()
  return {
    ...actual,
    drawTextBlock: (ctx: unknown, options: Record<string, unknown>) => {
      recorded.drawTextBlocks.push(options)
      return (actual as typeof import('../../../lib/utils/canvasHelpers')).drawTextBlock(
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
  return ctx as unknown as Parameters<typeof drawRecapSharePosterContent>[0]
}

const TABLEMATE_ASSETS = [
  'https://cdn.example.com/archetype-corgi.webp',
  'https://cdn.example.com/archetype-fox.webp',
  'https://cdn.example.com/archetype-elephant.webp',
]
const TABLEMATE_PATHS = ['tmp://corgi.webp', 'tmp://fox.webp', 'tmp://elephant.webp']

function buildInput(overrides: Partial<RecapSharePosterInput> = {}): RecapSharePosterInput {
  return {
    tierName: '畅聊局',
    dateLabel: '2026.10.20',
    ownMedalTitle: '接梗王',
    highlightQuote: '今晚每个人都把最真的一面留在了桌上',
    tablemateArchetypeAssets: TABLEMATE_ASSETS,
    tablemateCount: 6,
    hasAigcLabel: true,
    ...overrides,
  }
}

const allDrawnStrings = () => [
  ...recorded.fillTexts,
  ...recorded.drawTextBlocks.map((block) => String(block.text)),
]

// WeChat review posture + incentive-word scans (mirrors insightPoster's
// AC-06): the AIGC label and QR copy are the ONLY sanctioned carve-outs.
const FORBIDDEN_VOCAB = /匹配|社交|灵魂|AI|撮合/
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const INCENTIVE_PATTERN = /奖励|权益|优惠|红包|礼券|返现|免费|福利|券|快来|助力|领取/

describe('recapSharePoster — geometry convention', () => {
  it('pins the 1080×1560 portrait convention (results-page)', () => {
    expect(RECAP_SHARE_POSTER_WIDTH).toBe(1080)
    expect(RECAP_SHARE_POSTER_HEIGHT).toBe(1560)
  })
})

describe('recapSharePoster — content layout (spec 规格一 §2 / AC-4)', () => {
  beforeEach(() => {
    recorded.drawTextBlocks.length = 0
    recorded.fillTexts.length = 0
    recorded.drawImages.length = 0
  })

  it('draws the 局名日期 line, medal block, quote, icons, count, brand mark', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput(), TABLEMATE_PATHS)

    expect(recorded.fillTexts).toContain('畅聊局 · 2026.10.20')
    expect(recorded.fillTexts).toContain('我拿到了')
    expect(recorded.fillTexts).toContain('接梗王')
    expect(recorded.drawTextBlocks.map((b) => b.text)).toContain('今晚每个人都把最真的一面留在了桌上')
    expect(recorded.drawImages).toEqual(TABLEMATE_PATHS)
    expect(recorded.fillTexts).toContain('6 位有趣的桌友')
    expect(recorded.fillTexts).toContain('JoyJoin 悦聚')
    expect(recorded.fillTexts).toContain(RECAP_SHARE_POSTER_QR_COPY)
    expect(recorded.fillTexts).toContain(RECAP_SHARE_POSTER_AIGC_LABEL)
  })

  it('caps the archetype icon row at 6', () => {
    const sevenPaths = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    drawRecapSharePosterContent(
      createMockCtx(),
      buildInput({ tablemateArchetypeAssets: sevenPaths }),
      sevenPaths,
    )
    expect(recorded.drawImages).toHaveLength(6)
  })

  it('omits the medal block when the viewer has no medal', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput({ ownMedalTitle: undefined }), TABLEMATE_PATHS)
    expect(recorded.fillTexts).not.toContain('我拿到了')
    expect(recorded.fillTexts).not.toContain('接梗王')
    // The rest of the poster still renders.
    expect(recorded.fillTexts).toContain('6 位有趣的桌友')
  })

  it('omits the 局名日期 line halves it does not have', () => {
    drawRecapSharePosterContent(
      createMockCtx(),
      buildInput({ tierName: undefined, dateLabel: undefined }),
      TABLEMATE_PATHS,
    )
    expect(recorded.fillTexts).not.toContain('畅聊局 · 2026.10.20')
    expect(recorded.fillTexts.some((t) => t.includes('畅聊局'))).toBe(false)

    recorded.fillTexts.length = 0
    drawRecapSharePosterContent(
      createMockCtx(),
      buildInput({ tierName: '破冰局', dateLabel: undefined }),
      TABLEMATE_PATHS,
    )
    expect(recorded.fillTexts).toContain('破冰局')
  })

  it('bakes the AIGC label iff hasAigcLabel (fail-closed)', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput({ hasAigcLabel: true }))
    expect(recorded.fillTexts).toContain(RECAP_SHARE_POSTER_AIGC_LABEL)

    recorded.fillTexts.length = 0
    drawRecapSharePosterContent(createMockCtx(), buildInput({ hasAigcLabel: false }))
    expect(recorded.fillTexts).not.toContain(RECAP_SHARE_POSTER_AIGC_LABEL)
  })

  it('draws the QR image fail-open — copy-only band without it', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput({ qrCodeImagePath: 'tmp://qr.png' }))
    expect(recorded.drawImages).toContain('tmp://qr.png')
    expect(recorded.fillTexts).toContain(RECAP_SHARE_POSTER_QR_COPY)

    recorded.drawImages.length = 0
    drawRecapSharePosterContent(createMockCtx(), buildInput({ qrCodeImagePath: undefined }))
    expect(recorded.drawImages).not.toContain('tmp://qr.png')
    expect(recorded.fillTexts).toContain(RECAP_SHARE_POSTER_QR_COPY)
  })

  it('keeps block Y positions monotonic (layout stability)', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput(), TABLEMATE_PATHS)
    const blockYs = recorded.drawTextBlocks.map((block) => Number(block.y))
    for (let i = 1; i < blockYs.length; i += 1) {
      expect(blockYs[i]).toBeGreaterThanOrEqual(blockYs[i - 1])
    }
  })

  it('PRIVACY (spy-locked): other participants’ displayNames and quote attributions never reach any canvas primitive', () => {
    // Simulate the full recap data environment: the roster carries other
    // players' names and the moment panel carries personDisplayName
    // attributions. The poster input type structurally excludes them — this
    // test locks that no such string can appear in the canvas text stream.
    const OTHER_DISPLAY_NAMES = ['老周', '小鹿', '阿紫', 'stone']
    const input = buildInput({
      // Even a quote that came from an attributed highlight arrives UNSIGNED.
      highlightQuote: '有人把全场逗笑了三次',
    })
    drawRecapSharePosterContent(createMockCtx(), input, TABLEMATE_PATHS)

    const drawn = allDrawnStrings().join('\n')
    for (const name of OTHER_DISPLAY_NAMES) {
      expect(drawn).not.toContain(name)
    }
    // Structural exclusion: every key on the input belongs to the sanctioned
    // set — no identity key (displayName/userId/participants) can exist.
    const SANCTIONED_KEYS = [
      'dateLabel',
      'hasAigcLabel',
      'highlightQuote',
      'ownMedalTitle',
      'qrCodeImagePath',
      'tablemateArchetypeAssets',
      'tablemateCount',
      'tierName',
    ]
    for (const key of Object.keys(input)) {
      expect(SANCTIONED_KEYS).toContain(key)
    }
    // Icon slots receive image PATHS only — never name strings.
    for (const src of recorded.drawImages) {
      expect(OTHER_DISPLAY_NAMES.some((name) => src.includes(name))).toBe(false)
    }
  })

  it('zero forbidden vocab / emoji / incentive wording except sanctioned strings', () => {
    drawRecapSharePosterContent(createMockCtx(), buildInput(), TABLEMATE_PATHS)

    for (const text of allDrawnStrings()) {
      expect(INCENTIVE_PATTERN.test(text)).toBe(false)
      expect(EMOJI_PATTERN.test(text)).toBe(false)
      if (text === RECAP_SHARE_POSTER_AIGC_LABEL) continue
      expect(FORBIDDEN_VOCAB.test(text)).toBe(false)
    }
    // The carve-out is asserted explicitly (not silently skipped).
    expect(RECAP_SHARE_POSTER_AIGC_LABEL).toBe('内容由 AI 生成')
    expect(RECAP_SHARE_POSTER_QR_COPY).toBe('扫码，遇见对味的局')
  })
})

describe('resolveRecapShareQuote — priority chain (spec §2)', () => {
  it('panel narrative wins over recap sources', () => {
    const result = resolveRecapShareQuote({
      panelQuote: '  面板里的高光  ',
      summaryMoments: ['回顾瞬间'],
      funMoments: ['数据瞬间'],
    })
    expect(result).toEqual({ quote: '面板里的高光', source: 'panel' })
  })

  it('falls back to summary moments, then funMoments, then the static sentence', () => {
    expect(
      resolveRecapShareQuote({ panelQuote: null, summaryMoments: ['回顾瞬间'], funMoments: ['数据瞬间'] }),
    ).toEqual({ quote: '回顾瞬间', source: 'recap' })
    expect(
      resolveRecapShareQuote({ panelQuote: '', summaryMoments: [], funMoments: ['数据瞬间'] }),
    ).toEqual({ quote: '数据瞬间', source: 'recap' })
    expect(resolveRecapShareQuote({})).toEqual({
      quote: RECAP_SHARE_POSTER_FALLBACK_QUOTE,
      source: 'fallback',
    })
    // The static fallback sentence is the pinned spec copy.
    expect(RECAP_SHARE_POSTER_FALLBACK_QUOTE).toBe('有些晚上，值得被记住')
  })
})

describe('formatRecapShareDateLabel', () => {
  it('formats a ms timestamp as YYYY.MM.DD', () => {
    expect(formatRecapShareDateLabel(new Date(2026, 9, 20, 21, 30).getTime())).toBe('2026.10.20')
  })

  it('returns empty for unusable timestamps', () => {
    expect(formatRecapShareDateLabel(undefined)).toBe('')
    expect(formatRecapShareDateLabel(0)).toBe('')
    expect(formatRecapShareDateLabel(Number.NaN)).toBe('')
  })
})

describe('buildRecapShareTitle — AC-7 banned-word scan', () => {
  it('uses the group line with a plausible head count, solo line otherwise', () => {
    expect(buildRecapShareTitle(6)).toBe('我们 6 个人把今晚聊热了')
    expect(buildRecapShareTitle(2)).toBe('我们 2 个人把今晚聊热了')
    expect(buildRecapShareTitle(1)).toBe('今晚这桌，聊得很对味')
    expect(buildRecapShareTitle(undefined)).toBe('今晚这桌，聊得很对味')
  })

  it('both candidates pass the 禁用词 + incentive scan with zero hits', () => {
    for (const title of [buildRecapShareTitle(6), buildRecapShareTitle(undefined)]) {
      expect(FORBIDDEN_VOCAB.test(title)).toBe(false)
      expect(INCENTIVE_PATTERN.test(title)).toBe(false)
      expect(EMOJI_PATTERN.test(title)).toBe(false)
    }
  })
})

describe('buildRecapSharePath — referral landing convention', () => {
  it('carries the referral code onto the LANDING page (never the session page)', () => {
    const path = buildRecapSharePath('ABC123')
    expect(path).toBe('/pages/index/index?invitationCode=ABC123')
    expect(path).not.toContain('icebreaker-session')
  })

  it('falls back to the plain landing path without a code', () => {
    expect(buildRecapSharePath('')).toBe('/pages/index/index')
    expect(buildRecapSharePath(null)).toBe('/pages/index/index')
    expect(buildRecapSharePath(undefined)).toBe('/pages/index/index')
  })
})

describe('buildTablemateCountLabel', () => {
  it('renders the count-only label', () => {
    expect(buildTablemateCountLabel(6)).toBe('6 位有趣的桌友')
    expect(buildTablemateCountLabel(0)).toBe('0 位有趣的桌友')
  })
})
