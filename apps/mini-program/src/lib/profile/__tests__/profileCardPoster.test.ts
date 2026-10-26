import { describe, expect, it, vi } from 'vitest'
import {
  drawProfileCardPosterContent,
  fitCanvasTextToWidth,
  planPortraitLayers,
  PROFILE_CARD_NO_QR_COPY,
  PROFILE_CARD_QR_COPY,
  type ProfileCardPosterInput,
} from '../profileCardPoster'
import type { EquipmentItem, EquipmentOutfit } from '../equipmentApi'

// P2-3 (PM memo §8): the rebuilt card poster must never bake privacy fields
// (city/age/interests/bio/referral) or incentive wording. The input type
// structurally excludes them; this spy test guards the draw path itself.

function makeCtxSpy() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setFillStyle: vi.fn(),
    setStrokeStyle: vi.fn(),
    setLineWidth: vi.fn(),
    setFontSize: vi.fn(),
    setTextAlign: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 120 })),
    fillText: vi.fn(),
    drawImage: vi.fn(),
  }
}

const BASE_INPUT: ProfileCardPosterInput = {
  displayName: '小悦',
  archetypeName: '开心柯基',
  familyName: '气氛组联盟',
  growthValue: 128,
  pixelArchetypeId: 'corgi',
  qrCodeImagePath: '/tmp/qr.png',
}

// B2 (pre-ship 2026-10-26): the portrait is a 2:3 well (320×480 at x 380/y 150),
// and every layer carries its own rect instead of one shared square.
const BODY_LAYER = { url: '/tmp/body.webp', left: 380, top: 150, width: 320, height: 480 }

describe('drawProfileCardPosterContent (P2-3)', () => {
  it('renders identity + family + 潮流值 + the locked QR caption', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, BASE_INPUT, [BODY_LAYER])

    const texts = ctx.fillText.mock.calls.map((call) => String(call[0]))
    expect(texts).toContain('小悦')
    expect(texts).toContain('气氛组联盟')
    expect(texts).toContain('潮流值 128')
    expect(texts).toContain(PROFILE_CARD_QR_COPY)
    expect(texts).toContain('JoyJoin 悦聚')
    // Portrait stack + QR drawn.
    expect(ctx.drawImage).toHaveBeenCalledWith('/tmp/body.webp', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
    expect(ctx.drawImage).toHaveBeenCalledWith('/tmp/qr.png', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
  })

  it('QR band degrades to copy-only when the QR image is absent (fail-open)', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, { ...BASE_INPUT, qrCodeImagePath: undefined }, [])

    const texts = ctx.fillText.mock.calls.map((call) => String(call[0]))
    // R1 (UIUX 2026-10-26): no QR → never render a scan instruction.
    expect(texts).toContain(PROFILE_CARD_NO_QR_COPY)
    expect(texts).not.toContain(PROFILE_CARD_QR_COPY)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('never draws privacy or incentive strings', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, BASE_INPUT, [BODY_LAYER])

    const allText = ctx.fillText.mock.calls.map((call) => String(call[0])).join('\n')
    // Banned on the card: privacy fields, referral hooks, incentive wording.
    for (const banned of ['岁', '城市:', '来自', '邀请码', '推荐码', '领取', '立减', '免费', '扫码领']) {
      expect(allText).not.toContain(banned)
    }
  })

  it('skips empty portrait layers and tolerates missing family/growth', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, {
      displayName: '小悦',
      archetypeName: null,
      familyName: null,
      growthValue: null,
    }, [])

    const texts = ctx.fillText.mock.calls.map((call) => String(call[0]))
    expect(texts).toContain('小悦')
    expect(texts).not.toContain('潮流值 0')
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
})

describe('fitCanvasTextToWidth (R2, UIUX 2026-10-26)', () => {
  const makeMeasureCtx = () => ({
    // 20px per code point makes the width math explicit in assertions.
    measureText: vi.fn((text?: string) => ({ width: Array.from(String(text)).length * 20 })),
  })

  it('returns the name unchanged when it fits', () => {
    const ctx = makeMeasureCtx()
    expect(fitCanvasTextToWidth(ctx as never, '小悦', 888)).toBe('小悦')
  })

  it('ellipsizes long names and keeps the result within max width', () => {
    const ctx = makeMeasureCtx()
    const result = fitCanvasTextToWidth(ctx as never, '小'.repeat(100), 200)
    expect(result.endsWith('…')).toBe(true)
    expect(Array.from(result).length * 20).toBeLessThanOrEqual(200)
    expect(result.length).toBeLessThan(100)
  })

  it('never splits a surrogate pair when trimming emoji', () => {
    const ctx = makeMeasureCtx()
    const result = fitCanvasTextToWidth(ctx as never, '👪'.repeat(100), 200)
    expect(result.endsWith('…')).toBe(true)
    for (const ch of Array.from(result)) {
      const codePoint = ch.codePointAt(0) ?? 0
      expect(codePoint < 0xd800 || codePoint > 0xdfff).toBe(true)
    }
  })
})

