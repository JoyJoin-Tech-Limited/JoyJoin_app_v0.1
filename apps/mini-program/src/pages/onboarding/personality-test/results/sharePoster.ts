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
  splitText,
  exportCanvasWithRetry,
} from '../../../../lib/utils/canvasHelpers'

const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1920

const charWeightCache = new Map<string, number>()

const OUTER_MARGIN = 28
const CARD_RADIUS = 40
const CARD_X = OUTER_MARGIN
const CARD_Y = OUTER_MARGIN
const CARD_WIDTH = POSTER_WIDTH - OUTER_MARGIN * 2
const CARD_HEIGHT = POSTER_HEIGHT - OUTER_MARGIN * 2

const BADGE_HEIGHT = 42
const BADGE_RADIUS = 21
const HERO_IMAGE_SIZE = 224
const HERO_IMAGE_RADIUS = 112
const SKILL_CARD_HEIGHT = 148
const SKILL_CARD_RADIUS = 28

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
  summary: string
  shareLine: string
  accentColor: string
  accentSoft: string
  archetypeAsset: string
  archetypeAssetPng: string
  confidenceLabel?: string
  rarityLabel?: string
  skillAttribute: string
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

function measureTextSplit(
  ctx: Taro.CanvasContext,
  text: string,
  maxCharsPerLine: number,
  maxLines = 2,
): string[] {
  const normalized = text.trim()
  if (!normalized) {
    return []
  }

  // Measure reference CJK character to normalize widths
  let refWidth = 0
  try {
    refWidth = ctx.measureText('中').width
  } catch {
    refWidth = 0
  }
  if (refWidth === 0) {
    return splitText(text, maxCharsPerLine, maxLines)
  }

  const chars = Array.from(normalized)
  const lines: string[] = []
  let currentLine = ''
  let currentWeight = 0

  chars.forEach((char) => {
    let weight = charWeightCache.get(char)
    if (weight === undefined) {
      let width = 0
      try {
        width = ctx.measureText(char).width
      } catch {
        width = 0
      }
      weight = width > 0 ? width / refWidth : (/[A-Za-z0-9]/.test(char) ? 0.72 : 1)
      charWeightCache.set(char, weight)
    }

    if (currentWeight + weight > maxCharsPerLine && currentLine) {
      lines.push(currentLine)
      currentLine = char
      currentWeight = weight
      return
    }

    currentLine += char
    currentWeight += weight
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length <= maxLines) {
    return lines
  }

  const limited = lines.slice(0, maxLines)
  const lastLine = limited[maxLines - 1] ?? ''
  limited[maxLines - 1] = `${lastLine.slice(0, Math.max(lastLine.length - 1, 1))}…`
  return limited
}

/**
 * Create a holographic rainbow sheen gradient overlay.
 * This simulates the light-refraction effect on premium foil cards.
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
  gradient.addColorStop(0, `rgba(255, 182, 193, ${opacity})`)     // foil pink
  gradient.addColorStop(0.2, `rgba(255, 215, 0, ${opacity * 1.2})`)   // gold
  gradient.addColorStop(0.4, `rgba(64, 224, 208, ${opacity})`)    // cyan
  gradient.addColorStop(0.6, `rgba(230, 230, 250, ${opacity})`)   // lavender
  gradient.addColorStop(0.8, `rgba(255, 215, 0, ${opacity * 1.2})`)   // gold
  gradient.addColorStop(1, `rgba(255, 182, 193, ${opacity})`)     // foil pink
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
  // Deterministic pseudo-random based on seed
  let s = seed
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }

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

    // Cross sparkle for larger ones
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
    // Taro's CanvasContext typing doesn't include createRadialGradient,
    // but WeChat's canvas 2d context supports it at runtime.
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
 * Draw a holographic edition stamp / watermark at the bottom of the card.
 */
function drawHolographicStamp(
  ctx: Taro.CanvasContext,
  centerX: number,
  centerY: number,
): void {
  ctx.save()

  // Gold gradient bar background
  const barWidth = 260
  const barHeight = 36
  const barX = centerX - barWidth / 2
  const barY = centerY - barHeight / 2

  const goldGrad = createMetallicGold(ctx, barX, barY, barX + barWidth, barY + barHeight)
  fillRoundedRect(ctx, barX, barY, barWidth, barHeight, 18, goldGrad)

  // Stamp text
  ctx.setFillStyle('#4a2e00')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('全息限定版', centerX, centerY)

  ctx.restore()
}

/**
 * Draw embedded JoyJoin attribution watermark.
 */
function drawAttributionWatermark(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
): void {
  ctx.save()
  ctx.setFillStyle('rgba(139, 92, 246, 0.08)')
  ctx.setFontSize(16)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('悦聚 · 测测你的氛围命格 · 找到同频的人', x + width / 2, y)
  ctx.restore()
}

function createCardBackground(ctx: Taro.CanvasContext, accentColor: string): void {
  const pageGradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  pageGradient.addColorStop(0, PALETTE.pageBgStart)
  pageGradient.addColorStop(0.45, PALETTE.pageBgMid)
  pageGradient.addColorStop(1, PALETTE.pageBgEnd)
  ctx.setFillStyle(pageGradient)
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  // Main card body with subtle foil sparkles
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)
  drawFoilSparkles(ctx, CARD_X + 8, CARD_Y + 8, CARD_WIDTH - 16, CARD_HEIGHT - 16, 7)

  // Outer metallic gold border (dual-layer for depth)
  const outerGold = createMetallicGold(ctx, CARD_X, CARD_Y, CARD_X + CARD_WIDTH, CARD_Y)
  strokeRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, outerGold as unknown as string, 6)
  strokeRoundedRect(ctx, CARD_X + 10, CARD_Y + 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, CARD_RADIUS - 10, PALETTE.cardInnerBorder, 2)

  // Holographic sheen overlay across the whole card
  ctx.save()
  drawRoundedRect(ctx, CARD_X + 2, CARD_Y + 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, CARD_RADIUS - 2)
  ctx.clip()
  const sheen = createHolographicSheen(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, 0.1)
  ctx.setFillStyle(sheen)
  ctx.fillRect(CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()

  // Vignette for depth
  drawVignette(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)

  // Hero image panel with enhanced glow
  ctx.save()
  ctx.setShadow(0, 14, 36, PALETTE.shadowPurple)
  fillRoundedRect(ctx, CARD_X + 26, CARD_Y + 108, CARD_WIDTH - 52, 272, 36, PALETTE.white)
  ctx.restore()

  // Dynamic radial glow behind hero using accent color
  let heroGlow: Taro.CanvasGradient
  try {
    // Runtime fallback: WeChat canvas 2d supports createRadialGradient
    // even though Taro's types omit it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    heroGlow = (ctx as any).createRadialGradient(
      CARD_X + CARD_WIDTH / 2, CARD_Y + 236, 20,
      CARD_X + CARD_WIDTH / 2, CARD_Y + 236, 180,
    )
    heroGlow.addColorStop(0, toCanvasRGBA(accentColor, 1))
    heroGlow.addColorStop(0.6, toCanvasRGBA(accentColor, 0.53))
    heroGlow.addColorStop(1, PALETTE.heroGlowEnd)
  } catch {
    heroGlow = ctx.createLinearGradient(
      CARD_X + 40, CARD_Y + 140, CARD_X + CARD_WIDTH - 40, CARD_Y + 370,
    )
    heroGlow.addColorStop(0, toCanvasRGBA(accentColor, 1))
    heroGlow.addColorStop(1, PALETTE.heroGlowEnd)
  }
  fillRoundedRect(ctx, CARD_X + 34, CARD_Y + 114, CARD_WIDTH - 68, 260, 32, heroGlow)
}

