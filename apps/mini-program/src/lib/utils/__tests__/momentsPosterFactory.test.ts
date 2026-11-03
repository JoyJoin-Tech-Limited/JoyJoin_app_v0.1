import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Taro from '@tarojs/taro'
import {
  generateGroupRevealPoster,
  generatePersonalitySquarePoster,
  PERSONALITY_SQUARE_CANVAS_ID,
  type PersonalitySquarePosterInput,
} from '../momentsPosterFactory'

const QR_PATH = 'tmp://referral-qr.png'
const SQUARE_SIZE = 750
const CONTENT_LEFT = 64
const CONTENT_RIGHT = 686

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
}))

vi.mock('../canvasHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../canvasHelpers')>()
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

vi.mock('@tarojs/taro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tarojs/taro')>()
  const api = {
    ...actual,
    createCanvasContext: vi.fn(() => recorded.ctx),
    getImageInfo: vi.fn().mockResolvedValue({ width: 600, height: 600, path: 'tmp://archetype.png' }),
    canvasToTempFilePath: vi.fn().mockResolvedValue({ tempFilePath: 'tmp://personality-square.png' }),
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

function buildInput(overrides: Partial<PersonalitySquarePosterInput> = {}): PersonalitySquarePosterInput {
  return {
    archetype: '开心柯基',
    tagline: '把热闹带给每一桌',
    shareLine: '来悦聚测测你的氛围命格',
    archetypeAsset: 'https://cdn.example.com/corgi.webp',
    archetypeAssetPng: 'https://cdn.example.com/corgi.png',
    preResolvedImagePath: 'tmp://archetype.png',
    accentColor: '#8b5cf6',
    accentSoft: '#f4f0ff',
    typicalityChip: '典型开心柯基',
    traitEntries: [
      { label: '外向', value: 88 },
      { label: '亲和', value: 82 },
      { label: '稳定', value: 76 },
    ],
    energyLevel: 88,
    skillSet: {
      activeSkill: { name: '气氛点火器' },
      passiveSkill: { name: '快乐接收站' },
    },
    archetypeRank: 1,
    serialNumber: '#000123',
    qrCodeImagePath: QR_PATH,
    ...overrides,
  }
}

async function render(
  overrides: Partial<PersonalitySquarePosterInput> = {},
  options: { throwOnQr?: boolean } = {},
) {
  recorded.rects.length = 0
  const mock = createMockContext(options)
  const output = await generatePersonalitySquarePoster(buildInput(overrides))
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

describe('personality square poster — AC-03 QR and export lifecycle', () => {
  beforeEach(() => {
    recorded.exportCanvas.mockReset().mockResolvedValue('tmp://personality-square.png')
    recorded.unlinkSync.mockReset()
    recorded.rects.length = 0
  })

  it('ends in a real centered copy-only band when QR drawImage throws', async () => {
    const { texts, rects, output } = await render({}, { throwOnQr: true })

    expect(output).toBe('tmp://personality-square.png')
    expect(texts.map((call) => call.text)).toContain('微信搜索「悦聚」，3 分钟开测')
    expect(texts.some((call) => call.text.includes('长按识别'))).toBe(false)
    expect(texts.find((call) => call.text === '你是哪一种氛围命格？')?.align).toBe('center')

    const bandPaints = rects
      .map((rect, index) => ({ rect, index }))
      .filter(({ rect }) => rect.kind === 'fill' && rect.width === 622 && rect.height === 124)
    expect(bandPaints.length).toBeGreaterThanOrEqual(2)
    const finalBandIndex = bandPaints[bandPaints.length - 1].index
    expect(rects.slice(finalBandIndex + 1).some((rect) => rect.width === 96 && rect.height === 96)).toBe(false)

    expect(recorded.exportCanvas).toHaveBeenCalledWith(
      PERSONALITY_SQUARE_CANVAS_ID,
      SQUARE_SIZE,
      SQUARE_SIZE,
      [2, 1],
      { autoCleanup: false },
    )
  })

  it('B2: unlinks a late timed-out export once without canvas or resolve side effects', async () => {
    vi.useFakeTimers()
    let resolveLateExport!: (path: string) => void
    const lateExport = new Promise<string>((resolve) => { resolveLateExport = resolve })
    recorded.exportCanvas.mockReturnValue(lateExport)
    const { ctx } = createMockContext()

    try {
      const generation = generatePersonalitySquarePoster(buildInput())
      await vi.advanceTimersByTimeAsync(0)
      expect(recorded.exportCanvas).toHaveBeenCalledTimes(1)

      const rejection = expect(generation).rejects.toThrow('Canvas draw timed out')
      await vi.advanceTimersByTimeAsync(15_000)
      await rejection
      expect(recorded.unlinkSync).not.toHaveBeenCalled()

      ctx.clearRect.mockClear()
      resolveLateExport('tmp://late-square.png')
      await vi.advanceTimersByTimeAsync(0)

      expect(recorded.unlinkSync).toHaveBeenCalledTimes(1)
      expect(recorded.unlinkSync).toHaveBeenCalledWith('tmp://late-square.png')
      expect(ctx.clearRect).not.toHaveBeenCalled()
      await expect(generation).rejects.toThrow('Canvas draw timed out')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})

describe('personality square poster — AC-03 optional flow and bounds', () => {
  beforeEach(() => {
    recorded.exportCanvas.mockReset().mockResolvedValue('tmp://personality-square.png')
  })

  it('omits missing typicality, traits, energy, skills, rank and serial', async () => {
    const { texts } = await render({
      typicalityChip: undefined,
      traitEntries: [],
      energyLevel: undefined,
      skillSet: {
        activeSkill: { name: '' },
        passiveSkill: { name: '   ' },
      },
      archetypeRank: undefined,
      serialNumber: undefined,
    })

    const drawn = texts.map((call) => call.text)
    for (const omitted of [
      '悦聚氛围卡',
      '外向',
      '能量',
      '主动技',
      '被动技',
      '气氛点火器',
      '快乐接收站',
      '#000123',
    ]) {
      expect(drawn).not.toContain(omitted)
    }
    expect(drawn.some((text) => text.startsWith('氛围编号'))).toBe(false)
  })

  it('collapses the energy slot instead of leaving a blank gap before skills', async () => {
    const full = await render()
    const withoutEnergy = await render({ energyLevel: undefined })
    const fullSkill = full.texts.find((call) => call.text === '气氛点火器')
    const compactSkill = withoutEnergy.texts.find((call) => call.text === '气氛点火器')
    expect(fullSkill).toBeDefined()
    expect(compactSkill).toBeDefined()
    expect((compactSkill as TextCall).y).toBeLessThan((fullSkill as TextCall).y)
  })

  it('bounds empty, maximum CJK, unbroken ASCII and over-cap values without CTA collision', async () => {
    const { texts, rects } = await render({
      archetype: '超长氛围命格'.repeat(24),
      typicalityChip: '典型'.repeat(100),
      tagline: 'CJK'.repeat(200),
      traitEntries: [
        { label: '非'.repeat(100), value: 10000 },
        { label: 'A'.repeat(200), value: -100 },
        { label: '稳'.repeat(100), value: 50 },
        { label: '第四行不应出现', value: 50 },
      ],
      energyLevel: 10000,
      skillSet: {
        activeSkill: { name: 'A'.repeat(500) },
        passiveSkill: { name: '被'.repeat(500) },
      },
      archetypeRank: 999999999,
      serialNumber: `SERIAL-${'9'.repeat(400)}`,
    })

    for (const call of texts) {
      if (!call.text) continue
      const bounds = horizontalBounds(call)
      expect(bounds.left, `left bound for ${call.text}`).toBeGreaterThanOrEqual(CONTENT_LEFT - 1)
      expect(bounds.right, `right bound for ${call.text}`).toBeLessThanOrEqual(CONTENT_RIGHT + 1)
    }
    const drawn = texts.map((call) => call.text)
    expect(drawn).not.toContain('10000')
    expect(drawn).not.toContain('第四行不应出现')
    expect(drawn).toContain('100%')

    const cta = findRect(rects, 622, 124)
    const ctaCopy = new Set(['你是哪一种氛围命格？', '长按识别小程序码，3 分钟开测'])
    for (const call of texts) {
      if (call.y < 300 || ctaCopy.has(call.text)) continue
      expect(call.y + call.fontSize, `CTA collision for ${call.text}`).toBeLessThanOrEqual(cta.y - 4)
    }
  })

  it('preserves the longer non-typical canonical chip without ellipsizing it', async () => {
    const { texts } = await render({ typicalityChip: '非典型开心柯基' })
    expect(texts.map((call) => call.text)).toContain('非典型开心柯基')
  })

  it('preserves canonical full-data copy and geometry', async () => {
    const { texts, rects, ctx } = await render()
    expect(texts.map((call) => call.text)).toEqual(expect.arrayContaining([
      '典型开心柯基',
      '开心柯基',
      '气氛点火器',
      '快乐接收站',
      '长按识别小程序码，3 分钟开测',
    ]))
    expect(texts.find((call) => call.text === '把热闹带给每一桌')?.y).toBe(332)
    expect(findRect(rects, 622, 124).y).toBe(562)
    expect(ctx.drawImage).toHaveBeenCalledTimes(2)
  })
})

describe('group reveal — isolated from personality-square hardening', () => {
  it('keeps the existing group export path and canonical content', async () => {
    vi.useFakeTimers()
    recorded.exportCanvas.mockReset().mockResolvedValue('tmp://personality-square.png')
    recorded.rects.length = 0
    const { texts } = createMockContext()
    try {
      const output = await generateGroupRevealPoster({
        poolTitle: '周末饭局',
        eventType: '饭局',
        dateTimeText: '周六 18:00',
        members: [],
      })
      expect(output).toBe('tmp://personality-square.png')
      expect(texts.map((call) => call.text)).toContain('同好小组集结完毕')
      expect(recorded.exportCanvas).not.toHaveBeenCalled()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})