describe('drawProfileCardPosterContent name fitting (R2)', () => {
  it('ellipsizes an over-long displayName instead of overrunning the card', () => {
    const ctx = makeCtxSpy()
    ctx.measureText.mockImplementation((text?: string) => ({
      width: Array.from(String(text)).length * 20,
    }))
    const longName = '小悦'.repeat(50)
    drawProfileCardPosterContent(ctx as never, { ...BASE_INPUT, displayName: longName }, [])

    const texts = ctx.fillText.mock.calls.map((call) => String(call[0]))
    expect(texts).not.toContain(longName)
    expect(texts.some((text) => text.endsWith('…'))).toBe(true)
  })
})

// Pre-ship step 5 (2026-10-26) B1/B2/C1: the exported card must mirror the
// on-screen PixelAvatarComposite — fullStarter only for the exact default
// outfit, otherwise body + placement-positioned layers inside a 2:3 well.
const SLOTS = ['top', 'bottom', 'shoes', 'accessory'] as const

function item(slot: (typeof SLOTS)[number], assetKey: string): EquipmentItem {
  return { id: `${slot}:${assetKey}`, slot, assetKey, name: slot, rarity: 'common' } as unknown as EquipmentItem
}

function outfitWith(top: string | null, bottom: string | null, shoes: string | null, accessory: string | null): EquipmentOutfit {
  return {
    topItemId: top,
    bottomItemId: bottom,
    shoesItemId: shoes,
    accessoryItemId: accessory,
    version: 1,
  } as unknown as EquipmentOutfit
}

function bundle(items: EquipmentItem[]): Map<string, EquipmentItem> {
  return new Map(items.map((entry) => [entry.id, entry]))
}

const STARTER = (slot: (typeof SLOTS)[number]) => `equipment/starter/corgi/${slot}/v1`

describe('planPortraitLayers (pre-ship B1/B2/C1)', () => {
  it('keeps the starter full-look for the exact default outfit (one full-bleed layer)', () => {
    const items = SLOTS.map((slot) => item(slot, STARTER(slot)))
    const outfit = outfitWith(...(SLOTS.map((slot) => items.find((entry) => entry.slot === slot)!.id) as [string, string, string, string]))

    const layers = planPortraitLayers({ ...BASE_INPUT, outfit, itemsById: bundle(items) })

    expect(layers).toHaveLength(1)
    expect(layers[0].url).toContain('full-starter')
    expect(layers[0]).toMatchObject({ left: 380, top: 150, width: 320, height: 480 })
  })

  it('draws the base body plus placement rects once a non-starter item is equipped', () => {
    // One real starter garment + three catalogue items with no bundled art:
    // enough to leave the starter look, and enough to resolve one layer.
    const top = item('top', STARTER('top'))
    const outfit = outfitWith(top.id, 'pool-bottom', 'pool-shoes', 'pool-accessory')
    const items = bundle([top])

    const layers = planPortraitLayers({ ...BASE_INPUT, outfit, itemsById: items })

    expect(layers.length).toBeGreaterThan(1)
    expect(layers[0].url).toContain('body-front')
    // B2: the body fills the 2:3 well, never the old 320×320 square.
    expect(layers[0]).toMatchObject({ left: 380, top: 150, width: 320, height: 480 })

    for (const layer of layers.slice(1)) {
      // C1: layers sit on their authored placement rect, inside the well.
      expect(layer.left).toBeGreaterThanOrEqual(380)
      expect(layer.top).toBeGreaterThanOrEqual(150)
      expect(layer.left + layer.width).toBeLessThanOrEqual(700)
      expect(layer.top + layer.height).toBeLessThanOrEqual(630)
      expect(layer.width).toBeLessThan(320)
      expect(layer.height).toBeLessThan(480)
    }
  })

  it('falls back to the starter look when no outfit payload is available', () => {
    const layers = planPortraitLayers(BASE_INPUT)

    expect(layers).toHaveLength(1)
    expect(layers[0].url).toContain('full-starter')
  })

  it('centres the square archetype artwork when pixel avatars are unavailable', () => {
    const layers = planPortraitLayers({ displayName: '小悦', archetypeAsset: '/tmp/corgi.webp' })

    expect(layers).toHaveLength(1)
    expect(layers[0]).toMatchObject({ url: '/tmp/corgi.webp', left: 380, top: 230, width: 320, height: 320 })
  })

  it('returns no layers when there is nothing to draw', () => {
    expect(planPortraitLayers({ displayName: '小悦' })).toEqual([])
  })
})
