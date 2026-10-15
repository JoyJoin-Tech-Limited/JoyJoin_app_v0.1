import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import type { ProfileTaglineEvidence, ProfileTaglineLine } from '@shared/ai/onboarding'
import {
  drawTextBlock,
  exportCanvasWithRetry,
  fillRoundedRect,
  resolveImagePath,
  splitText,
} from '../utils/canvasHelpers'
import { logInfo } from '../utils/logger'

/**
 * Insight share poster (sprint insight-share-poster, 2026-10-15).
 *
 * Canvas builder for the profile-review 入场卡 share card: 1080×1560 portrait
 * (results-page convention), archetype portrait + display name + all insight
 * lines (display order) + evidence + brand mark + fail-open QR band, with the
 * AIGC label baked iff any included line is aigc=true AND the label flag is on.
 *
 * Privacy contract (REL-02 / SEC-01): `InsightPosterInput` structurally
 * EXCLUDES every 小档案 field (家乡/关系状态/学历/职业/行业) — no field on this
 * type can carry them into any canvas primitive. No identity metadata either.
 */

export const INSIGHT_POSTER_CANVAS_ID = 'insight-share-poster-canvas'
export const INSIGHT_POSTER_WIDTH = 1080
export const INSIGHT_POSTER_HEIGHT = 1560

/** AC-02c pinned text metrics: reveal ≈48px > observation/inference ≈40px
 *  @1080 width (±4px optical band), maxLines 3 with ellipsis truncation
 *  accepted as a known trade-off. */
export const INSIGHT_POSTER_TEXT_METRICS = {
  base: { fontSize: 40, lineHeight: 58, maxCharsPerLine: 22, maxLines: 3 },
  reveal: { fontSize: 48, lineHeight: 70, maxCharsPerLine: 18, maxLines: 3 },
} as const

/** Sanctioned AIGC label string (canvas bake, fail-closed). */
export const INSIGHT_POSTER_AIGC_LABEL = '内容由 AI 生成'

/** Pinned QR-band copy (vocab whitelist: asserted explicitly in tests). */
export const INSIGHT_POSTER_QR_COPY = '扫码，遇见对味的局'

const CHROME_LABEL = '悦仔的观察'
const BRAND_WORDMARK = 'JoyJoin 悦聚'
const EVIDENCE_CAPTION = '来自你的选择'

const CARD_X = 28
const CARD_Y = 28
const CARD_WIDTH = INSIGHT_POSTER_WIDTH - CARD_X * 2
const CARD_HEIGHT = INSIGHT_POSTER_HEIGHT - CARD_Y * 2
const CARD_RADIUS = 40

const LEFT_EDGE = 96
const RIGHT_EDGE = INSIGHT_POSTER_WIDTH - 96
const CENTER_X = INSIGHT_POSTER_WIDTH / 2

const CHROME_Y = 88
const PORTRAIT_Y = 140
const PORTRAIT_SIZE = 300
const NAME_Y = 470
const ARCHETYPE_Y = 548
const LINES_Y = 620
const LINE_GAP = 28
const EVIDENCE_GAP = 32
const EVIDENCE_CAPTION_LINE_HEIGHT = 34
const EVIDENCE_LINE_HEIGHT = 44
const EVIDENCE_ITEM_GAP = 10
const AIGC_GAP = 22
const AIGC_LINE_HEIGHT = 34
const QR_BAND_MIN_Y = 1330
const QR_SIZE = 160
const QR_COPY_FONT_SIZE = 30
const FOOTER_Y = 1500

const DEFAULT_ACCENT = '#8B5CF6'

