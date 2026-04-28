import Taro from '@tarojs/taro'
import { getArchetypeHSL, ARCHETYPE_LEGACY_NAME_MAP } from '@joyjoin/shared'

// ─── Constants ───────────────────────────────────────────────────────────────

const SQUARE_SIZE = 750
const GROUP_REVEAL_W = 750
const GROUP_REVEAL_H = 1000

const PALETTE = {
  bgStart: '#fff8fb',
  bgMid: '#f5eeff',
  bgEnd: '#ede4ff',
  goldStart: '#fff7db',
  goldMid: '#ffecd2',
  goldEnd: '#f8d7da',
  cardWhite: '#ffffff',
  textDark: '#201533',
  textMuted: '#6f5a8e',
  textSecondary: '#46355f',
  textLight: '#8b7fa3',
  badgeDarkFill: '#23123d',
  badgeDarkText: '#fff7d6',
  badgeGoldFill: '#fff1cc',
  badgeGoldText: '#7a4a00',
  badgePurpleFill: '#f0e7ff',
  badgePurpleText: '#5d35b2',
  borderGold: '#f5c86b',
  borderLight: 'rgba(139,92,246,0.12)',
  memberBg: 'rgba(255,255,255,0.85)',
  footerText: '#6d5f80',
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const sr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + sr, y)
  ctx.arcTo(x + w, y, x + w, y + h, sr)
  ctx.arcTo(x + w, y + h, x, y + h, sr)
  ctx.arcTo(x, y + h, x, y, sr)
  ctx.arcTo(x, y, x + w, y, sr)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | Taro.CanvasGradient,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.setFillStyle(fill)
  ctx.fill()
  ctx.restore()
}

function strokeRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lw: number,
): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.setStrokeStyle(stroke)
  ctx.setLineWidth(lw)
  ctx.stroke()
  ctx.restore()
}

function clipRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.clip()
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lig - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function getArchetypeColorHex(archetypeName: string | undefined): string {
  if (!archetypeName) return '#8b5cf6'
  const key = ARCHETYPE_LEGACY_NAME_MAP[archetypeName]
  if (!key) return '#8b5cf6'
  const hsl = getArchetypeHSL(key)
  return hslToHex(hsl.h, hsl.s, hsl.l)
}

