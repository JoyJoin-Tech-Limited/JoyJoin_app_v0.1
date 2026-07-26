/**
 * 这桌的桌卡 — squad table-card poster generator (2026-07-24 P2).
 *
 * Renders a 750×1100 collectible poster on the hidden page canvas using the
 * legacy Taro canvas context API (same pattern as the personality share
 * poster). All member art resolves through CDN URLs — canvas drawImage
 * requires a network-resolvable path. Exports via exportCanvasWithRetry
 * (DPR 2→1 fallback); the caller owns saveImageToPhotosAlbum + toasts.
 */

import Taro from '@tarojs/taro'
import type { PoolGroupMemberSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import {
  fillRoundedRect,
  clipRoundedRect,
  resolveImagePath,
  exportCanvasWithRetry,
} from '../../lib/utils/canvasHelpers'

export const SQUAD_TABLE_CARD_CANVAS_ID = 'squad-table-card-poster'
export const SQUAD_TABLE_CARD_POSTER_WIDTH = 750
export const SQUAD_TABLE_CARD_POSTER_HEIGHT = 1100

export interface SquadTableCardPosterInput {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  chemistryWord: string
  /** e.g. "7月27日 周一 20:14" */
  dateLine: string
  /** venueName or "深圳 · 南山区" style fallback; may be ''. */
  placeLine: string
  groupNumber?: number | null
}

const COLOR_TEXT_PRIMARY = '#23123D'
const COLOR_TEXT_SECONDARY = '#7B6A96'
const COLOR_PRIMARY = '#8B5CF6'
const COLOR_SECONDARY = '#FF6B9D'

function getMemberArtUrl(member: PoolGroupMemberSummary): string | undefined {
  if (member.avatarUrl) return member.avatarUrl
  if (!member.archetype) return undefined
  const id = resolveArchetype(member.archetype)?.id ?? member.archetype
  return ARCHETYPE_ASSET_MAP[id]?.webp
}

function getMemberTint(member: PoolGroupMemberSummary): string {
  const id = member.archetype ? resolveArchetype(member.archetype)?.id ?? null : null
  return formatHSLAsRGBA(getArchetypeHSL(id), 0.55)
}

export async function drawSquadTableCardPoster(input: SquadTableCardPosterInput): Promise<string> {
  const ctx = Taro.createCanvasContext(SQUAD_TABLE_CARD_CANVAS_ID)
  const W = SQUAD_TABLE_CARD_POSTER_WIDTH
  const H = SQUAD_TABLE_CARD_POSTER_HEIGHT

  // Background: brand warm gradient (cream → pink → purple).
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#FFF7F0')
  bg.addColorStop(0.52, '#FFEFF6')
  bg.addColorStop(1, '#F3EFFF')
  ctx.setFillStyle(bg)
  ctx.fillRect(0, 0, W, H)

  // White card.
  const cardX = 32
  const cardY = 32
  const cardW = W - cardX * 2
  const cardH = H - cardY * 2
  ctx.save()
  ctx.setShadow(0, 16, 48, 'rgba(139, 92, 246, 0.16)')
  fillRoundedRect(ctx, cardX, cardY, cardW, cardH, 40, '#FFFFFF')
  ctx.restore()

  // Gold foil top strip.
  clipRoundedRect(ctx, cardX, cardY, cardW, cardH, 40)
  const foil = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY)
  foil.addColorStop(0, 'rgba(255, 214, 94, 0.9)')
  foil.addColorStop(0.5, 'rgba(255, 107, 157, 0.75)')
  foil.addColorStop(1, 'rgba(139, 92, 246, 0.75)')
  ctx.setFillStyle(foil)
  ctx.fillRect(cardX, cardY, cardW, 10)
  ctx.restore()

  // Eyebrow.
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.setFillStyle(COLOR_TEXT_SECONDARY)
  ctx.setFontSize(24)
  const eyebrow = input.groupNumber ? `第 ${input.groupNumber} 组 · JoyJoin` : 'JoyJoin'
  ctx.fillText(eyebrow, W / 2, cardY + 64)

  // Title.
  ctx.setFillStyle(COLOR_TEXT_PRIMARY)
  ctx.setFontSize(60)
  ctx.fillText('这桌的桌卡', W / 2, cardY + 112)

  // Chemistry chip.
  const chipText = input.chemistryWord || '今晚有戏'
  ctx.setFontSize(28)
  const chipWidth = Math.max(200, chipText.length * 30 + 64)
  fillRoundedRect(ctx, (W - chipWidth) / 2, cardY + 216, chipWidth, 64, 32, 'rgba(255, 107, 157, 0.14)')
  ctx.setFillStyle(COLOR_SECONDARY)
  ctx.fillText(chipText, W / 2, cardY + 232)

  // Date · place line.
  const datePlace = [input.dateLine, input.placeLine].filter(Boolean).join(' · ')
  if (datePlace) {
    ctx.setFillStyle(COLOR_TEXT_SECONDARY)
    ctx.setFontSize(26)
    ctx.fillText(datePlace, W / 2, cardY + 320)
  }

  // Member heads row (up to 6, centred).
  const shown = input.members.slice(0, 6)
  const headR = 56
  const headGap = 24
  const rowWidth = shown.length * headR * 2 + (shown.length - 1) * headGap
  let cursorX = (W - rowWidth) / 2 + headR
  const headY = cardY + 452
  const nameY = headY + headR + 20

  const artPaths = await Promise.allSettled(
    shown.map((member) => {
      const url = getMemberArtUrl(member)
      return url ? resolveImagePath(url) : Promise.reject(new Error('no-art'))
    }),
  )

  for (let index = 0; index < shown.length; index += 1) {
    const member = shown[index]
    const cx = cursorX
    cursorX += headR * 2 + headGap

    // Tinted ring.
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, headY, headR + 4, 0, Math.PI * 2)
    ctx.setFillStyle(getMemberTint(member))
    ctx.fill()
    ctx.restore()

    const art = artPaths[index]
    if (art.status === 'fulfilled') {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, headY, headR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(art.value, cx - headR, headY - headR, headR * 2, headR * 2)
      ctx.restore()
    } else {
      // Brand-safe fallback: soft purple disc (no initials on art).
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, headY, headR, 0, Math.PI * 2)
      ctx.setFillStyle('rgba(139, 92, 246, 0.18)')
      ctx.fill()
      ctx.restore()
    }

    // 我 marker ring for the viewer's own head.
    if (member.userId === input.currentUserId) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, headY, headR + 8, 0, Math.PI * 2)
      ctx.setStrokeStyle(COLOR_PRIMARY)
      ctx.setLineWidth(4)
      ctx.stroke()
      ctx.restore()
    }

    // Name under head (truncate to 4 glyphs).
    const name = (member.displayName || '匿名').slice(0, 4)
    ctx.setFillStyle(COLOR_TEXT_PRIMARY)
    ctx.setFontSize(24)
    ctx.fillText(name, cx, nameY)
  }

  // Divider + footer.
  ctx.setStrokeStyle('rgba(139, 92, 246, 0.14)')
  ctx.setLineWidth(2)
  ctx.beginPath()
  ctx.moveTo(cardX + 64, cardY + cardH - 128)
  ctx.lineTo(cardX + cardW - 64, cardY + cardH - 128)
  ctx.stroke()

  ctx.setFillStyle(COLOR_PRIMARY)
  ctx.setFontSize(28)
  ctx.fillText('今晚见 · JoyJoin', W / 2, cardY + cardH - 96)

  await new Promise<void>((resolve, reject) => {
    const watchdog = setTimeout(() => reject(new Error('canvas draw timeout')), 8000)
    ctx.draw(false, () => {
      clearTimeout(watchdog)
      resolve()
    })
  })

  return exportCanvasWithRetry(
    SQUAD_TABLE_CARD_CANVAS_ID,
    SQUAD_TABLE_CARD_POSTER_WIDTH,
    SQUAD_TABLE_CARD_POSTER_HEIGHT,
  )
}
