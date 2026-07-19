import { describe, expect, it } from 'vitest'
import {
  drawMingCard,
  MING_CARD_HEIGHT,
  MING_CARD_LAYOUT,
  MING_CARD_WIDTH,
  type MingCardInput,
  type MingCardPainter,
} from '@shared/ui/mingCard'

/**
 * Regression tests for slice 4 (2026-07-19): the shared 命格卡 generator.
 * Verifies layout invariants against a recording fake painter — platform
 * adapters (mini-program CanvasContext, H5 ctx2d) stay thin by contract.
 */

interface Call { fn: string; args: unknown[] }

function fakePainter() {
  const calls: Call[] = []
  const record = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }) }
  const painter: MingCardPainter = {
    fillRoundedRect: record('fillRoundedRect'),
    strokeRoundedRect: record('strokeRoundedRect'),
    fillText: record('fillText'),
    clipRoundedRect: record('clipRoundedRect'),
    drawImageCover: record('drawImageCover'),
    save: record('save'),
    restore: record('restore'),
  }
  return { painter, calls }
}

const BASE: MingCardInput = {
  name: '开心柯基',
  badge: '典型',
  keywords: ['热情', '治愈', '社交'],
  blendLine: '隐约有狐狸的影子',
  accent: '#CB9268',
  index: 1,
}

describe('drawMingCard', () => {
  it('draws name, badge, blend line, set footer, and all keyword pills', () => {
    const { painter, calls } = fakePainter()
    drawMingCard(painter, BASE)
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string)
    expect(texts).toContain('开心柯基')
    expect(texts).toContain('典型')
    expect(texts).toContain('隐约有狐狸的影子')
    expect(texts).toContain('JOYJOIN · No.01/12')
    for (const kw of BASE.keywords) expect(texts).toContain(kw)
  })

  it('keeps every drawn region inside the canvas bounds', () => {
    const { painter, calls } = fakePainter()
    drawMingCard(painter, { ...BASE, artImagePath: '/tmp/art.webp', artImageSize: { width: 694, height: 663 } })
    for (const c of calls) {
      if (c.fn === 'fillRoundedRect' || c.fn === 'strokeRoundedRect' || c.fn === 'clipRoundedRect') {
        const [x, y, w, h] = c.args as number[]
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(MING_CARD_WIDTH)
        expect(y + h).toBeLessThanOrEqual(MING_CARD_HEIGHT)
      }
    }
  })

  it('clips and cover-draws art only when image input is complete', () => {
    const withArt = fakePainter()
    drawMingCard(withArt.painter, { ...BASE, artImagePath: '/tmp/art.webp', artImageSize: { width: 694, height: 663 } })
    expect(withArt.calls.some(c => c.fn === 'clipRoundedRect')).toBe(true)
    expect(withArt.calls.some(c => c.fn === 'drawImageCover')).toBe(true)

    const noArt = fakePainter()
    drawMingCard(noArt.painter, BASE)
    expect(noArt.calls.some(c => c.fn === 'drawImageCover')).toBe(false)
  })

  it('caps keyword pills at 3 and omits blend line when absent', () => {
    const { painter, calls } = fakePainter()
    drawMingCard(painter, { ...BASE, keywords: ['一', '二', '三', '四'], blendLine: undefined })
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string)
    expect(texts).toContain('一')
    expect(texts).toContain('三')
    expect(texts).not.toContain('四')
    expect(texts).not.toContain('隐约有狐狸的影子')
  })

  it('pads set number to No.0X/12 for single-digit indices', () => {
    const { painter, calls } = fakePainter()
    drawMingCard(painter, { ...BASE, index: 12 })
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string)
    expect(texts).toContain('JOYJOIN · No.12/12')
  })

  it('art window matches the layout contract used by the WebGL foil mask', () => {
    // The spike's foil shader masks the sheen to the art window in UV space;
    // this pins the pixel region those UVs were derived from.
    expect(MING_CARD_LAYOUT.artWindow).toEqual({ x: 58, y: 200, w: 628, h: 620, r: 26 })
  })
})