function drawEnergyBar(
  ctx: Taro.CanvasContext,
  y: number,
  energyLevel: number,
  accentColor: string,
): void {
  const sectionX = CARD_X + 46
  const trackWidth = CARD_WIDTH - 152
  const label = '社交续航力'

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(22)
  ctx.setTextBaseline('top')
  ctx.fillText(label, sectionX, y)

  // Energy value
  ctx.setTextAlign('right')
  ctx.fillText(`${clampPercent(energyLevel)}%`, sectionX + 110 + trackWidth + 28, y)
  ctx.restore()

  // Track
  const barY = y + 36
  fillRoundedRect(ctx, sectionX + 122, barY, trackWidth, 18, 10, PALETTE.traitTrack)

  // Fill — gradient from yellow to orange to red
  const fillWidth = Math.max(36, trackWidth * (clampPercent(energyLevel) / 100))
  const energyGradient = ctx.createLinearGradient(sectionX + 122, barY, sectionX + 122 + fillWidth, barY)
  energyGradient.addColorStop(0, '#fbbf24')
  energyGradient.addColorStop(0.5, '#f97316')
  energyGradient.addColorStop(1, '#ef4444')
  fillRoundedRect(ctx, sectionX + 122, barY, fillWidth, 18, 10, energyGradient)
}