function splitText(text: string, maxChars: number, maxLines = 2): string[] {
  const norm = text.trim()
  if (!norm) return []
  const chars = Array.from(norm)
  const lines: string[] = []
  let line = ''
  let weight = 0
  for (const ch of chars) {
    const w = /[A-Za-z0-9]/.test(ch) ? 0.72 : 1
    if (weight + w > maxChars && line) {
      lines.push(line)
      line = ch
      weight = w
      continue
    }
    line += ch
    weight += w
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const trimmed = lines.slice(0, maxLines)
  const last = trimmed[maxLines - 1] ?? ''
  trimmed[maxLines - 1] = `${last.slice(0, Math.max(last.length - 1, 1))}…`
  return trimmed
}

function drawTextBlock(
  ctx: Taro.CanvasContext,
  opts: {
    text: string
    x: number
    y: number
    maxChars: number
    maxLines?: number
    lineHeight: number
    fontSize: number
    color: string
    align?: 'left' | 'center' | 'right'
  },
): number {
  const lines = splitText(opts.text, opts.maxChars, opts.maxLines)
  ctx.save()
  ctx.setFillStyle(opts.color)
  ctx.setFontSize(opts.fontSize)
  ctx.setTextAlign(opts.align ?? 'left')
  ctx.setTextBaseline('top')
  lines.forEach((line, i) => {
    ctx.fillText(line, opts.x, opts.y + i * opts.lineHeight)
  })
  ctx.restore()
  return lines.length * opts.lineHeight
}

function drawBadge(
  ctx: Taro.CanvasContext,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  color: string,
): void {
  fillRoundedRect(ctx, x, y, w, h, r, fill)
  ctx.save()
  ctx.setFillStyle(color)
  ctx.setFontSize(Math.round(h * 0.55))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(text, x + w / 2, y + h / 2)
  ctx.restore()
}

async function resolveImagePath(src: string): Promise<string> {
  if (!src) return ''
  try {
    const info = await Taro.getImageInfo({ src })
    return info.path || ''
  } catch {
    return ''
  }
}

function exportCanvas(
  ctx: Taro.CanvasContext,
  canvasId: string,
  width: number,
  height: number,
): Promise<string> {
  const sys = Taro.getSystemInfoSync()
  const dpr = sys.pixelRatio || 2
  const ram = (sys as { deviceMemory?: number }).deviceMemory || 4
  const cap = ram < 3 ? 2 : 3
  const mult = Math.min(Math.max(dpr, 2), cap)

  return new Promise((resolve, reject) => {
    ctx.draw(false, async () => {
      try {
        const out = await Taro.canvasToTempFilePath({
          canvasId,
          x: 0,
          y: 0,
          width,
          height,
          destWidth: Math.round(width * mult),
          destHeight: Math.round(height * mult),
          fileType: 'png',
          quality: 1,
        })
        setTimeout(() => {
          try { Taro.getFileSystemManager().unlinkSync(out.tempFilePath) } catch {}
        }, 60000)
        resolve(out.tempFilePath)
      } catch (err) {
        reject(err)
      }
    })
  })
}

// ─── Square Personality Poster (1:1 for WeChat Moments) ──────────────────────

export const PERSONALITY_SQUARE_CANVAS_ID = 'personality-square-poster-canvas'

export interface PersonalitySquarePosterInput {
  archetype: string
  tagline: string
  rarityPercentage: number
  archetypeAsset: string
  archetypeAssetPng?: string
}

export async function generatePersonalitySquarePoster(
  input: PersonalitySquarePosterInput,
): Promise<string> {
  const canvasId = PERSONALITY_SQUARE_CANVAS_ID
  const ctx = Taro.createCanvasContext(canvasId)
  const S = SQUARE_SIZE
  const M = 40

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, S, S)
  bgGrad.addColorStop(0, PALETTE.bgStart)
  bgGrad.addColorStop(0.5, PALETTE.bgMid)
  bgGrad.addColorStop(1, PALETTE.bgEnd)
  ctx.setFillStyle(bgGrad)
  ctx.fillRect(0, 0, S, S)

  // Main card
  const cardW = S - M * 2
  const cardH = S - M * 2
  fillRoundedRect(ctx, M, M, cardW, cardH, 36, PALETTE.cardWhite)
  strokeRoundedRect(ctx, M, M, cardW, cardH, 36, PALETTE.borderGold, 4)

  // Top badge
  drawBadge(ctx, '悦聚 · 社交命盘', M + 28, M + 28, 180, 40, 20, PALETTE.badgeDarkFill, PALETTE.badgeDarkText)

  // Archetype name (large, centered)
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(56)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, S / 2, M + 110)
  ctx.restore()

  // Hero image (circular, 200px)
  const imgSize = 200
  const imgX = (S - imgSize) / 2
  const imgY = M + 180
  const imgPath = await resolveImagePath(input.archetypeAssetPng || input.archetypeAsset)

  fillRoundedRect(ctx, imgX - 6, imgY - 6, imgSize + 12, imgSize + 12, imgSize / 2 + 6, 'rgba(139,92,246,0.08)')
  if (imgPath) {
    ctx.save()
    clipRoundedRect(ctx, imgX, imgY, imgSize, imgSize, imgSize / 2)
    ctx.drawImage(imgPath, imgX, imgY, imgSize, imgSize)
    ctx.restore()
  } else {
    // Fallback: colored circle with first char
    const color = getArchetypeColorHex(input.archetype)
    fillRoundedRect(ctx, imgX, imgY, imgSize, imgSize, imgSize / 2, color)
    ctx.save()
    ctx.setFillStyle('#fff')
    ctx.setFontSize(80)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText(input.archetype.slice(0, 1), S / 2, imgY + imgSize / 2)
    ctx.restore()
  }

  // Tagline
  drawTextBlock(ctx, {
    text: input.tagline,
    x: S / 2,
    y: imgY + imgSize + 24,
    maxChars: 16,
    maxLines: 2,
    lineHeight: 36,
    fontSize: 26,
    color: PALETTE.textSecondary,
    align: 'center',
  })

  // Rarity badge
  const rarityText = `缘分稀有度 ${Math.round(input.rarityPercentage)}%`
  drawBadge(ctx, rarityText, S / 2 - 130, imgY + imgSize + 100, 260, 44, 22, PALETTE.badgePurpleFill, PALETTE.badgePurpleText)

  // Bottom CTA
  drawTextBlock(ctx, {
    text: '来 JoyJoin 测测你的社交命格',
    x: S / 2,
    y: S - M - 80,
    maxChars: 20,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 22,
    color: PALETTE.footerText,
    align: 'center',
  })

  // JoyJoin watermark
  ctx.save()
  ctx.setFillStyle('rgba(139,92,246,0.08)')
  ctx.setFontSize(16)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('悦聚 · 找到同频的人', S / 2, S - M - 44)
  ctx.restore()

  return exportCanvas(ctx, canvasId, S, S)
}

// ─── Group Reveal Poster (blind-box squad reveal) ────────────────────────────

export const GROUP_REVEAL_CANVAS_ID = 'group-reveal-poster-canvas'

export interface GroupRevealPosterMember {
  displayName: string
  archetype?: string
}

export interface GroupRevealPosterInput {
  poolTitle: string
  groupNumber?: number
  eventType: string
  venueName?: string
  dateTimeText: string
  members: GroupRevealPosterMember[]
  matchScore?: number
}

