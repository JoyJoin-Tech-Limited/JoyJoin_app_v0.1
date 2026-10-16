import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { exportCanvasWithRetry, fillRoundedRect, resolveImagePath } from '../../lib/utils/canvasHelpers'
import { logInfo } from '../../lib/utils/logger'

/**
 * 互选纪念卡 (keepsake card) canvas builder — event-feedback premium uplift
 * item 19 (2026-10-16, spec row 19 / C-10+P-10).
 *
 * The mutual-match moment on the revealed screen is the highest share-desire
 * point in the flow; this bakes it into a 1080×1560 portrait card via the
 * proven insight-poster pipeline (legacy createCanvasContext + hidden
 * full-bitmap <Canvas> + exportCanvasWithRetry).
 *
 * Privacy contract (mirrors insightPoster's REL-02/SEC-01 discipline):
 * `KeepsakeCardInput` structurally EXCLUDES every contact field — no property
 * on this type can carry a 微信号 (or any other contact info) into a canvas
 * primitive. The page maps MutualMatch → { displayName, archetype } before
 * calling. Spy-locked in eventFeedbackFlow.test.ts.
 *
 * Zero inducement: the card carries no share CTA and no reward wording —
 * passive keepsake only (WeChat bans incentivized sharing).
 */

export const KEEPSAKE_CARD_CANVAS_ID = 'event-feedback-keepsake-canvas'
export const KEEPSAKE_CARD_WIDTH = 1080
export const KEEPSAKE_CARD_HEIGHT = 1560

/** QR band copy — same vocab-whitelisted, zero-inducement line as the insight poster. */
export const KEEPSAKE_QR_COPY = '扫码，遇见对味的局'

const CHROME_LABEL = '互选纪念'
const BRAND_WORDMARK = 'JoyJoin 悦聚'
const MUTUAL_LINE = '我们互相选择了对方'
const VIEWER_NAME_FALLBACK = '我'
const MATCH_NAME_FALLBACK = '同桌'

const CARD_X = 28
const CARD_Y = 28
const CARD_WIDTH = KEEPSAKE_CARD_WIDTH - CARD_X * 2
const CARD_HEIGHT = KEEPSAKE_CARD_HEIGHT - CARD_Y * 2
const CARD_RADIUS = 40

const LEFT_EDGE = 96
const RIGHT_EDGE = KEEPSAKE_CARD_WIDTH - 96
const CENTER_X = KEEPSAKE_CARD_WIDTH / 2

const CHROME_Y = 88
const HEAD_ROW_Y = 280
const HEAD_GAP = 48
const NAME_GAP = 36
const NAME_FONT_SIZE = 30
const DIVIDER_GAP = 72
const MUTUAL_LINE_GAP = 64
const MUTUAL_FONT_SIZE = 44
const DATE_FONT_SIZE = 30
const DATE_GAP = 24
const QR_BAND_MIN_Y = 1300
const QR_SIZE = 160
const QR_COPY_FONT_SIZE = 30
const FOOTER_Y = 1500

/** At most 3 matches drawn beside the viewer (rare path; the rest fold into a caption). */
const MAX_MATCH_HEADS = 3

const COLOR_PRIMARY = '#8B5CF6'

/** One person on the card — contact fields are unrepresentable here by design. */
export interface KeepsakePerson {
  displayName: string | null
  archetype: string | null
}

export interface KeepsakeCardInput {
  /** The card owner (left-most head, primary ring marker). */
  viewer: KeepsakePerson
  /** Mutual picks (1..N; drawn left-to-right after the viewer). */
  matches: KeepsakePerson[]
  /** e.g. 「10.15」 from formatEventDayLabel; omitted when unresolved. */
  eventDayLabel?: string
  /** QR temp file path from `fetchShareQrCodeImage()`; undefined → copy-only band. */
  qrCodeImagePath?: string
}

