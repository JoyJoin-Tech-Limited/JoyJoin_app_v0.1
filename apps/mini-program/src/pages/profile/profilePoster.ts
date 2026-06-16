import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import { getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import {
  toCanvasRGBA,
  resolveImagePath,
  fillRoundedRect,
  strokeRoundedRect,
  clipRoundedRect,
  drawBadge,
  drawTextBlock,
  createMetallicGold,
  exportCanvasWithRetry,
} from '../../lib/utils/canvasHelpers'

export const PROFILE_SHARE_POSTER_CANVAS_ID = 'profile-share-poster-canvas'

const POSTER_SIZE = 750
const MARGIN = 40
const CARD_RADIUS = 36

export interface ProfilePosterInput {
  displayName: string
  archetypeId: string
  archetypeName: string
  familyName?: string | null
  tagline?: string
  summary?: string
  city?: string | null
  age?: number | null
  interests?: string[]
  referralCode?: string | null
  /**
   * Preferred canvas DPR. Primary devices default to 2; degradation devices
   * can request 1 to save memory and reduce export time.
   */
  preferredDpr?: number
}

function buildFactLine(input: ProfilePosterInput): string {
  const parts: string[] = []
  if (input.city) parts.push(input.city)
  if (input.age != null && !Number.isNaN(input.age) && input.age > 0) {
    parts.push(`${input.age}岁`)
  }
  const interests = (input.interests ?? [])
    .filter((i): i is string => typeof i === 'string')
    .slice(0, 2)
  if (interests.length > 0) {
    parts.push(interests.join(' / '))
  }
  return parts.join(' · ')
}

export async function generateProfileSharePoster(
  input: ProfilePosterInput,
): Promise<string> {
  const { archetypeId, archetypeName, displayName } = input
  if (!archetypeId || !archetypeName) {
    throw new Error('Profile poster requires an archetype')
  }

  const hsl = getArchetypeHSL(archetypeId)
  const accentColor = formatHSLAsRGBA(hsl, 1)
  const accentSoft = formatHSLAsRGBA(hsl, 0.14)

  const assetWebp = cdnAsset(`/assets/personality/archetypes/archetype-${archetypeId}.webp`)
  const assetPng = cdnAsset(`/assets/personality/archetypes/archetype-${archetypeId}.png`)
  const imagePath = await resolveImagePath(assetWebp) || await resolveImagePath(assetPng)

  const ctx = Taro.createCanvasContext(PROFILE_SHARE_POSTER_CANVAS_ID)

  // ── Background ─────────────────────────────────────────────────────────────
  const bgGradient = ctx.createLinearGradient(0, 0, POSTER_SIZE, POSTER_SIZE)
  bgGradient.addColorStop(0, PALETTE.pageBgStart)
  bgGradient.addColorStop(0.5, accentSoft)
  bgGradient.addColorStop(1, PALETTE.pageBgEnd)
  ctx.setFillStyle(bgGradient)
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE)

  // ── Card ───────────────────────────────────────────────────────────────────
  const cardW = POSTER_SIZE - MARGIN * 2
  const cardH = cardW
  const cardX = MARGIN
  const cardY = MARGIN

  fillRoundedRect(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS, PALETTE.cardFill)
  const goldBorder = createMetallicGold(ctx, cardX, cardY, cardX + cardW, cardY + cardH)
  strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS, goldBorder, 5)

  // ── Top badge ──────────────────────────────────────────────────────────────
  drawBadge(ctx, {
    text: '我的社交名片',
    x: cardX + 32,
    y: cardY + 28,
    width: 170,
    fill: PALETTE.badgeDarkFill,
    color: PALETTE.badgeDarkText,
    fontSize: 22,
    height: 40,
  })

  // ── Archetype hero image (circular) ────────────────────────────────────────
  const imgSize = 168
  const imgX = (POSTER_SIZE - imgSize) / 2
  const imgY = cardY + 96

  ctx.save()
  ctx.setShadow(0, 10, 24, toCanvasRGBA(accentColor, 0.22))
  fillRoundedRect(ctx, imgX - 6, imgY - 6, imgSize + 12, imgSize + 12, (imgSize + 12) / 2, PALETTE.heroImageShell)
  ctx.restore()

  if (imagePath) {
    ctx.save()
    clipRoundedRect(ctx, imgX, imgY, imgSize, imgSize, imgSize / 2)
    ctx.drawImage(imagePath, imgX, imgY, imgSize, imgSize)
    ctx.restore()
  } else {
    fillRoundedRect(ctx, imgX, imgY, imgSize, imgSize, imgSize / 2, accentColor)
    ctx.save()
    ctx.setFillStyle(PALETTE.white)
    ctx.setFontSize(64)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText(archetypeName.slice(0, 1), POSTER_SIZE / 2, imgY + imgSize / 2)
    ctx.restore()
  }

  let cursorY = imgY + imgSize + 22

  // ── Display name ───────────────────────────────────────────────────────────
  const nameHeight = drawTextBlock(ctx, {
    text: displayName,
    x: POSTER_SIZE / 2,
    y: cursorY,
    maxCharsPerLine: 10,
    maxLines: 1,
    lineHeight: 42,
    fontSize: 36,
    color: PALETTE.textDark,
    align: 'center',
  })
  cursorY += nameHeight + 10

  // ── Archetype pill ─────────────────────────────────────────────────────────
  const familyName = input.familyName || '悦聚家族'
  const pillText = `${archetypeName} · ${familyName}`
  ctx.save()
  ctx.setFontSize(24)
  const pillTextWidth = ctx.measureText(pillText).width
  ctx.restore()
  const pillPaddingX = 28
  const pillWidth = Math.round(pillTextWidth + pillPaddingX * 2)
  const pillHeight = 44
  const pillX = (POSTER_SIZE - pillWidth) / 2
  const pillY = cursorY

  fillRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2, accentSoft)
  strokeRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2, toCanvasRGBA(accentColor, 0.35), 2)
  ctx.save()
  ctx.setFillStyle(accentColor)
  ctx.setFontSize(24)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(pillText, POSTER_SIZE / 2, pillY + pillHeight / 2)
  ctx.restore()
  cursorY += pillHeight + 18

  // ── Tagline / summary ──────────────────────────────────────────────────────
  const tagline = input.tagline || input.summary || '来 JoyJoin，遇见同频的人'
  const taglineHeight = drawTextBlock(ctx, {
    text: tagline,
    x: cardX + 48,
    y: cursorY,
    maxCharsPerLine: 18,
    maxLines: 2,
    lineHeight: 34,
    fontSize: 26,
    color: PALETTE.textSecondary,
    align: 'center',
  })
  cursorY += taglineHeight + 22

  // ── Fact line (city · age · interests) ─────────────────────────────────────
  const factLine = buildFactLine(input)
  if (factLine) {
    const factHeight = drawTextBlock(ctx, {
      text: factLine,
      x: POSTER_SIZE / 2,
      y: cursorY,
      maxCharsPerLine: 22,
      maxLines: 1,
      lineHeight: 28,
      fontSize: 22,
      color: PALETTE.textMuted,
      align: 'center',
    })
    cursorY += factHeight + 18
  }

  // ── Referral code chip ─────────────────────────────────────────────────────
  if (input.referralCode) {
    const codeText = `邀请码 ${input.referralCode}`
    ctx.save()
    ctx.setFontSize(22)
    const codeTextWidth = ctx.measureText(codeText).width
    ctx.restore()
    const chipWidth = Math.round(codeTextWidth + 44)
    const chipHeight = 40
    const chipX = (POSTER_SIZE - chipWidth) / 2
    const chipY = cursorY

    fillRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2, PALETTE.badgeMatchFill)
    ctx.save()
    ctx.setFillStyle(PALETTE.badgeMatchText)
    ctx.setFontSize(22)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText(codeText, POSTER_SIZE / 2, chipY + chipHeight / 2)
    ctx.restore()
    cursorY += chipHeight + 24
  }

  // ── Footer CTA ─────────────────────────────────────────────────────────────
  const footerY = POSTER_SIZE - MARGIN - 56
  drawTextBlock(ctx, {
    text: '保存海报 · 来 JoyJoin 找到我',
    x: POSTER_SIZE / 2,
    y: footerY,
    maxCharsPerLine: 22,
    maxLines: 1,
    lineHeight: 28,
    fontSize: 22,
    color: PALETTE.footerText,
    align: 'center',
  })

  // ── Watermark ──────────────────────────────────────────────────────────────
  ctx.save()
  ctx.setFillStyle('rgba(139, 92, 246, 0.08)')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText('悦聚 · 遇见同频的人', POSTER_SIZE / 2, POSTER_SIZE - MARGIN - 24)
  ctx.restore()

  // WeChat canvas contexts are command buffers; flush with ctx.draw() before
  // export or canvasToTempFilePath will capture a blank frame.
  const DRAW_TIMEOUT_MS = 15_000
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Profile share poster canvas draw timed out'))
      }
    }, DRAW_TIMEOUT_MS)

    ctx.draw(false, async () => {
      if (settled) return
      try {
        const dprValues = [input.preferredDpr ?? 2, 1]
      const tempFilePath = await exportCanvasWithRetry(
        PROFILE_SHARE_POSTER_CANVAS_ID,
        POSTER_SIZE,
        POSTER_SIZE,
        dprValues,
      )
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
