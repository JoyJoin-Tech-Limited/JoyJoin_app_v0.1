import Taro from '@tarojs/taro'

const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1920
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
const SKILL_CARD_HEIGHT = 158
const SKILL_CARD_RADIUS = 28

const PALETTE = {
  pageBgStart: '#fff8fb',
  pageBgMid: '#fff3ea',
  pageBgEnd: '#f6ecff',
  cardFill: '#fffdfa',
  cardBorder: '#f5c86b',
  cardInnerBorder: 'rgba(255, 255, 255, 0.95)',
  shadowPurple: 'rgba(91, 53, 178, 0.14)',
  shadowOrange: 'rgba(255, 177, 87, 0.25)',
  white: '#ffffff', // design-audit:intentional — canvas rendering requires exact hex values
  heroGlowEnd: '#ffcf7d',
  heroImageShell: '#fff7ee',
  heroImageBorder: 'rgba(255, 255, 255, 0.85)',
  textDark: '#201533',
  textMuted: '#6f5a8e',
  textSecondary: '#46355f',
  textTertiary: '#6b5a7f',
  textBody: '#2b1b41',
  traitLabel: '#5d4c78',
  traitTrack: '#f4ebff',
  badgeDarkFill: '#23123d',
  badgeDarkText: '#fff7d6',
  badgeConfidenceFill: '#fff1cc',
  badgeConfidenceText: '#7a4a00',
  badgeRarityFill: '#f0e7ff',
  badgeRarityText: '#5d35b2',
  badgeMatchFill: '#fff7db',
  badgeMatchText: '#815900',
  quoteBoxFill: '#fff5ef',
  quoteBoxBorder: 'rgba(255, 193, 140, 0.55)',
  activeSkillFill: '#fff5f1',
  activeSkillAccent: '#ff9969',
  passiveSkillFill: '#f4f0ff',
  passiveSkillAccent: '#8b5cf6',
  skillCardBorder: 'rgba(91, 53, 178, 0.12)',
  skillTitle: '#25173a',
  skillEffect: '#64557c',
  footerText: '#6d5f80',
  skillAttributeText: '#4b2f77',
  holographicGold: '#ffd700',
  holographicSilver: '#e8e8e8',
  foilPink: '#ffb6c1',
  foilCyan: '#40e0d0',
  foilLavender: '#e6e6fa',
} as const

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
  energyLevel?: number
  archetypeRank?: number
  serialNumber?: string
}

function drawRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius)
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius)
  ctx.arcTo(x, y + height, x, y, safeRadius)
  ctx.arcTo(x, y, x + width, y, safeRadius)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | Taro.CanvasGradient,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.setFillStyle(fillStyle)
  ctx.fill()
  ctx.restore()
}

function strokeRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth: number,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.setStrokeStyle(strokeStyle)
  ctx.setLineWidth(lineWidth)
  ctx.stroke()
  ctx.restore()
}

function clipRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.clip()
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(Math.round(value), 100))
}