function drawRankBadges(
  ctx: Taro.CanvasContext,
  y: number,
  archetypeRank: number,
  serialNumber: string,
  globalRank?: number,
): void {
  const badgeY = y
  const badgeHeight = 36
  const badgeRadius = 18

  // Archetype rank badge (left)
  const leftBadgeWidth = 160
  const leftBadgeX = CARD_X + 44
  fillRoundedRect(ctx, leftBadgeX, badgeY, leftBadgeWidth, badgeHeight, badgeRadius, 'rgba(255, 255, 255, 0.92)')
  strokeRoundedRect(ctx, leftBadgeX, badgeY, leftBadgeWidth, badgeHeight, badgeRadius, 'rgba(139, 92, 246, 0.15)', 1)

  ctx.save()
  ctx.setFillStyle(PALETTE.traitLabel)
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(`命格编号 No.${archetypeRank}`, leftBadgeX + leftBadgeWidth / 2, badgeY + badgeHeight / 2)
  ctx.restore()

  // Serial number badge (right) — combined with global rank when available
  const rightBadgeWidth = globalRank ? 260 : 180
  const rightBadgeX = CARD_X + CARD_WIDTH - 44 - rightBadgeWidth
  fillRoundedRect(ctx, rightBadgeX, badgeY, rightBadgeWidth, badgeHeight, badgeRadius, 'rgba(255, 248, 214, 0.94)')
  strokeRoundedRect(ctx, rightBadgeX, badgeY, rightBadgeWidth, badgeHeight, badgeRadius, 'rgba(180, 140, 40, 0.15)', 1)

  ctx.save()
  ctx.setFillStyle('#7a5a09')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  const serialText = globalRank
    ? `${serialNumber} · 全球 #${globalRank}`
    : `${serialNumber}`
  ctx.fillText(serialText, rightBadgeX + rightBadgeWidth / 2, badgeY + badgeHeight / 2)
  ctx.restore()
}

