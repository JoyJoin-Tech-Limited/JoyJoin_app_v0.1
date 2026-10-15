import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import { logInfo, logWarn } from '../../../../lib/utils/logger'
import {
  toCanvasRGBA,
  resolveImagePath as resolveImagePathShared,
  clampPercent,
  createMetallicGold,
  drawRoundedRect,
  fillRoundedRect,
  strokeRoundedRect,
  clipRoundedRect,
  drawBadge,
  drawTextBlock,
  exportCanvasWithRetry,
} from '../../../../lib/utils/canvasHelpers'
import { getWindowInfoCompat } from '../../../../lib/utils/systemInfo'

// ── Canvas dimensions ─────────────────────────────────────────────
const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1560

// ── Card geometry ─────────────────────────────────────────────────
const OUTER_MARGIN = 28
const CARD_RADIUS = 40
const CARD_X = OUTER_MARGIN
const CARD_Y = OUTER_MARGIN
const CARD_WIDTH = POSTER_WIDTH - OUTER_MARGIN * 2
const CARD_HEIGHT = POSTER_HEIGHT - OUTER_MARGIN * 2
const CARD_RIGHT = CARD_X + CARD_WIDTH
const CARD_BOTTOM = CARD_Y + CARD_HEIGHT

// Single outer-content grid line (left edge of all major blocks)
const LEFT_EDGE = 72
const RIGHT_EDGE = CARD_RIGHT - 72
const CONTENT_WIDTH = RIGHT_EDGE - LEFT_EDGE

// ── Layout rhythm (2026-10-14 redesign — mirrors the in-app reveal card
//    vertical rhythm: chrome → hero → rank → energy → skills → stamp →
//    friend CTA band → footer. All values on the 4px grid; interior bottom
//    padding ≈ 60px vs 52px top — bottom reads slightly airier by design.) ──
const CHROME_Y = 80
const CHROME_HEIGHT = 44

const PORTRAIT_X = 104
const PORTRAIT_Y = 180
const PORTRAIT_SIZE = 300

const HERO_TEXT_X = 472
const HERO_EYEBROW_Y = 204
const HERO_NAME_Y = 232
const HERO_NAME_SIZE = 64
const HERO_TAGLINE_Y = 324
const HERO_TAGLINE_LINE_HEIGHT = 44
const HERO_RARITY_Y = 420

const RANK_STRIP_Y = 540
const RANK_STRIP_HEIGHT = 44

const ENERGY_LABEL_Y = 640
const ENERGY_TRACK_Y = 684
const ENERGY_TRACK_HEIGHT = 20
const ENERGY_HINT_Y = 718

const SKILL_Y = 780
const SKILL_CARD_HEIGHT = 204
const SKILL_CARD_RADIUS = 28
const SKILL_CARD_GAP = 16

const STAMP_Y = 1036
const STAMP_HEIGHT = 48

const CTA_BAND_Y = 1136
const CTA_BAND_HEIGHT = 216
const CTA_BAND_RADIUS = 28
const CTA_QR_CHIP_SIZE = 168
const CTA_QR_INSET = 14

const FOOTER_DIVIDER_Y = 1374
const FOOTER_SHARELINE_Y = 1404
const FOOTER_LOCKUP_Y = 1448

// ── Inline color tokens (to promote to CANVAS_PALETTE when convenient) ─
const COLOR_ENERGY_AMBER = '#fbbf24'
const COLOR_ENERGY_ORANGE = '#f97316'
const COLOR_ENERGY_RED = '#ef4444'
const COLOR_RANK_LEFT_BG = 'rgba(255, 255, 255, 0.92)'
const COLOR_RANK_LEFT_BORDER = 'rgba(139, 92, 246, 0.15)'
const COLOR_RANK_RIGHT_BG = 'rgba(255, 248, 214, 0.94)'
const COLOR_RANK_RIGHT_BORDER = 'rgba(180, 140, 40, 0.15)'
const COLOR_RANK_RIGHT_TEXT = '#7a5a09'
const COLOR_BRAND_PURPLE = '#8b5cf6'
const COLOR_CTA_TEXT = '#fff7d6'
const COLOR_CTA_TEXT_SOFT = 'rgba(255, 247, 214, 0.85)'
const COLOR_CTA_DECOR = 'rgba(255, 255, 255, 0.09)'
/** In-app card gradient middle stop (FinalStage CARD_GRADIENT_MID). */
const CARD_GRADIENT_MID = '#fff8ee'
const CARD_GRADIENT_END = 'rgba(255, 255, 255, 0.98)'