export interface InsightPosterInput {
  /** Resolved page display name (incl. the '悦聚用户' fallback). */
  displayName: string
  archetypeName?: string
  /** Archetype full-body CDN asset (`visual.asset`); fail-open when unresolved. */
  archetypeAsset?: string
  /** Themed poster accent (`visual.accentText`); falls back to brand purple. */
  accentText?: string
  /** Insight lines in display order (observation/inference[/reveal]). */
  lines: ProfileTaglineLine[]
  /** Evidence pill texts (fail-open: empty array renders no evidence block). */
  evidence: ProfileTaglineEvidence[]
  /** QR temp file path from `fetchShareQrCodeImage()`; undefined → copy-only band. */
  qrCodeImagePath?: string
  /** Baked iff ≥1 included line is aigc=true AND the AIGC label flag is on. */
  hasAigcLabel: boolean
}

export interface InsightShareVisibilitySignals {
  /** Page-derived v2 shape signal (excludes loading/error/legacy/generic). */
  isV2Insight: boolean
  /** All insight rows landed (the same signal the gift timing consumes). */
  insightRowsLanded: boolean
  /** `visual !== null` — the poster needs the archetype visual. */
  hasVisual: boolean
  /** `entryCardInsightV2Enabled !== false` — the AC-18 kill-switch. */
  flagEnabled: boolean
}

/**
 * AC-01 visibility matrix (fail-closed): every signal must be true, otherwise
 * the 存下这张卡 entry stays hidden (loading/error/legacy/generic/flag-off/
 * visual-null/not-landed are all excluded by construction).
 */
export function resolveInsightShareVisibility(signals: InsightShareVisibilitySignals): boolean {
  return (
    signals.isV2Insight &&
    signals.insightRowsLanded &&
    signals.hasVisual &&
    signals.flagEnabled
  )
}

/**
 * Draw the poster content onto a canvas context. Exported separately from the
 * export pipeline so layout/vocab/privacy tests can spy on the canvas
 * primitives without touching Taro's canvas runtime.
 */