function drawTraitBars(
  ctx: Taro.CanvasContext,
  y: number,
  traitEntries: PersonalitySharePosterTraitEntry[],
  accentColor: string,
): number {
  const sectionX = CARD_X + 44
  const sectionWidth = CARD_WIDTH - 88
  const barHeight = 14
  const barRadius = 7
  const rowHeight = 22
  const labelWidth = 70
  const valueWidth = 36
  const barX = sectionX + labelWidth + 8
  const barMaxWidth = sectionWidth - labelWidth - valueWidth - 16

  const entries = traitEntries.slice(0, 6)

  entries.forEach((entry, index) => {
    const rowY = y + index * rowHeight

    // Label (left)
    ctx.save()
    ctx.setFillStyle(PALETTE.traitLabel)
    ctx.setFontSize(16)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('middle')
    ctx.fillText(entry.label, sectionX, rowY + barHeight / 2)
    ctx.restore()

    // Value (right)
    ctx.save()
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setFontSize(16)
    ctx.setTextAlign('right')
    ctx.setTextBaseline('middle')
    ctx.fillText(String(entry.value), sectionX + sectionWidth, rowY + barHeight / 2)
    ctx.restore()

    // Track background
    fillRoundedRect(ctx, barX, rowY, barMaxWidth, barHeight, barRadius, PALETTE.traitTrack)

    // Fill with accent gradient
    const fillWidth = Math.max(4, barMaxWidth * (clampPercent(entry.value) / 100))
    const fillGradient = ctx.createLinearGradient(barX, rowY, barX + fillWidth, rowY)
    fillGradient.addColorStop(0, toCanvasRGBA(accentColor, 1))
    fillGradient.addColorStop(1, toCanvasRGBA(accentColor, 0.6))
    fillRoundedRect(ctx, barX, rowY, fillWidth, barHeight, barRadius, fillGradient)
  })

  return entries.length * rowHeight - 8
}

function drawSkillCard(
  ctx: Taro.CanvasContext,
  options: {
    x: number
    y: number
    width: number
    title: string
    effect: string
    label: string
    fill: string
    accent: string
  },
): void {
  fillRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, options.fill)
  strokeRoundedRect(ctx, options.x, options.y, options.width, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS, PALETTE.skillCardBorder, 2)

  // Subtle foil sparkle on skill card
  drawFoilSparkles(ctx, options.x + 4, options.y + 4, options.width - 8, SKILL_CARD_HEIGHT - 8, options.x + options.y)

  drawBadge(ctx, {
    text: options.label,
    x: options.x + 22,
    y: options.y + 18,
    width: 96,
    fill: options.accent,
    color: PALETTE.white,
  })

  drawTextBlock(ctx, {
    text: options.title,
    x: options.x + 22,
    y: options.y + 74,
    maxCharsPerLine: 11,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 26,
    color: PALETTE.skillTitle,
  })

  drawTextBlock(ctx, {
    text: options.effect,
    x: options.x + 22,
    y: options.y + 110,
    maxCharsPerLine: 16,
    maxLines: 2,
    lineHeight: 26,
    fontSize: 20,
    color: PALETTE.skillEffect,
  })
}