export const PERSONALITY_SHARE_POSTER_CANVAS_ID = 'personality-share-poster-canvas'

export interface PersonalitySharePosterInput {
  archetype: string
  tagline: string
  shareLine: string
  accentColor: string
  accentSoft: string
  archetypeAsset: string
  archetypeAssetPng: string
  preResolvedImagePath?: string
  /** Dark typicality chip text (e.g. 典型夸夸仓鼠) — the in-app card's top badge. */
  confidenceLabel?: string
  rarityLabel?: string
  activeSkillTitle: string
  activeSkillEffect: string
  passiveSkillTitle: string
  passiveSkillEffect: string
  energyLevel?: number
  archetypeRank?: number
  serialNumber?: string
  /**
   * Local temp path of the referral-attributed mini-program code (server
   * route POST /api/personality/share-qrcode). When absent, the CTA band
   * renders a copy-only variant — never block poster generation on this.
   */
  qrCodeImagePath?: string
}

interface ImageDimensions {
  width: number
  height: number
}

/**
 * Resolve actual pixel dimensions of a local image path.
 * Falls back to a safe 3:4 portrait assumption if getImageInfo fails.
 */
async function resolveImageDimensions(imagePath: string | undefined): Promise<ImageDimensions> {
  if (!imagePath) return { width: 600, height: 800 }
  try {
    const info = await Taro.getImageInfo({ src: imagePath })
    if (info.width && info.height) return { width: info.width, height: info.height }
  } catch { /* fall back to default */ }
  return { width: 600, height: 800 }
}

/**
 * Create a holographic rainbow sheen gradient overlay.
 */
function createHolographicSheen(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity = 0.18,
): Taro.CanvasGradient {
  // A single diagonal light sweep, not a full-card wash (2026-10-14 review):
  // transparent edges → warm champagne/pink/lavender band → transparent. A
  // uniform tint reads as a stain on the warm card; a confined band reads as
  // light catching foil. Stays in the warm spectrum — turquoise over the
  // cream base renders green.
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  const transparent = 'rgba(255, 255, 255, 0)'
  gradient.addColorStop(0, transparent)
  gradient.addColorStop(0.3, transparent)
  gradient.addColorStop(0.38, `rgba(255, 223, 186, ${opacity})`)
  gradient.addColorStop(0.45, `rgba(255, 200, 220, ${opacity})`)
  gradient.addColorStop(0.52, `rgba(230, 230, 250, ${opacity * 0.9})`)
  gradient.addColorStop(0.6, transparent)
  gradient.addColorStop(1, transparent)
  return gradient
}

/**
 * Draw foil sparkles — deliberate glints, not dust (2026-10-14 refinement):
 * most are very faint; a sparse set of 4-point star glints carries the foil
 * catch-light so the texture reads premium at a glance.
 */
function drawFoilSparkles(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  seed = 42,
): void {
  ctx.save()
  let s = seed
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }

  const sparkleCount = Math.floor((width * height) / 26000)
  for (let i = 0; i < sparkleCount; i++) {
    const sx = x + rand() * width
    const sy = y + rand() * height
    const isStar = rand() > 0.78
    const size = isStar ? 1.8 + rand() * 1.8 : 0.8 + rand() * 1.4
    const alpha = isStar ? 0.3 + rand() * 0.3 : 0.08 + rand() * 0.16

    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.setFillStyle(`rgba(255, 255, 255, ${alpha})`)
    ctx.fill()

    if (isStar) {
      ctx.beginPath()
      ctx.moveTo(sx - size * 2.6, sy)
      ctx.lineTo(sx + size * 2.6, sy)
      ctx.moveTo(sx, sy - size * 2.6)
      ctx.lineTo(sx, sy + size * 2.6)
      ctx.setStrokeStyle(`rgba(255, 248, 220, ${alpha * 0.6})`)
      ctx.setLineWidth(0.6)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/**
 * Draw the in-app card's corner light catches (2026-10-14 refinement):
 * a soft white glint top-right and a warm cream glow bottom-left, clipped to
 * the card. Radial gradients are wrapped fail-open — older base libraries
 * that lack createRadialGradient simply render no glint.
 */
function drawCornerShines(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.clip()

  const drawGlow = (
    cx: number,
    cy: number,
    r: number,
    inner: string,
  ): void => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const glow = (ctx as any).createRadialGradient(cx, cy, 0, cx, cy, r)
      glow.addColorStop(0, inner)
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.setFillStyle(glow)
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    } catch {
      // No radial-gradient support — skip the glint (cosmetic only).
    }
  }

  drawGlow(x + width - 70, y + 56, 260, 'rgba(255, 255, 255, 0.5)')
  drawGlow(x + 64, y + height - 96, 230, 'rgba(255, 248, 220, 0.45)')

  ctx.restore()
}

