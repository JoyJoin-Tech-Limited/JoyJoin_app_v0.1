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

// Single outer-content grid line (left edge of all major blocks)
const LEFT_EDGE = 72
const RIGHT_EDGE = CARD_RIGHT - 72
const CONTENT_WIDTH = RIGHT_EDGE - LEFT_EDGE

// Inner text inset for readable blocks
const INNER_EDGE = 104

// ── Spacing scale (4 px grid) ─────────────────────────────────────
const GAP_TIGHT = 16

// ── Layout constants (top → bottom, all on 4 px grid) ─────────────
const CHROME_Y = 68
const CHROME_HEIGHT = 42

const NAME_Y = 132
const NAME_SIZE = 48

const SUBTITLE_Y = 220
const SUBTITLE_SIZE = 28

const TAGLINE_Y = 276
const TAGLINE_SIZE = 22
const TAGLINE_LINE_HEIGHT = 36 // 1.64

const HERO_PANEL_Y = 368
const HERO_PANEL_H = 440
const HERO_PANEL_RADIUS = 32

const RANK_STRIP_Y = 600
const RANK_STRIP_HEIGHT = 36

const TRAITS_Y = 892
const TRAIT_ROW_HEIGHT = 42
const TRAIT_BAR_HEIGHT = 14
const TRAIT_BAR_RADIUS = 7

const TOPMATCHES_Y = 1052
const TOPMATCHES_ROW_HEIGHT = 42

const ENERGY_Y = 704

const SKILL_Y = 824
const SKILL_CARD_HEIGHT = 220
const SKILL_CARD_RADIUS = 28
const SKILL_CARD_GAP = 16
const SKILL_TITLE_LINE_HEIGHT = 36 // 1.38

const FOOTER_Y = 1112
const FOOTER_STAMP_HEIGHT = 36
const FOOTER_LOCKUP_SIZE = 16
const FOOTER_CTA_SIZE = 20
const FOOTER_CTA_LINE_HEIGHT = 28 // 1.4

// ── Inline color tokens (to promote to CANVAS_PALETTE when convenient) ─
const COLOR_ENERGY_AMBER = '#fbbf24'
const COLOR_ENERGY_ORANGE = '#f97316'
const COLOR_ENERGY_RED = '#ef4444'
const COLOR_RANK_LEFT_BG = 'rgba(255, 255, 255, 0.92)'
const COLOR_RANK_LEFT_BORDER = 'rgba(139, 92, 246, 0.15)'
const COLOR_RANK_RIGHT_BG = 'rgba(255, 248, 214, 0.94)'
const COLOR_RANK_RIGHT_BORDER = 'rgba(180, 140, 40, 0.15)'
const COLOR_RANK_RIGHT_TEXT = '#7a5a09'

export const PERSONALITY_SHARE_POSTER_CANVAS_ID = 'personality-share-poster-canvas'

export interface PersonalitySharePosterTraitEntry {
  label: string
  value: number
}

export interface PersonalitySharePosterTopMatch {
  archetype: string
  score: number
}

export interface PersonalitySharePosterInput {
  archetype: string
  nickname: string
  tagline: string
  shareLine: string
  accentColor: string
  accentSoft: string
  archetypeAsset: string
  archetypeAssetPng: string
  preResolvedImagePath?: string
  /** Slice 4 (2026-07-19): pre-generated 命格卡 temp image; hero panel prefers it over raw art. */
  mingCardImagePath?: string
  confidenceLabel?: string
  rarityLabel?: string
  activeSkillTitle: string
  activeSkillEffect: string
  passiveSkillTitle: string
  passiveSkillEffect: string
  topMatches: PersonalitySharePosterTopMatch[]
  traitEntries: PersonalitySharePosterTraitEntry[]
  subtitle: string
  globalRank?: number
  energyLevel?: number
  archetypeRank?: number
  serialNumber?: string
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
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, `rgba(255, 182, 193, ${opacity})`)
  gradient.addColorStop(0.2, `rgba(255, 215, 0, ${opacity * 1.2})`)
  gradient.addColorStop(0.4, `rgba(64, 224, 208, ${opacity})`)
  gradient.addColorStop(0.6, `rgba(230, 230, 250, ${opacity})`)
  gradient.addColorStop(0.8, `rgba(255, 215, 0, ${opacity * 1.2})`)
  gradient.addColorStop(1, `rgba(255, 182, 193, ${opacity})`)
  return gradient
}

