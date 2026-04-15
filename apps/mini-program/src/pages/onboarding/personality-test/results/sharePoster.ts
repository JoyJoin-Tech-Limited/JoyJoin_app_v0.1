import Taro from '@tarojs/taro'

const POSTER_WIDTH = 750
const POSTER_HEIGHT = 1200
const OUTER_MARGIN = 28
const CARD_RADIUS = 40
const CARD_X = OUTER_MARGIN
const CARD_Y = OUTER_MARGIN
const CARD_WIDTH = POSTER_WIDTH - OUTER_MARGIN * 2
const CARD_HEIGHT = POSTER_HEIGHT - OUTER_MARGIN * 2

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
  accentStrong: string
  archetypeAsset: string
  xiaoyueAsset: string
  confidenceLabel?: string
  rarityLabel?: string
  skillAttribute: string
  activeSkillTitle: string
  activeSkillEffect: string
  passiveSkillTitle: string
  passiveSkillEffect: string
  traitEntries: PersonalitySharePosterTraitEntry[]
  topMatches: PersonalitySharePosterTopMatch[]
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
  fillRoundedRect(ctx, options.x, options.y, options.width, 42, 21, options.fill)
  ctx.save()
  ctx.setFillStyle(options.color)
  ctx.setFontSize(20)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(options.text, options.x + options.width / 2, options.y + 21)
  ctx.restore()
}

async function resolveImagePath(src: string): Promise<string> {
  if (!src) {
    return ''
  }

  try {
    const imageInfo = await Taro.getImageInfo({ src })
    return imageInfo.path || src
  } catch {
    return src
  }
}

function createCardBackground(ctx: Taro.CanvasContext, accentColor: string): void {
  const pageGradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  pageGradient.addColorStop(0, '#fff8fb')
  pageGradient.addColorStop(0.45, '#fff3ea')
  pageGradient.addColorStop(1, '#f6ecff')
  ctx.setFillStyle(pageGradient)
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, '#fffdfa')
  strokeRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, '#f5c86b', 6)
  strokeRoundedRect(ctx, CARD_X + 10, CARD_Y + 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, CARD_RADIUS - 10, 'rgba(255, 255, 255, 0.95)', 2)

  ctx.save()
  ctx.setShadow(0, 14, 36, 'rgba(91, 53, 178, 0.14)')
  fillRoundedRect(ctx, CARD_X + 26, CARD_Y + 120, CARD_WIDTH - 52, 300, 36, '#ffffff')
  ctx.restore()

  const heroGlow = ctx.createLinearGradient(CARD_X + 40, CARD_Y + 150, CARD_X + CARD_WIDTH - 40, CARD_Y + 400)
  heroGlow.addColorStop(0, accentColor)
  heroGlow.addColorStop(1, '#ffcf7d')
  fillRoundedRect(ctx, CARD_X + 34, CARD_Y + 126, CARD_WIDTH - 68, 288, 32, heroGlow)
}

function drawTraitBars(
  ctx: Taro.CanvasContext,
  traitEntries: PersonalitySharePosterTraitEntry[],
  accentColor: string,
): void {
  const sectionX = CARD_X + 46
  const sectionY = CARD_Y + 740
  const trackWidth = CARD_WIDTH - 152

  ctx.save()
  ctx.setFillStyle('#35294d')
  ctx.setFontSize(26)
  ctx.setTextBaseline('top')
  ctx.fillText('Trait Meter', sectionX, sectionY)
  ctx.restore()

  traitEntries.slice(0, 4).forEach((trait, index) => {
    const rowY = sectionY + 54 + index * 64
    fillRoundedRect(ctx, sectionX + 122, rowY + 10, trackWidth, 18, 10, '#f4ebff')
    fillRoundedRect(
      ctx,
      sectionX + 122,
      rowY + 10,
      Math.max(36, trackWidth * (clampPercent(trait.value) / 100)),
      18,
      10,
      accentColor,
    )

    ctx.save()
    ctx.setFillStyle('#5d4c78')
    ctx.setFontSize(22)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(trait.label, sectionX, rowY)
    ctx.setTextAlign('right')
    ctx.fillText(String(clampPercent(trait.value)), sectionX + 110 + trackWidth + 28, rowY)
    ctx.restore()
  })
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
  fillRoundedRect(ctx, options.x, options.y, options.width, 158, 28, options.fill)
  strokeRoundedRect(ctx, options.x, options.y, options.width, 158, 28, 'rgba(91, 53, 178, 0.12)', 2)

  drawBadge(ctx, {
    text: options.label,
    x: options.x + 22,
    y: options.y + 18,
    width: 96,
    fill: options.accent,
    color: '#ffffff',
  })

  drawTextBlock(ctx, {
    text: options.title,
    x: options.x + 22,
    y: options.y + 74,
    maxCharsPerLine: 11,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 26,
    color: '#25173a',
  })

  drawTextBlock(ctx, {
    text: options.effect,
    x: options.x + 22,
    y: options.y + 110,
    maxCharsPerLine: 16,
    maxLines: 2,
    lineHeight: 26,
    fontSize: 20,
    color: '#64557c',
  })
}