/**
 * Draw a subtle vignette around the card edges for depth.
 */
function drawVignette(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.clip()

  let vignette: Taro.CanvasGradient
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vignette = (ctx as any).createRadialGradient(
      x + width / 2, y + height / 2, Math.min(width, height) * 0.35,
      x + width / 2, y + height / 2, Math.min(width, height) * 0.75,
    )
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(60, 30, 90, 0.06)')
  } catch {
    vignette = ctx.createLinearGradient(x, y + height, x + width, y)
    vignette.addColorStop(0, 'rgba(60, 30, 90, 0)')
    vignette.addColorStop(1, 'rgba(60, 30, 90, 0.04)')
  }

  ctx.setFillStyle(vignette)
  ctx.fillRect(x, y, width, height)
  ctx.restore()
}

/**
 * Draw center-aligned text with letter tracking (canvas has no
 * letter-spacing). Used for the edition stamp — tracked caps-style CJK is
 * the classic foil-press premium cue. Falls back to a single fillText for
 * empty strings.
 */
function drawTrackedText(
  ctx: Taro.CanvasContext,
  text: string,
  x: number,
  centerY: number,
  fontSize: number,
  color: string,
  tracking: number,
  align: 'center' | 'left' = 'center',
): void {
  const chars = Array.from(text)
  if (chars.length === 0) return
  ctx.save()
  ctx.setFontSize(fontSize)
  ctx.setFillStyle(color)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  const widths = chars.map((c) => ctx.measureText(c).width)
  const totalWidth = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1)
  let cursorX = align === 'center' ? x - totalWidth / 2 : x
  chars.forEach((c, i) => {
    const charCenter = cursorX + widths[i] / 2
    ctx.fillText(c, charCenter, centerY)
    cursorX += widths[i] + tracking
  })
  ctx.restore()
}

/**
 * Draw the collectible edition stamp — full content width, mirroring the
 * in-app card's gold holo bar (限量氛围版).
 */
function drawHolographicStamp(ctx: Taro.CanvasContext): void {
  ctx.save()
  const barX = LEFT_EDGE
  const barY = STAMP_Y
  const barWidth = CONTENT_WIDTH
  const goldGrad = createMetallicGold(ctx, barX, barY, barX + barWidth, barY)
  fillRoundedRect(ctx, barX, barY, barWidth, STAMP_HEIGHT, STAMP_HEIGHT / 2, goldGrad)
  // Inset highlight line — fakes the engraved edge of a foil press stamp.
  strokeRoundedRect(ctx, barX + 5, barY + 5, barWidth - 10, STAMP_HEIGHT - 10, (STAMP_HEIGHT - 10) / 2, 'rgba(255, 255, 255, 0.55)', 1.5)
  ctx.restore()
  drawTrackedText(ctx, '限量氛围版', POSTER_WIDTH / 2, barY + STAMP_HEIGHT / 2, 22, '#4a2e00', 6)
}

/**
 * Friend-trigger CTA band — the acquisition layer of the poster. Solid brand
 * purple with decorative circles, a playful collection challenge on the left,
 * and the referral-attributed mini-program code in a white chip on the right.
 * Without a QR image (guests, flag off, WeChat failure) the band centers a
 * copy-only variant pointing at 微信搜索.
 */