/**
 * Draw scattered sparkle dots to simulate foil texture.
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

  const sparkleCount = Math.floor((width * height) / 12000)
  for (let i = 0; i < sparkleCount; i++) {
    const sx = x + rand() * width
    const sy = y + rand() * height
    const size = 1 + rand() * 2.5
    const alpha = 0.15 + rand() * 0.35

    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.setFillStyle(`rgba(255, 255, 255, ${alpha})`)
    ctx.fill()

    if (size > 2) {
      ctx.beginPath()
      ctx.moveTo(sx - size * 2, sy)
      ctx.lineTo(sx + size * 2, sy)
      ctx.moveTo(sx, sy - size * 2)
      ctx.lineTo(sx, sy + size * 2)
      ctx.setStrokeStyle(`rgba(255, 248, 220, ${alpha * 0.7})`)
      ctx.setLineWidth(0.6)
      ctx.stroke()
    }
  }
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
 * Draw a holographic edition stamp at the bottom of the card.
 */
function drawHolographicStamp(ctx: Taro.CanvasContext, centerX: number, centerY: number): void {
  ctx.save()
  const barWidth = 260
  const barHeight = 36
  const barX = centerX - barWidth / 2
  const barY = centerY - barHeight / 2
  const goldGrad = createMetallicGold(ctx, barX, barY, barX + barWidth, barY + barHeight)
  fillRoundedRect(ctx, barX, barY, barWidth, barHeight, 18, goldGrad)
  ctx.setFillStyle('#4a2e00')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('限量氛围版', centerX, centerY)
  ctx.restore()
}

/**
 * Draw embedded JoyJoin attribution watermark.
 */
function drawAttributionWatermark(ctx: Taro.CanvasContext, x: number, y: number, width: number): void {
  ctx.save()
  ctx.setFillStyle('rgba(139, 92, 246, 0.08)')
  ctx.setFontSize(16)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('悦聚 · 测测你的氛围命格 · 找到同频的人', x + width / 2, y)
  ctx.restore()
}

/**
 * Draw the page background, card shell, gold borders, foil sparkles,
 * holographic sheen, and vignette.
 */
function createCardBackground(ctx: Taro.CanvasContext): void {
  const pageGradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  pageGradient.addColorStop(0, PALETTE.pageBgStart)
  pageGradient.addColorStop(0.45, PALETTE.pageBgMid)
  pageGradient.addColorStop(1, PALETTE.pageBgEnd)
  ctx.setFillStyle(pageGradient)
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)
  drawFoilSparkles(ctx, CARD_X + 8, CARD_Y + 8, CARD_WIDTH - 16, CARD_HEIGHT - 16, 7)

  const outerGold = createMetallicGold(ctx, CARD_X, CARD_Y, CARD_X + CARD_WIDTH, CARD_Y)
  strokeRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, outerGold as unknown as string, 6)
  strokeRoundedRect(ctx, CARD_X + 10, CARD_Y + 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, CARD_RADIUS - 10, PALETTE.cardInnerBorder, 2)

  ctx.save()
  drawRoundedRect(ctx, CARD_X + 2, CARD_Y + 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, CARD_RADIUS - 2)
  ctx.clip()
  const sheen = createHolographicSheen(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, 0.1)
  ctx.setFillStyle(sheen)
  ctx.fillRect(CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()

  drawVignette(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
}

/**
 * Draw the top chrome bar: left dark chip and right confidence badge.
 */
function drawTopChrome(ctx: Taro.CanvasContext, confidenceLabel?: string): void {
  drawBadge(ctx, {
    text: '悦聚 · 氛围命盘',
    x: LEFT_EDGE,
    y: CHROME_Y,
    width: 172,
    height: CHROME_HEIGHT,
    fill: PALETTE.badgeDarkFill,
    color: PALETTE.badgeDarkText,
  })
  drawBadge(ctx, {
    text: confidenceLabel ?? '命定结果',
    x: RIGHT_EDGE - 148,
    y: CHROME_Y,
    width: 148,
    height: CHROME_HEIGHT,
    fill: PALETTE.badgeConfidenceFill,
    color: PALETTE.badgeConfidenceText,
  })
}

/**
 * Draw the archetype name, subtitle/nickname, and tagline below the chrome bar.
 */
function drawArchetypeHeader(ctx: Taro.CanvasContext, input: PersonalitySharePosterInput): void {
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(NAME_SIZE)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, LEFT_EDGE, NAME_Y)
  ctx.restore()

  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(SUBTITLE_SIZE)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.nickname || input.subtitle, LEFT_EDGE, SUBTITLE_Y)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.tagline,
    x: LEFT_EDGE,
    y: TAGLINE_Y,
    maxCharsPerLine: 38,
    maxLines: 2,
    lineHeight: TAGLINE_LINE_HEIGHT,
    fontSize: TAGLINE_SIZE,
    color: PALETTE.textSecondary,
  })
}