export function drawInsightPosterContent(
  ctx: Taro.CanvasContext,
  input: InsightPosterInput,
  archetypeImagePath = '',
): void {
  const accent = input.accentText || DEFAULT_ACCENT

  // ── Background + card shell ──
  ctx.save()
  ctx.setFillStyle(PALETTE.pageBgStart)
  ctx.fillRect(0, 0, INSIGHT_POSTER_WIDTH, INSIGHT_POSTER_HEIGHT)
  ctx.restore()
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)

  // ── Top chrome: section label + brand mark ──
  ctx.save()
  ctx.setFontSize(26)
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(CHROME_LABEL, LEFT_EDGE, CHROME_Y)
  ctx.setTextAlign('right')
  ctx.setFillStyle(PALETTE.textTertiary)
  ctx.fillText('JOYJOIN', RIGHT_EDGE, CHROME_Y)
  ctx.restore()

  // ── Archetype portrait (fail-open: skipped when the asset did not resolve) ──
  if (archetypeImagePath) {
    ctx.save()
    ctx.drawImage(
      archetypeImagePath,
      CENTER_X - PORTRAIT_SIZE / 2,
      PORTRAIT_Y,
      PORTRAIT_SIZE,
      PORTRAIT_SIZE,
    )
    ctx.restore()
  }

  // ── Display name ──
  ctx.save()
  ctx.setFontSize(52)
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(splitText(input.displayName, 14, 1)[0] ?? input.displayName, CENTER_X, NAME_Y)
  ctx.restore()

  // ── Archetype name ──
  if (input.archetypeName) {
    ctx.save()
    ctx.setFontSize(30)
    ctx.setFillStyle(accent)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(input.archetypeName, CENTER_X, ARCHETYPE_Y)
    ctx.restore()
  }

  // ── Insight lines (display order; reveal carries the peak typography) ──
  let cursorY = LINES_Y
  input.lines.forEach((line, index) => {
    const metrics = line.role === 'reveal' ? INSIGHT_POSTER_TEXT_METRICS.reveal : INSIGHT_POSTER_TEXT_METRICS.base
    if (index > 0) {
      cursorY += LINE_GAP
    }
    cursorY += drawTextBlock(ctx, {
      text: line.text,
      x: LEFT_EDGE,
      y: cursorY,
      maxCharsPerLine: metrics.maxCharsPerLine,
      maxLines: metrics.maxLines,
      lineHeight: metrics.lineHeight,
      fontSize: metrics.fontSize,
      color: line.role === 'reveal' ? accent : PALETTE.textBody,
    })
  })

  // ── Evidence (caption + dotted items, each single-line ellipsis) ──
  if (input.evidence.length > 0) {
    cursorY += EVIDENCE_GAP
    cursorY += drawTextBlock(ctx, {
      text: EVIDENCE_CAPTION,
      x: LEFT_EDGE,
      y: cursorY,
      maxCharsPerLine: 40,
      maxLines: 1,
      lineHeight: EVIDENCE_CAPTION_LINE_HEIGHT,
      fontSize: 24,
      color: PALETTE.textTertiary,
    })
    input.evidence.forEach((item) => {
      cursorY += EVIDENCE_ITEM_GAP
      ctx.save()
      ctx.setFillStyle(accent)
      ctx.beginPath()
      ctx.arc(LEFT_EDGE + 8, cursorY + EVIDENCE_LINE_HEIGHT / 2, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      cursorY += drawTextBlock(ctx, {
        text: item.text,
        x: LEFT_EDGE + 32,
        y: cursorY,
        maxCharsPerLine: 26,
        maxLines: 1,
        lineHeight: EVIDENCE_LINE_HEIGHT,
        fontSize: 30,
        color: PALETTE.textSecondary,
      })
    })
  }

  // ── AIGC label (baked iff ≥1 included aigc line AND the label flag is on) ──
  if (input.hasAigcLabel) {
    cursorY += AIGC_GAP
    ctx.save()
    ctx.setFontSize(24)
    ctx.setFillStyle(PALETTE.textTertiary)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(INSIGHT_POSTER_AIGC_LABEL, LEFT_EDGE, cursorY)
    ctx.restore()
    cursorY += AIGC_LINE_HEIGHT
  }

  // ── QR band (fail-open: without a QR temp file the band collapses to copy) ──
  const qrBandY = Math.max(cursorY + LINE_GAP, QR_BAND_MIN_Y)
  if (input.qrCodeImagePath) {
    ctx.save()
    ctx.drawImage(input.qrCodeImagePath, LEFT_EDGE, qrBandY, QR_SIZE, QR_SIZE)
    ctx.restore()
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(INSIGHT_POSTER_QR_COPY, LEFT_EDGE + QR_SIZE + 40, qrBandY + QR_SIZE / 2 - 20)
    ctx.restore()
  } else {
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(INSIGHT_POSTER_QR_COPY, CENTER_X, qrBandY + 40)
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
 * Generate the insight poster and return the exported temp file path.
 * Export inherits `exportCanvasWithRetry` semantics (DPR ≤2, retry, 60s
 * auto-unlink of the exported file). One generation per call — callers must
 * never reuse a previous temp file across taps.
 */
export async function generateInsightPoster(input: InsightPosterInput): Promise<string> {
  const archetypeImagePath = input.archetypeAsset
    ? await resolveImagePath(input.archetypeAsset)
    : ''

  const ctx = Taro.createCanvasContext(INSIGHT_POSTER_CANVAS_ID)
  drawInsightPosterContent(ctx, input, archetypeImagePath)

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
          INSIGHT_POSTER_CANVAS_ID,
          INSIGHT_POSTER_WIDTH,
          INSIGHT_POSTER_HEIGHT,
        )
        settled = true
        clearTimeout(timeout)
        // Release the backing store immediately after export (~27 MB).
        try {
          ctx.clearRect(0, 0, INSIGHT_POSTER_WIDTH, INSIGHT_POSTER_HEIGHT)
        } catch {
          // best-effort
        }
        logInfo('[InsightPoster] generated', { lineCount: input.lines.length })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}