function drawFriendCtaBand(ctx: Taro.CanvasContext, qrCodeImagePath?: string): void {
  const bandX = LEFT_EDGE
  const bandY = CTA_BAND_Y
  const bandW = CONTENT_WIDTH
  const bandH = CTA_BAND_HEIGHT

  // Dimensional purple: lighter top edge → deeper base, plus a hairline
  // inner border — reads as a raised button, not a flat rectangle.
  const bandGradient = ctx.createLinearGradient(bandX, bandY, bandX, bandY + bandH)
  bandGradient.addColorStop(0, '#9d75f9')
  bandGradient.addColorStop(0.55, COLOR_BRAND_PURPLE)
  bandGradient.addColorStop(1, '#7c3aed')
  fillRoundedRect(ctx, bandX, bandY, bandW, bandH, CTA_BAND_RADIUS, bandGradient)
  strokeRoundedRect(ctx, bandX + 2, bandY + 2, bandW - 4, bandH - 4, CTA_BAND_RADIUS - 2, 'rgba(255, 255, 255, 0.18)', 2)

  // Decorative circles (brand-safe ornament, same idea as the coupon banner).
  ctx.save()
  clipRoundedRect(ctx, bandX, bandY, bandW, bandH, CTA_BAND_RADIUS)
  ctx.setFillStyle(COLOR_CTA_DECOR)
  ctx.beginPath()
  ctx.arc(bandX + 60, bandY + 10, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bandX + bandW - 40, bandY + bandH - 10, 150, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const hasQr = Boolean(qrCodeImagePath)
  const textX = bandX + 48
  const headline = '12 种氛围命格，你是哪一种？'
  const instruction = hasQr
    ? '长按识别小程序码，3 分钟测出你的命格'
    : '微信搜索「悦聚」小程序，3 分钟开测'

  if (hasQr && qrCodeImagePath) {
    const chipX = bandX + bandW - 32 - CTA_QR_CHIP_SIZE
    const chipY = bandY + (bandH - CTA_QR_CHIP_SIZE) / 2
    ctx.save()
    ctx.setShadow(0, 8, 24, 'rgba(46, 16, 101, 0.35)')
    fillRoundedRect(ctx, chipX, chipY, CTA_QR_CHIP_SIZE, CTA_QR_CHIP_SIZE, 24, PALETTE.white)
    ctx.restore()
    // Gold rim ties the code chip to the card's collectible frame.
    strokeRoundedRect(ctx, chipX, chipY, CTA_QR_CHIP_SIZE, CTA_QR_CHIP_SIZE, 24, 'rgba(245, 200, 107, 0.9)', 2)
    try {
      ctx.drawImage(
        qrCodeImagePath,
        chipX + CTA_QR_INSET,
        chipY + CTA_QR_INSET,
        CTA_QR_CHIP_SIZE - CTA_QR_INSET * 2,
        CTA_QR_CHIP_SIZE - CTA_QR_INSET * 2,
      )
    } catch {
      logWarn('[sharePoster] QR drawImage failed; band keeps copy-only layout')
    }

    ctx.save()
    ctx.setFillStyle(COLOR_CTA_TEXT)
    ctx.setFontSize(32)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('middle')
    ctx.fillText(headline, textX, bandY + 84)
    ctx.setFillStyle(COLOR_CTA_TEXT_SOFT)
    ctx.setFontSize(21)
    ctx.fillText(instruction, textX, bandY + 138)
    ctx.restore()
    return
  }

  // Copy-only variant — vertically centered two-line block.
  ctx.save()
  ctx.setFillStyle(COLOR_CTA_TEXT)
  ctx.setFontSize(34)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(headline, bandX + bandW / 2, bandY + 82)
  ctx.setFillStyle(COLOR_CTA_TEXT_SOFT)
  ctx.setFontSize(22)
  ctx.fillText(instruction, bandX + bandW / 2, bandY + 138)
  ctx.restore()
}

/**
 * Draw the page background, card shell (warm archetype-tinted gradient —
 * mirrors the in-app reveal card's `linear-gradient(160deg, accentSoft,
 * #fff8ee, white)`), gold borders, foil sparkles, holographic sheen, and
 * vignette.
 */
function createCardBackground(ctx: Taro.CanvasContext, accentSoft: string): void {
  const pageGradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  pageGradient.addColorStop(0, PALETTE.pageBgStart)
  pageGradient.addColorStop(0.45, PALETTE.pageBgMid)
  pageGradient.addColorStop(1, PALETTE.pageBgEnd)
  ctx.setFillStyle(pageGradient)
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)

  // 160deg-ish (mostly vertical, slight rightward tilt) like the in-app card.
  const cardGradient = ctx.createLinearGradient(
    CARD_X,
    CARD_Y,
    CARD_X + CARD_WIDTH * 0.35,
    CARD_Y + CARD_HEIGHT,
  )
  cardGradient.addColorStop(0, toCanvasRGBA(accentSoft, 0.22))
  cardGradient.addColorStop(0.5, CARD_GRADIENT_MID)
  cardGradient.addColorStop(1, CARD_GRADIENT_END)
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, cardGradient)

  drawFoilSparkles(ctx, CARD_X + 8, CARD_Y + 8, CARD_WIDTH - 16, CARD_HEIGHT - 16, 7)

  const outerGold = createMetallicGold(ctx, CARD_X, CARD_Y, CARD_X + CARD_WIDTH, CARD_Y)
  strokeRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, outerGold as unknown as string, 6)
  // Bevel ridge hairline just inside the gold — the angled-edge illusion of
  // a real foil-stamped border.
  strokeRoundedRect(ctx, CARD_X + 5, CARD_Y + 5, CARD_WIDTH - 10, CARD_HEIGHT - 10, CARD_RADIUS - 5, 'rgba(120, 80, 20, 0.22)', 1)
  strokeRoundedRect(ctx, CARD_X + 10, CARD_Y + 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, CARD_RADIUS - 10, PALETTE.cardInnerBorder, 2)

  // Corner registration ticks — print-shop authenticity (4 quiet L marks).
  ctx.save()
  ctx.setStrokeStyle('rgba(180, 140, 40, 0.35)')
  ctx.setLineWidth(2)
  const tick = 20
  const inset = 24
  const corners: Array<[number, number, number, number]> = [
    [CARD_X + inset, CARD_Y + inset, 1, 1],
    [CARD_RIGHT - inset, CARD_Y + inset, -1, 1],
    [CARD_X + inset, CARD_BOTTOM - inset, 1, -1],
    [CARD_RIGHT - inset, CARD_BOTTOM - inset, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * tick, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * tick)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  drawRoundedRect(ctx, CARD_X + 2, CARD_Y + 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, CARD_RADIUS - 2)
  ctx.clip()
  const sheen = createHolographicSheen(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, 0.13)
  ctx.setFillStyle(sheen)
  ctx.fillRect(CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()

  drawCornerShines(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)

  drawVignette(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
}

/**
 * Draw the top chrome: the in-app card's dark typicality chip on the left
 * (典型夸夸仓鼠) and a quiet brand lockup on the right.
 */
function drawTopChrome(ctx: Taro.CanvasContext, confidenceLabel?: string): void {
  const chipText = confidenceLabel ?? '悦聚氛围卡'
  ctx.save()
  ctx.setFontSize(22)
  const chipWidth = Math.ceil(ctx.measureText(chipText).width) + 56
  ctx.restore()

  drawBadge(ctx, {
    text: chipText,
    x: LEFT_EDGE,
    y: CHROME_Y,
    width: chipWidth,
    height: CHROME_HEIGHT,
    fill: PALETTE.badgeDarkFill,
    color: PALETTE.badgeDarkText,
    fontSize: 22,
  })

  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(20)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('middle')
  ctx.fillText('JOYJOIN · 悦聚', RIGHT_EDGE, CHROME_Y + CHROME_HEIGHT / 2)
  ctx.restore()
}

/**
 * Compact share identity block — the in-app card's hero row rendered for
 * print: coin-framed portrait (white disc, purple shadow, metallic gold ring)
 * on the left; archetype name, tagline, and rarity line on the right.
 */
function drawCompactIdentity(
  ctx: Taro.CanvasContext,
  input: PersonalitySharePosterInput,
  archetypeImagePath: string | undefined,
  dimensions: ImageDimensions,
): void {
  const portraitRadius = PORTRAIT_SIZE / 2
  const portraitCenterX = PORTRAIT_X + portraitRadius
  const portraitCenterY = PORTRAIT_Y + portraitRadius

  ctx.save()
  ctx.setShadow(0, 16, 34, PALETTE.shadowPurple)
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius + 12, 0, Math.PI * 2)
  ctx.setFillStyle(PALETTE.white)
  ctx.fill()
  ctx.restore()

  // Metallic coin ring — the collectible frame around the portrait.
  const ringGradient = createMetallicGold(
    ctx,
    portraitCenterX - portraitRadius - 16,
    portraitCenterY - portraitRadius - 16,
    portraitCenterX + portraitRadius + 16,
    portraitCenterY + portraitRadius + 16,
  )
  ctx.save()
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius + 16, 0, Math.PI * 2)
  ctx.setStrokeStyle(ringGradient as unknown as string)
  ctx.setLineWidth(5)
  ctx.stroke()

  // Inner rim hairline — the double edge that reads "medal", not "sticker".
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius + 7, 0, Math.PI * 2)
  ctx.setStrokeStyle('rgba(180, 140, 40, 0.38)')
  ctx.setLineWidth(1.5)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius, 0, Math.PI * 2)
  ctx.clip()
  // Soft accent glow behind the character lifts it off the disc.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const halo = (ctx as any).createRadialGradient(
      portraitCenterX, portraitCenterY + 30, 10,
      portraitCenterX, portraitCenterY + 30, portraitRadius,
    )
    halo.addColorStop(0, toCanvasRGBA(input.accentColor, 0.3))
    halo.addColorStop(1, toCanvasRGBA(input.accentColor, 0))
    ctx.setFillStyle(halo)
    ctx.fillRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE)
  } catch {
    // No radial-gradient support — flat tint fallback.
    ctx.setFillStyle(toCanvasRGBA(input.accentColor, 0.16))
    ctx.fillRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE)
  }

  if (archetypeImagePath) {
    const scale = Math.max(PORTRAIT_SIZE / dimensions.width, PORTRAIT_SIZE / dimensions.height)
    const drawW = dimensions.width * scale
    const drawH = dimensions.height * scale
    try {
      ctx.drawImage(
        archetypeImagePath,
        PORTRAIT_X + (PORTRAIT_SIZE - drawW) / 2,
        PORTRAIT_Y + (PORTRAIT_SIZE - drawH) / 2,
        drawW,
        drawH,
      )
    } catch {
      logWarn('[sharePoster] compact portrait drawImage failed', { archetype: input.archetype })
    }
  }
  ctx.restore()

  // Eyebrow micro-caps — bilingual micro-typography is the packaging-code
  // signature of premium print (tracked, warm gold-brown, quiet).
  drawTrackedText(
    ctx,
    'JOYJOIN ARCHETYPE COLLECTION',
    HERO_TEXT_X,
    HERO_EYEBROW_Y + 8,
    15,
    COLOR_RANK_RIGHT_TEXT,
    2.5,
    'left',
  )

  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(HERO_NAME_SIZE)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, HERO_TEXT_X, HERO_NAME_Y)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.tagline,
    x: HERO_TEXT_X,
    y: HERO_TAGLINE_Y,
    maxCharsPerLine: 15,
    maxLines: 2,
    lineHeight: HERO_TAGLINE_LINE_HEIGHT,
    fontSize: 28,
    color: PALETTE.textSecondary,
  })

  // Rarity line — the collection hook (稀有度 12%), balanced by the edition
  // provenance micro-text on the right (图鉴 · 2026 — collectibles carry
  // provenance; derived from the render date, honest year edition).
  if (input.rarityLabel) {
    ctx.save()
    ctx.setFillStyle(COLOR_RANK_RIGHT_TEXT)
    ctx.setFontSize(20)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(input.rarityLabel, HERO_TEXT_X, HERO_RARITY_Y)
    ctx.restore()
  }
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(16)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('top')
  ctx.fillText(`图鉴 · ${new Date().getFullYear()}`, RIGHT_EDGE, HERO_RARITY_Y + 2)
  ctx.restore()
}