/**
 * Compact share identity block. The share poster intentionally carries only
 * the collectible card's most recognizable information, matching the in-app
 * reveal card instead of repeating the full personality report.
 */
function drawCompactIdentity(
  ctx: Taro.CanvasContext,
  input: PersonalitySharePosterInput,
  archetypeImagePath: string | undefined,
  dimensions: ImageDimensions,
): void {
  const portraitX = 104
  const portraitY = 152
  const portraitSize = 300
  const portraitRadius = portraitSize / 2
  const portraitCenterX = portraitX + portraitRadius
  const portraitCenterY = portraitY + portraitRadius

  ctx.save()
  ctx.setShadow(0, 16, 34, PALETTE.shadowPurple)
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius + 12, 0, Math.PI * 2)
  ctx.setFillStyle(PALETTE.white)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius, 0, Math.PI * 2)
  ctx.clip()
  ctx.setFillStyle(toCanvasRGBA(input.accentColor, 0.16))
  ctx.fillRect(portraitX, portraitY, portraitSize, portraitSize)

  if (archetypeImagePath) {
    const scale = Math.max(portraitSize / dimensions.width, portraitSize / dimensions.height)
    const drawW = dimensions.width * scale
    const drawH = dimensions.height * scale
    try {
      ctx.drawImage(
        archetypeImagePath,
        portraitX + (portraitSize - drawW) / 2,
        portraitY + (portraitSize - drawH) / 2,
        drawW,
        drawH,
      )
    } catch {
      logWarn('[sharePoster] compact portrait drawImage failed', { archetype: input.archetype })
    }
  }
  ctx.restore()

  const textX = 472
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(58)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, textX, 196)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.tagline,
    x: textX,
    y: 294,
    maxCharsPerLine: 15,
    maxLines: 2,
    lineHeight: 42,
    fontSize: 28,
    color: PALETTE.textSecondary,
  })
}

/**
 * Draw the full-bleed hero art panel with accent radial glow and archetype art.
 */