/** CDN head asset for an archetype id/legacy name ('' when unresolved — disc fallback). */
function archetypeHeadAsset(archetype: string | null): string {
  if (!archetype) return ''
  const id = resolveArchetype(archetype)?.id
  return id ? cdnAsset(`/assets/icons/archetype/archetype-${id}-head.webp`) : ''
}

function truncateName(name: string | null, fallback: string): string {
  const trimmed = (name ?? '').trim()
  return Array.from(trimmed || fallback).slice(0, 4).join('')
}

/**
 * Draw the card content onto a canvas context. Exported separately from the
 * export pipeline so layout/vocab/privacy tests can spy on the canvas
 * primitives without touching Taro's canvas runtime (insightPoster pattern).
 *
 * `resolvedHeads[i]` is the resolved temp path for person i ('' → brand-safe
 * purple disc fallback, never initials).
 */
export function drawKeepsakeCardContent(
  ctx: Taro.CanvasContext,
  input: KeepsakeCardInput,
  resolvedHeads: readonly string[],
): void {
  // ── Background + card shell (insight-poster convention) ──
  ctx.save()
  ctx.setFillStyle(PALETTE.pageBgStart)
  ctx.fillRect(0, 0, KEEPSAKE_CARD_WIDTH, KEEPSAKE_CARD_HEIGHT)
  ctx.restore()
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)

  // ── Top chrome ──
  ctx.save()
  ctx.setFontSize(26)
  ctx.setTextBaseline('top')
  ctx.setTextAlign('left')
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.fillText(CHROME_LABEL, LEFT_EDGE, CHROME_Y)
  ctx.setTextAlign('right')
  ctx.setFillStyle(PALETTE.textTertiary)
  ctx.fillText('JOYJOIN', RIGHT_EDGE, CHROME_Y)
  ctx.restore()

  // ── Heads row: viewer + up to MAX_MATCH_HEADS matches, adaptively sized ──
  const shownMatches = input.matches.slice(0, MAX_MATCH_HEADS)
  const people = [input.viewer, ...shownMatches]
  const headCount = people.length
  const headSize = headCount <= 2 ? 320 : headCount === 3 ? 280 : 220
  const rowWidth = headCount * headSize + (headCount - 1) * HEAD_GAP
  const rowLeft = CENTER_X - rowWidth / 2
  const headCenterY = HEAD_ROW_Y + headSize / 2

  people.forEach((person, index) => {
    const centerX = rowLeft + index * (headSize + HEAD_GAP) + headSize / 2
    const imagePath = resolvedHeads[index] ?? ''
    if (imagePath) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, headCenterY, headSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imagePath, centerX - headSize / 2, HEAD_ROW_Y, headSize, headSize)
      ctx.restore()
    } else {
      // Brand-safe fallback: soft purple disc (no initials on art).
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, headCenterY, headSize / 2, 0, Math.PI * 2)
      ctx.setFillStyle('rgba(139, 92, 246, 0.18)')
      ctx.fill()
      ctx.restore()
    }

    // Viewer marker ring (squad-poster grammar: primary stroke, no text).
    if (index === 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, headCenterY, headSize / 2 + 8, 0, Math.PI * 2)
      ctx.setStrokeStyle(COLOR_PRIMARY)
      ctx.setLineWidth(4)
      ctx.stroke()
      ctx.restore()
    }

    // Name under the head (truncate to 4 glyphs, centered per head).
    ctx.save()
    ctx.setFontSize(NAME_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textDark)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(
      truncateName(person.displayName, index === 0 ? VIEWER_NAME_FALLBACK : MATCH_NAME_FALLBACK),
      centerX,
      HEAD_ROW_Y + headSize + NAME_GAP,
    )
    ctx.restore()
  })

  const rowBottom = HEAD_ROW_Y + headSize + NAME_GAP + NAME_FONT_SIZE

  // ── Divider ──
  const dividerY = rowBottom + DIVIDER_GAP
  ctx.save()
  ctx.setStrokeStyle('rgba(139, 92, 246, 0.14)')
  ctx.setLineWidth(2)
  ctx.beginPath()
  ctx.moveTo(LEFT_EDGE, dividerY)
  ctx.lineTo(RIGHT_EDGE, dividerY)
  ctx.stroke()
  ctx.restore()

  // ── The mutual line ──
  const mutualY = dividerY + MUTUAL_LINE_GAP
  ctx.save()
  ctx.setFontSize(MUTUAL_FONT_SIZE)
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(MUTUAL_LINE, CENTER_X, mutualY)
  ctx.restore()

  // ── Event date (omitted when unresolved) ──
  let cursorY = mutualY + MUTUAL_FONT_SIZE
  if (input.eventDayLabel) {
    cursorY += DATE_GAP
    ctx.save()
    ctx.setFontSize(DATE_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(`${input.eventDayLabel} 那局`, CENTER_X, cursorY)
    ctx.restore()
    cursorY += DATE_FONT_SIZE
  }

  // ── Overflow caption when matches were folded (rare path) ──
  const folded = input.matches.length - shownMatches.length
  if (folded > 0) {
    cursorY += DATE_GAP
    ctx.save()
    ctx.setFontSize(26)
    ctx.setFillStyle(PALETTE.textTertiary)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(`还有 ${folded} 位伙伴互选成功`, CENTER_X, cursorY)
    ctx.restore()
    cursorY += 26
  }

  // ── QR band (fail-open: without a QR temp file the band collapses to copy) ──
  const qrBandY = Math.max(cursorY + 64, QR_BAND_MIN_Y)
  if (input.qrCodeImagePath) {
    ctx.save()
    ctx.drawImage(input.qrCodeImagePath, LEFT_EDGE, qrBandY, QR_SIZE, QR_SIZE)
    ctx.restore()
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(KEEPSAKE_QR_COPY, LEFT_EDGE + QR_SIZE + 40, qrBandY + QR_SIZE / 2 - 20)
    ctx.restore()
  } else {
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(KEEPSAKE_QR_COPY, CENTER_X, qrBandY + 40)
    ctx.restore()
  }

  // ── Footer brand mark ──
  ctx.save()
  ctx.setFontSize(26)
  ctx.setFillStyle(PALETTE.textTertiary)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(BRAND_WORDMARK, CENTER_X, FOOTER_Y)
  ctx.restore()
}