/**
 * Draw the rank strip: left "氛围编号 #X" chip, right gold serial chip.
 */
function drawRankStrip(
  ctx: Taro.CanvasContext,
  archetypeRank: number,
  serialNumber: string,
): void {
  const badgeRadius = RANK_STRIP_HEIGHT / 2

  const leftText = `氛围编号 #${archetypeRank}`
  ctx.save()
  ctx.setFontSize(20)
  const leftMeasured = ctx.measureText(leftText).width
  ctx.restore()

  const leftBadgeWidth = Math.max(200, Math.ceil(leftMeasured) + 48)
  fillRoundedRect(ctx, LEFT_EDGE, RANK_STRIP_Y, leftBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_LEFT_BG)
  strokeRoundedRect(ctx, LEFT_EDGE, RANK_STRIP_Y, leftBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_LEFT_BORDER, 1)

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(20)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(leftText, LEFT_EDGE + leftBadgeWidth / 2, RANK_STRIP_Y + RANK_STRIP_HEIGHT / 2)
  ctx.restore()

  const serialText = serialNumber.startsWith('#') ? serialNumber : `#${serialNumber}`

  ctx.save()
  ctx.setFontSize(20)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('middle')
  const measured = ctx.measureText(serialText).width
  ctx.restore()

  const rightBadgeWidth = Math.max(180, Math.ceil(measured) + 48)
  const rightBadgeX = RIGHT_EDGE - rightBadgeWidth
  fillRoundedRect(ctx, rightBadgeX, RANK_STRIP_Y, rightBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_RIGHT_BG)
  strokeRoundedRect(ctx, rightBadgeX, RANK_STRIP_Y, rightBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_RIGHT_BORDER, 1)

  // Debossed serial — cream underlay offset +1px below the dark ink fakes
  // the letterpress dent of a museum plaque number.
  ctx.save()
  ctx.setFontSize(20)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.setFillStyle('rgba(255, 255, 255, 0.65)')
  ctx.fillText(serialText, rightBadgeX + rightBadgeWidth / 2, RANK_STRIP_Y + RANK_STRIP_HEIGHT / 2 + 1.5)
  ctx.setFillStyle(COLOR_RANK_RIGHT_TEXT)
  ctx.fillText(serialText, rightBadgeX + rightBadgeWidth / 2, RANK_STRIP_Y + RANK_STRIP_HEIGHT / 2)
  ctx.restore()
}

