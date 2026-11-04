import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Taro from '@tarojs/taro'
import {
  generatePersonalitySharePoster,
  PERSONALITY_SHARE_POSTER_CANVAS_ID,
  type PersonalitySharePosterInput,
} from '../sharePoster'

const QR_PATH = 'tmp://referral-qr.png'
const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1560
const LEFT_EDGE = 72
const RIGHT_EDGE = 980
const CONTENT_WIDTH = RIGHT_EDGE - LEFT_EDGE

interface TextCall {
  text: string
  x: number
  y: number
  fontSize: number
  align: 'left' | 'center' | 'right'
  width: number
}

interface RectCall {
  kind: 'fill' | 'stroke'
  x: number
  y: number
  width: number
  height: number
}

const recorded = vi.hoisted(() => ({
  ctx: null as unknown as Taro.CanvasContext,
  rects: [] as RectCall[],
  exportCanvas: vi.fn(),
  unlinkSync: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../../../../../lib/utils/canvasHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../lib/utils/canvasHelpers')>()
  return {
    ...actual,
    fillRoundedRect: (...args: Parameters<typeof actual.fillRoundedRect>) => {
      const [, x, y, width, height] = args
      recorded.rects.push({ kind: 'fill', x, y, width, height })
      return actual.fillRoundedRect(...args)
    },
    strokeRoundedRect: (...args: Parameters<typeof actual.strokeRoundedRect>) => {
      const [, x, y, width, height] = args
      recorded.rects.push({ kind: 'stroke', x, y, width, height })
      return actual.strokeRoundedRect(...args)
    },
    exportCanvasWithRetry: recorded.exportCanvas,
  }
})

vi.mock('../../../../../lib/utils/logger', () => ({
  logInfo: recorded.logInfo,
  logWarn: recorded.logWarn,
}))

vi.mock('@tarojs/taro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tarojs/taro')>()
  const api = {
    ...actual,
    createCanvasContext: vi.fn(() => recorded.ctx),
    getImageInfo: vi.fn().mockResolvedValue({ width: 600, height: 800, path: 'tmp://archetype.png' }),
    getFileSystemManager: vi.fn(() => ({ unlinkSync: recorded.unlinkSync })),
  }
  return { ...actual, ...api, default: api }
})

function measure(text: string, fontSize: number): number {
  return Array.from(text).reduce((width) => width + fontSize, 0)
}

function createMockContext(options: { throwOnQr?: boolean } = {}) {
  let fontSize = 16
  let align: TextCall['align'] = 'left'
  const texts: TextCall[] = []
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    setFillStyle: vi.fn(),
    setStrokeStyle: vi.fn(),
    setLineWidth: vi.fn(),
    setShadow: vi.fn(),
    setFontSize: vi.fn((value: number) => { fontSize = value }),
    setTextAlign: vi.fn((value: TextCall['align']) => { align = value }),
    setTextBaseline: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: measure(text, fontSize) })),
    fillText: vi.fn((text: string, x: number, y: number) => {
      texts.push({ text, x, y, fontSize, align, width: measure(text, fontSize) })
    }),
    drawImage: vi.fn((src: string) => {
      if (src === QR_PATH && options.throwOnQr) throw new Error('QR decode failed')
    }),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    draw: vi.fn((_reserve?: boolean, callback?: () => void) => { callback?.() }),
  }
  recorded.ctx = ctx as unknown as Taro.CanvasContext
  return { ctx, texts }
}

function buildInput(overrides: Partial<PersonalitySharePosterInput> = {}): PersonalitySharePosterInput {
  return {
    archetype: '开心柯基',
    tagline: '把热闹带给每一桌',
    shareLine: '来悦聚测测你的氛围命格',
    accentColor: '#8b5cf6',
    accentSoft: '#f4f0ff',
    archetypeAsset: 'https://cdn.example.com/corgi.webp',
    archetypeAssetPng: 'https://cdn.example.com/corgi.png',
    preResolvedImagePath: 'tmp://archetype.png',
    confidenceLabel: '典型开心柯基',
    rarityLabel: '稀有度 12%',
    activeSkillTitle: '气氛点火器',
    activeSkillEffect: '让刚见面的桌友自然聊起来',
    passiveSkillTitle: '快乐接收站',
    passiveSkillEffect: '稳稳接住每一份善意',
    energyLevel: 88,
    archetypeRank: 1,
    serialNumber: '#000123',
    qrCodeImagePath: QR_PATH,
    ...overrides,
  }
}

