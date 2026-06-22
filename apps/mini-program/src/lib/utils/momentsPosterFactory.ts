import Taro from '@tarojs/taro'
import { getArchetypeHSL, ARCHETYPE_LEGACY_NAME_MAP } from '@joyjoin/shared'
import { CANVAS_PALETTE } from '@shared/personality/canvasPalette'
import {
  toCanvasRGBA,
  fillRoundedRect,
  strokeRoundedRect,
  clipRoundedRect,
} from './canvasHelpers'

// ─── Constants ───────────────────────────────────────────────────────────────

const SQUARE_SIZE = 750
const GROUP_REVEAL_W = 750
const GROUP_REVEAL_H = 1000

const PALETTE = {
  // Aligned with CANVAS_PALETTE from @shared/personality/canvasPalette
  bgStart: CANVAS_PALETTE.pageBgStart,   // '#fff8fb'
  bgMid: CANVAS_PALETTE.pageBgMid,       // '#fff3ea' (was '#f5eeff' — drifted from portrait)
  bgEnd: CANVAS_PALETTE.pageBgEnd,       // '#f6ecff' (was '#ede4ff' — drifted from portrait)
  goldStart: '#fff7db',
  goldMid: '#ffecd2',
  goldEnd: '#f8d7da',
  cardWhite: CANVAS_PALETTE.cardFill,     // '#fffdfa' (was '#ffffff')
  textDark: CANVAS_PALETTE.textDark,      // '#201533'
  textMuted: CANVAS_PALETTE.textMuted,    // '#6f5a8e'
  textSecondary: CANVAS_PALETTE.textSecondary, // '#46355f'
  textLight: '#8b7fa3',
  badgeDarkFill: CANVAS_PALETTE.badgeDarkFill, // '#23123d'
  badgeDarkText: CANVAS_PALETTE.badgeDarkText, // '#fff7d6'
  badgeGoldFill: '#fff1cc',
  badgeGoldText: '#7a4a00',
  badgePurpleFill: CANVAS_PALETTE.badgeRarityFill, // '#f0e7ff'
  badgePurpleText: CANVAS_PALETTE.badgeRarityText, // '#5d35b2'
  borderGold: '#f5c86b',
  borderLight: 'rgba(139,92,246,0.12)',
  memberBg: 'rgba(255,255,255,0.85)',
  footerText: CANVAS_PALETTE.footerText,  // '#6d5f80'
  traitTrack: CANVAS_PALETTE.traitTrack,  // '#f4ebff'
  activeSkillBg: CANVAS_PALETTE.activeSkillFill, // '#fff5f1'
  activeSkillText: '#c45e2e',
  passiveSkillBg: CANVAS_PALETTE.passiveSkillFill, // '#f4f0ff'
  passiveSkillText: '#6b3fc7',
} as const

// ─── Canvas helpers imported from @/lib/utils/canvasHelpers.ts ───────────
// drawRoundedRect, fillRoundedRect, strokeRoundedRect, clipRoundedRect,
// resolveImagePath, clampPercent, createMetallicGold, splitText,
// toCanvasRGBA, drawBadge, drawTextBlock are now shared.

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
  const rgba = toCanvasRGBA(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, 1)
  const match = rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)$/)
  if (match) {
    const r = Number(match[1]).toString(16).padStart(2, '0')
    const g = Number(match[2]).toString(16).padStart(2, '0')
    const b = Number(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#8b5cf6'
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
  // Cap DPR at 2 universally for memory safety — matching portrait poster.
  // 750×750 at DPR 3 ≈ 20MB backing store; DPR 2 ≈ 9MB.
  // Social media compresses anyway, so DPR 3 is negligible visual improvement.
  const sys = Taro.getSystemInfoSync()
  const dpr = sys.pixelRatio || 2
  const mult = Math.min(Math.max(dpr, 1), 2)

  // Draw timeout guard — prevent infinite hang on low-end devices
  const DRAW_TIMEOUT_MS = 15_000

  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Canvas draw timed out'))
      }
    }, DRAW_TIMEOUT_MS)

    ctx.draw(false, async () => {
      if (settled) return
      // 2-attempt retry: DPR 2 (primary), then DPR 1 (fallback)
      const dprValues = [mult, 1]
      for (let attempt = 0; attempt < dprValues.length; attempt++) {
        const currentDpr = dprValues[attempt]
        try {
          const out = await Taro.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width,
            height,
            destWidth: Math.round(width * currentDpr),
            destHeight: Math.round(height * currentDpr),
            fileType: 'png',
            quality: 1,
          })
          settled = true
          clearTimeout(timeout)
          setTimeout(() => {
            try { Taro.getFileSystemManager().unlinkSync(out.tempFilePath) } catch {}
          }, 60000)
          resolve(out.tempFilePath)
          return
        } catch (error) {
          if (attempt === dprValues.length - 1) {
            settled = true
            clearTimeout(timeout)
            reject(error)
            return
          }
          await new Promise((r) => setTimeout(r, 50))
        }
      }
    })
  })
}