function drawEnergyBar(ctx: Taro.CanvasContext, energyLevel: number): void {
  const label = '聚会续航力'
  const trackX = LEFT_EDGE
  const trackWidth = RIGHT_EDGE - LEFT_EDGE

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(24)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(label, LEFT_EDGE, ENERGY_LABEL_Y)
  ctx.setTextAlign('right')
  ctx.fillText(`${clampPercent(energyLevel)}%`, RIGHT_EDGE, ENERGY_LABEL_Y)
  ctx.restore()

  fillRoundedRect(ctx, trackX, ENERGY_TRACK_Y, trackWidth, ENERGY_TRACK_HEIGHT, ENERGY_TRACK_HEIGHT / 2, PALETTE.traitTrack)

  const fillWidth = Math.max(40, trackWidth * (clampPercent(energyLevel) / 100))
  const energyGradient = ctx.createLinearGradient(trackX, ENERGY_TRACK_Y, trackX + fillWidth, ENERGY_TRACK_Y)
  energyGradient.addColorStop(0, COLOR_ENERGY_AMBER)
  energyGradient.addColorStop(0.5, COLOR_ENERGY_ORANGE)
  energyGradient.addColorStop(1, COLOR_ENERGY_RED)
  fillRoundedRect(ctx, trackX, ENERGY_TRACK_Y, fillWidth, ENERGY_TRACK_HEIGHT, ENERGY_TRACK_HEIGHT / 2, energyGradient)

  // Instrument detailing: hairline tick marks at the quarter points turn a
  // flat bar into a gauge; a soft glow at the fill tip reads as the live
  // power level.
  ctx.save()
  clipRoundedRect(ctx, trackX, ENERGY_TRACK_Y, trackWidth, ENERGY_TRACK_HEIGHT, ENERGY_TRACK_HEIGHT / 2)
  ctx.setFillStyle('rgba(255, 255, 255, 0.55)')
  for (const ratio of [0.25, 0.5, 0.75]) {
    ctx.fillRect(trackX + trackWidth * ratio - 0.75, ENERGY_TRACK_Y, 1.5, ENERGY_TRACK_HEIGHT)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tipGlow = (ctx as any).createRadialGradient(
      trackX + fillWidth, ENERGY_TRACK_Y + ENERGY_TRACK_HEIGHT / 2, 1,
      trackX + fillWidth, ENERGY_TRACK_Y + ENERGY_TRACK_HEIGHT / 2, 16,
    )
    tipGlow.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
    tipGlow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.setFillStyle(tipGlow)
    ctx.fillRect(trackX + fillWidth - 16, ENERGY_TRACK_Y - 6, 32, ENERGY_TRACK_HEIGHT + 12)
  } catch {
    // No radial-gradient support — ticks alone carry the gauge look.
  }
  ctx.restore()

  // In-app parity hint under the bar.
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(18)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('top')
  ctx.fillText('你在聚会里的持久活力', RIGHT_EDGE, ENERGY_HINT_Y)
  ctx.restore()
}