export async function generateGroupRevealPoster(
  input: GroupRevealPosterInput,
): Promise<string> {
  const canvasId = GROUP_REVEAL_CANVAS_ID
  const ctx = Taro.createCanvasContext(canvasId)
  const W = GROUP_REVEAL_W
  const H = GROUP_REVEAL_H
  const M = 36

  // Background: warm gold gradient
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, PALETTE.goldStart)
  bg.addColorStop(0.5, PALETTE.goldMid)
  bg.addColorStop(1, PALETTE.goldEnd)
  ctx.setFillStyle(bg)
  ctx.fillRect(0, 0, W, H)

  // Decorative dots
  ctx.save()
  ctx.setFillStyle('rgba(255,255,255,0.35)')
  for (let i = 0; i < 20; i++) {
    const dx = ((i * 137) % (W - 40)) + 20
    const dy = ((i * 89) % (H - 40)) + 20
    ctx.beginPath()
    ctx.arc(dx, dy, (i % 3) + 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Main card
  const cardW = W - M * 2
  const cardH = H - M * 2
  fillRoundedRect(ctx, M, M, cardW, cardH, 32, 'rgba(255,255,255,0.92)')
  strokeRoundedRect(ctx, M, M, cardW, cardH, 32, PALETTE.borderGold, 3)

  // Top badge: 盲盒开箱
  drawBadge(ctx, '🎲 盲盒开箱', M + 28, M + 28, 160, 40, 20, PALETTE.badgeGoldFill, PALETTE.badgeGoldText)

  // Match score badge (if available)
  if (typeof input.matchScore === 'number') {
    drawBadge(ctx, `匹配度 ${input.matchScore}分`, W - M - 28 - 140, M + 28, 140, 40, 20, PALETTE.badgePurpleFill, PALETTE.badgePurpleText)
  }

  // Title
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(40)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('缘分小分队集结完毕', W / 2, M + 96)
  ctx.restore()

  // Subtitle: group number + event type
  const groupLabel = input.groupNumber ? `第${input.groupNumber}组` : '神秘小组'
  drawTextBlock(ctx, {
    text: `${groupLabel} · ${input.eventType}`,
    x: W / 2,
    y: M + 152,
    maxChars: 20,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 24,
    color: PALETTE.textMuted,
    align: 'center',
  })

  // Pool title
  drawTextBlock(ctx, {
    text: input.poolTitle,
    x: W / 2,
    y: M + 188,
    maxChars: 22,
    maxLines: 1,
    lineHeight: 28,
    fontSize: 22,
    color: PALETTE.textLight,
    align: 'center',
  })

  // Member grid
  const gridY = M + 244
  const cols = 2
  const cellW = (cardW - 48) / cols
  const cellH = 140
  const maxMembers = Math.min(input.members.length, 6)

  for (let i = 0; i < maxMembers; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = M + 24 + col * cellW + cellW / 2
    const cy = gridY + row * cellH
    const member = input.members[i]
    const color = getArchetypeColorHex(member.archetype)

    // Member card background
    fillRoundedRect(ctx, M + 24 + col * cellW + 4, cy, cellW - 8, cellH - 12, 20, PALETTE.memberBg)
    strokeRoundedRect(ctx, M + 24 + col * cellW + 4, cy, cellW - 8, cellH - 12, 20, PALETTE.borderLight, 1)

    // Archetype color dot
    fillRoundedRect(ctx, cx - 24, cy + 16, 48, 48, 24, color)
    ctx.save()
    ctx.setFillStyle('#fff')
    ctx.setFontSize(20)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText(member.archetype ? member.archetype.slice(0, 1) : '?', cx, cy + 40)
    ctx.restore()

    // Archetype name
    ctx.save()
    ctx.setFillStyle(PALETTE.textSecondary)
    ctx.setFontSize(20)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(member.archetype || '未知命格', cx, cy + 72)
    ctx.restore()

    // Display name
    ctx.save()
    ctx.setFillStyle(PALETTE.textLight)
    ctx.setFontSize(18)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(member.displayName || '匿名', cx, cy + 98)
    ctx.restore()
  }

  // Venue & date info
  const infoY = gridY + Math.ceil(maxMembers / cols) * cellH + 20
  if (input.venueName || input.dateTimeText) {
    const infoText = [input.venueName, input.dateTimeText].filter(Boolean).join(' · ')
    drawTextBlock(ctx, {
      text: infoText,
      x: W / 2,
      y: infoY,
      maxChars: 28,
      maxLines: 1,
      lineHeight: 28,
      fontSize: 20,
      color: PALETTE.textMuted,
      align: 'center',
    })
  }

  // Tagline
  drawTextBlock(ctx, {
    text: '这一局，是缘分把你们聚在一起',
    x: W / 2,
    y: infoY + 44,
    maxChars: 24,
    maxLines: 1,
    lineHeight: 30,
    fontSize: 24,
    color: PALETTE.textSecondary,
    align: 'center',
  })

  // Bottom branding
  drawTextBlock(ctx, {
    text: 'JoyJoin · 悦聚 — 测测你的社交命格',
    x: W / 2,
    y: H - M - 56,
    maxChars: 26,
    maxLines: 1,
    lineHeight: 24,
    fontSize: 18,
    color: PALETTE.footerText,
    align: 'center',
  })

  return exportCanvas(ctx, canvasId, W, H)
}
