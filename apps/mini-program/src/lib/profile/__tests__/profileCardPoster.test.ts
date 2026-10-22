import { describe, expect, it, vi } from 'vitest'
import {
  drawProfileCardPosterContent,
  PROFILE_CARD_QR_COPY,
  type ProfileCardPosterInput,
} from '../profileCardPoster'

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

describe('drawProfileCardPosterContent (P2-3)', () => {
  it('renders identity + family + 潮流值 + the locked QR caption', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, BASE_INPUT, ['/tmp/body.webp'])

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
    expect(texts).toContain(PROFILE_CARD_QR_COPY)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('never draws privacy or incentive strings', () => {
    const ctx = makeCtxSpy()
    drawProfileCardPosterContent(ctx as never, BASE_INPUT, ['/tmp/body.webp'])

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