function drawSkillCard(
  ctx: Taro.CanvasContext,
  options: { x: number; y: number; width: number; title: string; effect: string; label: string; fill: string; accent: string },
): void {
  fillRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, options.fill)
  strokeRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, PALETTE.skillCardBorder, 2)
  // Inset accent hairline — a nested inner frame, the jewelry-box effect.
  strokeRoundedRect(
    ctx,
    options.x + 6, options.y + 6,
    options.width - 12, SKILL_CARD_HEIGHT - 12,
    SKILL_CARD_RADIUS - 6,
    toCanvasRGBA(options.accent, 0.28),
    1,
  )
  drawFoilSparkles(ctx, options.x + 4, options.y + 4, options.width - 8, SKILL_CARD_HEIGHT - 8, options.x + options.y)

  drawBadge(ctx, { text: options.label, x: options.x + 24, y: options.y + 20, width: 108, height: 38, fill: options.accent, color: PALETTE.white, fontSize: 18 })

  drawTextBlock(ctx, {
    text: options.title,
    x: options.x + 24,
    y: options.y + 74,
    maxCharsPerLine: 10,
    maxLines: 1,
    lineHeight: 38,
    fontSize: 28,
    color: PALETTE.skillTitle,
  })

  drawTextBlock(ctx, {
    text: options.effect,
    x: options.x + 24,
    y: options.y + 118,
    maxCharsPerLine: 14,
    maxLines: 2,
    lineHeight: 30,
    fontSize: 19,
    color: PALETTE.skillEffect,
  })
}