async function render(
  overrides: Partial<PersonalitySharePosterInput> = {},
  options: { throwOnQr?: boolean } = {},
) {
  recorded.rects.length = 0
  const mock = createMockContext(options)
  const output = await generatePersonalitySharePoster(buildInput(overrides))
  return { ...mock, output, rects: [...recorded.rects] }
}

function horizontalBounds(call: TextCall): { left: number; right: number } {
  if (call.align === 'center') return { left: call.x - call.width / 2, right: call.x + call.width / 2 }
  if (call.align === 'right') return { left: call.x - call.width, right: call.x }
  return { left: call.x, right: call.x + call.width }
}

function findRect(rects: RectCall[], width: number, height: number): RectCall {
  const rect = rects.find((entry) => entry.kind === 'fill' && entry.width === width && entry.height === height)
  expect(rect, `missing filled rect ${width}x${height}`).toBeDefined()
  return rect as RectCall
}

describe('personality portrait poster — AC-03 QR and export lifecycle', () => {
  beforeEach(() => {
    recorded.exportCanvas.mockReset().mockResolvedValue('tmp://personality-portrait.png')
    recorded.unlinkSync.mockReset()
    recorded.logInfo.mockReset()
    recorded.logWarn.mockReset()
    recorded.rects.length = 0
  })

  it('ends in a real centered copy-only band when QR drawImage throws', async () => {
    const { texts, rects, output } = await render({}, { throwOnQr: true })

    expect(output).toBe('tmp://personality-portrait.png')
    expect(texts.map((call) => call.text)).toContain('微信搜索「悦聚」小程序，3 分钟开测')
    expect(texts.some((call) => call.text.includes('长按识别'))).toBe(false)
    expect(texts.find((call) => call.text === '12 种氛围命格，你是哪一种？')?.align).toBe('center')

    // Canvas commands are queued, so the opaque second band paint is the
    // actual rollback: no chip command may survive after that final paint.
    const bandPaints = rects
      .map((rect, index) => ({ rect, index }))
      .filter(({ rect }) => rect.kind === 'fill' && rect.width === CONTENT_WIDTH && rect.height === 216)
    expect(bandPaints.length).toBeGreaterThanOrEqual(2)
    const finalBandIndex = bandPaints[bandPaints.length - 1].index
    expect(rects.slice(finalBandIndex + 1).some((rect) => rect.width === 168 && rect.height === 168)).toBe(false)

    expect(recorded.exportCanvas).toHaveBeenCalledWith(
      PERSONALITY_SHARE_POSTER_CANVAS_ID,
      POSTER_WIDTH,
      POSTER_HEIGHT,
      [2, 1],
      { autoCleanup: false },
    )
  })

  it('B2: unlinks a late timed-out export once without canvas, log, or resolve side effects', async () => {
    vi.useFakeTimers()
    let resolveLateExport!: (path: string) => void
    const lateExport = new Promise<string>((resolve) => { resolveLateExport = resolve })
    recorded.exportCanvas.mockReturnValue(lateExport)
    const { ctx } = createMockContext()

    try {
      const generation = generatePersonalitySharePoster(buildInput())
      await vi.advanceTimersByTimeAsync(0)
      expect(recorded.exportCanvas).toHaveBeenCalledTimes(1)

      const rejection = expect(generation).rejects.toThrow('Canvas draw timed out')
      await vi.advanceTimersByTimeAsync(15_000)
      await rejection
      expect(recorded.unlinkSync).not.toHaveBeenCalled()

      ctx.clearRect.mockClear()
      recorded.logInfo.mockClear()
      resolveLateExport('tmp://late-portrait.png')
      await vi.advanceTimersByTimeAsync(0)

      expect(recorded.unlinkSync).toHaveBeenCalledTimes(1)
      expect(recorded.unlinkSync).toHaveBeenCalledWith('tmp://late-portrait.png')
      expect(ctx.clearRect).not.toHaveBeenCalled()
      expect(recorded.logInfo).not.toHaveBeenCalled()
      await expect(generation).rejects.toThrow('Canvas draw timed out')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})

describe('personality portrait poster — AC-03 optional flow and bounds', () => {
  beforeEach(() => {
    recorded.exportCanvas.mockReset().mockResolvedValue('tmp://personality-portrait.png')
  })

  it('omits every missing optional section and compacts the following stamp and CTA', async () => {
    const full = await render()
    const missing = await render({
      confidenceLabel: undefined,
      rarityLabel: undefined,
      archetypeRank: undefined,
      serialNumber: undefined,
      energyLevel: undefined,
      activeSkillTitle: '',
      activeSkillEffect: '',
      passiveSkillTitle: '   ',
      passiveSkillEffect: '',
    })

    const fullStamp = findRect(full.rects, CONTENT_WIDTH, 48)
    const missingStamp = findRect(missing.rects, CONTENT_WIDTH, 48)
    const fullCta = findRect(full.rects, CONTENT_WIDTH, 216)
    const missingCta = findRect(missing.rects, CONTENT_WIDTH, 216)
    expect(missingStamp.y).toBeLessThan(fullStamp.y)
    expect(missingCta.y).toBeLessThan(fullCta.y)
    expect(missingCta.y - (missingStamp.y + 48)).toBe(52)

    const missingText = missing.texts.map((call) => call.text)
    for (const omitted of [
      '悦聚氛围卡',
      '聚会续航力',
      '氛围技能',
      '氛围天赋',
      '氛围编号 #1',
      '#000123',
    ]) {
      expect(missingText).not.toContain(omitted)
    }
  })

  it('renders rank and serial independently instead of reserving an empty half-strip', async () => {
    const serialOnly = await render({ archetypeRank: undefined, serialNumber: 'SERIAL-42' })
    expect(serialOnly.texts.map((call) => call.text)).toContain('#SERIAL-42')
    expect(serialOnly.texts.some((call) => call.text.startsWith('氛围编号'))).toBe(false)

    const rankOnly = await render({ archetypeRank: 3, serialNumber: undefined })
    expect(rankOnly.texts.map((call) => call.text)).toContain('氛围编号 #3')
    expect(rankOnly.texts.some((call) => call.text.includes('SERIAL'))).toBe(false)
  })

  it('bounds empty, maximum CJK, unbroken ASCII and over-cap text without overlap', async () => {
    const { texts } = await render({
      archetype: '超长氛围命格'.repeat(24),
      confidenceLabel: '典型'.repeat(100),
      rarityLabel: `稀有度 ${'12%'.repeat(100)}`,
      tagline: 'CJK'.repeat(200),
      activeSkillTitle: 'A'.repeat(500),
      activeSkillEffect: '技'.repeat(500),
      passiveSkillTitle: 'B'.repeat(500),
      passiveSkillEffect: '能'.repeat(500),
      archetypeRank: 999999999,
      serialNumber: `SERIAL-${'9'.repeat(400)}`,
      shareLine: 'SHARE'.repeat(200),
      energyLevel: 10000,
    })

    for (const call of texts) {
      if (!call.text) continue
      const bounds = horizontalBounds(call)
      expect(bounds.left, `left bound for ${call.text}`).toBeGreaterThanOrEqual(LEFT_EDGE - 1)
      expect(bounds.right, `right bound for ${call.text}`).toBeLessThanOrEqual(RIGHT_EDGE + 1)
    }
    expect(texts.map((call) => call.text)).toContain('100%')

    const brand = texts.find((call) => call.text === 'JOYJOIN · 悦聚')
    const typicality = texts.find((call) => call.y === 102 && call.fontSize === 22)
    expect(brand).toBeDefined()
    expect(typicality).toBeDefined()
    expect(horizontalBounds(typicality as TextCall).right + 16)
      .toBeLessThanOrEqual(horizontalBounds(brand as TextCall).left)

    const provenance = texts.find((call) => call.text.startsWith('图鉴 · '))
    const rarity = texts.find((call) => call.y === 420)
    expect(provenance).toBeDefined()
    expect(rarity).toBeDefined()
    expect(horizontalBounds(rarity as TextCall).right + 16)
      .toBeLessThanOrEqual(horizontalBounds(provenance as TextCall).left)
  })

  it('preserves canonical full-data copy and geometry', async () => {
    const { texts, rects, ctx } = await render()
    expect(texts.map((call) => call.text)).toEqual(expect.arrayContaining([
      '典型开心柯基',
      '开心柯基',
      '气氛点火器',
      '快乐接收站',
      '长按识别小程序码，3 分钟测出你的命格',
    ]))
    expect(findRect(rects, CONTENT_WIDTH, 48).y).toBe(1036)
    expect(findRect(rects, CONTENT_WIDTH, 216).y).toBe(1136)
    expect(texts.find((call) => call.text === '聚会续航力')?.y).toBe(640)
    expect(texts.find((call) => call.text === '气氛点火器')?.y).toBe(854)
    expect(ctx.drawImage).toHaveBeenCalledTimes(2)
  })
})