const DRAW_TIMEOUT_MS = 15_000

/**
 * Generate the keepsake card and return the exported temp file path.
 * Export inherits `exportCanvasWithRetry` semantics (DPR ≤2, retry, 60s
 * auto-unlink). One generation per call — callers must never reuse a
 * previous temp file across taps.
 */
export async function generateKeepsakeCard(input: KeepsakeCardInput): Promise<string> {
  const shownMatches = input.matches.slice(0, MAX_MATCH_HEADS)
  const people = [input.viewer, ...shownMatches]
  const resolvedHeads = await Promise.all(
    people.map((person) => {
      const asset = archetypeHeadAsset(person.archetype)
      return asset ? resolveImagePath(asset) : Promise.resolve('')
    }),
  )

  const ctx = Taro.createCanvasContext(KEEPSAKE_CARD_CANVAS_ID)
  drawKeepsakeCardContent(ctx, input, resolvedHeads)

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
        const tempFilePath = await exportCanvasWithRetry(
          KEEPSAKE_CARD_CANVAS_ID,
          KEEPSAKE_CARD_WIDTH,
          KEEPSAKE_CARD_HEIGHT,
        )
        settled = true
        clearTimeout(timeout)
        // Release the backing store immediately after export (~27 MB).
        try {
          ctx.clearRect(0, 0, KEEPSAKE_CARD_WIDTH, KEEPSAKE_CARD_HEIGHT)
        } catch {
          // best-effort
        }
        logInfo('[KeepsakeCard] generated', { matchCount: input.matches.length })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}