// ─── Square Poster compact helpers ───────────────────────────────────────────

function clampPercent(value: number): number {
  return Math.max(0, Math.min(Math.round(value), 100))
}

function createMetallicGold(
  ctx: Taro.CanvasContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Taro.CanvasGradient {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, '#bf953f')
  gradient.addColorStop(0.25, '#fcf6ba')
  gradient.addColorStop(0.5, '#b38728')
  gradient.addColorStop(0.75, '#fbf5b7')
  gradient.addColorStop(1, '#aa771c')
  return gradient
}

function drawCompactTraitBars(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  traitEntries: { label: string; value: number }[],
  accentColor: string,
): number {
  const entries = traitEntries.slice(0, 3)
  const rowHeight = 18
  const trackHeight = 8
  const trackRadius = 4
  const labelWidth = 52
  const valueWidth = 28
  const barX = x + labelWidth + 6
  const barMaxWidth = Math.max(4, width - labelWidth - valueWidth - 16)

  entries.forEach((entry, index) => {
    const rowY = y + index * rowHeight

    // Label
    ctx.save()
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setFontSize(14)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('middle')
    ctx.fillText(entry.label, x, rowY + trackHeight / 2)
    ctx.restore()

    // Value
    ctx.save()
    ctx.setFillStyle(PALETTE.textLight)
    ctx.setFontSize(14)
    ctx.setTextAlign('right')
    ctx.setTextBaseline('middle')
    ctx.fillText(String(entry.value), x + width, rowY + trackHeight / 2)
    ctx.restore()

    // Track
    fillRoundedRect(ctx, barX, rowY, barMaxWidth, trackHeight, trackRadius, PALETTE.traitTrack)

    // Fill with accent gradient — use toCanvasRGBA for WeChat safety
    const fillWidth = Math.max(4, barMaxWidth * (clampPercent(entry.value) / 100))
    const fillGradient = ctx.createLinearGradient(barX, rowY, barX + fillWidth, rowY)
    fillGradient.addColorStop(0, accentColor)
    fillGradient.addColorStop(1, toCanvasRGBA(accentColor, 0.6))
    fillRoundedRect(ctx, barX, rowY, fillWidth, trackHeight, trackRadius, fillGradient)
  })

  return entries.length * rowHeight
}

function drawCompactEnergyBar(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  energyLevel: number,
): number {
  const label = '能量'
  const trackHeight = 10
  const trackRadius = 5
  const labelWidth = 66
  const valueWidth = 32
  const barX = x + labelWidth + 4
  const barMaxWidth = Math.max(4, width - labelWidth - valueWidth - 10)

  // Label
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(14)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(label, x, y)
  ctx.restore()

  // Value
  ctx.save()
  ctx.setFillStyle(PALETTE.textLight)
  ctx.setFontSize(14)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('top')
  ctx.fillText(`${clampPercent(energyLevel)}%`, x + width, y)
  ctx.restore()

  // Track
  const barY = y + 20
  fillRoundedRect(ctx, barX, barY, barMaxWidth, trackHeight, trackRadius, PALETTE.traitTrack)

  // Fill — gradient from yellow to orange to red
  const fillWidth = Math.max(4, barMaxWidth * (clampPercent(energyLevel) / 100))
  const energyGradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY)
  energyGradient.addColorStop(0, '#fbbf24')
  energyGradient.addColorStop(0.5, '#f97316')
  energyGradient.addColorStop(1, '#ef4444')
  fillRoundedRect(ctx, barX, barY, fillWidth, trackHeight, trackRadius, energyGradient)

  return 30
}