function drawHeroPanel(
  ctx: Taro.CanvasContext,
  archetypeImagePath: string | undefined,
  accentColor: string,
  archetype: string,
  dimensions: ImageDimensions,
  mingCardImagePath?: string,
): void {
  const panelX = LEFT_EDGE
  const panelY = HERO_PANEL_Y
  const panelW = CONTENT_WIDTH
  const panelH = HERO_PANEL_H

  ctx.save()
  ctx.setShadow(0, 14, 36, PALETTE.shadowPurple)
  fillRoundedRect(ctx, panelX, panelY, panelW, panelH, HERO_PANEL_RADIUS, PALETTE.white)
  ctx.restore()

  let heroGlow: Taro.CanvasGradient
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    heroGlow = (ctx as any).createRadialGradient(
      panelX + panelW / 2, panelY + panelH / 2, 20,
      panelX + panelW / 2, panelY + panelH / 2, Math.min(panelW, panelH) * 0.65,
    )
    heroGlow.addColorStop(0, toCanvasRGBA(accentColor, 1))
    heroGlow.addColorStop(0.6, toCanvasRGBA(accentColor, 0.5))
    heroGlow.addColorStop(1, PALETTE.heroGlowEnd)
  } catch {
    heroGlow = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH)
    heroGlow.addColorStop(0, toCanvasRGBA(accentColor, 1))
    heroGlow.addColorStop(1, PALETTE.heroGlowEnd)
  }
  fillRoundedRect(ctx, panelX + 6, panelY + 6, panelW - 12, panelH - 12, HERO_PANEL_RADIUS - 6, heroGlow)

  let drewImage = false
  // Preferred: the canonical 命格卡 (744×1039), contain-fit on the accent glow.
  if (mingCardImagePath) {
    ctx.save()
    clipRoundedRect(ctx, panelX + 6, panelY + 6, panelW - 12, panelH - 12, HERO_PANEL_RADIUS - 6)
    try {
      const scale = Math.min((panelW - 12) / 744, (panelH - 12) / 1039)
      const drawW = 744 * scale
      const drawH = 1039 * scale
      ctx.drawImage(
        mingCardImagePath,
        panelX + 6 + (panelW - 12 - drawW) / 2,
        panelY + 6 + (panelH - 12 - drawH) / 2,
        drawW,
        drawH,
      )
      drewImage = true
    } catch {
      logWarn('[sharePoster] ming card drawImage failed, falling back to raw art', { archetype })
    }
    ctx.restore()
  }
  if (!drewImage && archetypeImagePath) {
    ctx.save()
    clipRoundedRect(ctx, panelX + 6, panelY + 6, panelW - 12, panelH - 12, HERO_PANEL_RADIUS - 6)

    const { width: imgW, height: imgH } = dimensions
    const scale = Math.min((panelW - 12) / imgW, (panelH - 12) / imgH)
    const drawW = imgW * scale
    const drawH = imgH * scale
    const drawX = panelX + 6 + (panelW - 12 - drawW) / 2
    const drawY = panelY + 6 + (panelH - 12 - drawH) / 2

    try {
      ctx.drawImage(archetypeImagePath, drawX, drawY, drawW, drawH)
      drewImage = true
    } catch {
      logWarn('[sharePoster] drawImage failed, using fallback', { archetype })
    }
    ctx.restore()
  }

  if (!drewImage) {
    fillRoundedRect(ctx, panelX + 6, panelY + 6, panelW - 12, panelH - 12, HERO_PANEL_RADIUS - 6, toCanvasRGBA(accentColor, 0.18))
    // Subtle concentric rings for brand-safe placeholder (no text overlay on art)
    const cx = panelX + panelW / 2
    const cy = panelY + panelH / 2
    for (let r = 40; r <= 120; r += 20) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.setStrokeStyle(toCanvasRGBA(accentColor, 0.12 + (r - 40) / 200))
      ctx.setLineWidth(2)
      ctx.stroke()
    }
  }
}

/**
 * Draw the rank strip: left "No.X" chip, right serial + rarity chip.
 */
function drawRankStrip(
  ctx: Taro.CanvasContext,
  archetypeRank: number,
  serialNumber: string,
  _rarityLabel?: string,
  _globalRank?: number,
): void {
  const badgeRadius = RANK_STRIP_HEIGHT / 2

  const leftBadgeWidth = 160
  fillRoundedRect(ctx, LEFT_EDGE, RANK_STRIP_Y, leftBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_LEFT_BG)
  strokeRoundedRect(ctx, LEFT_EDGE, RANK_STRIP_Y, leftBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_LEFT_BORDER, 1)

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(`氛围编号 #${archetypeRank}`, LEFT_EDGE + leftBadgeWidth / 2, RANK_STRIP_Y + RANK_STRIP_HEIGHT / 2)
  ctx.restore()

  const serialText = serialNumber.startsWith('#') ? serialNumber : `#${serialNumber}`

  ctx.save()
  ctx.setFontSize(18)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('middle')
  const measured = ctx.measureText(serialText).width
  ctx.restore()

  const rightBadgeWidth = Math.max(180, measured + 40)
  const rightBadgeX = RIGHT_EDGE - rightBadgeWidth
  fillRoundedRect(ctx, rightBadgeX, RANK_STRIP_Y, rightBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_RIGHT_BG)
  strokeRoundedRect(ctx, rightBadgeX, RANK_STRIP_Y, rightBadgeWidth, RANK_STRIP_HEIGHT, badgeRadius, COLOR_RANK_RIGHT_BORDER, 1)

  ctx.save()
  ctx.setFillStyle(COLOR_RANK_RIGHT_TEXT)
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(serialText, rightBadgeX + rightBadgeWidth / 2, RANK_STRIP_Y + RANK_STRIP_HEIGHT / 2)
  ctx.restore()
}