/**
 * Draw the footer: the witty share caption and the brand lockup.
 */
function drawFooterBand(ctx: Taro.CanvasContext, shareLine: string): void {
  // Gold hairline divider above the caption — structured premium rhythm.
  const dividerGrad = createMetallicGold(ctx, POSTER_WIDTH / 2 - 60, 0, POSTER_WIDTH / 2 + 60, 0)
  fillRoundedRect(ctx, POSTER_WIDTH / 2 - 60, FOOTER_DIVIDER_Y, 120, 3, 1.5, dividerGrad)

  drawTextBlock(ctx, {
    text: shareLine || '来悦聚测测你的氛围命格，看看默契会带你去哪里',
    x: POSTER_WIDTH / 2,
    y: FOOTER_SHARELINE_Y,
    maxCharsPerLine: 30,
    maxLines: 1,
    lineHeight: 32,
    fontSize: 22,
    color: PALETTE.textSecondary,
    align: 'center',
  })

  ctx.save()
  ctx.setFillStyle(PALETTE.footerText)
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('JOYJOIN · 悦聚 — 测测你的氛围命格，找到同频的人', POSTER_WIDTH / 2, FOOTER_LOCKUP_Y)
  ctx.restore()
}

export async function generatePersonalitySharePoster(input: PersonalitySharePosterInput): Promise<string> {
  const archetypeImagePath = input.preResolvedImagePath
    || await resolveImagePathShared(input.archetypeAsset)
    || await resolveImagePathShared(input.archetypeAssetPng)

  const heroDimensions = await resolveImageDimensions(archetypeImagePath)

  const ctx = Taro.createCanvasContext(PERSONALITY_SHARE_POSTER_CANVAS_ID)
  createCardBackground(ctx, input.accentSoft)

  drawTopChrome(ctx, input.confidenceLabel)

  drawCompactIdentity(ctx, input, archetypeImagePath, heroDimensions)

  if (typeof input.archetypeRank === 'number' && input.serialNumber) {
    drawRankStrip(ctx, input.archetypeRank, input.serialNumber)
  }

  if (typeof input.energyLevel === 'number') {
    drawEnergyBar(ctx, input.energyLevel)
  }

  const skillCardWidth = (CONTENT_WIDTH - SKILL_CARD_GAP) / 2
  drawSkillCard(ctx, {
    x: LEFT_EDGE,
    y: SKILL_Y,
    width: skillCardWidth,
    title: input.activeSkillTitle,
    effect: input.activeSkillEffect,
    label: '氛围技能',
    fill: PALETTE.activeSkillFill,
    accent: PALETTE.activeSkillAccent,
  })
  drawSkillCard(ctx, {
    x: LEFT_EDGE + skillCardWidth + SKILL_CARD_GAP,
    y: SKILL_Y,
    width: skillCardWidth,
    title: input.passiveSkillTitle,
    effect: input.passiveSkillEffect,
    label: '氛围天赋',
    fill: PALETTE.passiveSkillFill,
    accent: PALETTE.passiveSkillAccent,
  })

  drawHolographicStamp(ctx)

  drawFriendCtaBand(ctx, input.qrCodeImagePath)

  drawFooterBand(ctx, input.shareLine)

  const systemInfo = getWindowInfoCompat()
  const dpr = Math.min(Math.max(systemInfo.pixelRatio || 2, 1), 2)
  const DRAW_TIMEOUT_MS = 15_000

  return await new Promise<string>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('Canvas draw timed out')) }
    }, DRAW_TIMEOUT_MS)

    ctx.draw(false, async () => {
      if (settled) return
      try {
        const tempFilePath = await exportCanvasWithRetry(PERSONALITY_SHARE_POSTER_CANVAS_ID, POSTER_WIDTH, POSTER_HEIGHT)
        settled = true
        clearTimeout(timeout)

        // Release backing store after export to free ~27 MB immediately
        try { ctx.clearRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT) } catch { /* best-effort */ }

        logInfo('[sharePoster] Portrait poster generated', { width: POSTER_WIDTH, height: POSTER_HEIGHT, dpr })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        logWarn('[sharePoster] Portrait poster generation failed', { error: error instanceof Error ? error.message : String(error) })
        reject(error)
      }
    })
  })
}