export async function generatePersonalitySharePoster(
  input: PersonalitySharePosterInput,
): Promise<string> {
  // Try WebP first (smaller, faster). If canvas drawImage fails with WebP,
  // fall back to CDN PNG. Both are resolved via getImageInfo to local temp paths.
  const archetypeImagePath = await resolveImagePathShared(input.archetypeAsset)
    || await resolveImagePathShared(input.archetypeAssetPng)

  const ctx = Taro.createCanvasContext(PERSONALITY_SHARE_POSTER_CANVAS_ID)
  createCardBackground(ctx, input.accentColor)

  drawBadge(ctx, {
    text: '悦聚 · 氛围命盘',
    x: CARD_X + 36,
    y: CARD_Y + 40,
    width: 172,
    fill: PALETTE.badgeDarkFill,
    color: PALETTE.badgeDarkText,
  })

  drawBadge(ctx, {
    text: input.confidenceLabel ?? '命定结果',
    x: CARD_X + CARD_WIDTH - 184,
    y: CARD_Y + 40,
    width: 148,
    fill: PALETTE.badgeConfidenceFill,
    color: PALETTE.badgeConfidenceText,
  })

  const heroPanelX = CARD_X + 52
  const heroPanelY = CARD_Y + 128
  const imageShellX = heroPanelX + 26
  const imageShellY = heroPanelY + 20

  ctx.save()
  ctx.setShadow(0, 12, 28, PALETTE.shadowOrange)
  fillRoundedRect(ctx, imageShellX, imageShellY, HERO_IMAGE_SIZE, HERO_IMAGE_SIZE, HERO_IMAGE_RADIUS, PALETTE.heroImageShell)
  ctx.restore()
  strokeRoundedRect(ctx, imageShellX, imageShellY, HERO_IMAGE_SIZE, HERO_IMAGE_SIZE, HERO_IMAGE_RADIUS, PALETTE.heroImageBorder, 3)

  if (archetypeImagePath) {
    ctx.save()
    clipRoundedRect(ctx, imageShellX, imageShellY, HERO_IMAGE_SIZE, HERO_IMAGE_SIZE, HERO_IMAGE_RADIUS)
    ctx.drawImage(archetypeImagePath, imageShellX + 20, imageShellY + 20, 184, 184)
    ctx.restore()
  } else {
    // Fallback: accent circle with archetype initial
    fillRoundedRect(ctx, imageShellX, imageShellY, HERO_IMAGE_SIZE, HERO_IMAGE_SIZE, HERO_IMAGE_RADIUS, toCanvasRGBA(input.accentColor, 1))

    ctx.save()
    ctx.setFillStyle(PALETTE.white)
    ctx.setFontSize(80)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    const firstChar = Array.from(input.archetype)[0] ?? '?'
    ctx.fillText(firstChar, imageShellX + HERO_IMAGE_SIZE / 2, imageShellY + HERO_IMAGE_SIZE / 2)
    ctx.restore()
  }

  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(48)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, heroPanelX + 280, heroPanelY + 24)
  ctx.restore()

  // Archetype nickname subtitle
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(28)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.subtitle, heroPanelX + 280, heroPanelY + 76)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.nickname || input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 110,
    maxCharsPerLine: 12,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 24,
    color: PALETTE.textMuted,
  })

  drawTextBlock(ctx, {
    text: input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 146,
    maxCharsPerLine: 14,
    maxLines: 2,
    lineHeight: 30,
    fontSize: 22,
    color: PALETTE.textSecondary,
  })

  drawTextBlock(ctx, {
    text: input.summary,
    x: heroPanelX + 280,
    y: heroPanelY + 204,
    maxCharsPerLine: 17,
    maxLines: 2,
    lineHeight: 24,
    fontSize: 20,
    color: PALETTE.textTertiary,
  })

  // Rank badges — placed just below the hero panel
  const rankBadgesY = heroPanelY + 272 + 14
  if (typeof input.archetypeRank === 'number' && input.serialNumber) {
    drawRankBadges(ctx, rankBadgesY, input.archetypeRank, input.serialNumber, input.globalRank)
  }

  // Quote box with share line (compressed to make room for trait bars)
  const quoteBoxY = rankBadgesY + 36 + 14
  const quoteBoxHeight = 90
  fillRoundedRect(ctx, CARD_X + 44, quoteBoxY, CARD_WIDTH - 88, quoteBoxHeight, 30, PALETTE.quoteBoxFill)
  strokeRoundedRect(ctx, CARD_X + 44, quoteBoxY, CARD_WIDTH - 88, quoteBoxHeight, 30, PALETTE.quoteBoxBorder, 2)

  drawTextBlock(ctx, {
    text: input.shareLine,
    x: CARD_X + 74,
    y: quoteBoxY + 22,
    maxCharsPerLine: 22,
    maxLines: 2,
    lineHeight: 28,
    fontSize: 28,
    color: PALETTE.textBody,
  })

  // Rarity and skill attribute badges
  const secondaryBadgesY = quoteBoxY + quoteBoxHeight + 12
  if (input.rarityLabel) {
    drawBadge(ctx, {
      text: input.rarityLabel,
      x: CARD_X + 44,
      y: secondaryBadgesY,
      width: 126,
      fill: PALETTE.badgeRarityFill,
      color: PALETTE.badgeRarityText,
    })
  }

  drawBadge(ctx, {
    text: input.skillAttribute,
    x: CARD_X + CARD_WIDTH - 182,
    y: secondaryBadgesY,
    width: 138,
    fill: toCanvasRGBA(input.accentSoft, 1),
    color: PALETTE.skillAttributeText,
  })

  // Top match chips
  const matchChipsY = secondaryBadgesY + 42 + 8
  if (input.topMatches.length > 0) {
    input.topMatches.slice(0, 3).forEach((match, index) => {
      drawBadge(ctx, {
        text: `${match.archetype} ${clampPercent(match.score)}%`,
        x: CARD_X + 188 + index * 156,
        y: matchChipsY,
        width: 144,
        fill: PALETTE.badgeMatchFill,
        color: PALETTE.badgeMatchText,
      })
    })
  }

  // Social energy bar
  const energyBarY = matchChipsY + 42 + 12
  if (typeof input.energyLevel === 'number') {
    drawEnergyBar(ctx, energyBarY, input.energyLevel, input.accentColor)
  }

  // ── Trait bars (6 ACOEXP dimensions) ────────────────────────────
  const traitBarsY = energyBarY + 54 + 12
  let traitBarsHeight = 0
  if (input.traitEntries.length > 0) {
    traitBarsHeight = drawTraitBars(ctx, traitBarsY, input.traitEntries, input.accentColor)
  }

  // Skill cards
  const skillCardsY = traitBarsY + traitBarsHeight + 16
  const skillCardHeight = 148
  const skillCardWidth = (CARD_WIDTH - 120) / 2
  drawSkillCard(ctx, {
    x: CARD_X + 42,
    y: skillCardsY,
    width: skillCardWidth,
    title: input.activeSkillTitle,
    effect: input.activeSkillEffect,
    label: '氛围技能',
    fill: PALETTE.activeSkillFill,
    accent: PALETTE.activeSkillAccent,
  })
  drawSkillCard(ctx, {
    x: CARD_X + 78 + skillCardWidth,
    y: skillCardsY,
    width: skillCardWidth,
    title: input.passiveSkillTitle,
    effect: input.passiveSkillEffect,
    label: '氛围天赋',
    fill: PALETTE.passiveSkillFill,
    accent: PALETTE.passiveSkillAccent,
  })

  // Holographic edition stamp
  const holoStampY = skillCardsY + skillCardHeight + 14
  drawHolographicStamp(ctx, POSTER_WIDTH / 2, holoStampY + 18)

  // Footer text, logo lockup, and attribution
  const footerY = holoStampY + 36 + 16

  // JoyJoin logo text lockup
  ctx.save()
  ctx.setFillStyle(PALETTE.footerText)
  ctx.setFontSize(16)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('JOYJOIN · 悦聚', POSTER_WIDTH / 2, footerY - 28)
  ctx.restore()

  drawTextBlock(ctx, {
    text: '来悦聚测测你的社交命格，看看默契会带你去哪里',
    x: CARD_X + 52,
    y: footerY,
    maxCharsPerLine: 24,
    maxLines: 2,
    lineHeight: 28,
    fontSize: 20,
    color: PALETTE.footerText,
  })

  drawAttributionWatermark(ctx, CARD_X, footerY + 56, CARD_WIDTH)

  // Determine export resolution based on device capability
  // Cap DPR at 2 universally — 1080×1920 at DPR 3 = ~74MB backing store,
  // which crashes on mid-range devices. DPR 2 (~33MB) is safe and
  // visually indistinguishable for social-media sharing.
  const systemInfo = Taro.getSystemInfoSync()
  const dpr = systemInfo.pixelRatio || 2
  const exportMultiplier = Math.min(Math.max(dpr, 1), 2)

  // Canvas draw timeout guard — on low-end devices ctx.draw() can hang.
  // Race with a 15s timeout to prevent infinite hangs.
  const DRAW_TIMEOUT_MS = 15_000

  return await new Promise<string>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Canvas draw timed out'))
      }
    }, DRAW_TIMEOUT_MS)

    ctx.draw(false, async () => {
      if (settled) return
      try {
        const tempFilePath = await exportCanvasWithRetry(PERSONALITY_SHARE_POSTER_CANVAS_ID, POSTER_WIDTH, POSTER_HEIGHT)
        settled = true
        clearTimeout(timeout)
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error)
      }
    })
  })
}