function drawSkillBadges(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  skillSet: { activeSkill: { name: string }; passiveSkill: { name: string } },
): number {
  const badgeHeight = 24
  const badgeRadius = 12
  const gap = 10

  // Measure texts to size badges
  ctx.save()
  ctx.setFontSize(13)

  const activeText = skillSet.activeSkill.name || '主动技'
  const passiveText = skillSet.passiveSkill.name || '被动技'

  const activeTextWidth = ctx.measureText(activeText).width
  const passiveTextWidth = ctx.measureText(passiveText).width
  ctx.restore()

  const activeBadgeWidth = Math.round(activeTextWidth + 18)
  const passiveBadgeWidth = Math.round(passiveTextWidth + 18)
  const totalWidth = activeBadgeWidth + gap + passiveBadgeWidth
  const startX = x + (width - totalWidth) / 2

  // Active badge — warm peach
  fillRoundedRect(ctx, startX, y, activeBadgeWidth, badgeHeight, badgeRadius, PALETTE.activeSkillBg)
  ctx.save()
  ctx.setFillStyle(PALETTE.activeSkillText)
  ctx.setFontSize(13)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(activeText, startX + activeBadgeWidth / 2, y + badgeHeight / 2)
  ctx.restore()

  // Passive badge — cool lavender
  const passiveX = startX + activeBadgeWidth + gap
  fillRoundedRect(ctx, passiveX, y, passiveBadgeWidth, badgeHeight, badgeRadius, PALETTE.passiveSkillBg)
  ctx.save()
  ctx.setFillStyle(PALETTE.passiveSkillText)
  ctx.setFontSize(13)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(passiveText, passiveX + passiveBadgeWidth / 2, y + badgeHeight / 2)
  ctx.restore()

  return badgeHeight
}

function drawRankSerialChip(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  width: number,
  archetypeRank: number,
  serialNumber: string,
): number {
  const badgeHeight = 24
  const badgeRadius = 12

  const parts: string[] = []
  if (typeof archetypeRank === 'number' && archetypeRank > 0) {
    parts.push(`No.${archetypeRank}`)
  }
  if (serialNumber) {
    parts.push(serialNumber)
  }
  if (parts.length === 0) return 0

  const text = parts.join(' · ')
  ctx.save()
  ctx.setFontSize(13)
  const textWidth = ctx.measureText(text).width
  ctx.restore()

  const badgeWidth = Math.round(Math.min(textWidth + 22, width))
  const badgeX = x + (width - badgeWidth) / 2

  fillRoundedRect(ctx, badgeX, y, badgeWidth, badgeHeight, badgeRadius, 'rgba(255,255,255,0.92)')
  strokeRoundedRect(ctx, badgeX, y, badgeWidth, badgeHeight, badgeRadius, 'rgba(139,92,246,0.15)', 1)

  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(13)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(text, badgeX + badgeWidth / 2, y + badgeHeight / 2)
  ctx.restore()

  return badgeHeight
}

function drawHoloStamp(
  ctx: Taro.CanvasContext,
  centerX: number,
  y: number,
): number {
  const barWidth = 220
  const barHeight = 26
  const barX = centerX - barWidth / 2

  const goldGrad = createMetallicGold(ctx, barX, y, barX + barWidth, y + barHeight)
  fillRoundedRect(ctx, barX, y, barWidth, barHeight, barHeight / 2, goldGrad)

  ctx.save()
  ctx.setFillStyle('#4a2e00')
  ctx.setFontSize(14)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('全息限定版', centerX, y + barHeight / 2)
  ctx.restore()

  return barHeight
}

// ─── Square Personality Poster (1:1 for WeChat Moments) ──────────────────────

export const PERSONALITY_SQUARE_CANVAS_ID = 'personality-square-poster-canvas'

export interface PersonalitySquarePosterTraitEntry {
  label: string
  value: number
}

export interface PersonalitySquarePosterInput {
  archetype: string
  subtitle?: string
  tagline: string
  shareLine?: string
  rarityPercentage: number
  archetypeAsset: string
  archetypeAssetPng?: string
  preResolvedImagePath?: string
  traitEntries?: PersonalitySquarePosterTraitEntry[]
  energyLevel?: number
  skillSet?: {
    activeSkill: { name: string }
    passiveSkill: { name: string }
  }
  archetypeRank?: number
  serialNumber?: string
}