/**
 * Draw compact 2-column trait bars (6 ACOEXP dimensions).
 */
function drawTraitBars(ctx: Taro.CanvasContext, traitEntries: PersonalitySharePosterTraitEntry[], accentColor: string): void {
  const entries = traitEntries.slice(0, 6)
  if (entries.length === 0) return

  const colCount = 2
  const colWidth = (CONTENT_WIDTH - SKILL_CARD_GAP) / 2
  const labelWidth = 48
  const innerOffset = INNER_EDGE - LEFT_EDGE

  entries.forEach((entry, index) => {
    const col = index % colCount
    const row = Math.floor(index / colCount)
    const colX = LEFT_EDGE + col * (colWidth + SKILL_CARD_GAP)
    const rowY = TRAITS_Y + row * TRAIT_ROW_HEIGHT
    const innerX = colX + innerOffset
    const barX = innerX + labelWidth + 8
    const barMaxWidth = colX + colWidth - 8 - barX
    const valueX = colX + colWidth - 8

    ctx.save()
    ctx.setFillStyle(PALETTE.traitLabel)
    ctx.setFontSize(16)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('middle')
    ctx.fillText(entry.label, innerX, rowY + TRAIT_BAR_HEIGHT / 2)
    ctx.restore()

    ctx.save()
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setFontSize(16)
    ctx.setTextAlign('right')
    ctx.setTextBaseline('middle')
    ctx.fillText(String(entry.value), valueX, rowY + TRAIT_BAR_HEIGHT / 2)
    ctx.restore()

    fillRoundedRect(ctx, barX, rowY, barMaxWidth, TRAIT_BAR_HEIGHT, TRAIT_BAR_RADIUS, PALETTE.traitTrack)

    const fillWidth = Math.max(4, barMaxWidth * (clampPercent(entry.value) / 100))
    const fillGradient = ctx.createLinearGradient(barX, rowY, barX + fillWidth, rowY)
    fillGradient.addColorStop(0, toCanvasRGBA(accentColor, 1))
    fillGradient.addColorStop(1, toCanvasRGBA(accentColor, 0.6))
    fillRoundedRect(ctx, barX, rowY, fillWidth, TRAIT_BAR_HEIGHT, TRAIT_BAR_RADIUS, fillGradient)
  })
}

/**
 * Draw top-match partner chemistry chips.
 */
function drawTopMatches(ctx: Taro.CanvasContext, topMatches: PersonalitySharePosterTopMatch[]): void {
  if (topMatches.length === 0) return
  const chipWidth = 144
  const gap = 12
  const visible = topMatches.slice(0, Math.min(3, Math.floor(CONTENT_WIDTH / (chipWidth + gap))))

  const totalWidth = visible.length * chipWidth + (visible.length - 1) * gap
  const startX = LEFT_EDGE + (CONTENT_WIDTH - totalWidth) / 2

  visible.forEach((match, index) => {
    const chipX = startX + index * (chipWidth + gap)
    drawBadge(ctx, {
      text: `${match.archetype} ${clampPercent(match.score)}%`,
      x: chipX,
      y: TOPMATCHES_Y,
      width: chipWidth,
      height: TOPMATCHES_ROW_HEIGHT,
      fill: PALETTE.badgeMatchFill,
      color: PALETTE.badgeMatchText,
    })
  })
}

function drawEnergyBar(ctx: Taro.CanvasContext, energyLevel: number): void {
  const label = '社交续航力'
  const trackX = INNER_EDGE
  const trackWidth = RIGHT_EDGE - INNER_EDGE
  const trackY = ENERGY_Y + 36

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(22)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(label, INNER_EDGE, ENERGY_Y)
  ctx.setTextAlign('right')
  ctx.fillText(`${clampPercent(energyLevel)}%`, RIGHT_EDGE, ENERGY_Y)
  ctx.restore()

  fillRoundedRect(ctx, trackX, trackY, trackWidth, 18, 10, PALETTE.traitTrack)

  const fillWidth = Math.max(36, trackWidth * (clampPercent(energyLevel) / 100))
  const energyGradient = ctx.createLinearGradient(trackX, trackY, trackX + fillWidth, trackY)
  energyGradient.addColorStop(0, COLOR_ENERGY_AMBER)
  energyGradient.addColorStop(0.5, COLOR_ENERGY_ORANGE)
  energyGradient.addColorStop(1, COLOR_ENERGY_RED)
  fillRoundedRect(ctx, trackX, trackY, fillWidth, 18, 10, energyGradient)
}