export async function generatePersonalitySharePoster(
  input: PersonalitySharePosterInput,
): Promise<string> {
  const [archetypeImagePath, xiaoyueImagePath] = await Promise.all([
    resolveImagePath(input.archetypeAsset),
    resolveImagePath(input.xiaoyueAsset),
  ])

  const ctx = Taro.createCanvasContext(PERSONALITY_SHARE_POSTER_CANVAS_ID)
  createCardBackground(ctx, input.accentColor)

  drawBadge(ctx, {
    text: 'JOYJOIN TCG',
    x: CARD_X + 36,
    y: CARD_Y + 40,
    width: 172,
    fill: '#23123d',
    color: '#fff7d6',
  })

  drawBadge(ctx, {
    text: input.confidenceLabel ?? '匿名结果',
    x: CARD_X + CARD_WIDTH - 184,
    y: CARD_Y + 40,
    width: 148,
    fill: '#fff1cc',
    color: '#7a4a00',
  })

  const heroPanelX = CARD_X + 52
  const heroPanelY = CARD_Y + 148
  const heroPanelWidth = CARD_WIDTH - 104
  const imageShellX = heroPanelX + 26
  const imageShellY = heroPanelY + 28

  ctx.save()
  ctx.setShadow(0, 12, 28, 'rgba(255, 177, 87, 0.25)')
  fillRoundedRect(ctx, imageShellX, imageShellY, 224, 224, 112, '#fff7ee')
  ctx.restore()
  strokeRoundedRect(ctx, imageShellX, imageShellY, 224, 224, 112, 'rgba(255, 255, 255, 0.85)', 3)

  if (archetypeImagePath) {
    ctx.save()
    clipRoundedRect(ctx, imageShellX, imageShellY, 224, 224, 112)
    ctx.drawImage(archetypeImagePath, imageShellX + 20, imageShellY + 18, 184, 184)
    ctx.restore()
  }

  ctx.save()
  ctx.setFillStyle('#201533')
  ctx.setFontSize(48)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, heroPanelX + 280, heroPanelY + 34)
  ctx.restore()

  drawTextBlock(ctx, {
    text: input.nickname || input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 98,
    maxCharsPerLine: 12,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 24,
    color: '#6f5a8e',
  })

  drawTextBlock(ctx, {
    text: input.tagline,
    x: heroPanelX + 280,
    y: heroPanelY + 138,
    maxCharsPerLine: 14,
    maxLines: 2,
    lineHeight: 30,
    fontSize: 22,
    color: '#46355f',
  })

  drawTextBlock(ctx, {
    text: input.summary,
    x: heroPanelX + 280,
    y: heroPanelY + 214,
    maxCharsPerLine: 17,
    maxLines: 3,
    lineHeight: 28,
    fontSize: 20,
    color: '#6b5a7f',
  })

  fillRoundedRect(ctx, CARD_X + 44, CARD_Y + 470, CARD_WIDTH - 88, 150, 30, '#fff5ef')
  strokeRoundedRect(ctx, CARD_X + 44, CARD_Y + 470, CARD_WIDTH - 88, 150, 30, 'rgba(255, 193, 140, 0.55)', 2)

  drawTextBlock(ctx, {
    text: input.shareLine,
    x: CARD_X + 74,
    y: CARD_Y + 514,
    maxCharsPerLine: 20,
    maxLines: 3,
    lineHeight: 34,
    fontSize: 28,
    color: '#2b1b41',
  })

  if (input.rarityLabel) {
    drawBadge(ctx, {
      text: input.rarityLabel,
      x: CARD_X + 44,
      y: CARD_Y + 652,
      width: 126,
      fill: '#f0e7ff',
      color: '#5d35b2',
    })
  }

  drawBadge(ctx, {
    text: input.skillAttribute,
    x: CARD_X + CARD_WIDTH - 182,
    y: CARD_Y + 652,
    width: 138,
    fill: input.accentSoft,
    color: '#4b2f77',
  })

  drawTraitBars(ctx, input.traitEntries, input.accentColor)

  const skillCardY = CARD_Y + 1016
  const skillCardWidth = (CARD_WIDTH - 120) / 2
  drawSkillCard(ctx, {
    x: CARD_X + 42,
    y: skillCardY,
    width: skillCardWidth,
    title: input.activeSkillTitle,
    effect: input.activeSkillEffect,
    label: '主动技',
    fill: '#fff5f1',
    accent: '#ff9969',
  })
  drawSkillCard(ctx, {
    x: CARD_X + 78 + skillCardWidth,
    y: skillCardY,
    width: skillCardWidth,
    title: input.passiveSkillTitle,
    effect: input.passiveSkillEffect,
    label: '被动技',
    fill: '#f4f0ff',
    accent: '#8b5cf6',
  })

  if (input.topMatches.length > 0) {
    const chipY = CARD_Y + 692
    input.topMatches.slice(0, 3).forEach((match, index) => {
      drawBadge(ctx, {
        text: `${match.archetype} ${clampPercent(match.score)}%`,
        x: CARD_X + 188 + index * 156,
        y: chipY,
        width: 144,
        fill: '#fff7db',
        color: '#815900',
      })
    })
  }

  if (xiaoyueImagePath) {
    ctx.drawImage(xiaoyueImagePath, CARD_X + CARD_WIDTH - 182, CARD_Y + CARD_HEIGHT - 192, 132, 132)
  }

  drawTextBlock(ctx, {
    text: '来 JoyJoin 测测你的社交原型，看看你会点亮哪一张卡。',
    x: CARD_X + 52,
    y: CARD_Y + CARD_HEIGHT - 112,
    maxCharsPerLine: 24,
    maxLines: 2,
    lineHeight: 28,
    fontSize: 20,
    color: '#6d5f80',
  })

  return await new Promise<string>((resolve, reject) => {
    ctx.draw(false, async () => {
      try {
        const output = await Taro.canvasToTempFilePath({
          canvasId: PERSONALITY_SHARE_POSTER_CANVAS_ID,
          x: 0,
          y: 0,
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
          destWidth: POSTER_WIDTH * 2,
          destHeight: POSTER_HEIGHT * 2,
          fileType: 'png',
          quality: 1,
        })
        resolve(output.tempFilePath)
      } catch (error) {
        reject(error)
      }
    })
  })
}