export async function generatePersonalitySquarePoster(
  input: PersonalitySquarePosterInput,
): Promise<string> {
  const canvasId = PERSONALITY_SQUARE_CANVAS_ID
  const ctx = Taro.createCanvasContext(canvasId)
  const S = SQUARE_SIZE
  const M = 40
  const accentColor = getArchetypeColorHex(input.archetype)

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
  drawBadge(ctx, '悦聚 · 氛围命盘', M + 28, M + 20, 170, 34, 17, PALETTE.badgeDarkFill, PALETTE.badgeDarkText)

  // Archetype name (large, centered)
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(48)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(input.archetype, S / 2, M + 72)
  ctx.restore()

  // Archetype nickname subtitle (small, centered)
  if (input.subtitle) {
    ctx.save()
    ctx.setFillStyle(PALETTE.textLight)
    ctx.setFontSize(20)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(input.subtitle, S / 2, M + 120)
    ctx.restore()
  }

  // Hero image (circular, 160px)
  const imgSize = 160
  const imgX = (S - imgSize) / 2
  const imgY = M + 148
  // Use pre-resolved image path if available to avoid a redundant network fetch.
  // Falls back to resolving archetypeAsset (WebP) then archetypeAssetPng (PNG CDN).
  const imgPath = input.preResolvedImagePath
    || await resolveImagePath(input.archetypeAsset)
    || (input.archetypeAssetPng ? await resolveImagePath(input.archetypeAssetPng) : '')

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
    ctx.setFontSize(72)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText(input.archetype.slice(0, 1), S / 2, imgY + imgSize / 2)
    ctx.restore()
  }

  // Tagline
  const taglineY = imgY + imgSize + 14
  const taglineHeight = drawTextBlock(ctx, {
    text: input.tagline,
    x: S / 2,
    y: taglineY,
    maxChars: 16,
    maxLines: 2,
    lineHeight: 28,
    fontSize: 22,
    color: PALETTE.textSecondary,
    align: 'center',
  })

  // Layout remaining elements in the space between tagline and bottom CTA
  const contentX = M + 32
  const contentW = cardW - 64
  let cursorY = taglineY + taglineHeight + 12

  // 3 compact trait bars
  if (input.traitEntries && input.traitEntries.length > 0) {
    const traitHeight = drawCompactTraitBars(ctx, contentX, cursorY, contentW, input.traitEntries, accentColor)
    cursorY += traitHeight + 4
  }

  // Energy bar
  if (typeof input.energyLevel === 'number') {
    const energyHeight = drawCompactEnergyBar(ctx, contentX, cursorY, contentW, input.energyLevel)
    cursorY += energyHeight + 4
  }

  // Skill badges
  if (input.skillSet) {
    const skillHeight = drawSkillBadges(ctx, contentX, cursorY, contentW, input.skillSet)
    cursorY += skillHeight + 4
  }

  // Rank + serial chip
  if ((typeof input.archetypeRank === 'number' && input.archetypeRank > 0) || input.serialNumber) {
    const rankHeight = drawRankSerialChip(ctx, contentX, cursorY, contentW, input.archetypeRank ?? 0, input.serialNumber ?? '')
    if (rankHeight > 0) {
      cursorY += rankHeight + 4
    }
  }

  // Holographic stamp
  const holoHeight = drawHoloStamp(ctx, S / 2, cursorY)
  cursorY += holoHeight + 4

  // Share line
  if (input.shareLine) {
    const shareHeight = drawTextBlock(ctx, {
      text: input.shareLine,
      x: S / 2,
      y: cursorY,
      maxChars: 22,
      maxLines: 1,
      lineHeight: 22,
      fontSize: 16,
      color: PALETTE.textLight,
      align: 'center',
    })
    cursorY += shareHeight + 4
  }

  // Rarity badge — keep a safe margin from bottom CTA
  const rarityText = `缘分稀有度 ${Math.round(input.rarityPercentage)}%`
  const rarityY = Math.min(cursorY, S - M - 100)
  drawBadge(ctx, rarityText, S / 2 - 120, rarityY, 240, 32, 16, PALETTE.badgePurpleFill, PALETTE.badgePurpleText)

// Bottom CTA — match portrait poster attribution
  drawTextBlock(ctx, {
    text: '来悦聚测测你的氛围命格',
    x: S / 2,
    y: S - M - 56,
    maxChars: 20,
    maxLines: 1,
    lineHeight: 26,
    fontSize: 20,
    color: PALETTE.footerText,
    align: 'center',
  })

  // JoyJoin watermark
  ctx.save()
  ctx.setFillStyle('rgba(139, 92, 246, 0.08)')
  ctx.setFontSize(16)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('悦聚 · 测测你的氛围命格 · 找到同频的人', S / 2, S - M - 28)
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

  // Top badge: 盲盒开箱 (no emoji per brand guidelines)
  drawBadge(ctx, '盲盒开箱', M + 28, M + 28, 160, 40, 20, PALETTE.badgeGoldFill, PALETTE.badgeGoldText)

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