function drawSkillCard(
  ctx: Taro.CanvasContext,
  options: { x: number; y: number; width: number; title: string; effect: string; label: string; fill: string; accent: string },
): void {
  fillRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, options.fill)
  strokeRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, PALETTE.skillCardBorder, 2)
  drawFoilSparkles(ctx, options.x + 4, options.y + 4, options.width - 8, SKILL_CARD_HEIGHT - 8, options.x + options.y)

  drawBadge(ctx, { text: options.label, x: options.x + 22, y: options.y + 18, width: 96, fill: options.accent, color: PALETTE.white })

  drawTextBlock(ctx, {
    text: options.title,
    x: options.x + 22,
    y: options.y + 68,
    maxCharsPerLine: 11,
    maxLines: 1,
    lineHeight: SKILL_TITLE_LINE_HEIGHT,
    fontSize: 26,
    color: PALETTE.skillTitle,
  })

  drawTextBlock(ctx, {
    text: options.effect,
    x: options.x + 22,
    y: options.y + 104,
    maxCharsPerLine: 15,
    maxLines: 2,
    lineHeight: 26,
    fontSize: 18,
    color: PALETTE.skillEffect,
  })
}

/**
 * Draw the cohesive footer band: holographic stamp, brand lockup,
 * share CTA line, and attribution watermark.
 */
function drawFooterBand(ctx: Taro.CanvasContext, shareLine: string): void {
  const stampY = FOOTER_Y + FOOTER_STAMP_HEIGHT / 2
  drawHolographicStamp(ctx, POSTER_WIDTH / 2, stampY)

  const lockupY = FOOTER_Y + FOOTER_STAMP_HEIGHT + GAP_TIGHT
  ctx.save()
  ctx.setFillStyle(PALETTE.footerText)
  ctx.setFontSize(FOOTER_LOCKUP_SIZE)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('JOYJOIN · 悦聚', POSTER_WIDTH / 2, lockupY)
  ctx.restore()

  const ctaY = lockupY + FOOTER_LOCKUP_SIZE + GAP_TIGHT
  drawTextBlock(ctx, {
    text: shareLine || '来悦聚测测你的社交命格，看看默契会带你去哪里',
    x: LEFT_EDGE + CONTENT_WIDTH / 2,
    y: ctaY,
    maxCharsPerLine: 40,
    maxLines: 1,
    lineHeight: FOOTER_CTA_LINE_HEIGHT,
    fontSize: FOOTER_CTA_SIZE,
    color: PALETTE.footerText,
    align: 'center',
  })

  const watermarkY = ctaY + FOOTER_CTA_LINE_HEIGHT * 2 + GAP_TIGHT
  drawAttributionWatermark(ctx, LEFT_EDGE, watermarkY, CONTENT_WIDTH)
}

export async function generatePersonalitySharePoster(input: PersonalitySharePosterInput): Promise<string> {
  const archetypeImagePath = input.preResolvedImagePath
    || await resolveImagePathShared(input.archetypeAsset)
    || await resolveImagePathShared(input.archetypeAssetPng)

  const heroDimensions = await resolveImageDimensions(archetypeImagePath)

  const ctx = Taro.createCanvasContext(PERSONALITY_SHARE_POSTER_CANVAS_ID)
  createCardBackground(ctx)

  drawCompactIdentity(ctx, input, archetypeImagePath, heroDimensions)

  if (typeof input.archetypeRank === 'number' && input.serialNumber) {
    drawRankStrip(ctx, input.archetypeRank, input.serialNumber, input.rarityLabel, input.globalRank)
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

  drawFooterBand(ctx, input.shareLine)

  const systemInfo = Taro.getSystemInfoSync()
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