function splitText(text: string, maxCharsPerLine: number, maxLines = 2): string[] {
  const normalized = text.trim()
  if (!normalized) {
    return []
  }

  const chars = Array.from(normalized)
  const lines: string[] = []
  let currentLine = ''
  let currentWeight = 0

  chars.forEach((char) => {
    const weight = /[A-Za-z0-9]/.test(char) ? 0.72 : 1
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

function drawTextBlock(ctx: Taro.CanvasContext, options: {
  text: string
  x: number
  y: number
  maxCharsPerLine: number
  maxLines?: number
  lineHeight: number
  fontSize: number
  color: string
}): number {
  const lines = splitText(options.text, options.maxCharsPerLine, options.maxLines)
  ctx.save()
  ctx.setFillStyle(options.color)
  ctx.setFontSize(options.fontSize)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')

  lines.forEach((line, index) => {
    ctx.fillText(line, options.x, options.y + index * options.lineHeight)
  })
  ctx.restore()

  return lines.length * options.lineHeight
}

function drawBadge(ctx: Taro.CanvasContext, options: {
  text: string
  x: number
  y: number
  width: number
  fill: string
  color: string
}): void {
  fillRoundedRect(ctx, options.x, options.y, options.width, BADGE_HEIGHT, BADGE_RADIUS, options.fill)
  ctx.save()
  ctx.setFillStyle(options.color)
  ctx.setFontSize(20)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(options.text, options.x + options.width / 2, options.y + BADGE_HEIGHT / 2)
  ctx.restore()
}

/**
 * Resolve image path with pre-flight validation.
 * For canvas drawImage, we need a resolved local path.
 * This validates the image can be loaded before attempting to draw.
 */
async function resolveImagePath(src: string): Promise<string> {
  if (!src) {
    return ''
  }

  try {
    const imageInfo = await Taro.getImageInfo({ src })
    if (imageInfo.path) {
      return imageInfo.path
    }
  } catch (err) {
    // Pre-flight failed — image may not be available locally
    console.warn('[sharePoster] getImageInfo failed for', src, err)
  }
  return ''
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
 * Create a metallic gold linear gradient for borders and stamps.
 */
function createMetallicGold(ctx: Taro.CanvasContext, x1: number, y1: number, x2: number, y2: number): Taro.CanvasGradient {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, '#bf953f')
  gradient.addColorStop(0.25, '#fcf6ba')
  gradient.addColorStop(0.5, '#b38728')
  gradient.addColorStop(0.75, '#fbf5b7')
  gradient.addColorStop(1, '#aa771c')
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
  ctx.fillText('★ HOLOGRAPHIC EDITION ★', centerX, centerY)

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
  ctx.fillText('悦聚 · 测测你的社交命格 · 找到同频的人', x + width / 2, y)
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
    heroGlow.addColorStop(0, accentColor)
    heroGlow.addColorStop(0.6, `${accentColor}88`) // 53% opacity
    heroGlow.addColorStop(1, PALETTE.heroGlowEnd)
  } catch {
    heroGlow = ctx.createLinearGradient(
      CARD_X + 40, CARD_Y + 140, CARD_X + CARD_WIDTH - 40, CARD_Y + 370,
    )
    heroGlow.addColorStop(0, accentColor)
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
  const label = '⚡ 社交能量'

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
  ctx.fillText(`🎴 命格编号 No.${archetypeRank}`, leftBadgeX + leftBadgeWidth / 2, badgeY + badgeHeight / 2)
  ctx.restore()

  // Serial number badge (right)
  const rightBadgeWidth = 180
  const rightBadgeX = CARD_X + CARD_WIDTH - 44 - rightBadgeWidth
  fillRoundedRect(ctx, rightBadgeX, badgeY, rightBadgeWidth, badgeHeight, badgeRadius, 'rgba(255, 248, 214, 0.94)')
  strokeRoundedRect(ctx, rightBadgeX, badgeY, rightBadgeWidth, badgeHeight, badgeRadius, 'rgba(180, 140, 40, 0.15)', 1)

  ctx.save()
  ctx.setFillStyle('#7a5a09')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(`🏅 ${serialNumber}`, rightBadgeX + rightBadgeWidth / 2, badgeY + badgeHeight / 2)
  ctx.restore()
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
  // Use PNG fallback for canvas drawImage (WebP compatibility uncertain in canvas context)
  const canvasAsset = input.archetypeAssetPng || input.archetypeAsset
  const archetypeImagePath = await resolveImagePath(canvasAsset)

  const ctx = Taro.createCanvasContext(PERSONALITY_SHARE_POSTER_CANVAS_ID)
  createCardBackground(ctx, input.accentColor)

  drawBadge(ctx, {
    text: '悦聚 · 社交命盘',
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
    ctx.drawImage(archetypeImagePath, imageShellX + 20, imageShellY + 18, 184, 184)
    ctx.restore()
  }

  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(48)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, heroPanelX + 280, heroPanelY + 24)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.nickname || input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 82,
    maxCharsPerLine: 12,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 24,
    color: PALETTE.textMuted,
  })

  drawTextBlock(ctx, {
    text: input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 118,
    maxCharsPerLine: 14,
    maxLines: 2,
    lineHeight: 30,
    fontSize: 22,
    color: PALETTE.textSecondary,
  })

  drawTextBlock(ctx, {
    text: input.summary,
    x: heroPanelX + 280,
    y: heroPanelY + 178,
    maxCharsPerLine: 17,
    maxLines: 2,
    lineHeight: 28,
    fontSize: 20,
    color: PALETTE.textTertiary,
  })

  // Rank badges — placed just below the hero panel
  const rankBadgesY = heroPanelY + 272 + 14
  if (typeof input.archetypeRank === 'number' && input.serialNumber) {
    drawRankBadges(ctx, rankBadgesY, input.archetypeRank, input.serialNumber)
  }

  // Quote box with share line
  const quoteBoxY = rankBadgesY + 36 + 14
  const quoteBoxHeight = 120
  fillRoundedRect(ctx, CARD_X + 44, quoteBoxY, CARD_WIDTH - 88, quoteBoxHeight, 30, PALETTE.quoteBoxFill)
  strokeRoundedRect(ctx, CARD_X + 44, quoteBoxY, CARD_WIDTH - 88, quoteBoxHeight, 30, PALETTE.quoteBoxBorder, 2)

  drawTextBlock(ctx, {
    text: input.shareLine,
    x: CARD_X + 74,
    y: quoteBoxY + 30,
    maxCharsPerLine: 20,
    maxLines: 2,
    lineHeight: 34,
    fontSize: 28,
    color: PALETTE.textBody,
  })

  // Rarity and skill attribute badges
  const secondaryBadgesY = quoteBoxY + quoteBoxHeight + 14
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
    fill: input.accentSoft,
    color: PALETTE.skillAttributeText,
  })

  // Top match chips
  const matchChipsY = secondaryBadgesY + 42 + 10
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
  const energyBarY = matchChipsY + 42 + 16
  if (typeof input.energyLevel === 'number') {
    drawEnergyBar(ctx, energyBarY, input.energyLevel, input.accentColor)
  }

  // Skill cards
  const skillCardsY = energyBarY + 54 + 18
  const skillCardHeight = 148
  const skillCardWidth = (CARD_WIDTH - 120) / 2
  drawSkillCard(ctx, {
    x: CARD_X + 42,
    y: skillCardsY,
    width: skillCardWidth,
    title: input.activeSkillTitle,
    effect: input.activeSkillEffect,
    label: '主动技',
    fill: PALETTE.activeSkillFill,
    accent: PALETTE.activeSkillAccent,
  })
  drawSkillCard(ctx, {
    x: CARD_X + 78 + skillCardWidth,
    y: skillCardsY,
    width: skillCardWidth,
    title: input.passiveSkillTitle,
    effect: input.passiveSkillEffect,
    label: '被动技',
    fill: PALETTE.passiveSkillFill,
    accent: PALETTE.passiveSkillAccent,
  })

  // Holographic edition stamp
  const holoStampY = skillCardsY + skillCardHeight + 18
  drawHolographicStamp(ctx, POSTER_WIDTH / 2, holoStampY + 18)

  // Footer text and attribution
  const footerY = holoStampY + 36 + 16
  drawTextBlock(ctx, {
    text: '来悦聚测测你的社交命格，看看缘分会带你去哪里 ✨',
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
  // Cap DPR at 2 for low-RAM devices to prevent OOM
  const systemInfo = Taro.getSystemInfoSync()
  const dpr = systemInfo.pixelRatio || 2
  const ram = (systemInfo as { deviceMemory?: number }).deviceMemory || 4
  const dprCap = ram < 3 ? 2 : 3
  const exportMultiplier = Math.min(Math.max(dpr, 2), dprCap)

  return await new Promise<string>((resolve, reject) => {
    ctx.draw(false, async () => {
      try {
        const output = await Taro.canvasToTempFilePath({
          canvasId: PERSONALITY_SHARE_POSTER_CANVAS_ID,
          x: 0,
          y: 0,
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
          destWidth: Math.round(POSTER_WIDTH * exportMultiplier),
          destHeight: Math.round(POSTER_HEIGHT * exportMultiplier),
          fileType: 'png',
          quality: 1,
        })
        // Clean up temp file after a delay (allow share/save to complete first)
        setTimeout(() => {
          try {
            const fs = Taro.getFileSystemManager()
            fs.unlinkSync(output.tempFilePath)
          } catch {
            // Ignore cleanup errors
          }
        }, 60000)
        resolve(output.tempFilePath)
      } catch (error) {
        reject(error)
      }
    })
  })
}
